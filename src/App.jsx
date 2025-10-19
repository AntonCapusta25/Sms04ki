import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Send, Users, MessageSquare, Plus, Trash2, Edit, Menu, X, Clock, CheckCircle, XCircle, MessageCircle, Upload, Download } from 'lucide-react';
import { supabase } from './supabaseClient';
import { sendSMS } from './twilioService';
import * as XLSX from 'xlsx';

const App = () => {
  const [activeTab, setActiveTab] = useState('send');
  const [clients, setClients] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // Predefined variables for easy insertion
  const predefinedVariables = [
    { name: 'name', label: 'Name', icon: '👤' },
    { name: 'phone', label: 'Phone', icon: '📱' },
    { name: 'email', label: 'Email', icon: '📧' },
    { name: 'date', label: 'Date', icon: '📅' },
    { name: 'time', label: 'Time', icon: '🕐' },
    { name: 'appointment', label: 'Appointment', icon: '📆' },
    { name: 'service', label: 'Service', icon: '💼' },
    { name: 'price', label: 'Price', icon: '💰' },
    { name: 'location', label: 'Location', icon: '📍' },
    { name: 'link', label: 'Link', icon: '🔗' }
  ];

  // Form states
  const [selectedClient, setSelectedClient] = useState('');
  const [selectedClients, setSelectedClients] = useState([]);
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [messageContent, setMessageContent] = useState('');
  const [templateVariables, setTemplateVariables] = useState({});

  // Client form
  const [clientForm, setClientForm] = useState({ name: '', phone: '', email: '', status: 'active' });
  const [showClientForm, setShowClientForm] = useState(false);

  // Template form
  const [templateForm, setTemplateForm] = useState({ name: '', content: '', variables: '' });
  const [showTemplateForm, setShowTemplateForm] = useState(false);

  // Import file ref
  const fileInputRef = useRef(null);
  
  // Textarea refs for variable insertion
  const messageTextareaRef = useRef(null);
  const templateContentRef = useRef(null);

  useEffect(() => {
    fetchClients();
    fetchTemplates();
    fetchMessages();
  }, [fetchClients, fetchTemplates, fetchMessages]);

  const fetchClients = useCallback(async () => {
    const { data } = await supabase.from('clients').select('*').order('created_at', { ascending: false });
    setClients(data || []);
  }, []);

  const fetchTemplates = useCallback(async () => {
    const { data } = await supabase.from('templates').select('*').order('created_at', { ascending: false });
    setTemplates(data || []);
  }, []);

  const fetchMessages = useCallback(async () => {
    const { data } = await supabase
      .from('messages')
      .select('*, clients(name, phone)')
      .order('created_at', { ascending: false });
    setMessages(data || []);
  }, []);

  const addClient = useCallback(async () => {
    if (!clientForm.name || !clientForm.phone) return;
    await supabase.from('clients').insert([clientForm]);
    setClientForm({ name: '', phone: '', email: '', status: 'active' });
    setShowClientForm(false);
    fetchClients();
  }, [clientForm, fetchClients]);

  const deleteClient = useCallback(async (id) => {
    await supabase.from('clients').delete().eq('id', id);
    fetchClients();
  }, [fetchClients]);

  // Export clients to Excel
  const exportClients = useCallback(() => {
    // Map client data to match the template structure
    const exportData = clients.map(client => {
      const nameParts = client.name.split(' ');
      const firstName = nameParts[0] || '';
      const lastName = nameParts.slice(1).join(' ') || '';
      
      return {
        'Прізвище': lastName,
        "Ім'я": firstName,
        'Email': client.email || '',
        'Телефон': client.phone || '',
        'День народження': '',
        'Усього візитів': '',
        'Отриманий дохід': '',
        'Коментар': `Status: ${client.status}`,
        'Середній чек всього': '',
        'Дата створення': new Date(client.created_at).toLocaleDateString('uk-UA'),
        'ui.customers.address_city': '',
        'ui.customers.address_region': '',
        'ui.customers.address_postal_code': '',
        'ui.customers.address_line_one': '',
        'ui.customers.address_line_two': '',
        'ui.customers.company_name': '',
        'ui.customers.vat_number': ''
      };
    });

    // Create workbook and worksheet
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Clients');

    // Set column widths
    ws['!cols'] = [
      { wch: 15 }, // Last name
      { wch: 15 }, // First name
      { wch: 25 }, // Email
      { wch: 15 }, // Phone
      { wch: 12 }, // Birthday
      { wch: 12 }, // Total visits
      { wch: 15 }, // Revenue
      { wch: 20 }, // Comment
      { wch: 15 }, // Average check
      { wch: 12 }, // Created date
    ];

    // Generate and download file
    XLSX.writeFile(wb, `clients_export_${new Date().toISOString().split('T')[0]}.xlsx`);
  }, [clients]);

  // Import clients from Excel
  const handleImport = useCallback((e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const data = new Uint8Array(event.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet);

        let imported = 0;
        let skipped = 0;

        for (const row of jsonData) {
          const firstName = row["Ім'я"] || '';
          const lastName = row['Прізвище'] || '';
          const name = `${firstName} ${lastName}`.trim();
          const phone = row['Телефон'] || '';
          const email = row['Email'] || '';

          // Skip if no name or phone
          if (!name || !phone) {
            skipped++;
            continue;
          }

          // Check if client already exists
          const { data: existing } = await supabase
            .from('clients')
            .select('id')
            .eq('phone', phone)
            .single();

          if (existing) {
            // Update existing client
            await supabase
              .from('clients')
              .update({
                name,
                email: email || null,
                updated_at: new Date().toISOString()
              })
              .eq('phone', phone);
            imported++;
          } else {
            // Insert new client
            await supabase
              .from('clients')
              .insert({
                name,
                phone,
                email: email || null,
                status: 'active'
              });
            imported++;
          }
        }

        alert(`Import complete!\n✅ Imported/Updated: ${imported}\n⚠️ Skipped: ${skipped}`);
        fetchClients();
        
        // Reset file input
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      } catch (error) {
        console.error('Import error:', error);
        alert('Error importing file: ' + error.message);
      }
    };

    reader.readAsArrayBuffer(file);
  }, [fetchClients]);

  const addTemplate = useCallback(async () => {
    if (!templateForm.name || !templateForm.content) return;
    const variables = templateForm.variables.split(',').map(v => v.trim()).filter(v => v);
    await supabase.from('templates').insert([{ ...templateForm, variables }]);
    setTemplateForm({ name: '', content: '', variables: '' });
    setShowTemplateForm(false);
    fetchTemplates();
  }, [templateForm, fetchTemplates]);

  const deleteTemplate = useCallback(async (id) => {
    await supabase.from('templates').delete().eq('id', id);
    fetchTemplates();
  }, [fetchTemplates]);

  const handleTemplateSelect = useCallback((templateId) => {
    setSelectedTemplate(templateId);
    const template = templates.find(t => t.id === templateId);
    if (template) {
      setMessageContent(template.content);
      const vars = {};
      template.variables?.forEach(v => vars[v] = '');
      setTemplateVariables(vars);
    }
  }, [templates]);

  const replaceVariables = useCallback((content, variables) => {
    let result = content;
    Object.keys(variables).forEach(key => {
      result = result.replace(new RegExp(`{{${key}}}`, 'g'), variables[key]);
    });
    return result;
  }, []);

  const getPreviewMessage = useCallback(() => {
    if (!messageContent) return '';
    return replaceVariables(messageContent, templateVariables);
  }, [messageContent, templateVariables, replaceVariables]);

  // Insert variable into textarea at cursor position
  const insertVariable = useCallback((variableName, textareaRef) => {
    if (!textareaRef.current) return;
    
    const textarea = textareaRef.current;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = textarea.value;
    const before = text.substring(0, start);
    const after = text.substring(end);
    const variable = `{{${variableName}}}`;
    
    const newText = before + variable + after;
    const newCursorPos = start + variable.length;
    
    // Update the appropriate state based on which textarea
    if (textarea.name === 'messageContent') {
      setMessageContent(newText);
    } else if (textarea.name === 'templateContent') {
      setTemplateForm(prev => ({ ...prev, content: newText }));
    }
    
    // Set cursor position after state update
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(newCursorPos, newCursorPos);
    }, 0);
  }, []);

  // Handle drag start
  const handleDragStart = useCallback((e, variableName) => {
    e.dataTransfer.setData('variable', variableName);
    e.dataTransfer.effectAllowed = 'copy';
  }, []);

  // Handle drop
  const handleDrop = useCallback((e, textareaRef) => {
    e.preventDefault();
    const variableName = e.dataTransfer.getData('variable');
    if (variableName) {
      insertVariable(variableName, textareaRef);
    }
  }, [insertVariable]);

  // Prevent default drag over
  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  }, []);

  const handleSendSMS = async () => {
    if (!selectedClient || !messageContent) return;
    setLoading(true);
    try {
      const client = clients.find(c => c.id === selectedClient);
      const finalMessage = replaceVariables(messageContent, templateVariables);
      
      const result = await sendSMS(client.phone, finalMessage);
      
      await supabase.from('messages').insert([{
        client_id: client.id,
        template_id: selectedTemplate || null,
        phone: client.phone,
        content: finalMessage,
        status: result.success ? 'sent' : 'failed'
      }]);

      alert(result.success ? 'SMS sent successfully!' : 'Failed to send SMS');
      setSelectedClient('');
      setSelectedTemplate('');
      setMessageContent('');
      setTemplateVariables({});
      fetchMessages();
    } catch (error) {
      alert('Error sending SMS: ' + error.message);
    }
    setLoading(false);
  };

  const handleBatchSend = async () => {
    if (selectedClients.length === 0 || !messageContent) return;
    setLoading(true);
    
    for (const clientId of selectedClients) {
      const client = clients.find(c => c.id === clientId);
      const finalMessage = replaceVariables(messageContent, templateVariables);
      
      try {
        const result = await sendSMS(client.phone, finalMessage);
        
        await supabase.from('messages').insert([{
          client_id: client.id,
          template_id: selectedTemplate || null,
          phone: client.phone,
          content: finalMessage,
          status: result.success ? 'sent' : 'failed'
        }]);
      } catch (error) {
        console.error(`Failed to send to ${client.name}:`, error);
      }
    }
    
    alert(`Batch send complete! Sent to ${selectedClients.length} clients`);
    setSelectedClients([]);
    setSelectedTemplate('');
    setMessageContent('');
    setTemplateVariables({});
    fetchMessages();
    setLoading(false);
  };

  const toggleClientSelection = (clientId) => {
    setSelectedClients(prev =>
      prev.includes(clientId) ? prev.filter(id => id !== clientId) : [...prev, clientId]
    );
  };

  const selectAllClients = () => {
    const activeClients = clients.filter(c => c.status === 'active').map(c => c.id);
    setSelectedClients(activeClients);
  };

  const deselectAllClients = () => {
    setSelectedClients([]);
  };

  // Sidebar Navigation
  const SidebarNav = () => (
    <div className={`${sidebarOpen ? 'w-64' : 'w-20'} bg-[#2E2F33] h-full transition-all duration-300 flex flex-col`}>
      <div className="p-6 flex items-center justify-between border-b border-gray-700">
        {sidebarOpen && <h1 className="text-xl font-bold text-white">SMS Platform</h1>}
        <button onClick={() => setSidebarOpen(!sidebarOpen)} className="text-gray-400 hover:text-white">
          {sidebarOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>
      
      <nav className="flex-1 p-4">
        <NavItem icon={<Send size={20} />} label="Send SMS" active={activeTab === 'send'} onClick={() => setActiveTab('send')} collapsed={!sidebarOpen} />
        <NavItem icon={<MessageCircle size={20} />} label="Batch Send" active={activeTab === 'batch'} onClick={() => setActiveTab('batch')} collapsed={!sidebarOpen} />
        <NavItem icon={<Users size={20} />} label="Clients" active={activeTab === 'clients'} onClick={() => setActiveTab('clients')} collapsed={!sidebarOpen} />
        <NavItem icon={<MessageSquare size={20} />} label="Templates" active={activeTab === 'templates'} onClick={() => setActiveTab('templates')} collapsed={!sidebarOpen} />
        <NavItem icon={<Clock size={20} />} label="History" active={activeTab === 'history'} onClick={() => setActiveTab('history')} collapsed={!sidebarOpen} />
      </nav>
    </div>
  );

  const NavItem = ({ icon, label, active, onClick, collapsed }) => (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg mb-2 transition-all ${
        active ? 'bg-[#56AF40] text-white' : 'text-gray-400 hover:bg-[#1E1E21] hover:text-white'
      }`}
    >
      {icon}
      {!collapsed && <span className="font-medium">{label}</span>}
    </button>
  );

  // Variable Pills Component
  const VariablePills = ({ onInsert, textareaRef }) => (
    <div className="bg-[#1E1E21] p-4 rounded-lg border border-gray-700">
      <h3 className="text-sm font-medium text-gray-300 mb-3">📌 Quick Variables (Drag or Click)</h3>
      <div className="flex flex-wrap gap-2">
        {predefinedVariables.map(variable => (
          <button
            key={variable.name}
            draggable
            onDragStart={(e) => handleDragStart(e, variable.name)}
            onClick={() => insertVariable(variable.name, textareaRef)}
            className="flex items-center gap-2 px-3 py-2 bg-[#2E2F33] text-white rounded-lg border border-gray-600 hover:bg-[#56AF40] hover:border-[#56AF40] transition-all cursor-move"
            title={`Click to insert or drag & drop {{${variable.name}}}`}
          >
            <span>{variable.icon}</span>
            <span className="text-sm">{variable.label}</span>
          </button>
        ))}
      </div>
      <p className="text-xs text-gray-500 mt-3">💡 Tip: Click to insert at cursor, or drag & drop into the text area below</p>
    </div>
  );

  // Send SMS Tab
  const SendSMSTab = () => (
    <div className="space-y-6">
      <div className="bg-[#2E2F33] rounded-lg p-6 shadow-lg">
        <h2 className="text-xl font-semibold mb-6 text-white">Send SMS Message</h2>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Select Client</label>
            <select
              value={selectedClient}
              onChange={(e) => setSelectedClient(e.target.value)}
              className="w-full px-4 py-3 bg-[#1E1E21] border border-gray-700 rounded-lg text-white focus:outline-none focus:border-[#56AF40]"
            >
              <option value="">Choose a client</option>
              {clients.filter(c => c.status === 'active').map(client => (
                <option key={client.id} value={client.id}>{client.name} - {client.phone}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Template (Optional)</label>
            <select
              value={selectedTemplate}
              onChange={(e) => handleTemplateSelect(e.target.value)}
              className="w-full px-4 py-3 bg-[#1E1E21] border border-gray-700 rounded-lg text-white focus:outline-none focus:border-[#56AF40]"
            >
              <option value="">Choose a template</option>
              {templates.map(template => (
                <option key={template.id} value={template.id}>{template.name}</option>
              ))}
            </select>
          </div>

          {selectedTemplate && templates.find(t => t.id === selectedTemplate)?.variables?.length > 0 && (
            <div className="bg-[#1E1E21] p-4 rounded-lg border border-gray-700">
              <h3 className="text-sm font-medium text-gray-300 mb-3">Template Variables</h3>
              {templates.find(t => t.id === selectedTemplate).variables.map(variable => (
                <div key={variable} className="mb-3">
                  <label className="block text-sm text-gray-400 mb-1">{variable}</label>
                  <input
                    type="text"
                    value={templateVariables[variable] || ''}
                    onChange={(e) => setTemplateVariables({...templateVariables, [variable]: e.target.value})}
                    className="w-full px-3 py-2 bg-[#2E2F33] border border-gray-700 rounded text-white focus:outline-none focus:border-[#56AF40]"
                  />
                </div>
              ))}
            </div>
          )}

          <VariablePills textareaRef={messageTextareaRef} />

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Message</label>
            <textarea
              ref={messageTextareaRef}
              name="messageContent"
              value={messageContent}
              onChange={(e) => setMessageContent(e.target.value)}
              onDrop={(e) => handleDrop(e, messageTextareaRef)}
              onDragOver={handleDragOver}
              rows={5}
              className="w-full px-4 py-3 bg-[#1E1E21] border border-gray-700 rounded-lg text-white focus:outline-none focus:border-[#56AF40] transition-colors"
              placeholder="Type your message or drag variables here..."
            />
            <p className="text-xs text-gray-500 mt-1">💡 Use {{`{variable}`}} syntax or drag from above</p>
          </div>

          {messageContent && Object.keys(templateVariables).length > 0 && (
            <div className="bg-[#1E1E21] p-4 rounded-lg border border-gray-700">
              <h3 className="text-sm font-medium text-gray-300 mb-2">Preview</h3>
              <p className="text-gray-400 whitespace-pre-wrap">{getPreviewMessage()}</p>
            </div>
          )}

          <button
            onClick={handleSendSMS}
            disabled={loading || !selectedClient || !messageContent}
            className="w-full bg-[#56AF40] text-white px-6 py-3 rounded-lg font-medium hover:bg-[#4a9636] disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? 'Sending...' : 'Send SMS'}
          </button>
        </div>
      </div>
    </div>
  );

  // Batch Send Tab
  const BatchSendTab = () => (
    <div className="space-y-6">
      <div className="bg-[#2E2F33] rounded-lg p-6 shadow-lg">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-white">Batch Send SMS</h2>
          <div className="flex gap-2">
            <button
              onClick={selectAllClients}
              className="px-4 py-2 bg-[#1E1E21] text-gray-300 rounded-lg hover:bg-[#56AF40] hover:text-white transition-colors text-sm"
            >
              Select All
            </button>
            <button
              onClick={deselectAllClients}
              className="px-4 py-2 bg-[#1E1E21] text-gray-300 rounded-lg hover:bg-red-600 hover:text-white transition-colors text-sm"
            >
              Deselect All
            </button>
          </div>
        </div>

        <div className="mb-6 bg-[#1E1E21] rounded-lg border border-gray-700 max-h-64 overflow-y-auto">
          <div className="p-4">
            <h3 className="text-sm font-medium text-gray-300 mb-3">Select Clients ({selectedClients.length} selected)</h3>
            {clients.filter(c => c.status === 'active').map(client => (
              <label key={client.id} className="flex items-center gap-3 p-3 hover:bg-[#2E2F33] rounded-lg cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedClients.includes(client.id)}
                  onChange={() => toggleClientSelection(client.id)}
                  className="w-4 h-4"
                />
                <div>
                  <p className="text-white font-medium">{client.name}</p>
                  <p className="text-gray-400 text-sm">{client.phone}</p>
                </div>
              </label>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Template (Optional)</label>
            <select
              value={selectedTemplate}
              onChange={(e) => handleTemplateSelect(e.target.value)}
              className="w-full px-4 py-3 bg-[#1E1E21] border border-gray-700 rounded-lg text-white focus:outline-none focus:border-[#56AF40]"
            >
              <option value="">Choose a template</option>
              {templates.map(template => (
                <option key={template.id} value={template.id}>{template.name}</option>
              ))}
            </select>
          </div>

          {selectedTemplate && templates.find(t => t.id === selectedTemplate)?.variables?.length > 0 && (
            <div className="bg-[#1E1E21] p-4 rounded-lg border border-gray-700">
              <h3 className="text-sm font-medium text-gray-300 mb-3">Template Variables</h3>
              {templates.find(t => t.id === selectedTemplate).variables.map(variable => (
                <div key={variable} className="mb-3">
                  <label className="block text-sm text-gray-400 mb-1">{variable}</label>
                  <input
                    type="text"
                    value={templateVariables[variable] || ''}
                    onChange={(e) => setTemplateVariables({...templateVariables, [variable]: e.target.value})}
                    className="w-full px-3 py-2 bg-[#2E2F33] border border-gray-700 rounded text-white focus:outline-none focus:border-[#56AF40]"
                  />
                </div>
              ))}
            </div>
          )}

          <VariablePills textareaRef={messageTextareaRef} />

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Message</label>
            <textarea
              ref={messageTextareaRef}
              name="messageContent"
              value={messageContent}
              onChange={(e) => setMessageContent(e.target.value)}
              onDrop={(e) => handleDrop(e, messageTextareaRef)}
              onDragOver={handleDragOver}
              rows={5}
              className="w-full px-4 py-3 bg-[#1E1E21] border border-gray-700 rounded-lg text-white focus:outline-none focus:border-[#56AF40] transition-colors"
              placeholder="Type your message or drag variables here..."
            />
            <p className="text-xs text-gray-500 mt-1">💡 Use {{`{variable}`}} syntax or drag from above</p>
          </div>

          <button
            onClick={handleBatchSend}
            disabled={loading || selectedClients.length === 0 || !messageContent}
            className="w-full bg-[#56AF40] text-white px-6 py-3 rounded-lg font-medium hover:bg-[#4a9636] disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? 'Sending...' : `Send to ${selectedClients.length} Clients`}
          </button>
        </div>
      </div>
    </div>
  );

  // Clients Tab
  const ClientsTab = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold text-white">Clients</h2>
        <div className="flex gap-3">
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx, .xls"
            onChange={handleImport}
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2 bg-[#1E1E21] text-gray-300 px-4 py-2 rounded-lg hover:bg-[#56AF40] hover:text-white transition-colors"
          >
            <Upload size={20} />
            Import
          </button>
          <button
            onClick={exportClients}
            className="flex items-center gap-2 bg-[#1E1E21] text-gray-300 px-4 py-2 rounded-lg hover:bg-[#56AF40] hover:text-white transition-colors"
          >
            <Download size={20} />
            Export
          </button>
          <button
            onClick={() => setShowClientForm(!showClientForm)}
            className="flex items-center gap-2 bg-[#56AF40] text-white px-4 py-2 rounded-lg hover:bg-[#4a9636] transition-colors"
          >
            <Plus size={20} />
            Add Client
          </button>
        </div>
      </div>

      {showClientForm && (
        <div className="bg-[#2E2F33] rounded-lg p-6 shadow-lg">
          <h3 className="text-lg font-semibold text-white mb-4">New Client</h3>
          <div className="space-y-4">
            <input
              type="text"
              placeholder="Name"
              value={clientForm.name}
              onChange={(e) => setClientForm({...clientForm, name: e.target.value})}
              className="w-full px-4 py-3 bg-[#1E1E21] border border-gray-700 rounded-lg text-white focus:outline-none focus:border-[#56AF40]"
            />
            <input
              type="tel"
              placeholder="Phone (E.164 format: +1234567890)"
              value={clientForm.phone}
              onChange={(e) => setClientForm({...clientForm, phone: e.target.value})}
              className="w-full px-4 py-3 bg-[#1E1E21] border border-gray-700 rounded-lg text-white focus:outline-none focus:border-[#56AF40]"
            />
            <input
              type="email"
              placeholder="Email (optional)"
              value={clientForm.email}
              onChange={(e) => setClientForm({...clientForm, email: e.target.value})}
              className="w-full px-4 py-3 bg-[#1E1E21] border border-gray-700 rounded-lg text-white focus:outline-none focus:border-[#56AF40]"
            />
            <select
              value={clientForm.status}
              onChange={(e) => setClientForm({...clientForm, status: e.target.value})}
              className="w-full px-4 py-3 bg-[#1E1E21] border border-gray-700 rounded-lg text-white focus:outline-none focus:border-[#56AF40]"
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="blocked">Blocked</option>
            </select>
            <div className="flex gap-3">
              <button
                onClick={addClient}
                className="flex-1 bg-[#56AF40] text-white px-4 py-2 rounded-lg hover:bg-[#4a9636] transition-colors"
              >
                Add Client
              </button>
              <button
                onClick={() => {
                  setShowClientForm(false);
                  setClientForm({ name: '', phone: '', email: '', status: 'active' });
                }}
                className="flex-1 bg-[#1E1E21] text-gray-300 px-4 py-2 rounded-lg hover:bg-gray-700 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="grid gap-4">
        {clients.map(client => (
          <div key={client.id} className="bg-[#2E2F33] rounded-lg p-6 shadow-lg hover:shadow-xl transition-shadow">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-white mb-2">{client.name}</h3>
                <p className="text-gray-400 mb-1">{client.phone}</p>
                {client.email && <p className="text-gray-400 mb-2">{client.email}</p>}
                <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${
                  client.status === 'active' ? 'bg-[#56AF40] text-white' :
                  client.status === 'inactive' ? 'bg-gray-600 text-gray-300' :
                  'bg-red-600 text-white'
                }`}>
                  {client.status}
                </span>
              </div>
              <button
                onClick={() => deleteClient(client.id)}
                className="text-red-400 hover:text-red-300 transition-colors"
              >
                <Trash2 size={20} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  // Templates Tab
  const TemplatesTab = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold text-white">Message Templates</h2>
        <button
          onClick={() => setShowTemplateForm(!showTemplateForm)}
          className="flex items-center gap-2 bg-[#56AF40] text-white px-4 py-2 rounded-lg hover:bg-[#4a9636] transition-colors"
        >
          <Plus size={20} />
          Add Template
        </button>
      </div>

      {showTemplateForm && (
        <div className="bg-[#2E2F33] rounded-lg p-6 shadow-lg">
          <h3 className="text-lg font-semibold text-white mb-4">New Template</h3>
          <div className="space-y-4">
            <input
              type="text"
              placeholder="Template Name"
              value={templateForm.name}
              onChange={(e) => setTemplateForm({...templateForm, name: e.target.value})}
              className="w-full px-4 py-3 bg-[#1E1E21] border border-gray-700 rounded-lg text-white focus:outline-none focus:border-[#56AF40]"
            />
            
            <VariablePills textareaRef={templateContentRef} />
            
            <div>
              <textarea
                ref={templateContentRef}
                name="templateContent"
                placeholder="Message content - drag variables from above or type {{variable}}"
                value={templateForm.content}
                onChange={(e) => setTemplateForm({...templateForm, content: e.target.value})}
                onDrop={(e) => handleDrop(e, templateContentRef)}
                onDragOver={handleDragOver}
                rows={5}
                className="w-full px-4 py-3 bg-[#1E1E21] border border-gray-700 rounded-lg text-white focus:outline-none focus:border-[#56AF40] transition-colors"
              />
              <p className="text-xs text-gray-500 mt-1">💡 Variables used will be auto-detected</p>
            </div>
            
            <input
              type="text"
              placeholder="Variables (optional - auto-detected from {{variable}} syntax)"
              value={templateForm.variables}
              onChange={(e) => setTemplateForm({...templateForm, variables: e.target.value})}
              className="w-full px-4 py-3 bg-[#1E1E21] border border-gray-700 rounded-lg text-white focus:outline-none focus:border-[#56AF40]"
            />
            <div className="flex gap-3">
              <button
                onClick={addTemplate}
                className="flex-1 bg-[#56AF40] text-white px-4 py-2 rounded-lg hover:bg-[#4a9636] transition-colors"
              >
                Add Template
              </button>
              <button
                onClick={() => {
                  setShowTemplateForm(false);
                  setTemplateForm({ name: '', content: '', variables: '' });
                }}
                className="flex-1 bg-[#1E1E21] text-gray-300 px-4 py-2 rounded-lg hover:bg-gray-700 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="grid gap-4">
        {templates.map(template => (
          <div key={template.id} className="bg-[#2E2F33] rounded-lg p-6 shadow-lg hover:shadow-xl transition-shadow">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-white mb-2">{template.name}</h3>
                <p className="text-gray-400 mb-3 whitespace-pre-wrap">{template.content}</p>
                {template.variables && template.variables.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {template.variables.map(variable => (
                      <span key={variable} className="px-3 py-1 bg-[#1E1E21] text-[#56AF40] rounded-full text-xs font-medium">
                        {variable}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <button
                onClick={() => deleteTemplate(template.id)}
                className="text-red-400 hover:text-red-300 transition-colors"
              >
                <Trash2 size={20} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  // History Tab
  const HistoryTab = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold text-white">Message History</h2>
        <button
          onClick={fetchMessages}
          className="flex items-center gap-2 bg-[#56AF40] text-white px-4 py-2 rounded-lg hover:bg-[#4a9636] transition-colors"
        >
          <Clock size={20} />
          Refresh
        </button>
      </div>

      <div className="space-y-4">
        {messages.map(message => (
          <div key={message.id} className="bg-[#2E2F33] rounded-lg p-6 shadow-lg hover:shadow-xl transition-shadow">
            <div className="flex items-start justify-between mb-3">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <h3 className="text-lg font-semibold text-white">
                    {message.clients?.name || 'Unknown Client'}
                  </h3>
                  <span className={`flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium ${
                    message.status === 'sent' ? 'bg-[#56AF40] text-white' :
                    message.status === 'delivered' ? 'bg-blue-600 text-white' :
                    message.status === 'failed' ? 'bg-red-600 text-white' :
                    'bg-gray-600 text-gray-300'
                  }`}>
                    {message.status === 'sent' && <CheckCircle size={14} />}
                    {message.status === 'delivered' && <CheckCircle size={14} />}
                    {message.status === 'failed' && <XCircle size={14} />}
                    {message.status}
                  </span>
                </div>
                <p className="text-gray-400 text-sm mb-1">{message.phone}</p>
                <p className="text-gray-300 mb-2 whitespace-pre-wrap">{message.content}</p>
                <p className="text-gray-500 text-xs">
                  {new Date(message.created_at).toLocaleString()}
                </p>
              </div>
            </div>
          </div>
        ))}
        {messages.length === 0 && (
          <div className="bg-[#2E2F33] rounded-lg p-12 text-center">
            <MessageSquare size={48} className="mx-auto text-gray-600 mb-4" />
            <p className="text-gray-400">No messages sent yet</p>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="flex h-screen bg-[#1E1E21] overflow-hidden">
      <SidebarNav />
      
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="bg-[#2E2F33] border-b border-gray-700 px-8 py-4">
          <h1 className="text-2xl font-bold text-white">
            {activeTab === 'send' && 'Send SMS'}
            {activeTab === 'batch' && 'Batch Send'}
            {activeTab === 'clients' && 'Clients Management'}
            {activeTab === 'templates' && 'Message Templates'}
            {activeTab === 'history' && 'Message History'}
          </h1>
        </div>

        {/* Main Content */}
        <div className="flex-1 overflow-y-auto p-8">
          {activeTab === 'send' && <SendSMSTab />}
          {activeTab === 'batch' && <BatchSendTab />}
          {activeTab === 'clients' && <ClientsTab />}
          {activeTab === 'templates' && <TemplatesTab />}
          {activeTab === 'history' && <HistoryTab />}
        </div>
      </div>
    </div>
  );
};

export default App;

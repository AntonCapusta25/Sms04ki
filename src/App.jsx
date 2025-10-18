import React, { useState, useEffect } from 'react';
import { Send, Users, MessageSquare, Plus, Trash2, Edit, Eye } from 'lucide-react';
import { supabase } from './supabaseClient';
import { sendSMS } from './twilioService';

const App = () => {
  const [activeTab, setActiveTab] = useState('send');
  const [clients, setClients] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);

  // Form states
  const [selectedClient, setSelectedClient] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [messageContent, setMessageContent] = useState('');
  const [templateVariables, setTemplateVariables] = useState({});

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    await Promise.all([
      loadClients(),
      loadTemplates(),
      loadMessages()
    ]);
    setLoading(false);
  };

  const loadClients = async () => {
    const { data, error } = await supabase
      .from('clients')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (!error) setClients(data || []);
  };

  const loadTemplates = async () => {
    const { data, error } = await supabase
      .from('templates')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (!error) setTemplates(data || []);
  };

  const loadMessages = async () => {
    const { data, error } = await supabase
      .from('messages')
      .select(`
        *,
        clients (name, phone)
      `)
      .order('created_at', { ascending: false })
      .limit(50);
    
    if (!error) setMessages(data || []);
  };

  const handleTemplateSelect = (templateId) => {
    setSelectedTemplate(templateId);
    const template = templates.find(t => t.id === templateId);
    
    if (template) {
      let content = template.content;
      
      // Replace variables with empty placeholders for user to fill
      if (template.variables && template.variables.length > 0) {
        const vars = {};
        template.variables.forEach(varName => {
          vars[varName] = '';
        });
        setTemplateVariables(vars);
      }
      
      setMessageContent(content);
    }
  };

  const replaceVariables = (content, variables) => {
    let result = content;
    Object.keys(variables).forEach(key => {
      const regex = new RegExp(`{{${key}}}`, 'g');
      result = result.replace(regex, variables[key] || `{{${key}}}`);
    });
    return result;
  };

  const handleSendSMS = async () => {
    if (!selectedClient || !messageContent) {
      alert('Please select a client and enter a message');
      return;
    }

    const client = clients.find(c => c.id === selectedClient);
    if (!client) {
      alert('Client not found');
      return;
    }

    if (client.status !== 'active') {
      alert('Cannot send SMS to inactive or blocked clients');
      return;
    }

    setLoading(true);

    try {
      // Replace variables in message content
      const finalContent = replaceVariables(messageContent, templateVariables);

      // Send SMS via Twilio
      const result = await sendSMS(client.phone, finalContent);

      // Save message to database
      const { error } = await supabase
        .from('messages')
        .insert({
          client_id: selectedClient,
          template_id: selectedTemplate || null,
          phone: client.phone,
          content: finalContent,
          status: result.success ? 'sent' : 'failed',
          twilio_sid: result.sid,
          error_message: result.error,
          sent_at: result.success ? new Date().toISOString() : null
        });

      if (!error) {
        alert(result.success ? 'SMS sent successfully!' : `Failed to send SMS: ${result.error}`);
        
        // Reset form
        setSelectedClient('');
        setSelectedTemplate('');
        setMessageContent('');
        setTemplateVariables({});
        
        // Reload messages
        loadMessages();
      }
    } catch (error) {
      alert('Error sending SMS: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <h1 className="text-3xl font-bold text-gray-900">SMS Sender</h1>
          <p className="text-gray-600">Manage clients, templates, and send SMS messages</p>
        </div>
      </header>

      {/* Navigation Tabs */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6">
        <nav className="flex space-x-4 border-b border-gray-200">
          <button
            onClick={() => setActiveTab('send')}
            className={`px-4 py-2 font-medium text-sm flex items-center gap-2 border-b-2 transition-colors ${
              activeTab === 'send'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            <Send size={18} />
            Send SMS
          </button>
          <button
            onClick={() => setActiveTab('clients')}
            className={`px-4 py-2 font-medium text-sm flex items-center gap-2 border-b-2 transition-colors ${
              activeTab === 'clients'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            <Users size={18} />
            Clients
          </button>
          <button
            onClick={() => setActiveTab('templates')}
            className={`px-4 py-2 font-medium text-sm flex items-center gap-2 border-b-2 transition-colors ${
              activeTab === 'templates'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            <MessageSquare size={18} />
            Templates
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`px-4 py-2 font-medium text-sm flex items-center gap-2 border-b-2 transition-colors ${
              activeTab === 'history'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            <Eye size={18} />
            Message History
          </button>
        </nav>
      </div>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'send' && (
          <SendSMSTab
            clients={clients}
            templates={templates}
            selectedClient={selectedClient}
            setSelectedClient={setSelectedClient}
            selectedTemplate={selectedTemplate}
            handleTemplateSelect={handleTemplateSelect}
            messageContent={messageContent}
            setMessageContent={setMessageContent}
            templateVariables={templateVariables}
            setTemplateVariables={setTemplateVariables}
            handleSendSMS={handleSendSMS}
            loading={loading}
            replaceVariables={replaceVariables}
          />
        )}

        {activeTab === 'clients' && (
          <ClientsTab
            clients={clients}
            loadClients={loadClients}
          />
        )}

        {activeTab === 'templates' && (
          <TemplatesTab
            templates={templates}
            loadTemplates={loadTemplates}
          />
        )}

        {activeTab === 'history' && (
          <MessageHistoryTab
            messages={messages}
            loadMessages={loadMessages}
          />
        )}
      </main>
    </div>
  );
};

// Send SMS Tab Component
const SendSMSTab = ({
  clients,
  templates,
  selectedClient,
  setSelectedClient,
  selectedTemplate,
  handleTemplateSelect,
  messageContent,
  setMessageContent,
  templateVariables,
  setTemplateVariables,
  handleSendSMS,
  loading,
  replaceVariables
}) => {
  const activeClients = clients.filter(c => c.status === 'active');
  const selectedTemplateData = templates.find(t => t.id === selectedTemplate);

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-2xl font-semibold mb-6">Send SMS Message</h2>

      <div className="space-y-6">
        {/* Client Selection */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Select Client
          </label>
          <select
            value={selectedClient}
            onChange={(e) => setSelectedClient(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">-- Choose a client --</option>
            {activeClients.map(client => (
              <option key={client.id} value={client.id}>
                {client.name} ({client.phone})
              </option>
            ))}
          </select>
          {activeClients.length === 0 && (
            <p className="text-sm text-red-600 mt-1">No active clients available</p>
          )}
        </div>

        {/* Template Selection */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Select Template (Optional)
          </label>
          <select
            value={selectedTemplate}
            onChange={(e) => handleTemplateSelect(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">-- Choose a template --</option>
            {templates.map(template => (
              <option key={template.id} value={template.id}>
                {template.name}
              </option>
            ))}
          </select>
        </div>

        {/* Template Variables */}
        {selectedTemplateData && selectedTemplateData.variables && selectedTemplateData.variables.length > 0 && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Template Variables
            </label>
            <div className="space-y-2">
              {selectedTemplateData.variables.map(varName => (
                <div key={varName}>
                  <label className="block text-xs text-gray-600 mb-1">
                    {varName}
                  </label>
                  <input
                    type="text"
                    value={templateVariables[varName] || ''}
                    onChange={(e) => setTemplateVariables({
                      ...templateVariables,
                      [varName]: e.target.value
                    })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder={`Enter ${varName}`}
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Message Content */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Message Content
          </label>
          <textarea
            value={messageContent}
            onChange={(e) => setMessageContent(e.target.value)}
            rows={6}
            className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Type your message here..."
          />
          <p className="text-sm text-gray-500 mt-1">
            Character count: {messageContent.length}
          </p>
        </div>

        {/* Preview */}
        {selectedTemplateData && Object.keys(templateVariables).length > 0 && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Preview
            </label>
            <div className="bg-gray-50 p-4 rounded-md border border-gray-200">
              <p className="text-sm text-gray-700 whitespace-pre-wrap">
                {replaceVariables(messageContent, templateVariables)}
              </p>
            </div>
          </div>
        )}

        {/* Send Button */}
        <button
          onClick={handleSendSMS}
          disabled={loading || !selectedClient || !messageContent}
          className="w-full bg-blue-600 text-white py-3 px-6 rounded-md font-medium hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
        >
          <Send size={20} />
          {loading ? 'Sending...' : 'Send SMS'}
        </button>
      </div>
    </div>
  );
};

// Clients Tab Component
const ClientsTab = ({ clients, loadClients }) => {
  const [showForm, setShowForm] = useState(false);
  const [editingClient, setEditingClient] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    status: 'active'
  });

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (editingClient) {
      const { error } = await supabase
        .from('clients')
        .update(formData)
        .eq('id', editingClient.id);

      if (!error) {
        alert('Client updated successfully!');
        resetForm();
        loadClients();
      }
    } else {
      const { error } = await supabase
        .from('clients')
        .insert([formData]);

      if (!error) {
        alert('Client added successfully!');
        resetForm();
        loadClients();
      }
    }
  };

  const handleEdit = (client) => {
    setEditingClient(client);
    setFormData({
      name: client.name,
      phone: client.phone,
      email: client.email || '',
      status: client.status
    });
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this client?')) {
      const { error } = await supabase
        .from('clients')
        .delete()
        .eq('id', id);

      if (!error) {
        alert('Client deleted successfully!');
        loadClients();
      }
    }
  };

  const resetForm = () => {
    setFormData({ name: '', phone: '', email: '', status: 'active' });
    setEditingClient(null);
    setShowForm(false);
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800';
      case 'inactive':
        return 'bg-gray-100 text-gray-800';
      case 'blocked':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-semibold">Clients</h2>
        <button
          onClick={() => setShowForm(!showForm)}
          className="bg-blue-600 text-white py-2 px-4 rounded-md font-medium hover:bg-blue-700 transition-colors flex items-center gap-2"
        >
          <Plus size={20} />
          Add Client
        </button>
      </div>

      {/* Add/Edit Form */}
      {showForm && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-xl font-semibold mb-4">
            {editingClient ? 'Edit Client' : 'Add New Client'}
          </h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Name *
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Phone *
              </label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                required
                placeholder="+1234567890"
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email
              </label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Status *
              </label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="blocked">Blocked</option>
              </select>
            </div>

            <div className="flex gap-2">
              <button
                type="submit"
                className="bg-blue-600 text-white py-2 px-4 rounded-md font-medium hover:bg-blue-700 transition-colors"
              >
                {editingClient ? 'Update' : 'Add'} Client
              </button>
              <button
                type="button"
                onClick={resetForm}
                className="bg-gray-300 text-gray-700 py-2 px-4 rounded-md font-medium hover:bg-gray-400 transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Clients List */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Name
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Phone
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Email
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {clients.map((client) => (
              <tr key={client.id}>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                  {client.name}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {client.phone}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {client.email || '-'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(client.status)}`}>
                    {client.status}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                  <button
                    onClick={() => handleEdit(client)}
                    className="text-blue-600 hover:text-blue-900 mr-3"
                  >
                    <Edit size={18} />
                  </button>
                  <button
                    onClick={() => handleDelete(client.id)}
                    className="text-red-600 hover:text-red-900"
                  >
                    <Trash2 size={18} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {clients.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            No clients found. Add your first client to get started.
          </div>
        )}
      </div>
    </div>
  );
};

// Templates Tab Component
const TemplatesTab = ({ templates, loadTemplates }) => {
  const [showForm, setShowForm] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    content: '',
    variables: ''
  });

  const handleSubmit = async (e) => {
    e.preventDefault();

    const variablesArray = formData.variables
      .split(',')
      .map(v => v.trim())
      .filter(v => v.length > 0);

    const templateData = {
      name: formData.name,
      content: formData.content,
      variables: variablesArray
    };

    if (editingTemplate) {
      const { error } = await supabase
        .from('templates')
        .update(templateData)
        .eq('id', editingTemplate.id);

      if (!error) {
        alert('Template updated successfully!');
        resetForm();
        loadTemplates();
      }
    } else {
      const { error } = await supabase
        .from('templates')
        .insert([templateData]);

      if (!error) {
        alert('Template added successfully!');
        resetForm();
        loadTemplates();
      }
    }
  };

  const handleEdit = (template) => {
    setEditingTemplate(template);
    setFormData({
      name: template.name,
      content: template.content,
      variables: (template.variables || []).join(', ')
    });
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this template?')) {
      const { error } = await supabase
        .from('templates')
        .delete()
        .eq('id', id);

      if (!error) {
        alert('Template deleted successfully!');
        loadTemplates();
      }
    }
  };

  const resetForm = () => {
    setFormData({ name: '', content: '', variables: '' });
    setEditingTemplate(null);
    setShowForm(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-semibold">Message Templates</h2>
        <button
          onClick={() => setShowForm(!showForm)}
          className="bg-blue-600 text-white py-2 px-4 rounded-md font-medium hover:bg-blue-700 transition-colors flex items-center gap-2"
        >
          <Plus size={20} />
          Add Template
        </button>
      </div>

      {/* Add/Edit Form */}
      {showForm && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-xl font-semibold mb-4">
            {editingTemplate ? 'Edit Template' : 'Add New Template'}
          </h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Template Name *
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Message Content *
              </label>
              <textarea
                value={formData.content}
                onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                required
                rows={4}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Hi {{name}}, your appointment is on {{date}}."
              />
              <p className="text-xs text-gray-500 mt-1">
                Use {`{{variable_name}}`} for variables
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Variables (comma-separated)
              </label>
              <input
                type="text"
                value={formData.variables}
                onChange={(e) => setFormData({ ...formData, variables: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="name, date, time"
              />
              <p className="text-xs text-gray-500 mt-1">
                Enter variable names that match those in your template
              </p>
            </div>

            <div className="flex gap-2">
              <button
                type="submit"
                className="bg-blue-600 text-white py-2 px-4 rounded-md font-medium hover:bg-blue-700 transition-colors"
              >
                {editingTemplate ? 'Update' : 'Add'} Template
              </button>
              <button
                type="button"
                onClick={resetForm}
                className="bg-gray-300 text-gray-700 py-2 px-4 rounded-md font-medium hover:bg-gray-400 transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Templates List */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {templates.map((template) => (
          <div key={template.id} className="bg-white rounded-lg shadow p-6">
            <div className="flex justify-between items-start mb-3">
              <h3 className="text-lg font-semibold text-gray-900">{template.name}</h3>
              <div className="flex gap-2">
                <button
                  onClick={() => handleEdit(template)}
                  className="text-blue-600 hover:text-blue-900"
                >
                  <Edit size={18} />
                </button>
                <button
                  onClick={() => handleDelete(template.id)}
                  className="text-red-600 hover:text-red-900"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            </div>
            <p className="text-sm text-gray-600 mb-3 whitespace-pre-wrap">{template.content}</p>
            {template.variables && template.variables.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {template.variables.map((variable, idx) => (
                  <span
                    key={idx}
                    className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full"
                  >
                    {variable}
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
      {templates.length === 0 && (
        <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
          No templates found. Add your first template to get started.
        </div>
      )}
    </div>
  );
};

// Message History Tab Component
const MessageHistoryTab = ({ messages, loadMessages }) => {
  const getStatusColor = (status) => {
    switch (status) {
      case 'sent':
        return 'bg-green-100 text-green-800';
      case 'delivered':
        return 'bg-blue-100 text-blue-800';
      case 'failed':
        return 'bg-red-100 text-red-800';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-semibold">Message History</h2>
        <button
          onClick={loadMessages}
          className="bg-blue-600 text-white py-2 px-4 rounded-md font-medium hover:bg-blue-700 transition-colors"
        >
          Refresh
        </button>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Client
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Phone
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Message
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Sent At
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {messages.map((message) => (
              <tr key={message.id}>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                  {message.clients?.name || 'Unknown'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {message.phone}
                </td>
                <td className="px-6 py-4 text-sm text-gray-500 max-w-xs truncate">
                  {message.content}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(message.status)}`}>
                    {message.status}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {message.sent_at ? formatDate(message.sent_at) : '-'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {messages.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            No messages found.
          </div>
        )}
      </div>
    </div>
  );
};

export default App;

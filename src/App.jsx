import React, { useState, useEffect, useRef } from 'react';
import { Send, Users, MessageSquare, Plus, Trash2, Menu, X, Clock, CheckCircle, XCircle, MessageCircle, Upload, Download, Tags } from 'lucide-react';
import { supabase } from './supabaseClient';
import { sendSMS } from './twilioService';
import * as XLSX from 'xlsx';

// ============================================
// PREDEFINED VARIABLES (OUTSIDE ALL COMPONENTS)
// ============================================
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

// ============================================
// UTILITY FUNCTIONS (OUTSIDE ALL COMPONENTS)
// ============================================
const replaceVariables = (content, variables) => {
  let result = content;
  Object.keys(variables).forEach(key => {
    result = result.replace(new RegExp(`{{${key}}}`, 'g'), variables[key]);
  });
  return result;
};

// ============================================
// VARIABLE PILLS COMPONENT (OUTSIDE APP)
// ============================================
const VariablePills = ({ onInsert }) => (
  <div className="bg-[#1E1E21] p-4 rounded-lg border border-gray-700">
    <h3 className="text-sm font-medium text-gray-300 mb-3">📌 Quick Variables (Click to Insert)</h3>
    <div className="flex flex-wrap gap-2">
      {predefinedVariables.map(variable => (
        <button
          key={variable.name}
          onClick={() => onInsert(variable.name)}
          className="flex items-center gap-2 px-3 py-2 bg-[#2E2F33] text-white rounded-lg border border-gray-600 hover:bg-[#56AF40] hover:border-[#56AF40] transition-all"
          title={`Click to insert {{${variable.name}}}`}
        >
          <span>{variable.icon}</span>
          <span className="text-sm">{variable.label}</span>
        </button>
      ))}
    </div>
    <p className="text-xs text-gray-500 mt-3">💡 Tip: Click to add variable at the end of your message</p>
  </div>
);

// ============================================
// NAV ITEM COMPONENT (OUTSIDE APP)
// ============================================
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

// ============================================
// SIDEBAR COMPONENT (OUTSIDE APP)
// ============================================
const SidebarNav = ({ activeTab, setActiveTab, sidebarOpen, setSidebarOpen }) => (
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
      <NavItem icon={<Tags size={20} />} label="Segments" active={activeTab === 'segments'} onClick={() => setActiveTab('segments')} collapsed={!sidebarOpen} />
      <NavItem icon={<MessageSquare size={20} />} label="Templates" active={activeTab === 'templates'} onClick={() => setActiveTab('templates')} collapsed={!sidebarOpen} />
      <NavItem icon={<Clock size={20} />} label="History" active={activeTab === 'history'} onClick={() => setActiveTab('history')} collapsed={!sidebarOpen} />
    </nav>
  </div>
);

// ============================================
// SEND SMS TAB COMPONENT (OUTSIDE APP)
// ============================================
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
  loading,
  handleSendSMS 
}) => {
  const insertVariable = (varName) => {
    setMessageContent(prev => prev + `{{${varName}}}`);
  };

  return (
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

          <VariablePills onInsert={insertVariable} />

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Message</label>
            <textarea
              value={messageContent}
              onChange={(e) => setMessageContent(e.target.value)}
              rows={5}
              className="w-full px-4 py-3 bg-[#1E1E21] border border-gray-700 rounded-lg text-white focus:outline-none focus:border-[#56AF40] transition-colors"
              placeholder="Type your message or use variables above..."
            />
          </div>

          {messageContent && selectedClient && (
            <div className="bg-[#1E1E21] p-4 rounded-lg border border-gray-700">
              <h3 className="text-sm font-medium text-gray-300 mb-2">Preview</h3>
              <p className="text-gray-400 whitespace-pre-wrap">
                {replaceVariables(messageContent, {
                  name: clients.find(c => c.id === selectedClient)?.name || '',
                  phone: clients.find(c => c.id === selectedClient)?.phone || '',
                  email: clients.find(c => c.id === selectedClient)?.email || '',
                  ...templateVariables
                })}
              </p>
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
};

// ============================================
// BATCH SEND TAB COMPONENT (OUTSIDE APP)
// ============================================
const BatchSendTab = ({
  clients,
  templates,
  segments,
  selectedClients,
  toggleClientSelection,
  selectAllClients,
  deselectAllClients,
  selectedSegment,
  setSelectedSegment,
  selectedTemplate,
  handleTemplateSelect,
  messageContent,
  setMessageContent,
  templateVariables,
  setTemplateVariables,
  loading,
  handleBatchSend,
  getClientsBySegment
}) => {
  const insertVariable = (varName) => {
    setMessageContent(prev => prev + `{{${varName}}}`);
  };

  const selectSegment = (segmentId) => {
    if (segmentId) {
      const segmentClients = getClientsBySegment(segmentId).map(c => c.id);
      setSelectedSegment(segmentId);
      // Replace current selection with segment clients
      const currentSelected = [...selectedClients];
      segmentClients.forEach(id => {
        if (!currentSelected.includes(id)) {
          currentSelected.push(id);
        }
      });
      // Update through parent via toggleClientSelection
      segmentClients.forEach(id => {
        if (!selectedClients.includes(id)) {
          toggleClientSelection(id);
        }
      });
    } else {
      setSelectedSegment('');
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-[#2E2F33] rounded-lg p-6 shadow-lg">
        <h2 className="text-xl font-semibold mb-6 text-white">Batch Send SMS</h2>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Quick Select by Segment</label>
            <select
              value={selectedSegment}
              onChange={(e) => selectSegment(e.target.value)}
              className="w-full px-4 py-3 bg-[#1E1E21] border border-gray-700 rounded-lg text-white focus:outline-none focus:border-[#56AF40]"
            >
              <option value="">Select a segment...</option>
              {segments.map(segment => (
                <option key={segment.id} value={segment.id}>
                  {segment.name} ({getClientsBySegment(segment.id).length} clients)
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-500 mt-1">💡 Select a segment to quickly add those clients</p>
          </div>

          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="block text-sm font-medium text-gray-300">Select Clients</label>
              <div className="flex gap-2">
                <button
                  onClick={selectAllClients}
                  className="text-sm text-[#56AF40] hover:text-[#4a9636]"
                >
                  Select All
                </button>
                <button
                  onClick={deselectAllClients}
                  className="text-sm text-gray-400 hover:text-gray-300"
                >
                  Deselect All
                </button>
              </div>
            </div>
            <div className="bg-[#1E1E21] border border-gray-700 rounded-lg p-4 max-h-64 overflow-y-auto">
              {clients.filter(c => c.status === 'active').map(client => (
                <label key={client.id} className="flex items-center p-2 hover:bg-[#2E2F33] rounded cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedClients.includes(client.id)}
                    onChange={() => toggleClientSelection(client.id)}
                    className="mr-3"
                  />
                  <span className="text-white">{client.name} - {client.phone}</span>
                </label>
              ))}
            </div>
            <p className="text-sm text-gray-400 mt-2">Selected: {selectedClients.length} clients</p>
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

          <VariablePills onInsert={insertVariable} />

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Message</label>
            <textarea
              value={messageContent}
              onChange={(e) => setMessageContent(e.target.value)}
              rows={5}
              className="w-full px-4 py-3 bg-[#1E1E21] border border-gray-700 rounded-lg text-white focus:outline-none focus:border-[#56AF40] transition-colors"
              placeholder="Type your message or use variables above..."
            />
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
};

// ============================================
// CLIENTS TAB COMPONENT (OUTSIDE APP)
// ============================================
const ClientsTab = ({
  clients,
  showClientForm,
  setShowClientForm,
  clientForm,
  setClientForm,
  addClient,
  deleteClient,
  exportClients,
  handleImport,
  fileInputRef
}) => (
  <div className="space-y-6">
    <div className="flex items-center justify-between">
      <h2 className="text-2xl font-semibold text-white">Clients Management</h2>
      <div className="flex gap-3">
        <button
          onClick={exportClients}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Download size={20} />
          Export
        </button>
        <button
          onClick={() => fileInputRef.current?.click()}
          className="flex items-center gap-2 bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors"
        >
          <Upload size={20} />
          Import
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.xls"
          onChange={handleImport}
          className="hidden"
        />
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
        <div className="grid grid-cols-2 gap-4">
          <input
            type="text"
            placeholder="Name"
            value={clientForm.name}
            onChange={(e) => setClientForm({...clientForm, name: e.target.value})}
            className="px-4 py-3 bg-[#1E1E21] border border-gray-700 rounded-lg text-white focus:outline-none focus:border-[#56AF40]"
          />
          <input
            type="tel"
            placeholder="Phone"
            value={clientForm.phone}
            onChange={(e) => setClientForm({...clientForm, phone: e.target.value})}
            className="px-4 py-3 bg-[#1E1E21] border border-gray-700 rounded-lg text-white focus:outline-none focus:border-[#56AF40]"
          />
          <input
            type="email"
            placeholder="Email (optional)"
            value={clientForm.email}
            onChange={(e) => setClientForm({...clientForm, email: e.target.value})}
            className="px-4 py-3 bg-[#1E1E21] border border-gray-700 rounded-lg text-white focus:outline-none focus:border-[#56AF40]"
          />
          <select
            value={clientForm.status}
            onChange={(e) => setClientForm({...clientForm, status: e.target.value})}
            className="px-4 py-3 bg-[#1E1E21] border border-gray-700 rounded-lg text-white focus:outline-none focus:border-[#56AF40]"
          >
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>
        <div className="flex gap-3 mt-4">
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
    )}

    <div className="bg-[#2E2F33] rounded-lg shadow-lg overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-[#1E1E21]">
            <tr>
              <th className="px-6 py-4 text-left text-sm font-semibold text-gray-300">Name</th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-gray-300">Phone</th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-gray-300">Email</th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-gray-300">Status</th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-gray-300">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-700">
            {clients.map(client => (
              <tr key={client.id} className="hover:bg-[#1E1E21] transition-colors">
                <td className="px-6 py-4 text-white">{client.name}</td>
                <td className="px-6 py-4 text-gray-300">{client.phone}</td>
                <td className="px-6 py-4 text-gray-300">{client.email || '-'}</td>
                <td className="px-6 py-4">
                  <span className={`px-3 py-1 rounded-full text-sm ${
                    client.status === 'active' ? 'bg-green-500/20 text-green-400' : 'bg-gray-500/20 text-gray-400'
                  }`}>
                    {client.status}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <button
                    onClick={() => deleteClient(client.id)}
                    className="text-red-400 hover:text-red-300 transition-colors"
                  >
                    <Trash2 size={18} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  </div>
);

// ============================================
// TEMPLATES TAB COMPONENT (OUTSIDE APP)
// ============================================
const TemplatesTab = ({
  templates,
  showTemplateForm,
  setShowTemplateForm,
  templateForm,
  setTemplateForm,
  addTemplate,
  deleteTemplate
}) => {
  const insertVariable = (varName) => {
    setTemplateForm(prev => ({
      ...prev,
      content: prev.content + `{{${varName}}}`
    }));
  };

  return (
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
            
            <VariablePills onInsert={insertVariable} />
            
            <div>
              <textarea
                placeholder="Message content - click variables above to insert"
                value={templateForm.content}
                onChange={(e) => setTemplateForm({...templateForm, content: e.target.value})}
                rows={5}
                className="w-full px-4 py-3 bg-[#1E1E21] border border-gray-700 rounded-lg text-white focus:outline-none focus:border-[#56AF40] transition-colors"
              />
              <p className="text-xs text-gray-500 mt-1">💡 Variables used will be auto-detected</p>
            </div>
            
            <input
              type="text"
              placeholder="Variables (optional - auto-detected from content)"
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
          <div key={template.id} className="bg-[#2E2F33] rounded-lg p-6 shadow-lg">
            <div className="flex items-start justify-between mb-3">
              <h3 className="text-lg font-semibold text-white">{template.name}</h3>
              <button
                onClick={() => deleteTemplate(template.id)}
                className="text-red-400 hover:text-red-300 transition-colors"
              >
                <Trash2 size={18} />
              </button>
            </div>
            <p className="text-gray-300 mb-3 whitespace-pre-wrap">{template.content}</p>
            {template.variables?.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {template.variables.map(variable => (
                  <span key={variable} className="px-3 py-1 bg-[#1E1E21] text-gray-400 rounded-full text-sm">
                    {`{{${variable}}}`}
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

// ============================================
// HISTORY TAB COMPONENT (OUTSIDE APP)
// ============================================
const HistoryTab = ({ messages }) => (
  <div className="space-y-6">
    <h2 className="text-2xl font-semibold text-white">Message History</h2>
    
    <div className="bg-[#2E2F33] rounded-lg shadow-lg overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-[#1E1E21]">
            <tr>
              <th className="px-6 py-4 text-left text-sm font-semibold text-gray-300">Client</th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-gray-300">Phone</th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-gray-300">Message</th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-gray-300">Status</th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-gray-300">Date</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-700">
            {messages.map(message => (
              <tr key={message.id} className="hover:bg-[#1E1E21] transition-colors">
                <td className="px-6 py-4 text-white">{message.clients?.name || 'Unknown'}</td>
                <td className="px-6 py-4 text-gray-300">{message.phone}</td>
                <td className="px-6 py-4 text-gray-300 max-w-md truncate">{message.content}</td>
                <td className="px-6 py-4">
                  <span className={`flex items-center gap-2 ${
                    message.status === 'sent' ? 'text-green-400' : message.status === 'failed' ? 'text-red-400' : 'text-yellow-400'
                  }`}>
                    {message.status === 'sent' ? <CheckCircle size={18} /> : message.status === 'failed' ? <XCircle size={18} /> : <Clock size={18} />}
                    {message.status}
                  </span>
                </td>
                <td className="px-6 py-4 text-gray-400 text-sm">
                  {new Date(message.created_at).toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  </div>
);

// ============================================
// SEGMENTS TAB COMPONENT (OUTSIDE APP)
// ============================================
const SegmentsTab = ({
  segments,
  clients,
  showSegmentForm,
  setShowSegmentForm,
  segmentForm,
  setSegmentForm,
  addSegment,
  deleteSegment,
  selectedSegment,
  setSelectedSegment,
  addClientToSegment,
  removeClientFromSegment,
  getClientsBySegment
}) => {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold text-white">Client Segments</h2>
        <button
          onClick={() => setShowSegmentForm(!showSegmentForm)}
          className="flex items-center gap-2 bg-[#56AF40] text-white px-4 py-2 rounded-lg hover:bg-[#4a9636] transition-colors"
        >
          <Plus size={20} />
          Create Segment
        </button>
      </div>

      {showSegmentForm && (
        <div className="bg-[#2E2F33] rounded-lg p-6 shadow-lg">
          <h3 className="text-lg font-semibold text-white mb-4">New Segment</h3>
          <div className="space-y-4">
            <input
              type="text"
              placeholder="Segment Name (e.g., VIP Clients, New Clients)"
              value={segmentForm.name}
              onChange={(e) => setSegmentForm({...segmentForm, name: e.target.value})}
              className="w-full px-4 py-3 bg-[#1E1E21] border border-gray-700 rounded-lg text-white focus:outline-none focus:border-[#56AF40]"
            />
            <textarea
              placeholder="Description (e.g., Clients who spent over $1000)"
              value={segmentForm.description}
              onChange={(e) => setSegmentForm({...segmentForm, description: e.target.value})}
              rows={3}
              className="w-full px-4 py-3 bg-[#1E1E21] border border-gray-700 rounded-lg text-white focus:outline-none focus:border-[#56AF40]"
            />
            <input
              type="text"
              placeholder="Tags (comma-separated: vip, premium, botox)"
              value={segmentForm.tags}
              onChange={(e) => setSegmentForm({...segmentForm, tags: e.target.value})}
              className="w-full px-4 py-3 bg-[#1E1E21] border border-gray-700 rounded-lg text-white focus:outline-none focus:border-[#56AF40]"
            />
            <div className="flex gap-3">
              <button
                onClick={addSegment}
                className="flex-1 bg-[#56AF40] text-white px-4 py-2 rounded-lg hover:bg-[#4a9636] transition-colors"
              >
                Create Segment
              </button>
              <button
                onClick={() => {
                  setShowSegmentForm(false);
                  setSegmentForm({ name: '', description: '', tags: '' });
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
        {segments.map(segment => (
          <div key={segment.id} className="bg-[#2E2F33] rounded-lg p-6 shadow-lg">
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-white mb-2">{segment.name}</h3>
                {segment.description && (
                  <p className="text-gray-400 text-sm mb-3">{segment.description}</p>
                )}
                {segment.tags?.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-4">
                    {segment.tags.map((tag, idx) => (
                      <span key={idx} className="px-3 py-1 bg-[#56AF40]/20 text-[#56AF40] rounded-full text-sm">
                        #{tag}
                      </span>
                    ))}
                  </div>
                )}
                <p className="text-gray-500 text-sm">
                  {getClientsBySegment(segment.id).length} clients in this segment
                </p>
              </div>
              <button
                onClick={() => deleteSegment(segment.id)}
                className="text-red-400 hover:text-red-300 transition-colors"
              >
                <Trash2 size={18} />
              </button>
            </div>

            {/* Manage Clients in Segment */}
            <div className="border-t border-gray-700 pt-4">
              <button
                onClick={() => setSelectedSegment(selectedSegment === segment.id ? '' : segment.id)}
                className="text-[#56AF40] hover:text-[#4a9636] text-sm font-medium"
              >
                {selectedSegment === segment.id ? 'Hide' : 'Manage'} Clients
              </button>

              {selectedSegment === segment.id && (
                <div className="mt-4 space-y-3">
                  <div className="bg-[#1E1E21] rounded-lg p-4 max-h-64 overflow-y-auto">
                    <h4 className="text-sm font-medium text-gray-300 mb-3">Add Clients to Segment</h4>
                    {clients.filter(c => c.status === 'active').map(client => {
                      const isInSegment = getClientsBySegment(segment.id).some(c => c.id === client.id);
                      return (
                        <label key={client.id} className="flex items-center justify-between p-2 hover:bg-[#2E2F33] rounded cursor-pointer">
                          <span className="text-white">{client.name} - {client.phone}</span>
                          <input
                            type="checkbox"
                            checked={isInSegment}
                            onChange={() => {
                              if (isInSegment) {
                                removeClientFromSegment(client.id, segment.id);
                              } else {
                                addClientToSegment(client.id, segment.id);
                              }
                            }}
                            className="ml-3"
                          />
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {segments.length === 0 && (
        <div className="bg-[#2E2F33] rounded-lg p-12 text-center">
          <Tags size={48} className="mx-auto text-gray-600 mb-4" />
          <h3 className="text-xl font-semibold text-white mb-2">No Segments Yet</h3>
          <p className="text-gray-400 mb-4">Create your first segment to organize clients</p>
          <button
            onClick={() => setShowSegmentForm(true)}
            className="bg-[#56AF40] text-white px-6 py-2 rounded-lg hover:bg-[#4a9636] transition-colors"
          >
            Create First Segment
          </button>
        </div>
      )}
    </div>
  );
};

// ============================================
// MAIN APP COMPONENT
// ============================================
const App = () => {
  const [activeTab, setActiveTab] = useState('send');
  const [clients, setClients] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [messages, setMessages] = useState([]);
  const [segments, setSegments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // Form states
  const [selectedClient, setSelectedClient] = useState('');
  const [selectedClients, setSelectedClients] = useState([]);
  const [selectedSegment, setSelectedSegment] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [messageContent, setMessageContent] = useState('');
  const [templateVariables, setTemplateVariables] = useState({});

  // Client form
  const [clientForm, setClientForm] = useState({ name: '', phone: '', email: '', status: 'active' });
  const [showClientForm, setShowClientForm] = useState(false);

  // Template form
  const [templateForm, setTemplateForm] = useState({ name: '', content: '', variables: '' });
  const [showTemplateForm, setShowTemplateForm] = useState(false);

  // Segment form
  const [segmentForm, setSegmentForm] = useState({ name: '', description: '', tags: '' });
  const [showSegmentForm, setShowSegmentForm] = useState(false);

  // Import file ref
  const fileInputRef = useRef(null);

  useEffect(() => {
    fetchClients();
    fetchTemplates();
    fetchMessages();
    fetchSegments();
  }, []);

  const fetchClients = async () => {
    const { data } = await supabase
      .from('clients')
      .select(`
        *,
        client_segments(
          segment_id,
          segments(id, name, tags)
        )
      `)
      .order('created_at', { ascending: false });
    
    // Transform the data to have a cleaner segments array
    const clientsWithSegments = data?.map(client => ({
      ...client,
      segments: client.client_segments?.map(cs => cs.segments) || []
    })) || [];
    
    setClients(clientsWithSegments);
  };

  const fetchTemplates = async () => {
    const { data } = await supabase.from('templates').select('*').order('created_at', { ascending: false });
    setTemplates(data || []);
  };

  const fetchMessages = async () => {
    const { data } = await supabase
      .from('messages')
      .select('*, clients(name, phone)')
      .order('created_at', { ascending: false });
    setMessages(data || []);
  };

  const fetchSegments = async () => {
    const { data } = await supabase.from('segments').select('*').order('created_at', { ascending: false });
    setSegments(data || []);
  };

  const addSegment = async () => {
    if (!segmentForm.name) return;
    const tags = segmentForm.tags.split(',').map(t => t.trim()).filter(t => t);
    await supabase.from('segments').insert([{ ...segmentForm, tags }]);
    setSegmentForm({ name: '', description: '', tags: '' });
    setShowSegmentForm(false);
    fetchSegments();
  };

  const deleteSegment = async (id) => {
    await supabase.from('segments').delete().eq('id', id);
    fetchSegments();
  };

  const addClientToSegment = async (clientId, segmentId) => {
    await supabase.from('client_segments').insert([{ client_id: clientId, segment_id: segmentId }]);
    fetchClients();
  };

  const removeClientFromSegment = async (clientId, segmentId) => {
    await supabase.from('client_segments').delete()
      .eq('client_id', clientId)
      .eq('segment_id', segmentId);
    fetchClients();
  };

  const getClientsBySegment = (segmentId) => {
    return clients.filter(client => 
      client.segments?.some(seg => seg.id === segmentId)
    );
  };

  const addClient = async () => {
    if (!clientForm.name || !clientForm.phone) return;
    await supabase.from('clients').insert([clientForm]);
    setClientForm({ name: '', phone: '', email: '', status: 'active' });
    setShowClientForm(false);
    fetchClients();
  };

  const deleteClient = async (id) => {
    await supabase.from('clients').delete().eq('id', id);
    fetchClients();
  };

  const exportClients = () => {
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

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Clients');

    ws['!cols'] = [
      { wch: 15 }, { wch: 15 }, { wch: 25 }, { wch: 15 }, { wch: 12 },
      { wch: 12 }, { wch: 15 }, { wch: 20 }, { wch: 15 }, { wch: 12 }
    ];

    XLSX.writeFile(wb, `clients_export_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const handleImport = (e) => {
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

          if (!name || !phone) {
            skipped++;
            continue;
          }

          const { data: existing } = await supabase
            .from('clients')
            .select('id')
            .eq('phone', phone)
            .single();

          if (existing) {
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
        
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      } catch (error) {
        console.error('Import error:', error);
        alert('Error importing file: ' + error.message);
      }
    };

    reader.readAsArrayBuffer(file);
  };

  const addTemplate = async () => {
    if (!templateForm.name || !templateForm.content) return;
    const variables = templateForm.variables.split(',').map(v => v.trim()).filter(v => v);
    await supabase.from('templates').insert([{ ...templateForm, variables }]);
    setTemplateForm({ name: '', content: '', variables: '' });
    setShowTemplateForm(false);
    fetchTemplates();
  };

  const deleteTemplate = async (id) => {
    await supabase.from('templates').delete().eq('id', id);
    fetchTemplates();
  };

  const handleTemplateSelect = (templateId) => {
    setSelectedTemplate(templateId);
    const template = templates.find(t => t.id === templateId);
    if (template) {
      setMessageContent(template.content);
      const vars = {};
      template.variables?.forEach(v => vars[v] = '');
      setTemplateVariables(vars);
    }
  };

  const handleSendSMS = async () => {
    if (!selectedClient || !messageContent) return;
    setLoading(true);
    try {
      const client = clients.find(c => c.id === selectedClient);
      
      // Auto-fill common variables from client data
      const autoVariables = {
        name: client.name,
        phone: client.phone,
        email: client.email || '',
        ...templateVariables // Keep any manually entered template variables
      };
      
      const finalMessage = replaceVariables(messageContent, autoVariables);
      
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
      
      // Auto-fill common variables from client data
      const autoVariables = {
        name: client.name,
        phone: client.phone,
        email: client.email || '',
        ...templateVariables // Keep any manually entered template variables
      };
      
      const finalMessage = replaceVariables(messageContent, autoVariables);
      
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

  return (
    <div className="flex h-screen bg-[#1E1E21] overflow-hidden">
      <SidebarNav 
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
      />
      
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="bg-[#2E2F33] border-b border-gray-700 px-8 py-4">
          <h1 className="text-2xl font-bold text-white">
            {activeTab === 'send' && 'Send SMS'}
            {activeTab === 'batch' && 'Batch Send'}
            {activeTab === 'clients' && 'Clients Management'}
            {activeTab === 'segments' && 'Client Segments'}
            {activeTab === 'templates' && 'Message Templates'}
            {activeTab === 'history' && 'Message History'}
          </h1>
        </div>
        
        <div className="flex-1 overflow-y-auto p-8">
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
              loading={loading}
              handleSendSMS={handleSendSMS}
            />
          )}
          
          {activeTab === 'batch' && (
            <BatchSendTab
              clients={clients}
              templates={templates}
              segments={segments}
              selectedClients={selectedClients}
              toggleClientSelection={toggleClientSelection}
              selectAllClients={selectAllClients}
              deselectAllClients={deselectAllClients}
              selectedSegment={selectedSegment}
              setSelectedSegment={setSelectedSegment}
              selectedTemplate={selectedTemplate}
              handleTemplateSelect={handleTemplateSelect}
              messageContent={messageContent}
              setMessageContent={setMessageContent}
              templateVariables={templateVariables}
              setTemplateVariables={setTemplateVariables}
              loading={loading}
              handleBatchSend={handleBatchSend}
              getClientsBySegment={getClientsBySegment}
            />
          )}
          
          {activeTab === 'clients' && (
            <ClientsTab
              clients={clients}
              showClientForm={showClientForm}
              setShowClientForm={setShowClientForm}
              clientForm={clientForm}
              setClientForm={setClientForm}
              addClient={addClient}
              deleteClient={deleteClient}
              exportClients={exportClients}
              handleImport={handleImport}
              fileInputRef={fileInputRef}
            />
          )}
          
          {activeTab === 'segments' && (
            <SegmentsTab
              segments={segments}
              clients={clients}
              showSegmentForm={showSegmentForm}
              setShowSegmentForm={setShowSegmentForm}
              segmentForm={segmentForm}
              setSegmentForm={setSegmentForm}
              addSegment={addSegment}
              deleteSegment={deleteSegment}
              selectedSegment={selectedSegment}
              setSelectedSegment={setSelectedSegment}
              addClientToSegment={addClientToSegment}
              removeClientFromSegment={removeClientFromSegment}
              getClientsBySegment={getClientsBySegment}
            />
          )}
          
          {activeTab === 'templates' && (
            <TemplatesTab
              templates={templates}
              showTemplateForm={showTemplateForm}
              setShowTemplateForm={setShowTemplateForm}
              templateForm={templateForm}
              setTemplateForm={setTemplateForm}
              addTemplate={addTemplate}
              deleteTemplate={deleteTemplate}
            />
          )}
          
          {activeTab === 'history' && (
            <HistoryTab messages={messages} />
          )}
        </div>
      </div>
    </div>
  );
};

export default App;

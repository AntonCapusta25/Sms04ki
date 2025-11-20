import React, { useState, useEffect, useRef } from 'react';
import { Send, Users, MessageSquare, Plus, Trash2, Menu, X, Clock, CheckCircle, XCircle, MessageCircle, Upload, Download, Tags, Edit2 } from 'lucide-react';
import { supabase } from './supabaseClient';
import { sendSMS } from './twilioService';
import * as XLSX from 'xlsx';

// ============================================
// PREDEFINED VARIABLES (OUTSIDE ALL COMPONENTS)
// ============================================
// These map to actual client database fields + common custom fields
const predefinedVariables = [
  { name: 'name', label: "Ім'я", icon: '👤', isDbField: true },
  { name: 'phone', label: 'Телефон', icon: '📱', isDbField: true },
  { name: 'email', label: 'Email', icon: '📧', isDbField: true },
  { name: 'status', label: 'Статус', icon: '✅', isDbField: true },
  // Common custom variables (not from DB, user must fill)
  { name: 'date', label: 'Дата', icon: '📅', isDbField: false },
  { name: 'time', label: 'Час', icon: '🕐', isDbField: false },
  { name: 'appointment', label: 'Запис', icon: '📆', isDbField: false },
  { name: 'service', label: 'Послуга', icon: '💼', isDbField: false },
  { name: 'price', label: 'Ціна', icon: '💰', isDbField: false },
  { name: 'location', label: 'Місце', icon: '📍', isDbField: false },
  { name: 'link', label: 'Посилання', icon: '🔗', isDbField: false }
];

// ============================================
// UTILITY FUNCTIONS (OUTSIDE ALL COMPONENTS)
// ============================================
const replaceVariables = (content, variables) => {
  let result = content;
  Object.keys(variables).forEach(key => {
    const value = variables[key] || '';
    result = result.replace(new RegExp(`{{${key}}}`, 'g'), value);
  });
  return result;
};

// Extract variables from message content
const extractVariables = (content) => {
  const matches = content.match(/{{(\w+)}}/g);
  if (!matches) return [];
  return [...new Set(matches.map(m => m.replace(/{{|}}/g, '')))];
};

// Get client data as variables object
const getClientVariables = (client) => {
  if (!client) return {};
  return {
    name: client.name || '',
    phone: client.phone || '',
    email: client.email || '',
    status: client.status || ''
  };
};

// ============================================
// VARIABLE PILLS COMPONENT (OUTSIDE APP)
// ============================================
const VariablePills = ({ onInsert }) => (
  <div className="bg-[#1E1E21] p-3 sm:p-4 rounded-lg border border-gray-700">
    <h3 className="text-xs sm:text-sm font-medium text-gray-300 mb-2 sm:mb-3">📌 Швидкі змінні (Натисніть для вставки)</h3>
    <div className="flex flex-wrap gap-1.5 sm:gap-2">
      {predefinedVariables.map(variable => (
        <button
          key={variable.name}
          onClick={() => onInsert(variable.name)}
          className={`flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg border transition-all text-xs sm:text-sm ${
            variable.isDbField 
              ? 'bg-[#56AF40]/20 text-[#56AF40] border-[#56AF40]/30 hover:bg-[#56AF40] hover:text-white'
              : 'bg-[#2E2F33] text-white border-gray-600 hover:bg-[#56AF40] hover:border-[#56AF40]'
          }`}
          title={variable.isDbField ? `Автозаповнення з бази: {{${variable.name}}}` : `Ручна змінна: {{${variable.name}}}`}
        >
          <span className="text-sm sm:text-base">{variable.icon}</span>
          <span>{variable.label}</span>
        </button>
      ))}
    </div>
    <div className="mt-2 sm:mt-3 space-y-1">
      <p className="text-xs text-gray-500">💡 <span className="text-[#56AF40]">Зелені</span> = Автозаповнення з бази клієнтів</p>
      <p className="text-xs text-gray-500">💡 <span className="text-gray-400">Сірі</span> = Потрібно заповнити вручну</p>
    </div>
  </div>
);

// ============================================
// NAV ITEM COMPONENT (OUTSIDE APP)
// ============================================
const NavItem = ({ icon, label, active, onClick, collapsed }) => (
  <button
    onClick={onClick}
    className={`w-full flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2 sm:py-3 rounded-lg mb-2 transition-all text-sm sm:text-base ${
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
  <>
    {/* Mobile Overlay */}
    {sidebarOpen && (
      <div 
        className="lg:hidden fixed inset-0 bg-black bg-opacity-50 z-40"
        onClick={() => setSidebarOpen(false)}
      />
    )}
    
    {/* Sidebar */}
    <div className={`
      ${sidebarOpen ? 'translate-x-0 w-64' : '-translate-x-full lg:translate-x-0 lg:w-20'} 
      fixed lg:relative z-50 bg-[#2E2F33] h-full transition-all duration-300 flex flex-col
    `}>
      <div className="p-4 sm:p-6 flex items-center justify-between border-b border-gray-700">
        {sidebarOpen && <h1 className="text-lg sm:text-xl font-bold text-white">SMS Платформа</h1>}
        <button onClick={() => setSidebarOpen(!sidebarOpen)} className="text-gray-400 hover:text-white">
          {sidebarOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>
      <nav className="flex-1 p-3 sm:p-4 overflow-y-auto">
        <NavItem icon={<Send size={18} />} label="Надіслати SMS" active={activeTab === 'send'} onClick={() => { setActiveTab('send'); if (window.innerWidth < 1024) setSidebarOpen(false); }} collapsed={!sidebarOpen} />
        <NavItem icon={<MessageCircle size={18} />} label="Масова розсилка" active={activeTab === 'batch'} onClick={() => { setActiveTab('batch'); if (window.innerWidth < 1024) setSidebarOpen(false); }} collapsed={!sidebarOpen} />
        <NavItem icon={<Users size={18} />} label="Клієнти" active={activeTab === 'clients'} onClick={() => { setActiveTab('clients'); if (window.innerWidth < 1024) setSidebarOpen(false); }} collapsed={!sidebarOpen} />
        <NavItem icon={<Tags size={18} />} label="Сегменти" active={activeTab === 'segments'} onClick={() => { setActiveTab('segments'); if (window.innerWidth < 1024) setSidebarOpen(false); }} collapsed={!sidebarOpen} />
        <NavItem icon={<MessageSquare size={18} />} label="Шаблони" active={activeTab === 'templates'} onClick={() => { setActiveTab('templates'); if (window.innerWidth < 1024) setSidebarOpen(false); }} collapsed={!sidebarOpen} />
        <NavItem icon={<Clock size={18} />} label="Історія" active={activeTab === 'history'} onClick={() => { setActiveTab('history'); if (window.innerWidth < 1024) setSidebarOpen(false); }} collapsed={!sidebarOpen} />
      </nav>
    </div>
  </>
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
  customVariables,
  setCustomVariables,
  loading,
  handleSendSMS 
}) => {
  const insertVariable = (varName) => {
    setMessageContent(prev => prev + `{{${varName}}}`);
  };

  // Get variables that need to be filled (non-DB fields)
  const usedVariables = extractVariables(messageContent);
  const customVarsNeeded = usedVariables.filter(v => 
    !predefinedVariables.find(pv => pv.name === v && pv.isDbField)
  );

  const client = clients.find(c => c.id === selectedClient);

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="bg-[#2E2F33] rounded-lg p-4 sm:p-6 shadow-lg">
        <h2 className="text-lg sm:text-xl font-semibold mb-4 sm:mb-6 text-white">Надіслати SMS повідомлення</h2>
        
        <div className="space-y-3 sm:space-y-4">
          <div>
            <label className="block text-xs sm:text-sm font-medium text-gray-300 mb-2">Оберіть клієнта</label>
            <select
              value={selectedClient}
              onChange={(e) => setSelectedClient(e.target.value)}
              className="w-full px-3 sm:px-4 py-2 sm:py-3 text-sm sm:text-base bg-[#1E1E21] border border-gray-700 rounded-lg text-white focus:outline-none focus:border-[#56AF40]"
            >
              <option value="">Оберіть клієнта</option>
              {clients.filter(c => c.status === 'active').map(client => (
                <option key={client.id} value={client.id}>{client.name} - {client.phone}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs sm:text-sm font-medium text-gray-300 mb-2">Шаблон (опціонально)</label>
            <select
              value={selectedTemplate}
              onChange={(e) => handleTemplateSelect(e.target.value)}
              className="w-full px-3 sm:px-4 py-2 sm:py-3 text-sm sm:text-base bg-[#1E1E21] border border-gray-700 rounded-lg text-white focus:outline-none focus:border-[#56AF40]"
            >
              <option value="">Оберіть шаблон</option>
              {templates.map(template => (
                <option key={template.id} value={template.id}>{template.name}</option>
              ))}
            </select>
          </div>

          <VariablePills onInsert={insertVariable} />

          <div>
            <label className="block text-xs sm:text-sm font-medium text-gray-300 mb-2">Повідомлення</label>
            <textarea
              value={messageContent}
              onChange={(e) => setMessageContent(e.target.value)}
              rows={5}
              className="w-full px-3 sm:px-4 py-2 sm:py-3 text-sm sm:text-base bg-[#1E1E21] border border-gray-700 rounded-lg text-white focus:outline-none focus:border-[#56AF40] transition-colors"
              placeholder="Введіть повідомлення або використовуйте змінні вище..."
            />
          </div>

          {/* Custom Variables Input */}
          {customVarsNeeded.length > 0 && (
            <div className="bg-[#1E1E21] p-3 sm:p-4 rounded-lg border border-gray-700">
              <h3 className="text-xs sm:text-sm font-medium text-gray-300 mb-3">📝 Заповніть кастомні змінні</h3>
              {customVarsNeeded.map(variable => (
                <div key={variable} className="mb-3">
                  <label className="block text-xs sm:text-sm text-gray-400 mb-1">{{variable}}</label>
                  <input
                    type="text"
                    value={customVariables[variable] || ''}
                    onChange={(e) => setCustomVariables({...customVariables, [variable]: e.target.value})}
                    className="w-full px-3 py-2 text-sm sm:text-base bg-[#2E2F33] border border-gray-700 rounded text-white focus:outline-none focus:border-[#56AF40]"
                    placeholder={`Введіть значення для ${variable}`}
                  />
                </div>
              ))}
            </div>
          )}

          {/* Preview */}
          {messageContent && selectedClient && (
            <div className="bg-[#1E1E21] p-3 sm:p-4 rounded-lg border border-gray-700">
              <h3 className="text-xs sm:text-sm font-medium text-gray-300 mb-2">📱 Попередній перегляд</h3>
              <p className="text-sm sm:text-base text-gray-400 whitespace-pre-wrap">
                {replaceVariables(messageContent, {
                  ...getClientVariables(client),
                  ...customVariables
                })}
              </p>
            </div>
          )}

          <button
            onClick={handleSendSMS}
            disabled={loading || !selectedClient || !messageContent}
            className="w-full bg-[#56AF40] text-white px-4 sm:px-6 py-2.5 sm:py-3 text-sm sm:text-base rounded-lg font-medium hover:bg-[#4a9636] disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? 'Надсилання...' : 'Надіслати SMS'}
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
  customVariables,
  setCustomVariables,
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
      const currentSelected = [...selectedClients];
      segmentClients.forEach(id => {
        if (!currentSelected.includes(id)) {
          currentSelected.push(id);
        }
      });
      segmentClients.forEach(id => {
        if (!selectedClients.includes(id)) {
          toggleClientSelection(id);
        }
      });
    } else {
      setSelectedSegment('');
    }
  };

  // Get variables that need to be filled (non-DB fields)
  const usedVariables = extractVariables(messageContent);
  const customVarsNeeded = usedVariables.filter(v => 
    !predefinedVariables.find(pv => pv.name === v && pv.isDbField)
  );

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="bg-[#2E2F33] rounded-lg p-4 sm:p-6 shadow-lg">
        <h2 className="text-lg sm:text-xl font-semibold mb-4 sm:mb-6 text-white">Масова розсилка SMS</h2>
        
        <div className="space-y-3 sm:space-y-4">
          <div>
            <label className="block text-xs sm:text-sm font-medium text-gray-300 mb-2">Швидкий вибір за сегментом</label>
            <select
              value={selectedSegment}
              onChange={(e) => selectSegment(e.target.value)}
              className="w-full px-3 sm:px-4 py-2 sm:py-3 text-sm sm:text-base bg-[#1E1E21] border border-gray-700 rounded-lg text-white focus:outline-none focus:border-[#56AF40]"
            >
              <option value="">Оберіть сегмент...</option>
              {segments.map(segment => (
                <option key={segment.id} value={segment.id}>
                  {segment.name} ({getClientsBySegment(segment.id).length} клієнтів)
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-500 mt-1">💡 Оберіть сегмент для швидкого додавання клієнтів</p>
          </div>

          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="block text-xs sm:text-sm font-medium text-gray-300">Оберіть клієнтів</label>
              <div className="flex gap-2">
                <button
                  onClick={selectAllClients}
                  className="text-xs sm:text-sm text-[#56AF40] hover:text-[#4a9636]"
                >
                  Всі
                </button>
                <button
                  onClick={deselectAllClients}
                  className="text-xs sm:text-sm text-gray-400 hover:text-gray-300"
                >
                  Скасувати
                </button>
              </div>
            </div>
            <div className="bg-[#1E1E21] border border-gray-700 rounded-lg p-3 sm:p-4 max-h-48 sm:max-h-64 overflow-y-auto">
              {clients.filter(c => c.status === 'active').map(client => (
                <label key={client.id} className="flex items-center p-2 hover:bg-[#2E2F33] rounded cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedClients.includes(client.id)}
                    onChange={() => toggleClientSelection(client.id)}
                    className="mr-2 sm:mr-3"
                  />
                  <span className="text-xs sm:text-sm text-white">{client.name} - {client.phone}</span>
                </label>
              ))}
            </div>
            <p className="text-xs sm:text-sm text-gray-400 mt-2">Обрано: {selectedClients.length} клієнтів</p>
          </div>

          <div>
            <label className="block text-xs sm:text-sm font-medium text-gray-300 mb-2">Шаблон (опціонально)</label>
            <select
              value={selectedTemplate}
              onChange={(e) => handleTemplateSelect(e.target.value)}
              className="w-full px-3 sm:px-4 py-2 sm:py-3 text-sm sm:text-base bg-[#1E1E21] border border-gray-700 rounded-lg text-white focus:outline-none focus:border-[#56AF40]"
            >
              <option value="">Оберіть шаблон</option>
              {templates.map(template => (
                <option key={template.id} value={template.id}>{template.name}</option>
              ))}
            </select>
          </div>

          <VariablePills onInsert={insertVariable} />

          <div>
            <label className="block text-xs sm:text-sm font-medium text-gray-300 mb-2">Повідомлення</label>
            <textarea
              value={messageContent}
              onChange={(e) => setMessageContent(e.target.value)}
              rows={5}
              className="w-full px-3 sm:px-4 py-2 sm:py-3 text-sm sm:text-base bg-[#1E1E21] border border-gray-700 rounded-lg text-white focus:outline-none focus:border-[#56AF40] transition-colors"
              placeholder="Введіть повідомлення або використовуйте змінні вище..."
            />
          </div>

          {/* Custom Variables Input */}
          {customVarsNeeded.length > 0 && (
            <div className="bg-[#1E1E21] p-3 sm:p-4 rounded-lg border border-gray-700">
              <h3 className="text-xs sm:text-sm font-medium text-gray-300 mb-3">📝 Заповніть кастомні змінні</h3>
              <p className="text-xs text-gray-500 mb-3">⚠️ Ці значення будуть однакові для всіх обраних клієнтів</p>
              {customVarsNeeded.map(variable => (
                <div key={variable} className="mb-3">
                  <label className="block text-xs sm:text-sm text-gray-400 mb-1">{{variable}}</label>
                  <input
                    type="text"
                    value={customVariables[variable] || ''}
                    onChange={(e) => setCustomVariables({...customVariables, [variable]: e.target.value})}
                    className="w-full px-3 py-2 text-sm sm:text-base bg-[#2E2F33] border border-gray-700 rounded text-white focus:outline-none focus:border-[#56AF40]"
                    placeholder={`Введіть значення для ${variable}`}
                  />
                </div>
              ))}
            </div>
          )}

          <button
            onClick={handleBatchSend}
            disabled={loading || selectedClients.length === 0 || !messageContent}
            className="w-full bg-[#56AF40] text-white px-4 sm:px-6 py-2.5 sm:py-3 text-sm sm:text-base rounded-lg font-medium hover:bg-[#4a9636] disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? 'Надсилання...' : `Надіслати ${selectedClients.length} клієнтам`}
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
  <div className="space-y-4 sm:space-y-6">
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      <h2 className="text-xl sm:text-2xl font-semibold text-white">Управління клієнтами</h2>
      <div className="flex flex-wrap gap-2 sm:gap-3">
        <button
          onClick={exportClients}
          className="flex items-center gap-1.5 sm:gap-2 bg-blue-600 text-white px-3 sm:px-4 py-2 text-sm sm:text-base rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Download size={16} className="sm:w-5 sm:h-5" />
          Експорт
        </button>
        <button
          onClick={() => fileInputRef.current?.click()}
          className="flex items-center gap-1.5 sm:gap-2 bg-purple-600 text-white px-3 sm:px-4 py-2 text-sm sm:text-base rounded-lg hover:bg-purple-700 transition-colors"
        >
          <Upload size={16} className="sm:w-5 sm:h-5" />
          Імпорт
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
          className="flex items-center gap-1.5 sm:gap-2 bg-[#56AF40] text-white px-3 sm:px-4 py-2 text-sm sm:text-base rounded-lg hover:bg-[#4a9636] transition-colors"
        >
          <Plus size={16} className="sm:w-5 sm:h-5" />
          Додати
        </button>
      </div>
    </div>

    {showClientForm && (
      <div className="bg-[#2E2F33] rounded-lg p-4 sm:p-6 shadow-lg">
        <h3 className="text-base sm:text-lg font-semibold text-white mb-4">Новий клієнт</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
          <input
            type="text"
            placeholder="Ім'я"
            value={clientForm.name}
            onChange={(e) => setClientForm({...clientForm, name: e.target.value})}
            className="px-3 sm:px-4 py-2 sm:py-3 text-sm sm:text-base bg-[#1E1E21] border border-gray-700 rounded-lg text-white focus:outline-none focus:border-[#56AF40]"
          />
          <input
            type="tel"
            placeholder="Телефон"
            value={clientForm.phone}
            onChange={(e) => setClientForm({...clientForm, phone: e.target.value})}
            className="px-3 sm:px-4 py-2 sm:py-3 text-sm sm:text-base bg-[#1E1E21] border border-gray-700 rounded-lg text-white focus:outline-none focus:border-[#56AF40]"
          />
          <input
            type="email"
            placeholder="Email (опціонально)"
            value={clientForm.email}
            onChange={(e) => setClientForm({...clientForm, email: e.target.value})}
            className="px-3 sm:px-4 py-2 sm:py-3 text-sm sm:text-base bg-[#1E1E21] border border-gray-700 rounded-lg text-white focus:outline-none focus:border-[#56AF40]"
          />
          <select
            value={clientForm.status}
            onChange={(e) => setClientForm({...clientForm, status: e.target.value})}
            className="px-3 sm:px-4 py-2 sm:py-3 text-sm sm:text-base bg-[#1E1E21] border border-gray-700 rounded-lg text-white focus:outline-none focus:border-[#56AF40]"
          >
            <option value="active">Активний</option>
            <option value="inactive">Неактивний</option>
          </select>
        </div>
        <div className="flex gap-3 mt-4">
          <button
            onClick={addClient}
            className="flex-1 bg-[#56AF40] text-white px-4 py-2 text-sm sm:text-base rounded-lg hover:bg-[#4a9636] transition-colors"
          >
            Додати клієнта
          </button>
          <button
            onClick={() => {
              setShowClientForm(false);
              setClientForm({ name: '', phone: '', email: '', status: 'active' });
            }}
            className="flex-1 bg-[#1E1E21] text-gray-300 px-4 py-2 text-sm sm:text-base rounded-lg hover:bg-gray-700 transition-colors"
          >
            Скасувати
          </button>
        </div>
      </div>
    )}

    <div className="bg-[#2E2F33] rounded-lg shadow-lg overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-[#1E1E21]">
            <tr>
              <th className="px-3 sm:px-6 py-3 sm:py-4 text-left text-xs sm:text-sm font-semibold text-gray-300">Ім'я</th>
              <th className="px-3 sm:px-6 py-3 sm:py-4 text-left text-xs sm:text-sm font-semibold text-gray-300">Телефон</th>
              <th className="hidden sm:table-cell px-6 py-4 text-left text-sm font-semibold text-gray-300">Email</th>
              <th className="px-3 sm:px-6 py-3 sm:py-4 text-left text-xs sm:text-sm font-semibold text-gray-300">Статус</th>
              <th className="px-3 sm:px-6 py-3 sm:py-4 text-left text-xs sm:text-sm font-semibold text-gray-300">Дії</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-700">
            {clients.map(client => (
              <tr key={client.id} className="hover:bg-[#1E1E21] transition-colors">
                <td className="px-3 sm:px-6 py-3 sm:py-4 text-xs sm:text-base text-white">{client.name}</td>
                <td className="px-3 sm:px-6 py-3 sm:py-4 text-xs sm:text-base text-gray-300">{client.phone}</td>
                <td className="hidden sm:table-cell px-6 py-4 text-gray-300">{client.email || '-'}</td>
                <td className="px-3 sm:px-6 py-3 sm:py-4">
                  <span className={`px-2 sm:px-3 py-1 rounded-full text-xs sm:text-sm ${
                    client.status === 'active' ? 'bg-green-500/20 text-green-400' : 'bg-gray-500/20 text-gray-400'
                  }`}>
                    {client.status === 'active' ? 'Активний' : 'Неактивний'}
                  </span>
                </td>
                <td className="px-3 sm:px-6 py-3 sm:py-4">
                  <button
                    onClick={() => deleteClient(client.id)}
                    className="text-red-400 hover:text-red-300 transition-colors"
                  >
                    <Trash2 size={16} className="sm:w-[18px] sm:h-[18px]" />
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
  updateTemplate,
  deleteTemplate,
  editingTemplate,
  setEditingTemplate
}) => {
  const insertVariable = (varName) => {
    setTemplateForm(prev => ({
      ...prev,
      content: prev.content + `{{${varName}}}`
    }));
  };

  const handleEdit = (template) => {
    setEditingTemplate(template.id);
    setTemplateForm({
      name: template.name,
      content: template.content,
      variables: template.variables?.join(', ') || ''
    });
    setShowTemplateForm(true);
  };

  const handleSubmit = () => {
    if (editingTemplate) {
      updateTemplate(editingTemplate);
    } else {
      addTemplate();
    }
  };

  const handleCancel = () => {
    setShowTemplateForm(false);
    setEditingTemplate(null);
    setTemplateForm({ name: '', content: '', variables: '' });
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h2 className="text-xl sm:text-2xl font-semibold text-white">Шаблони повідомлень</h2>
        <button
          onClick={() => {
            setEditingTemplate(null);
            setShowTemplateForm(!showTemplateForm);
          }}
          className="flex items-center gap-1.5 sm:gap-2 bg-[#56AF40] text-white px-3 sm:px-4 py-2 text-sm sm:text-base rounded-lg hover:bg-[#4a9636] transition-colors"
        >
          <Plus size={16} className="sm:w-5 sm:h-5" />
          Додати шаблон
        </button>
      </div>

      {showTemplateForm && (
        <div className="bg-[#2E2F33] rounded-lg p-4 sm:p-6 shadow-lg">
          <h3 className="text-base sm:text-lg font-semibold text-white mb-4">
            {editingTemplate ? 'Редагувати шаблон' : 'Новий шаблон'}
          </h3>
          <div className="space-y-3 sm:space-y-4">
            <input
              type="text"
              placeholder="Назва шаблону"
              value={templateForm.name}
              onChange={(e) => setTemplateForm({...templateForm, name: e.target.value})}
              className="w-full px-3 sm:px-4 py-2 sm:py-3 text-sm sm:text-base bg-[#1E1E21] border border-gray-700 rounded-lg text-white focus:outline-none focus:border-[#56AF40]"
            />
            
            <VariablePills onInsert={insertVariable} />
            
            <div>
              <textarea
                placeholder="Текст повідомлення - натисніть на змінні вище для вставки"
                value={templateForm.content}
                onChange={(e) => setTemplateForm({...templateForm, content: e.target.value})}
                rows={5}
                className="w-full px-3 sm:px-4 py-2 sm:py-3 text-sm sm:text-base bg-[#1E1E21] border border-gray-700 rounded-lg text-white focus:outline-none focus:border-[#56AF40] transition-colors"
              />
              <p className="text-xs text-gray-500 mt-1">💡 Змінні будуть автоматично виявлені та показані нижче</p>
            </div>
            
            {/* Show detected variables */}
            {templateForm.content && extractVariables(templateForm.content).length > 0 && (
              <div className="bg-[#1E1E21] p-3 rounded-lg border border-gray-700">
                <p className="text-xs text-gray-400 mb-2">Виявлені змінні:</p>
                <div className="flex flex-wrap gap-2">
                  {extractVariables(templateForm.content).map(v => (
                    <span key={v} className="px-2 py-1 bg-[#56AF40]/20 text-[#56AF40] rounded text-xs">
                      {`{{${v}}}`}
                    </span>
                  ))}
                </div>
              </div>
            )}
            
            <div className="flex gap-3">
              <button
                onClick={handleSubmit}
                className="flex-1 bg-[#56AF40] text-white px-4 py-2 text-sm sm:text-base rounded-lg hover:bg-[#4a9636] transition-colors"
              >
                {editingTemplate ? 'Оновити шаблон' : 'Додати шаблон'}
              </button>
              <button
                onClick={handleCancel}
                className="flex-1 bg-[#1E1E21] text-gray-300 px-4 py-2 text-sm sm:text-base rounded-lg hover:bg-gray-700 transition-colors"
              >
                Скасувати
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="grid gap-3 sm:gap-4">
        {templates.map(template => (
          <div key={template.id} className="bg-[#2E2F33] rounded-lg p-4 sm:p-6 shadow-lg">
            <div className="flex items-start justify-between mb-3">
              <h3 className="text-base sm:text-lg font-semibold text-white">{template.name}</h3>
              <div className="flex gap-2">
                <button
                  onClick={() => handleEdit(template)}
                  className="text-blue-400 hover:text-blue-300 transition-colors"
                  title="Редагувати"
                >
                  <Edit2 size={16} className="sm:w-[18px] sm:h-[18px]" />
                </button>
                <button
                  onClick={() => deleteTemplate(template.id)}
                  className="text-red-400 hover:text-red-300 transition-colors"
                  title="Видалити"
                >
                  <Trash2 size={16} className="sm:w-[18px] sm:h-[18px]" />
                </button>
              </div>
            </div>
            <p className="text-sm sm:text-base text-gray-300 mb-3 whitespace-pre-wrap">{template.content}</p>
            {template.variables?.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {template.variables.map(variable => (
                  <span key={variable} className="px-2 sm:px-3 py-1 bg-[#1E1E21] text-gray-400 rounded-full text-xs sm:text-sm">
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
  <div className="space-y-4 sm:space-y-6">
    <h2 className="text-xl sm:text-2xl font-semibold text-white">Історія повідомлень</h2>
    
    <div className="bg-[#2E2F33] rounded-lg shadow-lg overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-[#1E1E21]">
            <tr>
              <th className="px-3 sm:px-6 py-3 sm:py-4 text-left text-xs sm:text-sm font-semibold text-gray-300">Клієнт</th>
              <th className="px-3 sm:px-6 py-3 sm:py-4 text-left text-xs sm:text-sm font-semibold text-gray-300">Телефон</th>
              <th className="hidden md:table-cell px-6 py-4 text-left text-sm font-semibold text-gray-300">Повідомлення</th>
              <th className="px-3 sm:px-6 py-3 sm:py-4 text-left text-xs sm:text-sm font-semibold text-gray-300">Статус</th>
              <th className="hidden lg:table-cell px-6 py-4 text-left text-sm font-semibold text-gray-300">Дата</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-700">
            {messages.map(message => (
              <tr key={message.id} className="hover:bg-[#1E1E21] transition-colors">
                <td className="px-3 sm:px-6 py-3 sm:py-4 text-xs sm:text-base text-white">{message.clients?.name || 'Невідомо'}</td>
                <td className="px-3 sm:px-6 py-3 sm:py-4 text-xs sm:text-base text-gray-300">{message.phone}</td>
                <td className="hidden md:table-cell px-6 py-4 text-gray-300 max-w-md truncate">{message.content}</td>
                <td className="px-3 sm:px-6 py-3 sm:py-4">
                  <span className={`flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm ${
                    message.status === 'sent' ? 'text-green-400' : message.status === 'failed' ? 'text-red-400' : 'text-yellow-400'
                  }`}>
                    {message.status === 'sent' ? <CheckCircle size={14} className="sm:w-[18px] sm:h-[18px]" /> : message.status === 'failed' ? <XCircle size={14} className="sm:w-[18px] sm:h-[18px]" /> : <Clock size={14} className="sm:w-[18px] sm:h-[18px]" />}
                    {message.status === 'sent' ? 'Надіслано' : message.status === 'failed' ? 'Помилка' : 'В черзі'}
                  </span>
                </td>
                <td className="hidden lg:table-cell px-6 py-4 text-gray-400 text-sm">
                  {new Date(message.created_at).toLocaleString('uk-UA')}
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
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h2 className="text-xl sm:text-2xl font-semibold text-white">Сегменти клієнтів</h2>
        <button
          onClick={() => setShowSegmentForm(!showSegmentForm)}
          className="flex items-center gap-1.5 sm:gap-2 bg-[#56AF40] text-white px-3 sm:px-4 py-2 text-sm sm:text-base rounded-lg hover:bg-[#4a9636] transition-colors"
        >
          <Plus size={16} className="sm:w-5 sm:h-5" />
          Створити сегмент
        </button>
      </div>

      {showSegmentForm && (
        <div className="bg-[#2E2F33] rounded-lg p-4 sm:p-6 shadow-lg">
          <h3 className="text-base sm:text-lg font-semibold text-white mb-4">Новий сегмент</h3>
          <div className="space-y-3 sm:space-y-4">
            <input
              type="text"
              placeholder="Назва сегменту (наприклад, VIP клієнти, Нові клієнти)"
              value={segmentForm.name}
              onChange={(e) => setSegmentForm({...segmentForm, name: e.target.value})}
              className="w-full px-3 sm:px-4 py-2 sm:py-3 text-sm sm:text-base bg-[#1E1E21] border border-gray-700 rounded-lg text-white focus:outline-none focus:border-[#56AF40]"
            />
            <textarea
              placeholder="Опис (наприклад, Клієнти які витратили понад 1000 грн)"
              value={segmentForm.description}
              onChange={(e) => setSegmentForm({...segmentForm, description: e.target.value})}
              rows={3}
              className="w-full px-3 sm:px-4 py-2 sm:py-3 text-sm sm:text-base bg-[#1E1E21] border border-gray-700 rounded-lg text-white focus:outline-none focus:border-[#56AF40]"
            />
            <input
              type="text"
              placeholder="Теги (через кому: vip, преміум, ботокс)"
              value={segmentForm.tags}
              onChange={(e) => setSegmentForm({...segmentForm, tags: e.target.value})}
              className="w-full px-3 sm:px-4 py-2 sm:py-3 text-sm sm:text-base bg-[#1E1E21] border border-gray-700 rounded-lg text-white focus:outline-none focus:border-[#56AF40]"
            />
            <div className="flex gap-3">
              <button
                onClick={addSegment}
                className="flex-1 bg-[#56AF40] text-white px-4 py-2 text-sm sm:text-base rounded-lg hover:bg-[#4a9636] transition-colors"
              >
                Створити сегмент
              </button>
              <button
                onClick={() => {
                  setShowSegmentForm(false);
                  setSegmentForm({ name: '', description: '', tags: '' });
                }}
                className="flex-1 bg-[#1E1E21] text-gray-300 px-4 py-2 text-sm sm:text-base rounded-lg hover:bg-gray-700 transition-colors"
              >
                Скасувати
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="grid gap-3 sm:gap-4">
        {segments.map(segment => (
          <div key={segment.id} className="bg-[#2E2F33] rounded-lg p-4 sm:p-6 shadow-lg">
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1">
                <h3 className="text-base sm:text-lg font-semibold text-white mb-2">{segment.name}</h3>
                {segment.description && (
                  <p className="text-xs sm:text-sm text-gray-400 mb-3">{segment.description}</p>
                )}
                {segment.tags?.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-4">
                    {segment.tags.map((tag, idx) => (
                      <span key={idx} className="px-2 sm:px-3 py-1 bg-[#56AF40]/20 text-[#56AF40] rounded-full text-xs sm:text-sm">
                        #{tag}
                      </span>
                    ))}
                  </div>
                )}
                <p className="text-xs sm:text-sm text-gray-500">
                  {getClientsBySegment(segment.id).length} клієнтів у цьому сегменті
                </p>
              </div>
              <button
                onClick={() => deleteSegment(segment.id)}
                className="text-red-400 hover:text-red-300 transition-colors"
              >
                <Trash2 size={16} className="sm:w-[18px] sm:h-[18px]" />
              </button>
            </div>

            {/* Manage Clients in Segment */}
            <div className="border-t border-gray-700 pt-4">
              <button
                onClick={() => setSelectedSegment(selectedSegment === segment.id ? '' : segment.id)}
                className="text-[#56AF40] hover:text-[#4a9636] text-xs sm:text-sm font-medium"
              >
                {selectedSegment === segment.id ? 'Приховати' : 'Керувати'} клієнтами
              </button>

              {selectedSegment === segment.id && (
                <div className="mt-4 space-y-3">
                  <div className="bg-[#1E1E21] rounded-lg p-3 sm:p-4 max-h-48 sm:max-h-64 overflow-y-auto">
                    <h4 className="text-xs sm:text-sm font-medium text-gray-300 mb-3">Додати клієнтів до сегменту</h4>
                    {clients.filter(c => c.status === 'active').map(client => {
                      const isInSegment = getClientsBySegment(segment.id).some(c => c.id === client.id);
                      return (
                        <label key={client.id} className="flex items-center justify-between p-2 hover:bg-[#2E2F33] rounded cursor-pointer">
                          <span className="text-xs sm:text-sm text-white">{client.name} - {client.phone}</span>
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
        <div className="bg-[#2E2F33] rounded-lg p-8 sm:p-12 text-center">
          <Tags size={40} className="sm:w-12 sm:h-12 mx-auto text-gray-600 mb-4" />
          <h3 className="text-lg sm:text-xl font-semibold text-white mb-2">Поки немає сегментів</h3>
          <p className="text-sm sm:text-base text-gray-400 mb-4">Створіть свій перший сегмент для організації клієнтів</p>
          <button
            onClick={() => setShowSegmentForm(true)}
            className="bg-[#56AF40] text-white px-4 sm:px-6 py-2 text-sm sm:text-base rounded-lg hover:bg-[#4a9636] transition-colors"
          >
            Створити перший сегмент
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
  const [customVariables, setCustomVariables] = useState({});

  // Client form
  const [clientForm, setClientForm] = useState({ name: '', phone: '', email: '', status: 'active' });
  const [showClientForm, setShowClientForm] = useState(false);

  // Template form
  const [templateForm, setTemplateForm] = useState({ name: '', content: '', variables: '' });
  const [showTemplateForm, setShowTemplateForm] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null);

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
        'Коментар': `Статус: ${client.status}`,
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

        alert(`Імпорт завершено!\n✅ Імпортовано/Оновлено: ${imported}\n⚠️ Пропущено: ${skipped}`);
        fetchClients();
        
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      } catch (error) {
        console.error('Помилка імпорту:', error);
        alert('Помилка при імпорті файлу: ' + error.message);
      }
    };

    reader.readAsArrayBuffer(file);
  };

  const addTemplate = async () => {
    if (!templateForm.name || !templateForm.content) return;
    
    // Auto-detect variables from content
    const detectedVariables = extractVariables(templateForm.content);
    
    await supabase.from('templates').insert([{ 
      name: templateForm.name,
      content: templateForm.content,
      variables: detectedVariables
    }]);
    
    setTemplateForm({ name: '', content: '', variables: '' });
    setShowTemplateForm(false);
    fetchTemplates();
  };

  const updateTemplate = async (templateId) => {
    if (!templateForm.name || !templateForm.content) return;
    
    // Auto-detect variables from content
    const detectedVariables = extractVariables(templateForm.content);
    
    await supabase.from('templates')
      .update({ 
        name: templateForm.name,
        content: templateForm.content,
        variables: detectedVariables
      })
      .eq('id', templateId);
    
    setTemplateForm({ name: '', content: '', variables: '' });
    setShowTemplateForm(false);
    setEditingTemplate(null);
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
      // Reset custom variables when template changes
      setCustomVariables({});
    }
  };

  const handleSendSMS = async () => {
    if (!selectedClient || !messageContent) return;
    setLoading(true);
    try {
      const client = clients.find(c => c.id === selectedClient);
      
      // Combine DB fields with custom variables
      const allVariables = {
        ...getClientVariables(client),
        ...customVariables
      };
      
      const finalMessage = replaceVariables(messageContent, allVariables);
      
      const result = await sendSMS(client.phone, finalMessage);
      
      await supabase.from('messages').insert([{
        client_id: client.id,
        template_id: selectedTemplate || null,
        phone: client.phone,
        content: finalMessage,
        status: result.success ? 'sent' : 'failed'
      }]);

      alert(result.success ? 'SMS успішно надіслано!' : 'Помилка при надсиланні SMS');
      setSelectedClient('');
      setSelectedTemplate('');
      setMessageContent('');
      setCustomVariables({});
      fetchMessages();
    } catch (error) {
      alert('Помилка при надсиланні SMS: ' + error.message);
    }
    setLoading(false);
  };

  const handleBatchSend = async () => {
    if (selectedClients.length === 0 || !messageContent) return;
    setLoading(true);
    
    for (const clientId of selectedClients) {
      const client = clients.find(c => c.id === clientId);
      
      // Combine DB fields with custom variables
      const allVariables = {
        ...getClientVariables(client),
        ...customVariables
      };
      
      const finalMessage = replaceVariables(messageContent, allVariables);
      
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
        console.error(`Помилка надсилання ${client.name}:`, error);
      }
    }

    alert(`Масова розсилка завершена! Надіслано ${selectedClients.length} клієнтам`);
    setSelectedClients([]);
    setSelectedTemplate('');
    setMessageContent('');
    setCustomVariables({});
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
      
      <div className="flex-1 flex flex-col overflow-hidden lg:ml-0">
        {/* Header */}
        <div className="bg-[#2E2F33] border-b border-gray-700 px-4 sm:px-8 py-3 sm:py-4 flex items-center gap-3">
          <button 
            onClick={() => setSidebarOpen(true)} 
            className="lg:hidden text-gray-400 hover:text-white"
          >
            <Menu size={24} />
          </button>
          <h1 className="text-lg sm:text-2xl font-bold text-white">
            {activeTab === 'send' && 'Надіслати SMS'}
            {activeTab === 'batch' && 'Масова розсилка'}
            {activeTab === 'clients' && 'Управління клієнтами'}
            {activeTab === 'segments' && 'Сегменти клієнтів'}
            {activeTab === 'templates' && 'Шаблони повідомлень'}
            {activeTab === 'history' && 'Історія повідомлень'}
          </h1>
        </div>
        
        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-8">
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
              customVariables={customVariables}
              setCustomVariables={setCustomVariables}
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
              customVariables={customVariables}
              setCustomVariables={setCustomVariables}
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
              updateTemplate={updateTemplate}
              deleteTemplate={deleteTemplate}
              editingTemplate={editingTemplate}
              setEditingTemplate={setEditingTemplate}
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

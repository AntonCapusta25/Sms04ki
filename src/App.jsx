import React, { useState, useEffect, useRef } from 'react';
import { Send, Users, MessageSquare, Plus, Trash2, Menu, X, Clock, CheckCircle, XCircle, MessageCircle, Upload, Download, Tags, Edit2, FileSpreadsheet, AlertCircle } from 'lucide-react';
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
// IMPORT MODAL COMPONENT (NEW)
// ============================================
const ImportModal = ({ isOpen, onClose, onImport, fileInputRef }) => {
  const [isDragging, setIsDragging] = useState(false);

  if (!isOpen) return null;

  const handleDragEnter = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files && files[0]) {
      const event = { target: { files: [files[0]] } };
      onImport(event);
      onClose();
    }
  };

  const handleFileSelect = (e) => {
    if (e.target.files && e.target.files[0]) {
      onImport(e);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-[#2E2F33] rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-700">
          <h2 className="text-xl font-semibold text-white flex items-center gap-2">
            <Upload size={24} className="text-[#56AF40]" />
            Імпорт клієнтів з Excel
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Drag & Drop Area */}
          <div
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer ${
              isDragging
                ? 'border-[#56AF40] bg-[#56AF40]/10'
                : 'border-gray-600 hover:border-[#56AF40]/50 hover:bg-[#1E1E21]'
            }`}
            onClick={() => fileInputRef.current?.click()}
          >
            <FileSpreadsheet size={48} className={`mx-auto mb-4 ${isDragging ? 'text-[#56AF40]' : 'text-gray-500'}`} />
            <p className="text-lg text-white mb-2">
              Перетягніть файл сюди або натисніть для вибору
            </p>
            <p className="text-sm text-gray-400">
              Підтримуються формати: .xlsx, .xls, .csv
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={handleFileSelect}
              className="hidden"
            />
          </div>

          {/* Instructions */}
          <div className="bg-[#1E1E21] rounded-lg p-5 border border-gray-700">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <AlertCircle size={20} className="text-blue-400" />
              Інструкція з імпорту
            </h3>
            
            <div className="space-y-4 text-sm text-gray-300">
              <div>
                <h4 className="font-semibold text-white mb-2">📋 Формат файлу Excel:</h4>
                <p className="mb-2">Файл повинен містити наступні колонки (українською):</p>
                <div className="bg-[#2E2F33] rounded p-3 space-y-1 font-mono text-xs">
                  <div className="flex gap-2">
                    <span className="text-[#56AF40]">✓</span>
                    <span><strong>Ім'я</strong> - ім'я клієнта (обов'язково)</span>
                  </div>
                  <div className="flex gap-2">
                    <span className="text-[#56AF40]">✓</span>
                    <span><strong>Прізвище</strong> - прізвище клієнта (обов'язково)</span>
                  </div>
                  <div className="flex gap-2">
                    <span className="text-[#56AF40]">✓</span>
                    <span><strong>Телефон</strong> - номер телефону (обов'язково)</span>
                  </div>
                  <div className="flex gap-2">
                    <span className="text-gray-500">○</span>
                    <span><strong>Email</strong> - email адреса (опціонально)</span>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="font-semibold text-white mb-2">📱 Формат телефону:</h4>
                <ul className="space-y-1 ml-4">
                  <li className="flex items-start gap-2">
                    <span className="text-[#56AF40] mt-1">•</span>
                    <span>Українські номери: <code className="bg-[#2E2F33] px-2 py-0.5 rounded">+380671234567</code></span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-[#56AF40] mt-1">•</span>
                    <span>Можна без "+" (система додасть автоматично)</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-[#56AF40] mt-1">•</span>
                    <span>Приклад: <code className="bg-[#2E2F33] px-2 py-0.5 rounded">380671234567</code></span>
                  </li>
                </ul>
              </div>

              <div>
                <h4 className="font-semibold text-white mb-2">⚙️ Як працює імпорт:</h4>
                <ul className="space-y-1 ml-4">
                  <li className="flex items-start gap-2">
                    <span className="text-blue-400 mt-1">1.</span>
                    <span>Система перевіряє кожен номер телефону</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-blue-400 mt-1">2.</span>
                    <span>Якщо номер <strong>вже існує</strong> - оновлює дані клієнта</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-blue-400 mt-1">3.</span>
                    <span>Якщо номер <strong>новий</strong> - створює нового клієнта</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-blue-400 mt-1">4.</span>
                    <span>Рядки без імені або телефону - <strong>пропускаються</strong></span>
                  </li>
                </ul>
              </div>

              <div className="bg-[#56AF40]/10 border border-[#56AF40]/30 rounded p-3">
                <p className="text-[#56AF40] flex items-start gap-2">
                  <span className="text-lg">💡</span>
                  <span><strong>Порада:</strong> Можна експортувати існуючих клієнтів, відредагувати файл, і імпортувати назад для масового оновлення даних!</span>
                </p>
              </div>
            </div>
          </div>

          {/* Example */}
          <div className="bg-[#1E1E21] rounded-lg p-5 border border-gray-700">
            <h3 className="text-lg font-semibold text-white mb-3">📊 Приклад файлу:</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border border-gray-600">
                <thead className="bg-[#2E2F33]">
                  <tr>
                    <th className="border border-gray-600 px-3 py-2 text-left text-white">Прізвище</th>
                    <th className="border border-gray-600 px-3 py-2 text-left text-white">Ім'я</th>
                    <th className="border border-gray-600 px-3 py-2 text-left text-white">Телефон</th>
                    <th className="border border-gray-600 px-3 py-2 text-left text-white">Email</th>
                  </tr>
                </thead>
                <tbody className="text-gray-300">
                  <tr>
                    <td className="border border-gray-600 px-3 py-2">Коваленко</td>
                    <td className="border border-gray-600 px-3 py-2">Олена</td>
                    <td className="border border-gray-600 px-3 py-2">+380671234567</td>
                    <td className="border border-gray-600 px-3 py-2">olena@example.com</td>
                  </tr>
                  <tr>
                    <td className="border border-gray-600 px-3 py-2">Петренко</td>
                    <td className="border border-gray-600 px-3 py-2">Андрій</td>
                    <td className="border border-gray-600 px-3 py-2">380509876543</td>
                    <td className="border border-gray-600 px-3 py-2"></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex-1 bg-[#56AF40] text-white px-6 py-3 rounded-lg font-medium hover:bg-[#4a9636] transition-colors flex items-center justify-center gap-2"
            >
              <Upload size={20} />
              Вибрати файл
            </button>
            <button
              onClick={onClose}
              className="flex-1 bg-[#1E1E21] text-gray-300 px-6 py-3 rounded-lg font-medium hover:bg-gray-700 transition-colors"
            >
              Скасувати
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ============================================
// IMPORT RESULTS MODAL COMPONENT (NEW)
// ============================================
const ImportResultsModal = ({ isOpen, onClose, results }) => {
  if (!isOpen) return null;

  const totalProcessed = results.imported + results.updated + results.skipped.length;
  const successRate = totalProcessed > 0 ? Math.round(((results.imported + results.updated) / totalProcessed) * 100) : 0;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-[#2E2F33] rounded-lg max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-700">
          <h2 className="text-xl font-semibold text-white flex items-center gap-2">
            <CheckCircle size={24} className="text-[#56AF40]" />
            Результати імпорту
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Summary Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4">
              <div className="flex items-center gap-3">
                <CheckCircle size={32} className="text-green-400" />
                <div>
                  <p className="text-2xl font-bold text-green-400">{results.imported}</p>
                  <p className="text-sm text-gray-400">Нові клієнти</p>
                </div>
              </div>
            </div>

            <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
              <div className="flex items-center gap-3">
                <Edit2 size={32} className="text-blue-400" />
                <div>
                  <p className="text-2xl font-bold text-blue-400">{results.updated}</p>
                  <p className="text-sm text-gray-400">Оновлені</p>
                </div>
              </div>
            </div>

            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
              <div className="flex items-center gap-3">
                <AlertCircle size={32} className="text-yellow-400" />
                <div>
                  <p className="text-2xl font-bold text-yellow-400">{results.skipped.length}</p>
                  <p className="text-sm text-gray-400">Пропущено</p>
                </div>
              </div>
            </div>
          </div>

          {/* Success Rate */}
          <div className="bg-[#1E1E21] rounded-lg p-4 border border-gray-700">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-400">Успішність імпорту</span>
              <span className="text-lg font-bold text-[#56AF40]">{successRate}%</span>
            </div>
            <div className="w-full bg-gray-700 rounded-full h-2">
              <div 
                className="bg-[#56AF40] h-2 rounded-full transition-all duration-500"
                style={{ width: `${successRate}%` }}
              />
            </div>
          </div>

          {/* Skipped Rows Details */}
          {results.skipped.length > 0 && (
            <div className="bg-[#1E1E21] rounded-lg p-5 border border-yellow-500/30">
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <AlertCircle size={20} className="text-yellow-400" />
                Пропущені записи ({results.skipped.length})
              </h3>
              
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {results.skipped.map((skip, idx) => (
                  <div key={idx} className="bg-[#2E2F33] rounded-lg p-4 border border-gray-700">
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0 w-8 h-8 bg-yellow-500/20 rounded-full flex items-center justify-center">
                        <span className="text-yellow-400 font-semibold text-sm">{skip.row}</span>
                      </div>
                      <div className="flex-1">
                        <p className="text-white font-medium mb-1">
                          Рядок {skip.row}
                          {skip.name && <span className="text-gray-400"> - {skip.name}</span>}
                        </p>
                        <div className="flex items-start gap-2 text-sm">
                          <span className="text-yellow-400">⚠️</span>
                          <p className="text-gray-400">{skip.reason}</p>
                        </div>
                        {skip.data && (
                          <div className="mt-2 p-2 bg-[#1E1E21] rounded text-xs text-gray-500 font-mono">
                            {Object.entries(skip.data)
                              .filter(([key, value]) => value)
                              .map(([key, value]) => `${key}: ${value}`)
                              .join(' | ') || 'Немає даних'}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Errors */}
          {results.errors && results.errors.length > 0 && (
            <div className="bg-[#1E1E21] rounded-lg p-5 border border-red-500/30">
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <XCircle size={20} className="text-red-400" />
                Помилки ({results.errors.length})
              </h3>
              
              <div className="space-y-2">
                {results.errors.map((error, idx) => (
                  <div key={idx} className="bg-[#2E2F33] rounded p-3 border border-gray-700">
                    <p className="text-red-400 text-sm">{error}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Success Message */}
          {results.skipped.length === 0 && (
            <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4 text-center">
              <CheckCircle size={48} className="mx-auto text-green-400 mb-3" />
              <p className="text-lg font-semibold text-green-400 mb-1">Ідеально! 🎉</p>
              <p className="text-sm text-gray-400">Всі записи успішно імпортовані без помилок</p>
            </div>
          )}

          {/* Tips */}
          <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
            <p className="text-sm text-blue-400 flex items-start gap-2">
              <span className="text-lg">💡</span>
              <span>
                <strong>Порада:</strong> Виправте пропущені записи у вашому Excel файлі та імпортуйте знову. 
                Система автоматично оновить існуючі записи за номером телефону.
              </span>
            </p>
          </div>

          {/* Close Button */}
          <button
            onClick={onClose}
            className="w-full bg-[#56AF40] text-white px-6 py-3 rounded-lg font-medium hover:bg-[#4a9636] transition-colors"
          >
            Закрити
          </button>
        </div>
      </div>
    </div>
  );
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
          <span className="whitespace-nowrap">{variable.label}</span>
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
              {customVarsNeeded.map((variable, idx) => (
                <div key={`custom-var-${idx}`} className="mb-3">
                  <label className="block text-xs sm:text-sm text-gray-400 mb-1">{`{{${variable}}}`}</label>
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
              {customVarsNeeded.map((variable, idx) => (
                <div key={`batch-var-${idx}`} className="mb-3">
                  <label className="block text-xs sm:text-sm text-gray-400 mb-1">{`{{${variable}}}`}</label>
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
  updateClient,
  deleteClient,
  exportClients,
  handleImport,
  fileInputRef,
  editingClient,
  setEditingClient,
  editForm,
  setEditForm,
  showImportModal,
  setShowImportModal,
  showImportResultsModal,
  setShowImportResultsModal,
  importResults,
  segments,
  addClientToSegment,
  removeClientFromSegment,
  updateClientSegment
}) => {
  const [editingField, setEditingField] = useState(null);

  const startEditing = (client, field) => {
    setEditingClient(client.id);
    setEditingField(field);
    setEditForm({
      name: client.name,
      phone: client.phone,
      email: client.email || '',
      status: client.status
    });
  };

  const handleFieldUpdate = async (clientId, field, value) => {
    // Optimistic update
    const updatedData = { [field]: value };
    updateClient(clientId, updatedData);
    
    // Clear editing state
    setEditingClient(null);
    setEditingField(null);
  };

  const handleKeyPress = (e, clientId, field) => {
    if (e.key === 'Enter') {
      handleFieldUpdate(clientId, field, editForm[field]);
    } else if (e.key === 'Escape') {
      setEditingClient(null);
      setEditingField(null);
    }
  };

  return (
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
            onClick={() => setShowImportModal(true)}
            className="flex items-center gap-1.5 sm:gap-2 bg-purple-600 text-white px-3 sm:px-4 py-2 text-sm sm:text-base rounded-lg hover:bg-purple-700 transition-colors"
          >
            <Upload size={16} className="sm:w-5 sm:h-5" />
            Імпорт
          </button>
          <button
            onClick={() => setShowClientForm(!showClientForm)}
            className="flex items-center gap-1.5 sm:gap-2 bg-[#56AF40] text-white px-3 sm:px-4 py-2 text-sm sm:text-base rounded-lg hover:bg-[#4a9636] transition-colors"
          >
            <Plus size={16} className="sm:w-5 sm:h-5" />
            Додати
          </button>
        </div>
      </div>

      {/* Import Modal */}
      <ImportModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        onImport={handleImport}
        fileInputRef={fileInputRef}
      />

      {/* Import Results Modal */}
      <ImportResultsModal
        isOpen={showImportResultsModal}
        onClose={() => setShowImportResultsModal(false)}
        results={importResults}
      />

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
                <th className="px-3 sm:px-6 py-3 sm:py-4 text-left text-xs sm:text-sm font-semibold text-gray-300">Сегменти</th>
                <th className="px-3 sm:px-6 py-3 sm:py-4 text-left text-xs sm:text-sm font-semibold text-gray-300">Статус</th>
                <th className="px-3 sm:px-6 py-3 sm:py-4 text-left text-xs sm:text-sm font-semibold text-gray-300">Дії</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700">
              {clients.map(client => (
                <tr key={client.id} className="hover:bg-[#1E1E21] transition-colors">
                  {/* Name - Editable */}
                  <td className="px-3 sm:px-6 py-3 sm:py-4">
                    {editingClient === client.id && editingField === 'name' ? (
                      <input
                        type="text"
                        value={editForm.name}
                        onChange={(e) => setEditForm({...editForm, name: e.target.value})}
                        onBlur={() => handleFieldUpdate(client.id, 'name', editForm.name)}
                        onKeyDown={(e) => handleKeyPress(e, client.id, 'name')}
                        autoFocus
                        className="w-full px-2 py-1 text-xs sm:text-sm bg-[#1E1E21] border border-[#56AF40] rounded text-white focus:outline-none"
                      />
                    ) : (
                      <span
                        onClick={() => startEditing(client, 'name')}
                        className="text-xs sm:text-base text-white cursor-pointer hover:text-[#56AF40] transition-colors"
                        title="Клікніть для редагування"
                      >
                        {client.name}
                      </span>
                    )}
                  </td>

                  {/* Phone - Editable */}
                  <td className="px-3 sm:px-6 py-3 sm:py-4">
                    {editingClient === client.id && editingField === 'phone' ? (
                      <input
                        type="tel"
                        value={editForm.phone}
                        onChange={(e) => setEditForm({...editForm, phone: e.target.value})}
                        onBlur={() => handleFieldUpdate(client.id, 'phone', editForm.phone)}
                        onKeyDown={(e) => handleKeyPress(e, client.id, 'phone')}
                        autoFocus
                        className="w-full px-2 py-1 text-xs sm:text-sm bg-[#1E1E21] border border-[#56AF40] rounded text-white focus:outline-none"
                      />
                    ) : (
                      <span
                        onClick={() => startEditing(client, 'phone')}
                        className="text-xs sm:text-base text-gray-300 cursor-pointer hover:text-[#56AF40] transition-colors"
                        title="Клікніть для редагування"
                      >
                        {client.phone}
                      </span>
                    )}
                  </td>

                  {/* Email - Editable */}
                  <td className="hidden sm:table-cell px-6 py-4">
                    {editingClient === client.id && editingField === 'email' ? (
                      <input
                        type="email"
                        value={editForm.email}
                        onChange={(e) => setEditForm({...editForm, email: e.target.value})}
                        onBlur={() => handleFieldUpdate(client.id, 'email', editForm.email)}
                        onKeyDown={(e) => handleKeyPress(e, client.id, 'email')}
                        autoFocus
                        className="w-full px-2 py-1 text-sm bg-[#1E1E21] border border-[#56AF40] rounded text-white focus:outline-none"
                      />
                    ) : (
                      <span
                        onClick={() => startEditing(client, 'email')}
                        className="text-gray-300 cursor-pointer hover:text-[#56AF40] transition-colors"
                        title="Клікніть для редагування"
                      >
                        {client.email || '-'}
                      </span>
                    )}
                  </td>

                  {/* Segments - Single select dropdown like Status */}
                  <td className="px-3 sm:px-6 py-3 sm:py-4">
                    <select
                      value={client.segments?.[0]?.id || ''}
                      onChange={(e) => {
                        updateClientSegment(client.id, e.target.value);
                      }}
                      className={`px-2 sm:px-3 py-1 pr-7 rounded-full text-xs sm:text-sm cursor-pointer transition-colors border-0 focus:outline-none focus:ring-2 focus:ring-[#56AF40] appearance-none bg-no-repeat ${
                        client.segments?.[0]
                          ? 'bg-blue-500/20 text-blue-400 hover:bg-blue-500/30'
                          : 'bg-gray-500/20 text-gray-400 hover:bg-gray-500/30'
                      }`}
                      style={{
                        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='currentColor' d='M6 9L1 4h10z'/%3E%3C/svg%3E")`,
                        backgroundPosition: 'right 0.5rem center',
                        backgroundSize: '12px'
                      }}
                    >
                      <option value="">Без сегменту</option>
                      {segments.map(segment => (
                        <option key={segment.id} value={segment.id}>
                          {segment.name}
                        </option>
                      ))}
                    </select>
                  </td>

                  {/* Status - Dropdown with optimistic update */}
                  <td className="px-3 sm:px-6 py-3 sm:py-4">
                    <select
                      value={client.status}
                      onChange={(e) => handleFieldUpdate(client.id, 'status', e.target.value)}
                      className={`px-2 sm:px-3 py-1 pr-7 rounded-full text-xs sm:text-sm cursor-pointer transition-colors border-0 focus:outline-none focus:ring-2 focus:ring-[#56AF40] appearance-none bg-no-repeat ${
                        client.status === 'active' 
                          ? 'bg-green-500/20 text-green-400 hover:bg-green-500/30' 
                          : 'bg-gray-500/20 text-gray-400 hover:bg-gray-500/30'
                      }`}
                      style={{
                        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='currentColor' d='M6 9L1 4h10z'/%3E%3C/svg%3E")`,
                        backgroundPosition: 'right 0.5rem center',
                        backgroundSize: '12px'
                      }}
                    >
                      <option value="active">Активний</option>
                      <option value="inactive">Неактивний</option>
                    </select>
                  </td>

                  {/* Actions */}
                  <td className="px-3 sm:px-6 py-3 sm:py-4">
                    <button
                      onClick={() => deleteClient(client.id)}
                      className="text-red-400 hover:text-red-300 transition-colors"
                      title="Видалити клієнта"
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
      
      <div className="text-xs sm:text-sm text-gray-500 text-center">
        💡 Підказка: Клікніть на будь-яке поле для швидкого редагування. Натисніть Enter для збереження або Escape для скасування.
      </div>
    </div>
  );
};

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
                  {extractVariables(templateForm.content).map((v, idx) => (
                    <span key={`detected-var-${idx}`} className="px-2 py-1 bg-[#56AF40]/20 text-[#56AF40] rounded text-xs">
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
            {template.variables && Array.isArray(template.variables) && template.variables.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {template.variables.map((variable, idx) => (
                  <span key={`${template.id}-var-${idx}`} className="px-2 sm:px-3 py-1 bg-[#1E1E21] text-gray-400 rounded-full text-xs sm:text-sm">
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
                {selectedSegment === segment.id ? 'Приховати' : 'Керувати'}
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
  const [editingClient, setEditingClient] = useState(null);
  const [editForm, setEditForm] = useState({ name: '', phone: '', email: '', status: 'active' });

  // Template form
  const [templateForm, setTemplateForm] = useState({ name: '', content: '', variables: '' });
  const [showTemplateForm, setShowTemplateForm] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null);

  // Segment form
  const [segmentForm, setSegmentForm] = useState({ name: '', description: '', tags: '' });
  const [showSegmentForm, setShowSegmentForm] = useState(false);

  // Import file ref and modal
  const fileInputRef = useRef(null);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showImportResultsModal, setShowImportResultsModal] = useState(false);
  const [importResults, setImportResults] = useState({ imported: 0, updated: 0, skipped: [], errors: [] });

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

  const updateClientSegment = (clientId, newSegmentId) => {
    // Optimistic update - update UI immediately
    setClients(prevClients => {
      return prevClients.map(client => {
        if (client.id === clientId) {
          const newSegment = segments.find(s => s.id === newSegmentId);
          return {
            ...client,
            segments: newSegmentId ? [newSegment] : []
          };
        }
        return client;
      });
    });

    // Background database operations
    (async () => {
      try {
        const client = clients.find(c => c.id === clientId);
        const currentSegment = client.segments?.[0];
        
        // Remove from current segment if exists
        if (currentSegment) {
          await supabase.from('client_segments').delete()
            .eq('client_id', clientId)
            .eq('segment_id', currentSegment.id);
        }
        
        // Add to new segment if selected
        if (newSegmentId) {
          await supabase.from('client_segments').insert([{ 
            client_id: clientId, 
            segment_id: newSegmentId 
          }]);
        }
      } catch (error) {
        console.error('Error updating segment:', error);
        // Revert on error
        fetchClients();
      }
    })();
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

  const updateClient = async (clientId, updatedData) => {
    // Optimistic update - update UI immediately
    setClients(prevClients => 
      prevClients.map(client => 
        client.id === clientId 
          ? { ...client, ...updatedData, updated_at: new Date().toISOString() }
          : client
      )
    );

    // Background database update
    try {
      await supabase
        .from('clients')
        .update({
          ...updatedData,
          updated_at: new Date().toISOString()
        })
        .eq('id', clientId);
    } catch (error) {
      console.error('Помилка оновлення клієнта:', error);
      // Revert on error
      fetchClients();
    }
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
    
    // Determine file type
    const isCSV = file.name.toLowerCase().endsWith('.csv');
    
    reader.onload = async (event) => {
      try {
        let jsonData;
        
        if (isCSV) {
          // Parse CSV file
          const text = event.target.result;
          // Handle both Unix (\n) and Windows (\r\n) line endings
          const lines = text.split(/\r?\n/).filter(line => line.trim());
          
          if (lines.length < 2) {
            setImportResults({
              imported: 0,
              updated: 0,
              skipped: [],
              errors: ['Файл порожній або містить тільки заголовки']
            });
            setShowImportResultsModal(true);
            return;
          }
          
          // Parse header
          const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
          
          // Parse rows
          jsonData = lines.slice(1).map(line => {
            const values = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''));
            const row = {};
            headers.forEach((header, idx) => {
              row[header] = values[idx] || '';
            });
            return row;
          });
        } else {
          // Parse Excel file
          const data = new Uint8Array(event.target.result);
          const workbook = XLSX.read(data, { type: 'array' });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          jsonData = XLSX.utils.sheet_to_json(worksheet);
        }

        let imported = 0;
        let updated = 0;
        const skipped = [];
        const errors = [];

        for (let i = 0; i < jsonData.length; i++) {
          const row = jsonData[i];
          const rowNumber = i + 2; // Excel/CSV row number (accounting for header)
          
          const firstName = row["Ім'я"] || '';
          const lastName = row['Прізвище'] || '';
          const name = `${firstName} ${lastName}`.trim();
          const phone = row['Телефон'] || '';
          const email = row['Email'] || '';

          // Validation: Check if name is missing
          if (!name || name.length === 0) {
            skipped.push({
              row: rowNumber,
              name: phone || '(немає даних)',
              reason: "Відсутнє ім'я клієнта. Поля 'Ім'я' та 'Прізвище' не можуть бути порожніми.",
              data: { "Ім'я": firstName, "Прізвище": lastName, "Телефон": phone, "Email": email }
            });
            continue;
          }

          // Validation: Check if phone is missing
          if (!phone || phone.length === 0) {
            skipped.push({
              row: rowNumber,
              name: name,
              reason: "Відсутній номер телефону. Поле 'Телефон' обов'язкове для ідентифікації клієнта.",
              data: { "Ім'я": firstName, "Прізвище": lastName, "Телефон": phone, "Email": email }
            });
            continue;
          }

          // Validation: Check phone format
          const phoneStr = String(phone).trim();
          if (phoneStr.length < 10) {
            skipped.push({
              row: rowNumber,
              name: name,
              reason: `Невірний формат телефону '${phoneStr}'. Номер повинен містити мінімум 10 цифр (наприклад: +380671234567).`,
              data: { "Ім'я": firstName, "Прізвище": lastName, "Телефон": phone, "Email": email }
            });
            continue;
          }

          try {
            // Format phone to include + if missing
            let formattedPhone = phoneStr;
            if (!formattedPhone.startsWith('+')) {
              formattedPhone = '+' + formattedPhone;
            }

            const { data: existing } = await supabase
              .from('clients')
              .select('id')
              .eq('phone', formattedPhone)
              .single();

            if (existing) {
              // Update existing client
              const { error: updateError } = await supabase
                .from('clients')
                .update({
                  name,
                  email: email || null,
                  updated_at: new Date().toISOString()
                })
                .eq('phone', formattedPhone);

              if (updateError) {
                skipped.push({
                  row: rowNumber,
                  name: name,
                  reason: `Помилка оновлення: ${updateError.message}`,
                  data: { "Ім'я": firstName, "Прізвище": lastName, "Телефон": formattedPhone, "Email": email }
                });
              } else {
                updated++;
              }
            } else {
              // Insert new client
              const { error: insertError } = await supabase
                .from('clients')
                .insert({
                  name,
                  phone: formattedPhone,
                  email: email || null,
                  status: 'active'
                });

              if (insertError) {
                skipped.push({
                  row: rowNumber,
                  name: name,
                  reason: `Помилка додавання: ${insertError.message}`,
                  data: { "Ім'я": firstName, "Прізвище": lastName, "Телефон": formattedPhone, "Email": email }
                });
              } else {
                imported++;
              }
            }
          } catch (error) {
            skipped.push({
              row: rowNumber,
              name: name,
              reason: `Непередбачена помилка: ${error.message}`,
              data: { "Ім'я": firstName, "Прізвище": lastName, "Телефон": phone, "Email": email }
            });
          }
        }

        // Set results and show modal
        setImportResults({ imported, updated, skipped, errors });
        setShowImportResultsModal(true);
        
        // Refresh client list
        fetchClients();
        
        // Clear file input
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      } catch (error) {
        console.error('Помилка імпорту:', error);
        setImportResults({
          imported: 0,
          updated: 0,
          skipped: [],
          errors: [`Критична помилка при читанні файлу: ${error.message}`]
        });
        setShowImportResultsModal(true);
      }
    };

    // Read file based on type
    if (isCSV) {
      reader.readAsText(file, 'UTF-8');
    } else {
      reader.readAsArrayBuffer(file);
    }
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
              updateClient={updateClient}
              deleteClient={deleteClient}
              exportClients={exportClients}
              handleImport={handleImport}
              fileInputRef={fileInputRef}
              editingClient={editingClient}
              setEditingClient={setEditingClient}
              editForm={editForm}
              setEditForm={setEditForm}
              showImportModal={showImportModal}
              setShowImportModal={setShowImportModal}
              showImportResultsModal={showImportResultsModal}
              setShowImportResultsModal={setShowImportResultsModal}
              importResults={importResults}
              segments={segments}
              addClientToSegment={addClientToSegment}
              removeClientFromSegment={removeClientFromSegment}
              updateClientSegment={updateClientSegment}
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

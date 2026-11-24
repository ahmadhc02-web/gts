import React, { useState, useRef, useEffect } from 'react';
import { motion } from 'motion/react';
import {
  Settings,
  Building2,
  DollarSign,
  Package,
  Bell,
  Server,
  Sun,
  Moon,
  Download,
  Upload,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  Copy,
  Layers,
  ShieldCheck,
  Database,
  ArrowLeft
} from 'lucide-react';
import { RadiusSettings } from './radiusStore';
import { formatRadiusError } from './radiusApi';
import { VertixLandscapeCard, ConfirmDeleteModal, VertixModal } from './ui';

interface SettingsViewProps {
  store: any;
  isDarkMode: boolean;
  setIsDarkMode: (val: boolean) => void;
  currency: string;
  setCurrency: (c: any) => void;
  addToast: (msg: string, type: 'success' | 'error' | 'info') => void;
  onBack?: () => void;
  isFullPage?: boolean;
}

export default function SettingsView({
  store,
  isDarkMode,
  setIsDarkMode,
  currency,
  setCurrency,
  addToast,
  onBack,
  isFullPage = false,
}: SettingsViewProps) {
  const currentSettings: RadiusSettings = store.settings || {
    companyName: 'Green Pro Network Solutions',
    logoInitials: 'G',
    defaultCurrency: 'PKR',
    defaultPackage: '',
    defaultMonths: 1,
    expiryReminderDays: 3,
    radiusServerIp: '',
    radiusAuthPort: 1812,
    radiusAcctPort: 1813,
    themeDefault: 'light',
  };

  // Form states
  const [companyName, setCompanyName] = useState(currentSettings.companyName);
  const [logoInitials, setLogoInitials] = useState(currentSettings.logoInitials);
  const [defaultCurrency, setDefaultCurrency] = useState(currentSettings.defaultCurrency);
  const [defaultPackage, setDefaultPackage] = useState(currentSettings.defaultPackage);
  const [defaultMonths, setDefaultMonths] = useState(currentSettings.defaultMonths);
  const [expiryReminderDays, setExpiryReminderDays] = useState(currentSettings.expiryReminderDays);
  const [radiusServerIp, setRadiusServerIp] = useState(currentSettings.radiusServerIp);
  const [radiusAuthPort, setRadiusAuthPort] = useState(currentSettings.radiusAuthPort);
  const [radiusAcctPort, setRadiusAcctPort] = useState(currentSettings.radiusAcctPort);
  const [themeDefault, setThemeDefault] = useState(currentSettings.themeDefault);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!store.settings) return;
    setCompanyName(store.settings.companyName || 'Green Pro Network Solutions');
    setLogoInitials(store.settings.logoInitials || 'G');
    setDefaultCurrency(store.settings.defaultCurrency || 'PKR');
    setDefaultPackage(store.settings.defaultPackage || '');
    setDefaultMonths(store.settings.defaultMonths || 1);
    setExpiryReminderDays(store.settings.expiryReminderDays || 3);
    setRadiusServerIp(store.settings.radiusServerIp || '');
    setRadiusAuthPort(store.settings.radiusAuthPort || 1812);
    setRadiusAcctPort(store.settings.radiusAcctPort || 1813);
    setThemeDefault(store.settings.themeDefault || 'light');
  }, [store.settings]);

  // Modals
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importJsonText, setImportJsonText] = useState('');
  const [importError, setImportError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Save Settings
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSaving) return;
    setIsSaving(true);
    try {
      await store.updateSettings({
        companyName: companyName.trim() || 'Green Pro Network Solutions',
        logoInitials: (logoInitials.trim() || 'G').toUpperCase(),
        defaultCurrency: defaultCurrency as any,
        defaultPackage,
        defaultMonths: Number(defaultMonths) || 1,
        expiryReminderDays: Number(expiryReminderDays) || 3,
        radiusServerIp: radiusServerIp.trim(),
        radiusAuthPort: Number(radiusAuthPort) || 1812,
        radiusAcctPort: Number(radiusAcctPort) || 1813,
        themeDefault: themeDefault as any,
      });

      if (setCurrency) {
        setCurrency(defaultCurrency);
      }

      addToast('Engine configuration saved successfully', 'success');
    } catch (err: any) {
      addToast(formatRadiusError(err), 'error');
    } finally {
      setIsSaving(false);
    }
  };

  // Export JSON Backup
  const handleExportJson = () => {
    const jsonStr = store.exportData();
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `vertix_radius_backup_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    addToast('Full JSON snapshot exported to device', 'success');
  };

  // Import JSON file click
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = event => {
      const content = event.target?.result as string;
      if (content) {
        setImportJsonText(content);
        setShowImportModal(true);
      }
    };
    reader.readAsText(file);
    // Reset file input
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Confirm Import
  const handleConfirmImport = () => {
    setImportError('');
    if (!importJsonText.trim()) {
      setImportError('JSON data cannot be blank');
      return;
    }
    const result = store.importData(importJsonText);
    if (!result.success) {
      setImportError(result.error || 'Failed to parse JSON backup');
    } else {
      addToast('Backup restored successfully into memory and storage!', 'success');
      setShowImportModal(false);
      setImportJsonText('');
    }
  };

  // Refresh Data from Radius API
  const handleConfirmReset = async () => {
    try {
      await store.resetDemoData();
      addToast('Data refreshed from Radius API', 'info');
      setShowResetConfirm(false);
    } catch (err: any) {
      addToast(formatRadiusError(err), 'error');
    }
  };

  const innerContent = (
    <div className="space-y-4 w-full min-w-0">
      {/* Hidden File Input for JSON restore */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept=".json"
        className="hidden"
      />

      {/* 4 LANDSCAPE KPI CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <VertixLandscapeCard
          title="Engine Status"
          value="Online 2.4.1"
          badge="Healthy"
          badgeColor="bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800"
          icon={Server}
          iconBgGradient="bg-gradient-to-br from-emerald-500 to-teal-600"
          isDarkMode={isDarkMode}
        />
        <VertixLandscapeCard
          title="AAA Ports"
          value={`${radiusAuthPort}/${radiusAcctPort}`}
          badge="Auth/Acct"
          badgeColor="bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 border-blue-300 dark:border-blue-800"
          icon={Layers}
          iconBgGradient="bg-gradient-to-br from-blue-500 to-indigo-600"
          isDarkMode={isDarkMode}
        />
        <VertixLandscapeCard
          title="Grace Window"
          value={`${expiryReminderDays} Days`}
          badge="Notification Rule"
          badgeColor="bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800"
          icon={Bell}
          iconBgGradient="bg-gradient-to-br from-[#1f6b4f] to-[#0b3d2e]"
          isDarkMode={isDarkMode}
        />
        <VertixLandscapeCard
          title="Database Ledger"
          value={`${store.users.length} Users`}
          badge="Synchronized"
          badgeColor="bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300 border-purple-300 dark:border-purple-800"
          icon={Database}
          iconBgGradient="bg-gradient-to-br from-purple-500 to-violet-600"
          isDarkMode={isDarkMode}
        />
      </div>

      {/* SETTINGS WORKSPACE CONTAINER */}
      <form
        onSubmit={handleSaveSettings}
        className={`p-4 sm:p-5 rounded-2xl sm:rounded-3xl border shadow-sm flex flex-col transition-all w-full min-w-0 ${
          isDarkMode ? 'bg-[#161b24] border-[#2d3648]' : 'bg-white border-slate-300'
        }`}
      >
        {/* Controls Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-200 dark:border-[#2d3648]">
          <div>
            <h3 className="text-base sm:text-lg font-black text-black dark:text-white flex items-center gap-2">
              <Settings className="w-5 h-5 text-emerald-700 dark:text-emerald-400" />
              <span>RADIUS Engine & Operational Parameters</span>
            </h3>
            <p className="text-xs text-slate-700 dark:text-slate-300 font-medium">
              Manage AAA authentication ports, subscriber defaults, billing currencies, and data persistence
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="submit"
              disabled={isSaving}
              className="px-5 py-2 rounded-full bg-gradient-to-r from-[#1f6b4f] to-[#14532d] hover:from-[#18553f] hover:to-[#0f4424] text-white font-extrabold text-xs shadow-md shadow-emerald-950/20 cursor-pointer active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSaving ? 'Saving...' : 'Save Configuration'}
            </button>
          </div>
        </div>

        {/* 6 CONFIGURATION PANELS */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 my-4">
          {/* Panel 1: Brand & Organization */}
          <div
            className={`p-4 rounded-2xl border flex flex-col justify-between ${
              isDarkMode ? 'bg-[#10141b] border-[#2d3648]' : 'bg-slate-50 border-slate-300'
            }`}
          >
            <div>
              <div className="flex items-center gap-2 text-xs font-black text-slate-950 dark:text-white mb-2">
                <Building2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span>Brand & Identity</span>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="text-[11px] font-bold text-slate-700 dark:text-slate-200 block mb-1">Company / ISP Name</label>
                  <input
                    type="text"
                    value={companyName}
                    onChange={e => setCompanyName(e.target.value)}
                    className={`w-full text-xs px-3 py-2 rounded-xl border outline-none font-medium ${
                      isDarkMode
                        ? 'bg-[#161b24] border-[#333d52] text-white'
                        : 'bg-white border-slate-300 text-slate-950'
                    }`}
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-700 dark:text-slate-200 block mb-1">Logo Initials (1-2 chars)</label>
                  <input
                    type="text"
                    maxLength={3}
                    value={logoInitials}
                    onChange={e => setLogoInitials(e.target.value)}
                    className={`w-full text-xs px-3 py-2 rounded-xl border outline-none font-bold uppercase ${
                      isDarkMode
                        ? 'bg-[#161b24] border-[#333d52] text-white'
                        : 'bg-white border-slate-300 text-slate-950'
                    }`}
                  />
                </div>
              </div>
            </div>
            <p className="text-[10px] font-semibold text-slate-600 dark:text-slate-300 mt-2">Rendered in the dashboard window header</p>
          </div>

          {/* Panel 2: Billing & Default Currency */}
          <div
            className={`p-4 rounded-2xl border flex flex-col justify-between ${
              isDarkMode ? 'bg-[#10141b] border-[#2d3648]' : 'bg-slate-50 border-slate-300'
            }`}
          >
            <div>
              <div className="flex items-center gap-2 text-xs font-black text-slate-950 dark:text-white mb-2">
                <DollarSign className="w-4 h-4 text-emerald-500" />
                <span>Ledger Currency</span>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="text-[11px] font-bold text-slate-700 dark:text-slate-200 block mb-1">Default Base Currency</label>
                  <select
                    value={defaultCurrency}
                    onChange={e => setDefaultCurrency(e.target.value as any)}
                    className={`w-full text-xs px-3 py-2 rounded-xl border outline-none font-medium cursor-pointer ${
                      isDarkMode
                        ? 'bg-[#161b24] border-[#333d52] text-white'
                        : 'bg-white border-slate-300 text-slate-950'
                    }`}
                  >
                    <option value="PKR">PKR (Rs.) - Pakistani Rupee</option>
                    <option value="USD">USD ($) - US Dollar</option>
                    <option value="EUR">EUR (€) - Euro</option>
                    <option value="GBP">GBP (£) - British Pound</option>
                  </select>
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-700 dark:text-slate-200 block mb-1">Default Billing Period</label>
                  <select
                    value={defaultMonths}
                    onChange={e => setDefaultMonths(Number(e.target.value))}
                    className={`w-full text-xs px-3 py-2 rounded-xl border outline-none font-medium cursor-pointer ${
                      isDarkMode
                        ? 'bg-[#161b24] border-[#333d52] text-white'
                        : 'bg-white border-slate-300 text-slate-950'
                    }`}
                  >
                    <option value={1}>1 Month (Monthly Standard)</option>
                    <option value={3}>3 Months (Quarterly)</option>
                    <option value={6}>6 Months (Semi-Annual)</option>
                    <option value={12}>12 Months (Annual)</option>
                  </select>
                </div>
              </div>
            </div>
            <p className="text-[10px] font-semibold text-slate-600 dark:text-slate-300 mt-2">Drives subscriber defaults and financial conversion</p>
          </div>

          {/* Panel 3: Notifications & Grace Engine */}
          <div
            className={`p-4 rounded-2xl border flex flex-col justify-between ${
              isDarkMode ? 'bg-[#10141b] border-[#2d3648]' : 'bg-slate-50 border-slate-300'
            }`}
          >
            <div>
              <div className="flex items-center gap-2 text-xs font-black text-slate-950 dark:text-white mb-2">
                <Bell className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span>Expiry Notification Window</span>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="text-[11px] font-bold text-slate-700 dark:text-slate-200 block mb-1">
                    Expiry Reminder Days ({expiryReminderDays} days)
                  </label>
                  <input
                    type="range"
                    min={1}
                    max={14}
                    value={expiryReminderDays}
                    onChange={e => setExpiryReminderDays(Number(e.target.value))}
                    className="w-full accent-emerald-600 cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-slate-600 dark:text-slate-300 font-bold mt-1">
                    <span>1 Day</span>
                    <span className="text-emerald-700 dark:text-emerald-400 font-extrabold">{expiryReminderDays} Days</span>
                    <span>14 Days</span>
                  </div>
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-700 dark:text-slate-200 block mb-1">Default Package For New Users</label>
                  <select
                    value={defaultPackage}
                    onChange={e => setDefaultPackage(e.target.value)}
                    className={`w-full text-xs px-3 py-2 rounded-xl border outline-none font-medium cursor-pointer ${
                      isDarkMode
                        ? 'bg-[#161b24] border-[#333d52] text-white'
                        : 'bg-white border-slate-300 text-slate-950'
                    }`}
                  >
                    {store.packages.map((p: any) => (
                      <option key={p.id} value={p.name}>
                        {p.name} ({p.speed}) - Rs. {p.pricePerMonth}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
            <p className="text-[10px] font-semibold text-slate-600 dark:text-slate-300 mt-2">Drives the "Expiring" filter and notification alerts</p>
          </div>

          {/* Panel 4: RADIUS Core Server */}
          <div
            className={`p-4 rounded-2xl border flex flex-col justify-between ${
              isDarkMode ? 'bg-[#10141b] border-[#2d3648]' : 'bg-slate-50 border-slate-300'
            }`}
          >
            <div>
              <div className="flex items-center gap-2 text-xs font-black text-slate-950 dark:text-white mb-2">
                <Server className="w-4 h-4 text-teal-500" />
                <span>RADIUS AAA Core</span>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="text-[11px] font-bold text-slate-700 dark:text-slate-200 block mb-1">Server IP / FQDN</label>
                  <input
                    type="text"
                    value={radiusServerIp}
                    onChange={e => setRadiusServerIp(e.target.value)}
                    className={`w-full text-xs px-3 py-2 rounded-xl border outline-none font-mono ${
                      isDarkMode
                        ? 'bg-[#161b24] border-[#333d52] text-white'
                        : 'bg-white border-slate-300 text-slate-950'
                    }`}
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[11px] font-bold text-slate-700 dark:text-slate-200 block mb-1">Auth Port</label>
                    <input
                      type="number"
                      value={radiusAuthPort}
                      onChange={e => setRadiusAuthPort(Number(e.target.value))}
                      className={`w-full text-xs px-3 py-2 rounded-xl border outline-none font-mono ${
                        isDarkMode
                          ? 'bg-[#161b24] border-[#333d52] text-white'
                          : 'bg-white border-slate-300 text-slate-950'
                      }`}
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-slate-700 dark:text-slate-200 block mb-1">Acct Port</label>
                    <input
                      type="number"
                      value={radiusAcctPort}
                      onChange={e => setRadiusAcctPort(Number(e.target.value))}
                      className={`w-full text-xs px-3 py-2 rounded-xl border outline-none font-mono ${
                        isDarkMode
                          ? 'bg-[#161b24] border-[#333d52] text-white'
                          : 'bg-white border-slate-300 text-slate-950'
                      }`}
                    />
                  </div>
                </div>
              </div>
            </div>
            <p className="text-[10px] font-semibold text-slate-600 dark:text-slate-300 mt-2">Embedded in NAS "Copy RADIUS config" scripts</p>
          </div>

          {/* Panel 5: Theme & Appearance */}
          <div
            className={`p-4 rounded-2xl border flex flex-col justify-between ${
              isDarkMode ? 'bg-[#10141b] border-[#2d3648]' : 'bg-slate-50 border-slate-300'
            }`}
          >
            <div>
              <div className="flex items-center gap-2 text-xs font-black text-slate-950 dark:text-white mb-2">
                <Sun className="w-4 h-4 text-indigo-500" />
                <span>Visual Theme Mode</span>
              </div>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setThemeDefault('light');
                      setIsDarkMode(false);
                    }}
                    className={`p-3 rounded-xl border flex flex-col items-center gap-1.5 transition-all cursor-pointer ${
                      !isDarkMode
                        ? 'border-emerald-500 bg-emerald-500/10 text-emerald-800 font-extrabold shadow-sm'
                        : 'border-[#333d52] text-slate-200 hover:text-white'
                    }`}
                  >
                    <Sun className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                    <span className="text-xs">Light Mode</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setThemeDefault('dark');
                      setIsDarkMode(true);
                    }}
                    className={`p-3 rounded-xl border flex flex-col items-center gap-1.5 transition-all cursor-pointer ${
                      isDarkMode
                        ? 'border-emerald-500 bg-emerald-500/15 text-emerald-300 font-extrabold shadow-sm'
                        : 'border-slate-300 text-slate-700 hover:text-black'
                    }`}
                  >
                    <Moon className="w-5 h-5 text-indigo-400" />
                    <span className="text-xs">Dark Mode</span>
                  </button>
                </div>
              </div>
            </div>
            <p className="text-[10px] font-semibold text-slate-600 dark:text-slate-300 mt-2">Instant theme toggle with persistent storage</p>
          </div>

          {/* Panel 6: Backup, Restore & Reset */}
          <div
            className={`p-4 rounded-2xl border flex flex-col justify-between ${
              isDarkMode ? 'bg-[#10141b] border-[#2d3648]' : 'bg-slate-50 border-slate-300'
            }`}
          >
            <div>
              <div className="flex items-center gap-2 text-xs font-black text-slate-950 dark:text-white mb-2">
                <Database className="w-4 h-4 text-rose-500" />
                <span>Data Mobility & Backups</span>
              </div>
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={handleExportJson}
                  className="w-full py-2 px-3 rounded-xl border border-slate-300 dark:border-[#333d52] hover:bg-emerald-50/50 dark:hover:bg-[#1c2330] text-xs font-bold flex items-center justify-center gap-2 text-slate-900 dark:text-slate-100 cursor-pointer transition-colors"
                >
                  <Download className="w-3.5 h-3.5 text-blue-500" />
                  <span>Export All Data (JSON)</span>
                </button>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full py-2 px-3 rounded-xl border border-slate-300 dark:border-[#333d52] hover:bg-emerald-50/50 dark:hover:bg-[#1c2330] text-xs font-bold flex items-center justify-center gap-2 text-slate-900 dark:text-slate-100 cursor-pointer transition-colors"
                >
                  <Upload className="w-3.5 h-3.5 text-emerald-500" />
                  <span>Import Data (JSON)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowResetConfirm(true)}
                  className="w-full py-2 px-3 rounded-xl bg-rose-600/10 hover:bg-rose-600/20 text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-800 text-xs font-bold flex items-center justify-center gap-2 cursor-pointer transition-colors"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Refresh Data from API</span>
                </button>
              </div>
            </div>
            <p className="text-[10px] font-semibold text-slate-600 dark:text-slate-300 mt-2">Synchronized with Radius API service</p>
          </div>
        </div>
      </form>

      {/* IMPORT JSON MODAL */}
      <VertixModal
        isOpen={showImportModal}
        onClose={() => {
          setShowImportModal(false);
          setImportError('');
        }}
        title="Restore Radius Database Backup"
        subtitle="Validate and import JSON configuration snapshot"
        icon={Upload}
        iconColor="text-emerald-600 bg-emerald-100 dark:bg-emerald-950"
        maxWidth="max-w-lg"
        isDarkMode={isDarkMode}
      >
        <div className="space-y-3">
          {importError && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950 border border-rose-300 dark:border-rose-800 text-rose-700 dark:text-rose-200 text-xs font-bold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{importError}</span>
            </div>
          )}

          <div>
            <label className="text-xs font-bold text-slate-900 dark:text-slate-100 block mb-1">
              JSON Backup Payload
            </label>
            <textarea
              rows={8}
              value={importJsonText}
              onChange={e => setImportJsonText(e.target.value)}
              placeholder="Paste JSON content here..."
              className={`w-full p-3 font-mono text-[11px] rounded-2xl border outline-none ${
                isDarkMode
                  ? 'bg-[#10141b] border-[#333d52] text-emerald-300 placeholder-slate-400'
                  : 'bg-slate-50 border-slate-300 text-slate-950 placeholder-slate-500'
              }`}
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => {
                setShowImportModal(false);
                setImportError('');
              }}
              className="px-4 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 hover:text-black dark:hover:text-white cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirmImport}
              className="px-5 py-2 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs shadow-md shadow-emerald-500/20 cursor-pointer"
            >
              Confirm Restore
            </button>
          </div>
        </div>
      </VertixModal>

      {/* CONFIRM REFRESH MODAL */}
      <ConfirmDeleteModal
        isOpen={showResetConfirm}
        onClose={() => setShowResetConfirm(false)}
        onConfirm={handleConfirmReset}
        title="Refresh Data from Radius API"
        message="This will reload all subscribers, packages, payments, logs, and routers from the Radius API server."
        subMessage="Any unsaved local edits in this view will be discarded."
        isDarkMode={isDarkMode}
      />
    </div>
  );

  if (isFullPage || onBack) {
    return (
      <div
        className={`min-h-screen w-full flex flex-col font-sans select-none overflow-y-auto ${
          isDarkMode ? 'bg-[#0f131a] text-slate-100' : 'bg-[#eef3f1] text-slate-950'
        }`}
      >
        {/* Header Bar */}
        <header
          className={`h-16 px-4 sm:px-8 border-b flex items-center justify-between shrink-0 sticky top-0 z-40 ${
            isDarkMode ? 'bg-[#161b24] border-[#2d3648]' : 'bg-white border-slate-300'
          }`}
        >
          <div className="flex items-center gap-3">
            {onBack && (
              <button
                type="button"
                onClick={onBack}
                className="flex items-center gap-2 px-3.5 py-2 rounded-full bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/40 text-xs font-bold transition-all cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back to Dashboard</span>
              </button>
            )}
            <div className="h-5 w-[1px] bg-slate-300 dark:bg-[#333d52] hidden sm:block" />
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white flex items-center justify-center font-black shadow-md">
                <Settings className="w-4 h-4" />
              </div>
              <div>
                <h1 className="font-extrabold text-sm sm:text-base leading-tight text-slate-950 dark:text-white">Radius Engine Settings</h1>
                <p className="text-[10px] text-slate-600 dark:text-slate-300 font-mono">
                  /greenradius/settings
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-[11px] font-bold text-emerald-700 dark:text-emerald-300">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>RADIUS SYSTEM ACTIVE</span>
            </div>
            <button
              type="button"
              onClick={() => setIsDarkMode(!isDarkMode)}
              className={`p-2 rounded-xl border transition-all cursor-pointer ${
                isDarkMode
                  ? 'bg-[#10141b] border-[#333d52] text-amber-300 hover:text-white'
                  : 'bg-white border-slate-300 text-slate-700 hover:text-black shadow-xs'
              }`}
              title="Toggle theme"
            >
              {isDarkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
          </div>
        </header>

        {/* Main Container */}
        <main
          className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-6"
          style={{ paddingBottom: 'calc(2rem + env(safe-area-inset-bottom, 0px))' }}
        >
          {innerContent}
        </main>
      </div>
    );
  }

  return innerContent;
}

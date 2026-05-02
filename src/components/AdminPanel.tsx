import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { UserPlus, Settings, Users, ClipboardList, Key, Shield, Trash2, FileSpreadsheet, ExternalLink, HardDriveDownload, Layers, ShieldAlert, CheckCircle, X, Pencil, Check, Info, Copy, PlusSquare, CloudUpload, Zap, MapPin, Bell, Contact, MapPinned, Volume2, VolumeX, LogOut, Clock, TrendingUp, BarChart3, Mic, Activity, MessageSquare, RefreshCw, Unlink, QrCode } from 'lucide-react';
import { Complaint, ComplaintStatus, UserProfile, ComplaintPriority, ComplaintCategory } from '../types';
import ComplaintList from './ComplaintList';
import ComplaintForm from './ComplaintForm';
import ClientManagement from './ClientManagement';
import RealTimeMonitor from './RealTimeMonitor';
import { googleSheetsService } from '../services/googleSheetsService';
import { cn } from '../lib/utils';
import { toast } from 'sonner';
import { AppConfig } from '../constants';
import MicVisualizer from './MicVisualizer';

interface AdminPanelProps {
  complaints: Complaint[];
  users: UserProfile[];
  currentUserId: string;
  onDeleteComplaint: (id: string) => Promise<void>;
  onUpdateComplaintStatus: (id: string, status: ComplaintStatus) => Promise<void>;
  onUpdateComplaint: (id: string, data: Partial<Complaint>) => Promise<void>;
  onCreateUser: (username: string, pass: string, role: 'admin' | 'member') => Promise<void>;
  onDeleteUser: (uid: string) => Promise<void>;
  onUpdateUser: (uid: string, username: string, pass: string) => Promise<void>;
  onRegisterComplaint: (data: {
    customerName: string;
    customerUsername: string;
    area: string;
    description: string;
    number: string;
    status: ComplaintStatus;
    category: ComplaintCategory;
    priority: ComplaintPriority;
    pkgDetails?: string;
    userNearby?: string;
  }) => Promise<void>;
  onChangeAdminPass: (newPass: string) => Promise<void>;
  appConfig: AppConfig;
  onUpdateConfig: (newConfig: AppConfig) => void;
  isLoading?: boolean;
  alertAuthorized: boolean;
  onAuthorizeAlerts: () => Promise<void>;
  onSoundTest: () => void;
  isAudioMuted: boolean;
  onToggleAudio: () => void;
  onLogout: () => void;
  micAuthorized: boolean;
  onAuthorizeMic: () => Promise<void>;
  isMicMuted: boolean;
  onToggleMic: () => void;
}

export default function AdminPanel({
  complaints,
  users,
  currentUserId,
  onDeleteComplaint,
  onUpdateComplaintStatus,
  onUpdateComplaint,
  onCreateUser,
  onDeleteUser,
  onUpdateUser,
  onRegisterComplaint,
  onChangeAdminPass,
  appConfig,
  onUpdateConfig,
  isLoading,
  alertAuthorized,
  onAuthorizeAlerts,
  onSoundTest,
  isAudioMuted,
  onToggleAudio,
  onLogout,
  micAuthorized,
  onAuthorizeMic,
  isMicMuted,
  onToggleMic
}: AdminPanelProps) {
  const [activeTab, setActiveTab] = useState<'complaints' | 'users' | 'settings' | 'integrations' | 'submit' | 'critical' | 'config' | 'clients' | 'monitor'>('complaints');
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newUserRole, setNewUserRole] = useState<'admin' | 'member'>('member');
  const [isCreating, setIsCreating] = useState(false);
  
  // User editing state
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editUsername, setEditUsername] = useState('');
  const [editPassword, setEditPassword] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);

  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [adminNewPass, setAdminNewPass] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);

  // Filter state controlled by status tiles
  const [forcedStatus, setForcedStatus] = useState<ComplaintStatus | 'all'>('all');
  const [forcedPriority, setForcedPriority] = useState<ComplaintPriority | 'all'>('all');
  const [forcedCategory, setForcedCategory] = useState<ComplaintCategory | 'all'>('all');

  const stats = [
    { label: 'Total Registry', value: complaints.length, tooltip: 'Total volume of operational records currently stored in the central database.', color: 'border-slate-900 dark:border-brand-accent', textColor: 'text-slate-900 dark:text-white', icon: <Layers size={18} />, filter: { status: 'all', priority: 'all', category: 'all' } },
    { label: 'Pending Requests', value: complaints.filter(c => c.status === 'pending').length, tooltip: 'Operations currently in the queue awaiting technician dispatch or initial resource allocation.', color: 'border-amber-500', textColor: 'text-amber-500', icon: <Clock size={18} />, filter: { status: 'pending', priority: 'all', category: 'all' } },
    { label: 'New Connection', value: complaints.filter(c => c.category === 'New Connection' && c.status === 'pending').length, tooltip: 'Newly registered connection requests awaiting initial infrastructure deployment.', color: 'border-brand-accent', textColor: 'text-brand-accent', icon: <Zap size={18} />, filter: { status: 'pending', priority: 'all', category: 'New Connection' } },
    { label: 'In Operation', value: complaints.filter(c => c.status === 'in process').length, tooltip: 'Active logistics: Tasks currently under execution by on-site technicians.', color: 'border-blue-600', textColor: 'text-blue-600', icon: <TrendingUp size={18} />, filter: { status: 'in process', priority: 'all', category: 'all' } },
    { label: 'Finalized', value: complaints.filter(c => c.status === 'complete' && c.category !== 'New Connection').length, tooltip: 'Service successfully restored and verified according to enterprise protocols.', color: 'border-emerald-500', textColor: 'text-emerald-500', icon: <CheckCircle size={18} />, filter: { status: 'complete', priority: 'all', category: 'all' } },
    { label: 'Connection Complete', value: complaints.filter(c => c.category === 'New Connection' && c.status === 'complete').length, tooltip: 'Newly registered connection requests that have been successfully deployed.', color: 'border-cyan-500', textColor: 'text-cyan-500', icon: <Zap size={18} />, filter: { status: 'complete', priority: 'all', category: 'New Connection' } },
  ];

  const handleTileClick = (filter: any) => {
    setForcedStatus(filter.status || 'all');
    setForcedPriority(filter.priority || 'all');
    setForcedCategory(filter.category || 'all');
    setActiveTab('complaints');
    // Smooth scroll to list
    const listElement = document.getElementById('operations-registry');
    if (listElement) {
      listElement.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const [googleTokens, setGoogleTokens] = useState(googleSheetsService.getTokens());
  
  useEffect(() => {
    const handleAuthChange = (e: any) => {
      setGoogleTokens(e.detail);
    };
    window.addEventListener('google-auth-changed', handleAuthChange);
    return () => window.removeEventListener('google-auth-changed', handleAuthChange);
  }, []);

  const [spreadsheetId, setSpreadsheetId] = useState(googleSheetsService.getSpreadsheetId() || '');
  const [sheetName, setSheetName] = useState(googleSheetsService.getSheetName());
  const [sheetRange, setSheetRange] = useState(googleSheetsService.getSheetRange());
  const [isConnecting, setIsConnecting] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [config, setConfig] = useState<{ redirectUri: string, origin: string } | null>(null);

  // WhatsApp Bridge State
  const [waStatus, setWaStatus] = useState<{ status: string, qrCodeUrl: string | null }>({ status: 'disconnected', qrCodeUrl: null });
  const [isRefreshingWA, setIsRefreshingWA] = useState(false);

  const fetchWAStatus = async () => {
    try {
      const res = await fetch('/api/whatsapp/status');
      const contentType = res.headers.get('content-type');
      if (res.status === 429) {
        console.warn('WhatsApp status polling rate limited');
        return;
      }
      if (contentType && contentType.includes('application/json')) {
        const data = await res.json();
        setWaStatus(data);
      } else {
        // Not JSON, probably server restarting or proxy error
        console.warn('Received non-JSON response from WhatsApp status', res.status);
      }
    } catch (err) {
      console.error('Failed to fetch WA status', err);
    }
  };

  useEffect(() => {
    let interval: any;
    if (activeTab === 'whatsapp') {
      fetchWAStatus();
      interval = setInterval(fetchWAStatus, 5000); // Poll every 5 seconds to avoid background rate limits
    }
    return () => clearInterval(interval);
  }, [activeTab]);

  const handleWALogout = async () => {
    if (!confirm('Are you sure you want to disconnect WhatsApp and clear the session?')) return;
    try {
      await fetch('/api/whatsapp/logout', { method: 'POST' });
      fetchWAStatus();
      toast.success('WhatsApp session cleared successfully');
    } catch (err) {
      toast.error('Failed to logout WhatsApp');
    }
  };

  useEffect(() => {
    if (activeTab === 'integrations') {
      fetch('/api/auth/google/config')
        .then(res => res.json())
        .then(data => setConfig(data))
        .catch(err => console.error('Failed to fetch Google config', err));
    }
  }, [activeTab]);

  const handleGoogleConnect = async () => {
    setIsConnecting(true);
    try {
      const tokens = await googleSheetsService.initiateAuth();
      setGoogleTokens(tokens);
    } catch (err: any) {
      console.error(err);
      if (err.message === 'Auth window closed') {
        toast.error('Authentication cancelled', {
          description: 'Please keep the window open until the process completes.'
        });
      } else {
        toast.error(err.message || 'Failed to connect to Google Account.');
      }
    } finally {
      setIsConnecting(false);
    }
  };

  const handleBulkExport = async () => {
    if (!complaints.length) {
      toast.error('No operational logs found in the registry to export.');
      return;
    }

    setIsExporting(true);
    try {
      await googleSheetsService.exportAllComplaintsToSheets(complaints);
      toast.success('Operational logs successfully synchronized to Google Enterprise Cloud.');
    } catch (err: any) {
      toast.error(err.message || 'Synchronization failed.');
    } finally {
      setIsExporting(false);
    }
  };

  const handleSaveSpreadsheetId = () => {
    googleSheetsService.saveSpreadsheetId(spreadsheetId);
    toast.success('Spreadsheet ID saved successfully!');
  };

  const handleSaveRangeSettings = () => {
    googleSheetsService.saveSheetName(sheetName);
    googleSheetsService.saveSheetRange(sheetRange);
    toast.success('Sheet range settings saved successfully!');
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFormSuccess(null);

    const trimmedName = newUsername.trim();
    if (!trimmedName || !newPassword.trim()) {
      setFormError('Username and password are required.');
      return;
    }

    if (users.some(u => u.username.toLowerCase() === trimmedName.toLowerCase())) {
      setFormError('This username is already taken.');
      return;
    }

    if (trimmedName.toLowerCase() === newPassword.toLowerCase()) {
      setFormError('Security Error: Password cannot match username.');
      return;
    }

    setIsCreating(true);
    try {
      await onCreateUser(trimmedName, newPassword, newUserRole);
      setFormSuccess(`${newUserRole.charAt(0).toUpperCase() + newUserRole.slice(1)} account "${trimmedName}" created!`);
      setNewUsername('');
      setNewPassword('');
      setNewUserRole('member');
      setTimeout(() => setFormSuccess(null), 5000); 
    } catch (err) {
      setFormError('Critical Error: Could not save account.');
    } finally {
      setIsCreating(false);
    }
  };

  const handleStartEditUser = (user: UserProfile) => {
    setEditingUserId(user.uid);
    setEditUsername(user.username);
    setEditPassword(user.password);
  };

  const handleCancelEditUser = () => {
    setEditingUserId(null);
    setEditUsername('');
    setEditPassword('');
  };

  const handleUpdateUser = async (uid: string) => {
    if (!editUsername.trim() || !editPassword.trim()) {
      toast.error('Username and password are required');
      return;
    }
    
    setIsUpdating(true);
    try {
      await onUpdateUser(uid, editUsername.trim(), editPassword.trim());
      setEditingUserId(null);
    } catch (err) {
      console.error(err);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleResetAppData = () => {
    if (confirm('WARNING: This will delete ALL local accounts and complaints permanently. Are you absolutely sure?')) {
      localStorage.removeItem('gts_users');
      localStorage.removeItem('gts_complaints');
      window.location.reload();
    }
  };

  const handleChangeAdminPass = async (e: React.FormEvent) => {
    e.preventDefault();
    await onChangeAdminPass(adminNewPass);
    setAdminNewPass('');
  };

  const inputClasses = "w-full px-4 py-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-accent/30 transition-all font-medium placeholder:text-slate-400";
  const labelClasses = "block text-xs font-black uppercase text-slate-600 dark:text-slate-300 mb-2 tracking-widest ml-1";

  return (
    <div className="space-y-8">
      {/* Stats Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-6">
        {stats.map((stat, idx) => (
          <motion.div
            key={idx}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.1, duration: 0.5, ease: "easeOut" }}
            whileHover={{ y: -5, transition: { duration: 0.2 } }}
            onClick={() => handleTileClick(stat.filter)}
            title={stat.tooltip}
            className={cn(
              "p-6 bg-white dark:bg-slate-950 rounded-2xl border-l-4 shadow-xl shadow-slate-200/20 dark:shadow-none flex flex-col justify-between transition-all group cursor-pointer active:scale-95",
              stat.color,
              (forcedStatus === stat.filter.status && forcedPriority === stat.filter.priority && stat.label !== 'Total Registry') ? "ring-2 ring-brand-accent scale-105" : ""
            )}
          >
            <div className="flex justify-between items-start mb-4">
              <span className="text-xs font-black uppercase tracking-widest text-slate-500 group-hover:text-slate-700 dark:group-hover:text-slate-100 transition-colors">
                {stat.label}
              </span>
              <div className={cn("p-2 rounded-lg transition-colors", 
                stat.textColor === 'text-rose-500' ? "bg-rose-500/10" :
                stat.textColor === 'text-blue-600' ? "bg-blue-600/10" :
                stat.textColor === 'text-emerald-500' ? "bg-emerald-500/10" :
                "bg-slate-100 dark:bg-slate-900"
              )}>
                {stat.icon}
              </div>
            </div>
            <div className={cn("text-4xl font-black tracking-tighter", stat.textColor)}>
              {stat.value.toString().padStart(2, '0')}
            </div>
          </motion.div>
        ))}
      </div>

      {/* Admin Nav */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex flex-wrap gap-2 p-1.5 bg-slate-100 dark:bg-slate-900 rounded-xl w-full lg:w-fit border border-slate-200 dark:border-slate-800">
          {[
            { id: 'complaints', label: 'Operations', icon: ClipboardList },
            { id: 'monitor', label: 'Status Monitor', icon: BarChart3 },
            { id: 'submit', label: 'Complain Reg', icon: PlusSquare },
            { id: 'clients', label: 'User Details', icon: Contact },
            { id: 'users', label: 'Link Access', icon: Users },
            { id: 'config', label: 'Workflow Config', icon: Settings },
            { id: 'settings', label: 'Security', icon: Shield },
            { id: 'whatsapp', label: 'WhatsApp Bridge', icon: MessageSquare },
            { id: 'integrations', label: 'Cloud Connection', icon: CloudUpload },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id as any);
              }}
              className={cn(
                "flex items-center gap-2.5 px-6 py-3 rounded-lg text-sm font-bold uppercase tracking-widest transition-all",
                (activeTab === tab.id)
                  ? "bg-slate-950 dark:bg-brand-accent text-white shadow-lg" 
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white dark:hover:bg-slate-800"
              )}
            >
              <tab.icon size={16} />
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-3">
        </div>
      </div>

      <motion.div
        key={activeTab}
        initial={{ opacity: 0, y: 5 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        id="operations-registry"
      >
        {activeTab === 'whatsapp' && (
          <div className="max-w-4xl mx-auto space-y-8">
            <div className="business-card p-10 bg-white dark:bg-slate-950 overflow-hidden relative">
              <div className="absolute top-0 right-0 p-8">
                 <div className={cn(
                   "flex items-center gap-2 px-4 py-2 rounded-full border text-[10px] font-black uppercase tracking-widest",
                   waStatus.status === 'connected' ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" : 
                   waStatus.status === 'connecting' ? "bg-amber-500/10 text-amber-500 border-amber-500/20" :
                   "bg-rose-500/10 text-rose-500 border-rose-500/20"
                 )}>
                   <div className={cn("w-1.5 h-1.5 rounded-full animate-pulse", 
                     waStatus.status === 'connected' ? "bg-emerald-500" :
                     waStatus.status === 'connecting' ? "bg-amber-500" : "bg-rose-500"
                   )} />
                   {waStatus.status}
                 </div>
              </div>

              <div className="flex items-center gap-5 mb-10">
                <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shadow-sm">
                  <MessageSquare size={28} />
                </div>
                <div>
                  <h3 className="text-xl font-black uppercase tracking-tight">WhatsApp Backend Bridge</h3>
                  <p className="text-slate-500 font-bold uppercase tracking-widest text-[10px] mt-1">Automatic Dispatch & Notification Synchronization</p>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
                 <div className="space-y-6">
                    <p className="text-sm text-slate-600 dark:text-slate-400 font-medium leading-relaxed uppercase">
                      Link your WhatsApp business account to enable <span className="text-emerald-500 font-black">Autonomous Dispatch Protocol</span>. 
                      Once linked, the system will automatically send updates directly to customers without manual intervention.
                    </p>
                    
                    <ul className="space-y-4">
                       {[
                         { icon: Zap, text: 'Instant Registration Notify' },
                         { icon: CheckCircle, text: 'Automatic Resolution Alerts' },
                         { icon: Shield, text: 'Secure Session Encryption' },
                         { icon: RefreshCw, text: 'Background Connection Management' }
                       ].map((item, i) => (
                         <li key={i} className="flex items-center gap-3 text-[11px] font-black uppercase tracking-widest text-slate-500">
                           <item.icon size={14} className="text-emerald-500" />
                           {item.text}
                         </li>
                       ))}
                    </ul>

                    {waStatus.status === 'connected' && (
                      <button
                        onClick={handleWALogout}
                        className="flex items-center gap-2 px-6 py-3 rounded-xl bg-rose-500 text-white text-[10px] font-black uppercase tracking-widest shadow-lg shadow-rose-500/20 hover:bg-rose-600 transition-all"
                      >
                        <Unlink size={14} />
                        Terminate Link
                      </button>
                    )}
                 </div>

                 <div className="flex flex-col items-center justify-center p-8 bg-slate-50 dark:bg-slate-900 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 relative min-h-[350px]">
                    {waStatus.status === 'connected' ? (
                      <div className="text-center space-y-4">
                        <div className="w-24 h-24 rounded-full bg-emerald-500/10 flex items-center justify-center mx-auto border-2 border-emerald-500/30">
                           <Shield size={48} className="text-emerald-500" />
                        </div>
                        <div>
                          <h4 className="text-lg font-black uppercase text-emerald-500 tracking-tight">Active Connection</h4>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Operational Relay is ONLINE</p>
                        </div>
                      </div>
                    ) : waStatus.qrCodeUrl ? (
                      <div className="text-center space-y-6">
                        <div className="relative p-4 bg-white rounded-3xl shadow-2xl border border-slate-200">
                           <img src={waStatus.qrCodeUrl} alt="WhatsApp QR Code" className="w-48 h-48 sm:w-64 sm:h-64" />
                           <div className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity bg-white/40 backdrop-blur-[2px] rounded-3xl pointer-events-none">
                              <QrCode size={48} className="text-slate-900" />
                           </div>
                        </div>
                        <div>
                          <h4 className="text-sm font-black uppercase text-slate-900 dark:text-white tracking-widest">Scan QR Code</h4>
                          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-tight mt-2">Initialize link via WhatsApp Mobile Application</p>
                        </div>
                      </div>
                    ) : (
                      <div className="text-center space-y-4">
                        <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto" />
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Initializing Bridge Module...</p>
                      </div>
                    )}
                 </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'monitor' && (
          <div className="max-w-4xl mx-auto space-y-6">
            <RealTimeMonitor complaints={complaints} />
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6">
               <h3 className="text-sm font-black uppercase tracking-widest text-slate-900 dark:text-white mb-4">Pulse Analysis</h3>
               <p className="text-xs text-slate-500 font-medium leading-relaxed uppercase">
                 The Real-Time Pulse monitor visualizes network orchestration and operational flow within the GTS Infrastructure. Every heartbeat represents a synchronized node state or high-tier priority broadcast.
               </p>
            </div>
          </div>
        )}

        {activeTab === 'complaints' && (
          <ComplaintList
            complaints={complaints}
            onDelete={onDeleteComplaint}
            onStatusChange={onUpdateComplaintStatus}
            onEdit={onUpdateComplaint}
            isAdmin={true}
            currentUserId={currentUserId}
            forcedStatusFilter={forcedStatus}
            forcedPriorityFilter={forcedPriority}
            forcedCategoryFilter={forcedCategory}
            appConfig={appConfig}
          />
        )}

        {activeTab === 'submit' && (
          <div className="max-w-4xl mx-auto">
            <ComplaintForm 
              onSubmit={async (data) => {
                await onRegisterComplaint(data);
                setActiveTab('complaints');
              }} 
              isLoading={isLoading || false} 
              appConfig={appConfig}
            />
          </div>
        )}

        {activeTab === 'clients' && (
          <ClientManagement appConfig={appConfig} isAdmin={true} currentUserId={currentUserId} currentUserName={users.find(u => u.uid === currentUserId)?.username || 'Admin'} />
        )}

        {activeTab === 'users' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-1">
              <div className="business-card p-8 bg-white dark:bg-slate-950">
                <h3 className="text-lg font-black uppercase tracking-tight mb-8 flex items-center gap-3">
                  <UserPlus size={20} className="text-brand-accent" />
                  Link Access
                </h3>
                {formError && (
                  <div className="mb-6 p-4 rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-100 dark:border-red-900/30 text-red-600 dark:text-red-400 text-xs font-bold">
                    {formError}
                  </div>
                )}
                {formSuccess && (
                  <div className="mb-6 p-4 rounded-lg bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/30 text-emerald-600 dark:text-emerald-400 text-xs font-bold">
                    {formSuccess}
                  </div>
                )}
                <form onSubmit={handleCreateUser} className="space-y-6">
                  <div className="space-y-1.5">
                    <label className={labelClasses}>Employee Username</label>
                    <input
                      type="text"
                      value={newUsername}
                      onChange={(e) => setNewUsername(e.target.value)}
                      placeholder="e.g. john_doe"
                      className={inputClasses}
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className={labelClasses}>Access Password</label>
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="••••••••"
                      className={inputClasses}
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className={labelClasses}>Clearance Level</label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setNewUserRole('member')}
                        className={cn(
                          "py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all border",
                          newUserRole === 'member' 
                            ? "bg-slate-900 dark:bg-brand-accent text-white border-slate-900 dark:border-brand-accent" 
                            : "bg-slate-50 dark:bg-slate-900 border-slate-100 dark:border-slate-800 text-slate-500"
                        )}
                      >
                        Field Agent
                      </button>
                      <button
                        type="button"
                        onClick={() => setNewUserRole('admin')}
                        className={cn(
                          "py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all border",
                          newUserRole === 'admin' 
                            ? "bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-500/20" 
                            : "bg-slate-50 dark:bg-slate-900 border-slate-100 dark:border-slate-800 text-slate-500"
                        )}
                      >
                        Supervisor
                      </button>
                    </div>
                  </div>
                  <button
                    type="submit"
                    disabled={isCreating}
                    className="w-full py-4 rounded-lg bg-slate-900 dark:bg-brand-accent text-white font-bold uppercase tracking-widest text-[11px] shadow-lg hover:bg-black dark:hover:bg-blue-700 disabled:opacity-50 transition-all"
                  >
                    {isCreating ? 'Processing Reg...' : 'Initialize Link Access Member'}
                  </button>
                </form>
              </div>
            </div>

            <div className="lg:col-span-2">
              <div className="business-card overflow-hidden bg-white dark:bg-slate-950">
                <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50">
                   <h4 className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">Link Access Directory</h4>
                </div>
                <table className="w-full text-left">
                  <thead className="bg-slate-50 dark:bg-slate-900/50">
                    <tr className="border-b border-slate-100 dark:border-slate-800">
                      <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-500">Identity</th>
                      <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-500">Clearance</th>
                      <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-500">Registry Date</th>
                      <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-500 text-right">Protocol</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 dark:divide-slate-800/50">
                    {users.map((user) => (
                      <tr key={user.uid} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/30 transition-colors">
                        <td className="px-6 py-4">
                          {editingUserId === user.uid ? (
                            <div className="space-y-2">
                              <input
                                type="text"
                                value={editUsername}
                                onChange={(e) => setEditUsername(e.target.value)}
                                className="w-full px-2 py-1 text-sm border rounded bg-white dark:bg-slate-900"
                              />
                              <input
                                type="password"
                                value={editPassword}
                                onChange={(e) => setEditPassword(e.target.value)}
                                placeholder="New Password"
                                className="w-full px-2 py-1 text-sm border rounded bg-white dark:bg-slate-900"
                              />
                            </div>
                          ) : (
                            <span className="font-bold text-slate-900 dark:text-white uppercase tracking-tight">{user.username}</span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <span className={cn(
                            "px-2.5 py-1 rounded text-xs font-black uppercase tracking-widest border",
                            user.role === 'admin' ? "bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800/30" : "bg-slate-50 dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800"
                          )}>
                            {user.role}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-[11px] font-medium text-slate-400 uppercase tracking-tighter">{new Date(user.createdAt).toLocaleDateString()}</td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex justify-end gap-2">
                            {editingUserId === user.uid ? (
                              <>
                                <button
                                  onClick={() => handleUpdateUser(user.uid)}
                                  disabled={isUpdating}
                                  className="p-2 text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 rounded-lg transition-all"
                                  title="Save Changes"
                                >
                                  <Check size={16} />
                                </button>
                                <button
                                  onClick={handleCancelEditUser}
                                  className="p-2 text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-900/50 rounded-lg transition-all"
                                  title="Cancel"
                                >
                                  <X size={16} />
                                </button>
                              </>
                            ) : (
                              <>
                                <button
                                  onClick={() => handleStartEditUser(user)}
                                  className="p-2 text-slate-300 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-500/10 rounded-lg transition-all"
                                  title="Edit Credentials"
                                >
                                  <Pencil size={16} />
                                </button>
                                {user.uid !== currentUserId ? (
                                  deletingId === user.uid ? (
                                    <>
                                      <button
                                        onClick={async () => {
                                          try { await onDeleteUser(user.uid); setDeletingId(null); } catch (err) { toast.error('Unauthorized action'); }
                                        }}
                                        className="px-3 py-1.5 text-[9px] font-black text-white bg-red-600 rounded-md hover:bg-red-700 shadow-md shadow-red-500/20 uppercase tracking-widest"
                                      >
                                        Confirm
                                      </button>
                                      <button
                                        onClick={() => setDeletingId(null)}
                                        className="px-3 py-1.5 text-[9px] font-bold text-slate-400 hover:text-slate-900 uppercase tracking-widest"
                                      >
                                        No
                                      </button>
                                    </>
                                  ) : (
                                    <button
                                      onClick={() => setDeletingId(user.uid)}
                                      className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-all"
                                      title="Revoke Access"
                                    >
                                      <Trash2 size={16} />
                                    </button>
                                  )
                                ) : (
                                  <span className="text-[9px] uppercase font-black text-brand-accent tracking-widest bg-brand-accent/10 px-3 py-1 rounded">Self</span>
                                )}
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="max-w-2xl space-y-8">
            <div className="business-card p-10 bg-white dark:bg-slate-950">
              <div className="flex items-center gap-5 mb-10">
                <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500 shadow-sm">
                  <Volume2 size={28} />
                </div>
                <div>
                  <h3 className="text-xl font-black uppercase tracking-tight">System Audio & Matrix</h3>
                  <p className="text-slate-500 font-bold uppercase tracking-widest text-[10px] mt-1">Notification Matrix & Hardware Control</p>
                </div>
              </div>

              <div className="space-y-8">
                {/* Audio Matrix Section */}
                <div className="space-y-4">
                  <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Audio & Speaker Hub</h4>
                  {!alertAuthorized ? (
                    <div className="p-6 rounded-2xl bg-amber-500/5 border border-amber-500/20">
                      <p className="text-xs font-bold text-amber-600 dark:text-amber-400 mb-4 leading-relaxed uppercase tracking-widest text-center">
                        Synthesizer and alert speakers are restricted by current policy.
                      </p>
                      <button
                        onClick={onAuthorizeAlerts}
                        className="w-full py-4 rounded-xl bg-amber-500 text-white font-black uppercase tracking-widest text-xs shadow-lg hover:bg-amber-600 transition-all"
                      >
                        Initialize Speaker Matrix
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between p-4 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800">
                        <div className="flex items-center gap-3">
                          {isAudioMuted ? <VolumeX className="text-rose-500" size={18} /> : <Volume2 className="text-emerald-500" size={18} />}
                          <div>
                            <p className="text-xs font-black uppercase tracking-widest text-slate-700 dark:text-slate-300">Alert Audio</p>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">{isAudioMuted ? 'Notifications Suspended' : 'Notifications Active'}</p>
                          </div>
                        </div>
                        <button
                          onClick={onToggleAudio}
                          className={cn(
                            "px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all",
                            isAudioMuted ? "bg-emerald-500 text-white shadow-lg" : "bg-rose-500 text-white shadow-lg"
                          )}
                        >
                          {isAudioMuted ? 'Turn On' : 'Turn Off'}
                        </button>
                      </div>

                      <button
                        onClick={onSoundTest}
                        className="w-full py-3 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 font-black uppercase tracking-widest text-[10px] hover:bg-slate-50 dark:hover:bg-slate-900 transition-all flex items-center justify-center gap-3"
                      >
                        <Zap size={14} className="text-amber-500" />
                        Execute Speaker Sync Test
                      </button>
                    </div>
                  )}
                </div>

                {/* Microphone Section */}
                <div className="space-y-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                  <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Tactical Voice Input</h4>
                  {!micAuthorized ? (
                    <div className="p-6 rounded-2xl bg-blue-500/5 border border-blue-500/20">
                      <p className="text-xs font-bold text-blue-600 dark:text-blue-400 mb-4 leading-relaxed uppercase tracking-widest text-center">
                        Microphone capture protocols are currently offline.
                      </p>
                      <button
                        onClick={onAuthorizeMic}
                        className="w-full py-4 rounded-xl bg-blue-600 text-white font-black uppercase tracking-widest text-xs shadow-lg hover:bg-blue-700 transition-all"
                      >
                        Authorize Mic Input
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between p-4 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800">
                        <div className="flex items-center gap-3">
                          {isMicMuted ? <VolumeX className="text-rose-500" size={18} /> : <Mic className="text-blue-500" size={18} />}
                          <div>
                            <p className="text-xs font-black uppercase tracking-widest text-slate-700 dark:text-slate-300">Tactical Mic</p>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">{isMicMuted ? 'Capture Suppressed' : 'Capture Active'}</p>
                          </div>
                        </div>
                        <button
                          onClick={onToggleMic}
                          className={cn(
                            "px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all",
                            isMicMuted ? "bg-emerald-500 text-white shadow-lg" : "bg-rose-500 text-white shadow-lg"
                          )}
                        >
                          {isMicMuted ? 'Turn On' : 'Turn Off'}
                        </button>
                      </div>

                      <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800">
                        <MicVisualizer isMuted={isMicMuted} isAuthorized={micAuthorized} />
                      </div>
                    </div>
                  )}
                </div>

                <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
                  <button
                    onClick={onLogout}
                    className="w-full py-4 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-black uppercase tracking-widest text-xs shadow-lg flex items-center justify-center gap-3 hover:scale-[1.02] transition-all"
                  >
                    <LogOut size={16} />
                    Sign Out Session
                  </button>
                </div>
              </div>
            </div>

            <div className="business-card p-10 bg-white dark:bg-slate-950">
              <div className="flex items-center gap-5 mb-10">
                <div className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-center text-slate-900 dark:text-brand-accent shadow-sm">
                  <Shield size={28} />
                </div>
                <div>
                  <h3 className="text-xl font-black uppercase tracking-tight">Security Hardening</h3>
                  <p className="text-slate-500 font-bold uppercase tracking-widest text-[10px] mt-1">Personnel Authorization Management</p>
                </div>
              </div>

              <form onSubmit={handleChangeAdminPass} className="space-y-8">
                <div className="space-y-2">
                  <label className={labelClasses}>New Supervisor Passkey</label>
                  <div className="relative">
                    <Key className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input
                      type="password"
                      value={adminNewPass}
                      onChange={(e) => setAdminNewPass(e.target.value)}
                      placeholder="Initialize secure passkey replacement"
                      className={inputClasses}
                      required
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  className="px-8 py-4 rounded-lg bg-slate-900 dark:bg-brand-accent text-white font-bold uppercase tracking-widest text-xs shadow-lg hover:bg-black dark:hover:bg-blue-700 transition-all"
                >
                  Confirm Passkey Revision
                </button>
              </form>
            </div>

            <div className="p-8 business-card bg-rose-50/50 dark:bg-rose-950/10 border-rose-100 dark:border-rose-900/30">
              <h3 className="text-lg font-black uppercase tracking-tight text-rose-600 mb-2">Protocol Reset</h3>
              <p className="text-slate-500 font-medium text-sm mb-8 leading-relaxed">WARNING: Initiating a factory reset will terminate all existing operations, registries, and login accounts. This action is final and non-reversible.</p>
              <button
                onClick={handleResetAppData}
                className="px-6 py-3 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-[11px] uppercase font-black tracking-widest transition-all shadow-xl shadow-rose-500/20"
              >
                Execute Global Purge
              </button>
            </div>
          </div>
        )}

        {activeTab === 'config' && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-8">
              {/* Category Management */}
              <div className="business-card p-6 bg-white dark:bg-slate-950">
                <div className="flex items-center justify-between mb-6">
                  <h4 className="text-xs font-black uppercase tracking-widest text-slate-500">Service Categories</h4>
                  <Layers size={16} className="text-blue-500" />
                </div>
                
                <div className="space-y-4">
                  <div className="flex gap-2">
                    <input 
                      type="text" 
                      placeholder="Add Category..." 
                      className="flex-1 text-[11px] font-bold px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          const val = e.currentTarget.value.trim();
                          if (val && !appConfig.categories.includes(val)) {
                            onUpdateConfig({ ...appConfig, categories: [...appConfig.categories, val] });
                            e.currentTarget.value = '';
                          }
                        }
                      }}
                    />
                  </div>
                  
                  <div className="flex flex-wrap gap-2 max-h-[300px] overflow-y-auto pr-1">
                    {appConfig.categories.map((cat, i) => (
                      <div key={i} className="group relative flex items-center gap-2 px-3 py-1.5 bg-slate-100 dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 text-[10px] font-bold uppercase tracking-tight">
                        <span className="text-slate-700 dark:text-slate-300 uppercase">{cat}</span>
                        <button 
                          onClick={() => {
                            if (appConfig.categories.length > 1) {
                              onUpdateConfig({ ...appConfig, categories: appConfig.categories.filter(c => c !== cat) });
                            } else {
                              toast.error('At least one category is required.');
                            }
                          }}
                          className="text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                        >
                          <X size={10} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Status Management */}
              <div className="business-card p-6 bg-white dark:bg-slate-950">
                <div className="flex items-center justify-between mb-6">
                  <h4 className="text-xs font-black uppercase tracking-widest text-slate-500">Workflow Statuses</h4>
                  <Activity size={16} className="text-amber-500" />
                </div>
                
                <div className="space-y-4">
                  <div className="flex gap-2">
                    <input 
                      type="text" 
                      placeholder="Add Status..." 
                      className="flex-1 text-[11px] font-bold px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          const val = e.currentTarget.value.trim();
                          if (val && !appConfig.statuses.includes(val)) {
                            onUpdateConfig({ ...appConfig, statuses: [...appConfig.statuses, val] });
                            e.currentTarget.value = '';
                          }
                        }
                      }}
                    />
                  </div>
                  
                  <div className="flex flex-wrap gap-2">
                    {appConfig.statuses.map((stat, i) => (
                      <div key={i} className="group relative flex items-center gap-2 px-3 py-1.5 bg-slate-100 dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 text-[10px] font-bold uppercase tracking-tight">
                        <span className="text-slate-700 dark:text-slate-300">{stat}</span>
                        <button 
                          onClick={() => {
                            if (appConfig.statuses.length > 1) {
                              onUpdateConfig({ ...appConfig, statuses: appConfig.statuses.filter(s => s !== stat) });
                            } else {
                              toast.error('At least one status is required.');
                            }
                          }}
                          className="text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                        >
                          <X size={10} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Priority Management */}
              <div className="business-card p-6 bg-white dark:bg-slate-950">
                <div className="flex items-center justify-between mb-6">
                  <h4 className="text-xs font-black uppercase tracking-widest text-slate-500">Priority Levels</h4>
                  <ShieldAlert size={16} className="text-rose-500" />
                </div>
                
                <div className="space-y-4">
                  <div className="flex gap-2">
                    <input 
                      type="text" 
                      placeholder="Add Priority..." 
                      className="flex-1 text-[11px] font-bold px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 focus:outline-none focus:ring-2 focus:ring-rose-500/20"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          const val = e.currentTarget.value.trim();
                          if (val && !appConfig.priorities.includes(val)) {
                            onUpdateConfig({ ...appConfig, priorities: [...appConfig.priorities, val] });
                            e.currentTarget.value = '';
                          }
                        }
                      }}
                    />
                  </div>
                  
                  <div className="flex flex-wrap gap-2">
                    {appConfig.priorities.map((pri, i) => (
                      <div key={i} className="group relative flex items-center gap-2 px-3 py-1.5 bg-slate-100 dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 text-[10px] font-bold uppercase tracking-tight">
                        <span className="text-slate-700 dark:text-slate-300">{pri}</span>
                        <button 
                          onClick={() => {
                            if (appConfig.priorities.length > 1) {
                              onUpdateConfig({ ...appConfig, priorities: appConfig.priorities.filter(p => p !== pri) });
                            } else {
                              toast.error('At least one priority level is required.');
                            }
                          }}
                          className="text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                        >
                          <X size={10} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Zone Management */}
              <div className="business-card p-6 bg-white dark:bg-slate-950">
                <div className="flex items-center justify-between mb-6">
                  <h4 className="text-xs font-black uppercase tracking-widest text-slate-500">Operation Zones</h4>
                  <MapPin size={16} className="text-emerald-500" />
                </div>
                
                <div className="space-y-4">
                  <div className="flex gap-2">
                    <input 
                      type="text" 
                      placeholder="Add Zone..." 
                      className="flex-1 text-[11px] font-bold px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          const val = e.currentTarget.value.trim();
                          if (val && !appConfig.zones?.includes(val)) {
                            onUpdateConfig({ ...appConfig, zones: [...(appConfig.zones || []), val] });
                            e.currentTarget.value = '';
                          }
                        }
                      }}
                    />
                  </div>
                  
                  <div className="flex flex-wrap gap-2 max-h-[300px] overflow-y-auto pr-1">
                    {appConfig.zones?.map((zone, i) => (
                      <div key={i} className="group relative flex items-center gap-2 px-3 py-1.5 bg-slate-100 dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 text-[10px] font-bold uppercase tracking-tight">
                        <span className="text-slate-700 dark:text-slate-300">{zone}</span>
                        <button 
                          onClick={() => {
                            if (appConfig.zones.length > 1) {
                              onUpdateConfig({ ...appConfig, zones: appConfig.zones.filter(z => z !== zone) });
                            } else {
                              toast.error('At least one zone is required.');
                            }
                          }}
                          className="text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                        >
                          <X size={10} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            
            <div className="p-4 rounded-xl bg-blue-50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/30 flex items-start gap-4">
              <Info className="text-blue-600 mt-0.5" size={16} />
              <div className="text-[10px] font-medium text-slate-500 dark:text-slate-400 leading-relaxed uppercase tracking-widest">
                System configuration shifts are propagated in real-time to all members. Changes to categories, statuses, and zones will immediately reflect in the submission and auditing forms.
              </div>
            </div>
          </div>
        )}

        {/* Cloud Sync Tab */}
        {activeTab === 'integrations' && (
          <div className="max-w-4xl grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="business-card p-10 bg-white dark:bg-slate-950 flex flex-col h-full">
              <div className="flex items-center gap-5 mb-10">
                <div className="w-14 h-14 rounded-2xl bg-blue-50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/30 flex items-center justify-center text-blue-600">
                  <CloudUpload size={28} />
                </div>
                <div>
                  <h3 className="text-xl font-black uppercase tracking-tight">Google Drive & Sheets</h3>
                  <p className="text-slate-500 font-bold uppercase tracking-widest text-[10px] mt-1">Enterprise Cloud Authorization</p>
                </div>
              </div>

              {!googleTokens ? (
                <div className="flex-1 flex flex-col justify-between">
                  <div className="space-y-6">
                    <p className="text-slate-500 font-medium text-sm leading-relaxed">
                      Authorize access to your Google account to enable real-time operational backups and cloud spreadsheet synchronization.
                    </p>
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                        <CheckCircle size={12} className="text-emerald-500" />
                        Automatic CSV Backups
                      </div>
                      <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                        <CheckCircle size={12} className="text-emerald-500" />
                        Live Spreadsheet Mirroring
                      </div>
                      <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                        <CheckCircle size={12} className="text-emerald-500" />
                        Secure Enterprise Data Storage
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={handleGoogleConnect}
                    disabled={isConnecting}
                    className="mt-10 inline-flex items-center justify-center gap-3 px-8 py-5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-black uppercase tracking-widest text-xs transition-all shadow-xl shadow-blue-600/30 active:scale-95 disabled:opacity-50"
                  >
                    {isConnecting ? 'Linking Service...' : 'Link Google Account'}
                    <ExternalLink size={16} />
                  </button>
                </div>
              ) : (
                <div className="flex-1 flex flex-col justify-between">
                  <div className="space-y-8">
                    <div className="p-6 rounded-2xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/50">
                      <div className="flex items-center justify-between mb-4">
                        <span className="text-[11px] font-black uppercase tracking-widest text-emerald-600">Primary Channel Secure</span>
                        <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                      </div>
                      <div className="flex items-center gap-3 text-slate-900 dark:text-white">
                        <div className="w-10 h-10 rounded-full bg-white dark:bg-slate-900 flex items-center justify-center font-black text-blue-600 shadow-sm border border-slate-100 dark:border-slate-800">
                          G
                        </div>
                        <div className="text-xs font-bold uppercase tracking-widest truncate">
                          Enterprise Account Active
                        </div>
                      </div>
                    </div>
                    
                    <div className="space-y-4">
                      <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 px-1">Infrastructure Status</h4>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800">
                          <div className="text-[9px] font-black text-slate-400 uppercase mb-1">Drive Access</div>
                          <div className="text-[10px] font-bold text-emerald-500 uppercase">Verified</div>
                        </div>
                        <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800">
                          <div className="text-[9px] font-black text-slate-400 uppercase mb-1">Sheets Sync</div>
                          <div className="text-[10px] font-bold text-emerald-500 uppercase">Verified</div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <button 
                    onClick={() => { googleSheetsService.clearAuth(); setGoogleTokens(null); }} 
                    className="mt-10 w-full py-4 rounded-xl border-2 border-rose-500/20 text-rose-500 font-bold text-[10px] uppercase tracking-widest hover:bg-rose-500 hover:text-white transition-all"
                  >
                    Disconnect Enterprise Protocol
                  </button>
                </div>
              )}
            </div>

            <div className="space-y-8">
              {googleTokens && (
                <div className="business-card p-10 bg-white dark:bg-slate-950">
                  <div className="flex items-center gap-4 mb-8">
                    <FileSpreadsheet size={20} className="text-emerald-500" />
                    <h4 className="text-sm font-black uppercase tracking-widest">Mirroring Parameters</h4>
                  </div>

                  <div className="space-y-6">
                    <div className="space-y-2">
                       <label className={labelClasses}>Spreadsheet Identity</label>
                       <div className="flex gap-3">
                         <input type="text" value={spreadsheetId} onChange={(e) => setSpreadsheetId(e.target.value)} className={inputClasses} placeholder="SPREADSHEET_ID" />
                         <button onClick={handleSaveSpreadsheetId} className="px-5 py-2.5 rounded-lg bg-slate-900 dark:bg-slate-800 text-white font-bold text-[10px] uppercase tracking-widest hover:bg-black transition-colors">Save</button>
                       </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                       <div className="space-y-2">
                          <label className={labelClasses}>Target Sheet</label>
                          <input type="text" value={sheetName} onChange={(e) => setSheetName(e.target.value)} className={inputClasses} placeholder="Sheet1" />
                       </div>
                       <div className="space-y-2">
                          <label className={labelClasses}>Point Range</label>
                          <input type="text" value={sheetRange} onChange={(e) => setSheetRange(e.target.value)} className={inputClasses} placeholder="A1" />
                       </div>
                    </div>
                    
                    <button onClick={handleSaveRangeSettings} className="w-full py-4 rounded-lg border-2 border-slate-900 dark:border-brand-accent text-slate-900 dark:text-brand-accent font-black uppercase tracking-widest text-[11px] hover:bg-slate-900 dark:hover:bg-brand-accent hover:text-white transition-all">Submit Mapping</button>
                  </div>
                </div>
              )}

              {config && !googleTokens && (
                <div className="business-card p-8 bg-blue-50 dark:bg-blue-900/10 border-blue-100 dark:border-blue-900/30">
                  <div className="flex items-center gap-3 mb-6">
                    <Settings size={18} className="text-blue-600" />
                    <h4 className="text-xs font-black uppercase tracking-widest text-blue-600">Enterprise Credentials</h4>
                  </div>
                  
                  <div className="space-y-4">
                    <div className="space-y-1.5">
                      <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 ml-1">Redirect Origin</label>
                      <div className="flex items-center gap-2 p-3 bg-white dark:bg-slate-950 rounded-lg border border-blue-200 dark:border-blue-800">
                        <code className="text-[10px] font-mono text-slate-600 dark:text-slate-400 break-all flex-1">{config.origin}</code>
                        <button onClick={() => { navigator.clipboard.writeText(config.origin); toast.success('Copied to clipboard'); }} className="text-blue-600 p-1"><Copy size={12} /></button>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 ml-1">Redirect Endpoint</label>
                      <div className="flex items-center gap-2 p-3 bg-white dark:bg-slate-950 rounded-lg border border-blue-200 dark:border-blue-800">
                        <code className="text-[10px] font-mono text-slate-600 dark:text-slate-400 break-all flex-1">{config.redirectUri}</code>
                        <button onClick={() => { navigator.clipboard.writeText(config.redirectUri); toast.success('Copied to clipboard'); }} className="text-blue-600 p-1"><Copy size={12} /></button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
}

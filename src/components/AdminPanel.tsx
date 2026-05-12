import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { UserPlus, Settings, Users, ClipboardList, Key, Shield, Trash2, FileSpreadsheet, ExternalLink, HardDriveDownload, Layers, ShieldAlert, CheckCircle, X, Pencil, Check, Info, Copy, PlusSquare, CloudUpload, Zap, MapPin, Bell, Contact, MapPinned, Volume2, VolumeX, LogOut, Clock, TrendingUp, BarChart3, Mic, Activity, MessageSquare, Flame } from 'lucide-react';
import { Complaint, ComplaintStatus, UserProfile, ComplaintPriority, ComplaintCategory } from '../types';
import ComplaintList from './ComplaintList';
import ComplaintForm from './ComplaintForm';
import ClientManagement from './ClientManagement';
import RealTimeMonitor from './RealTimeMonitor';
import DistributionList from './DistributionList';
import HighFrequencyNodes from './HighFrequencyNodes';
import { googleSheetsService } from '../services/googleSheetsService';
import { firebaseService } from '../lib/firebaseService';
import { cn } from '../lib/utils';
import { toast } from 'sonner';
import { AppConfig } from '../constants';
import MicVisualizer from './MicVisualizer';

interface AdminPanelProps {
  complaints: Complaint[];
  users: UserProfile[];
  currentUser: UserProfile;
  onDeleteComplaint: (id: string) => Promise<void>;
  onUpdateComplaintStatus: (id: string, status: ComplaintStatus, remarks?: string) => Promise<void>;
  onUpdateRemarks: (id: string, remarks: string) => Promise<void>;
  onUpdateComplaint: (id: string, data: Partial<Complaint>) => Promise<void>;
  onCreateUser: (username: string, pass: string, role: UserProfile['role'], dealerId?: string, lineCode?: string, companyName?: string) => Promise<void>;
  onDeleteUser: (uid: string) => Promise<void>;
  onUpdateUser: (uid: string, username: string, pass: string, lineCode?: string, companyName?: string) => Promise<void>;
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
  onChatUser?: (uid: string) => void;
}

export default function AdminPanel({
  complaints,
  users,
  currentUser,
  onDeleteComplaint,
  onUpdateComplaintStatus,
  onUpdateRemarks,
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
  onToggleMic,
  onChatUser
}: AdminPanelProps) {
  const [activeTab, setActiveTab] = useState<'complaints' | 'users' | 'settings' | 'integrations' | 'submit' | 'critical' | 'config' | 'clients' | 'monitor' | 'dealers'>('complaints');
  const [isFormVisible, setIsFormVisible] = useState(true);
  const [isChartsVisible, setIsChartsVisible] = useState(true);
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newLineCode, setNewLineCode] = useState('');
  const [newCompanyName, setNewCompanyName] = useState('');
  const [newUserRole, setNewUserRole] = useState<UserProfile['role']>('member');
  const [isCreating, setIsCreating] = useState(false);
  const [selectedDealerId, setSelectedDealerId] = useState<string | 'all'>('all');
  
  // User editing state
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editUsername, setEditUsername] = useState('');
  const [editPassword, setEditPassword] = useState('');
  const [editLineCode, setEditLineCode] = useState('');
  const [editCompanyName, setEditCompanyName] = useState('');
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

  useEffect(() => {
    if (activeTab === 'integrations') {
      fetch('/api/auth/google/config')
        .then(res => res.json())
        .then(data => setConfig(data))
        .catch(err => console.error('Failed to fetch Google config', err instanceof Error ? err.message : String(err)));
    }
  }, [activeTab]);

  const handleGoogleConnect = async () => {
    setIsConnecting(true);
    try {
      const tokens = await googleSheetsService.initiateAuth();
      setGoogleTokens(tokens);
    } catch (err: any) {
      console.error(err instanceof Error ? err.message : String(err));
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
      if (activeTab === 'dealers') {
        if (!newLineCode.trim()) {
          setFormError('Line Code is required for Dealer accounts.');
          setIsCreating(false);
          return;
        }
        await onCreateUser(trimmedName, newPassword, 'dealer', undefined, newLineCode.trim(), newCompanyName.trim());
        setFormSuccess(`Dealer account "${trimmedName}" created with Line Code: ${newLineCode}`);
        setNewLineCode('');
        setNewCompanyName('');
      } else {
        // Correctly associate the new user with the dealer if the current user is a dealer or a dealer's admin
        const effectiveDealerId = currentUser.role === 'dealer' ? currentUser.uid : currentUser.dealerId;
        await onCreateUser(trimmedName, newPassword, newUserRole, effectiveDealerId);
        setFormSuccess(`${newUserRole.charAt(0).toUpperCase() + newUserRole.slice(1)} account "${trimmedName}" created!`);
      }
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
    setEditPassword(user.password || '');
    setEditLineCode(user.lineCode || '');
    setEditCompanyName(user.companyName || '');
  };

  const handleCancelEditUser = () => {
    setEditingUserId(null);
    setEditUsername('');
    setEditPassword('');
    setEditLineCode('');
    setEditCompanyName('');
  };

  const handleUpdateUser = async (uid: string) => {
    if (!editUsername.trim() || !editPassword.trim()) {
      toast.error('Username and password are required');
      return;
    }
    
    setIsUpdating(true);
    try {
      await onUpdateUser(uid, editUsername.trim(), editPassword.trim(), editLineCode.trim() || undefined, editCompanyName.trim() || undefined);
      setEditingUserId(null);
    } catch (err) {
      console.error(err instanceof Error ? err.message : String(err));
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
    <div className="space-y-12">
      {/* Stats Overview */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 sm:gap-6">
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
              "p-3 sm:p-6 bg-white dark:bg-slate-950 rounded-xl sm:rounded-2xl border-l-4 shadow-xl shadow-slate-200/20 dark:shadow-none flex flex-col justify-between transition-all group cursor-pointer active:scale-95",
              stat.color,
              (forcedStatus === stat.filter.status && forcedPriority === stat.filter.priority && stat.label !== 'Total Registry') ? "ring-2 ring-brand-accent scale-105" : ""
            )}
          >
            <div className="flex justify-between items-start mb-2 sm:mb-4">
              <span className="text-[9px] sm:text-xs font-black uppercase tracking-widest text-slate-500 group-hover:text-slate-700 dark:group-hover:text-slate-100 transition-colors leading-tight">
                {stat.label}
              </span>
              <div className={cn("p-1.5 sm:p-2 rounded-lg transition-colors shrink-0", 
                stat.textColor === 'text-rose-500' ? "bg-rose-500/10" :
                stat.textColor === 'text-blue-600' ? "bg-blue-600/10" :
                stat.textColor === 'text-emerald-500' ? "bg-emerald-500/10" :
                "bg-slate-100 dark:bg-slate-900"
              )}>
                {React.cloneElement(stat.icon as React.ReactElement, { size: window.innerWidth < 640 ? 14 : 18 })}
              </div>
            </div>
            <div className={cn("text-2xl sm:text-4xl font-black tracking-tighter", stat.textColor)}>
              {stat.value.toString().padStart(2, '0')}
            </div>
          </motion.div>
        ))}
      </div>

      {/* Analytics Dashboards - Below Stat Boxes */}
      <div className="space-y-6 mb-6">
        <div 
          className="text-center space-y-2 mb-10 cursor-pointer select-none group"
          onDoubleClick={() => setIsChartsVisible(!isChartsVisible)}
          title="Double-click to toggle analytics"
        >
          <h2 className="text-3xl font-black uppercase tracking-tight text-slate-900 dark:text-slate-50 group-hover:scale-105 transition-transform duration-500">Chart Analytics</h2>
          <p className="text-[10px] font-bold uppercase tracking-[0.4em] text-slate-400 dark:text-slate-500">Real-time operational data visualization</p>
        </div>

        <AnimatePresence mode="wait">
          {isChartsVisible && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9, filter: 'blur(20px)', y: 20 }}
              animate={{ opacity: 1, scale: 1, filter: 'blur(0px)', y: 0 }}
              exit={{ 
                opacity: 0, 
                scale: 0.8, 
                x: -400, 
                y: -100, 
                rotate: -15, 
                skewX: -40, 
                filter: 'blur(50px)',
                transition: { duration: 1.2, ease: [0.4, 0, 0.2, 1] }
              }}
              transition={{ 
                duration: 0.8, 
                ease: [0.16, 1, 0.3, 1] 
              }}
              className="grid grid-cols-1 xl:grid-cols-3 lg:grid-cols-2 gap-6 origin-right"
            >
              <div className="h-[300px] sm:h-[400px] shadow-sm rounded-2xl">
                <DistributionList complaints={complaints} chartType="area" />
              </div>
              <div className="h-[300px] sm:h-[400px] shadow-sm rounded-2xl md:col-span-1 lg:col-span-2 xl:col-span-1">
                <RealTimeMonitor complaints={complaints} />
              </div>
              <div className="h-[300px] sm:h-[400px] shadow-sm rounded-2xl">
                <DistributionList complaints={complaints} chartType="category" />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Admin Nav */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex flex-wrap gap-2 p-1.5 bg-slate-100 dark:bg-slate-900 rounded-xl w-full lg:w-fit border border-slate-200 dark:border-slate-800">
          {[
            { id: 'complaints', label: 'Operations', icon: ClipboardList },
            ...(currentUser.role === 'super_admin' ? [{ id: 'dealers_data', label: 'Dealers Data', icon: BarChart3 }] : []),
            { id: 'submit', label: 'Complain Reg', icon: PlusSquare },
            { id: 'clients', label: 'User Details', icon: Contact },
            { id: 'nodes', label: 'Active Nodes', icon: Flame },
            { id: 'users', label: 'Link Access', icon: Users },
            ...(currentUser.role === 'super_admin' ? [{ id: 'dealers', label: 'Dealer Section', icon: ShieldAlert }] : []),
            { id: 'config', label: 'Workflow Config', icon: Settings },
            { id: 'settings', label: 'Security', icon: Shield },
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
        {activeTab === 'complaints' && (
          <div className="space-y-6">
            {selectedDealerId !== 'all' && (
              <div className="flex items-center justify-between p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-900/30 rounded-xl">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white">
                    <BarChart3 size={16} />
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-blue-600">Active Dealer Audit Filter</p>
                    <p className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-tight">Viewing data for: {users.find(u => u.uid === selectedDealerId)?.username || 'Selected Dealer'}</p>
                  </div>
                </div>
                <button 
                  onClick={() => setSelectedDealerId('all')}
                  className="px-4 py-2 rounded-lg bg-white dark:bg-slate-900 border border-blue-100 dark:border-blue-800 text-[10px] font-black uppercase tracking-widest text-blue-600 hover:bg-blue-50 transition-all shadow-sm"
                >
                  Clear Filter
                </button>
              </div>
            )}
            <ComplaintList
              complaints={selectedDealerId === 'all' ? complaints : complaints.filter(c => c.dealerId === selectedDealerId)}
              onDelete={onDeleteComplaint}
              onStatusChange={onUpdateComplaintStatus}
              onUpdateRemarks={onUpdateRemarks}
              onEdit={onUpdateComplaint}
              isAdmin={true}
              currentUser={currentUser}
              forcedStatusFilter={forcedStatus}
              forcedPriorityFilter={forcedPriority}
              forcedCategoryFilter={forcedCategory}
              appConfig={appConfig}
            />
          </div>
        )}

        {activeTab === 'dealers_data' && currentUser.role === 'super_admin' && (
          <div className="space-y-8">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1">
                <h3 className="text-2xl font-black uppercase tracking-tight">Dealer Intelligence</h3>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Select an authorized dealer network to audit operational performance</p>
              </div>
              <div className="flex bg-slate-100 dark:bg-slate-900 p-1 rounded-xl border border-slate-200 dark:border-slate-800">
                <button 
                  onClick={() => setSelectedDealerId('all')}
                  className={cn(
                    "px-6 py-2.5 rounded-lg text-xs font-black uppercase tracking-widest transition-all",
                    selectedDealerId === 'all' ? "bg-slate-950 dark:bg-brand-accent text-white" : "text-slate-500 hover:text-slate-900"
                  )}
                >
                  Global View
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {users.filter(u => u.role === 'dealer').map((dealer) => {
                const dealerComplaints = complaints.filter(c => c.dealerId === dealer.uid);
                const pending = dealerComplaints.filter(c => c.status === 'pending').length;
                const completed = dealerComplaints.filter(c => c.status === 'complete').length;
                
                return (
                  <motion.div
                    key={dealer.uid}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => {
                      setSelectedDealerId(dealer.uid);
                      setActiveTab('complaints');
                    }}
                    className={cn(
                      "p-6 rounded-2xl border-2 transition-all cursor-pointer group",
                      selectedDealerId === dealer.uid 
                        ? "bg-slate-950 dark:bg-brand-accent text-white border-slate-950 dark:border-brand-accent" 
                        : "bg-white dark:bg-slate-950 border-slate-100 dark:border-slate-800 hover:border-brand-accent/50"
                    )}
                  >
                    <div className="flex justify-between items-start mb-6">
                      <div className={cn(
                        "w-12 h-12 rounded-xl flex items-center justify-center",
                        selectedDealerId === dealer.uid ? "bg-white/10" : "bg-slate-100 dark:bg-slate-900"
                      )}>
                        <TrendingUp size={24} className={selectedDealerId === dealer.uid ? "text-white" : "text-brand-accent"} />
                      </div>
                      <div className={cn(
                        "px-3 py-1 rounded text-[9px] font-black uppercase tracking-widest border",
                        selectedDealerId === dealer.uid ? "bg-white/20 border-white/30" : "bg-slate-100 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-500"
                      )}>
                        {dealer.lineCode}
                      </div>
                    </div>
                    
                    <h4 className="text-lg font-black uppercase tracking-tight mb-1 truncate">{dealer.username}</h4>
                    <p className={cn("text-[10px] font-bold uppercase tracking-widest mb-6", selectedDealerId === dealer.uid ? "text-white/60" : "text-slate-400")}>Authorized Dealer Network</p>
                    
                    <div className="grid grid-cols-2 gap-4 pt-4 border-t border-white/10 dark:border-slate-800">
                      <div>
                        <p className={cn("text-[9px] font-black uppercase tracking-widest", selectedDealerId === dealer.uid ? "text-white/40" : "text-slate-500")}>Operations</p>
                        <p className="text-xl font-black tracking-tighter">{dealerComplaints.length}</p>
                      </div>
                      <div>
                        <p className={cn("text-[9px] font-black uppercase tracking-widest", selectedDealerId === dealer.uid ? "text-white/40" : "text-slate-500")}>Pending</p>
                        <p className="text-xl font-black tracking-tighter text-amber-500">{pending}</p>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>

            {users.filter(u => u.role === 'dealer').length === 0 && (
              <div className="p-12 text-center border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-3xl">
                <div className="w-16 h-16 bg-slate-100 dark:bg-slate-900 rounded-full flex items-center justify-center mx-auto mb-6">
                  <ShieldAlert size={32} className="text-slate-300" />
                </div>
                <h4 className="text-xl font-black uppercase tracking-tight text-slate-900 dark:text-white mb-2">No Active Dealer Networks</h4>
                <p className="text-sm font-bold text-slate-500 uppercase tracking-widest">Authorize dealers in the "Dealer Section" to start auditing their data.</p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'submit' && (
          <div className="max-w-4xl mx-auto">
            <div 
              className="text-center space-y-2 mb-10 cursor-pointer select-none group"
              onDoubleClick={() => setIsFormVisible(!isFormVisible)}
              title="Double-click to toggle form"
            >
              <h2 className="text-3xl font-black uppercase tracking-tight text-slate-900 dark:text-slate-50 group-hover:scale-105 transition-transform duration-500">Field Operations</h2>
              <p className="text-[10px] font-bold uppercase tracking-[0.4em] text-slate-400 dark:text-slate-500">Capture and process enterprise support requests</p>
            </div>
            
            <AnimatePresence mode="wait">
              {isFormVisible && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9, filter: 'blur(20px)', y: 20 }}
                  animate={{ opacity: 1, scale: 1, filter: 'blur(0px)', y: 0 }}
                  exit={{ 
                    opacity: 0, 
                    scale: 0.8, 
                    x: 400, 
                    y: -100, 
                    rotate: 15, 
                    skewX: 40, 
                    filter: 'blur(50px)',
                    transition: { duration: 1.2, ease: [0.4, 0, 0.2, 1] }
                  }}
                  transition={{ 
                    duration: 0.8, 
                    ease: [0.16, 1, 0.3, 1]
                  }}
                  className="origin-left"
                >
                  <div className="pt-2 pb-8">
                    <ComplaintForm 
                      onSubmit={async (data) => {
                        await onRegisterComplaint(data);
                        setActiveTab('complaints');
                      }} 
                      isLoading={isLoading || false} 
                      appConfig={appConfig}
                      currentUser={currentUser}
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {activeTab === 'clients' && (
          <ClientManagement appConfig={appConfig} isAdmin={true} currentUser={currentUser} currentUserName={users.find(u => u.uid === currentUser.uid)?.username || 'Admin'} />
        )}

        {activeTab === 'nodes' && (
          <div className="max-w-4xl mx-auto">
            <HighFrequencyNodes complaints={complaints} />
          </div>
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
                      <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-500">Created From</th>
                      <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-500">Registry Date</th>
                      <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-500 text-right">Protocol</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 dark:divide-slate-800/50">
                    {users
                      .filter(u => {
                        const isNotDealer = u.role !== 'dealer';
                        const isNotSelfSuperAdmin = u.role !== 'super_admin' || u.uid === currentUser.uid;
                        
                        // Show all users to super_admin and admin, but for dealers only show their own network.
                        const belongsToMyTenant = currentUser.role === 'super_admin' || currentUser.role === 'admin' || u.dealerId === currentUser.uid;
                        
                        return isNotDealer && isNotSelfSuperAdmin && belongsToMyTenant;
                      })
                      .sort((a, b) => b.createdAt - a.createdAt)
                      .map((user) => (
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
                              {currentUser.role === 'super_admin' && user.role === 'dealer' && (
                                <input
                                  type="text"
                                  value={editLineCode}
                                  onChange={(e) => setEditLineCode(e.target.value)}
                                  placeholder="Line Code"
                                  className="w-full px-2 py-1 text-sm border rounded bg-white dark:bg-slate-900"
                                />
                              )}
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
                        <td className="px-6 py-4">
                          <span className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest bg-slate-100 dark:bg-slate-900 px-2 py-1 rounded border border-slate-200 dark:border-slate-800">
                            {user.createdByName || (user.createdBy === 'system' ? 'System' : 'Unknown Agent')}
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
                                {user.uid !== currentUser.uid && (
                                  <button
                                    onClick={() => {
                                      window.dispatchEvent(new CustomEvent('openChat', { detail: user.uid }));
                                    }}
                                    className="p-2 text-slate-300 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-500/10 rounded-lg transition-all"
                                    title="Private Message"
                                  >
                                    <MessageSquare size={16} />
                                  </button>
                                )}
                                <button
                                  onClick={() => handleStartEditUser(user)}
                                  className="p-2 text-slate-300 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-500/10 rounded-lg transition-all"
                                  title="Edit Credentials"
                                >
                                  <Pencil size={16} />
                                </button>
                                {user.uid !== currentUser.uid ? (
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

        {activeTab === 'dealers' && currentUser.role === 'super_admin' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-1">
              <div className="business-card p-8 bg-white dark:bg-slate-950 border-emerald-500/20 ring-1 ring-emerald-500/10">
                <h3 className="text-lg font-black uppercase tracking-tight mb-8 flex items-center gap-3 text-emerald-600 dark:text-emerald-400">
                  <ShieldAlert size={20} />
                  Dealer Setup
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
                    <label className={labelClasses}>Dealer Name</label>
                    <input
                      type="text"
                      value={newUsername}
                      onChange={(e) => setNewUsername(e.target.value)}
                      placeholder="e.g. John Doe"
                      className={inputClasses}
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className={labelClasses}>Dealer Passkey</label>
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
                    <label className={labelClasses}>Dealer Line Code</label>
                    <input
                      type="text"
                      value={newLineCode}
                      onChange={(e) => setNewLineCode(e.target.value)}
                      placeholder="e.g. DLR-99"
                      className={cn(inputClasses, "border-emerald-200 dark:border-emerald-900/50 bg-emerald-50/10")}
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className={labelClasses}>Leader Company Name</label>
                    <input
                      type="text"
                      value={newCompanyName}
                      onChange={(e) => setNewCompanyName(e.target.value)}
                      placeholder="e.g. Tech Solutions"
                      className={inputClasses}
                      required
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={isCreating}
                    className="w-full py-4 rounded-lg bg-emerald-600 text-white font-bold uppercase tracking-widest text-[11px] shadow-lg hover:bg-emerald-700 disabled:opacity-50 transition-all shadow-emerald-500/20"
                  >
                    {isCreating ? 'Provisioning...' : 'Authorize New Dealer Account'}
                  </button>
                </form>
              </div>
            </div>

            <div className="lg:col-span-2">
              <div className="business-card overflow-hidden bg-white dark:bg-slate-950">
                <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 flex justify-between items-center">
                   <h4 className="text-xs font-black uppercase tracking-[0.2em] text-emerald-500">Authorized Dealers Registry</h4>
                </div>
                <table className="w-full text-left">
                  <thead className="bg-slate-50 dark:bg-slate-900/50">
                    <tr className="border-b border-slate-100 dark:border-slate-800">
                      <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-500">Identity / Company</th>
                      <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-500">Line Code</th>
                      <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-500">Node Status</th>
                      <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-500 text-right">Protocol</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 dark:divide-slate-800/50">
                    {users.filter(u => u.role === 'dealer').length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-6 py-12 text-center text-slate-400 uppercase font-black tracking-widest text-xs">No Dealers Authorized in Registry</td>
                      </tr>
                    ) : (
                      users.filter(u => u.role === 'dealer').map((dealer) => (
                         <tr key={dealer.uid} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/30 transition-colors">
                          <td className="px-6 py-4">
                            {editingUserId === dealer.uid ? (
                              <div className="space-y-2">
                                <input
                                  type="text"
                                  value={editUsername}
                                  onChange={(e) => setEditUsername(e.target.value)}
                                  placeholder="Dealer Name"
                                  className="w-full px-2 py-1 text-sm border rounded bg-white dark:bg-slate-900"
                                />
                                <input
                                  type="text"
                                  value={editCompanyName}
                                  onChange={(e) => setEditCompanyName(e.target.value)}
                                  placeholder="Company Name"
                                  className="w-full px-2 py-1 text-sm border rounded bg-white dark:bg-slate-900"
                                />
                                <input
                                  type="password"
                                  value={editPassword}
                                  onChange={(e) => setEditPassword(e.target.value)}
                                  placeholder="New Passkey"
                                  className="w-full px-2 py-1 text-sm border rounded bg-white dark:bg-slate-900"
                                />
                              </div>
                            ) : (
                              <div className="flex flex-col">
                                <span className="font-bold text-slate-900 dark:text-white uppercase tracking-tight">{dealer.username}</span>
                                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{dealer.companyName || 'No Company Set'}</span>
                              </div>
                            )}
                          </td>
                          <td className="px-6 py-4">
                            {editingUserId === dealer.uid ? (
                              <input
                                type="text"
                                value={editLineCode}
                                onChange={(e) => setEditLineCode(e.target.value)}
                                className="w-full px-2 py-1 text-sm border rounded bg-white dark:bg-slate-900"
                                placeholder="Line Code"
                              />
                            ) : (
                              <span className="px-3 py-1 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 text-[10px] font-black rounded border border-emerald-200 dark:border-emerald-800/50">
                                {dealer.lineCode}
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                              <span className="text-[10px] font-black text-slate-400 uppercase">Operational</span>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-right">
                             <div className="flex justify-end gap-2">
                               {editingUserId === dealer.uid ? (
                                 <>
                                   <button
                                     onClick={() => handleUpdateUser(dealer.uid)}
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
                                     onClick={() => {
                                       window.dispatchEvent(new CustomEvent('openChat', { detail: dealer.uid }));
                                     }}
                                     className="p-2 text-slate-300 hover:text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 rounded-lg transition-all"
                                     title="Communicate with Dealer"
                                   >
                                     <MessageSquare size={16} />
                                   </button>
                                   <button
                                      onClick={() => handleStartEditUser(dealer)}
                                      className="p-2 text-slate-300 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-500/10 rounded-lg transition-all"
                                      title="Edit Dealer"
                                    >
                                      <Pencil size={16} />
                                    </button>
                                    {deletingId === dealer.uid ? (
                                      <div className="flex flex-col items-end gap-2 pr-2">
                                        <span className="text-[7px] text-red-500 font-black uppercase animate-pulse tracking-[0.2em]">
                                          PURGE NETWORK & DATA?
                                        </span>
                                        <div className="flex gap-2 pb-2">
                                          <button
                                            onClick={async () => {
                                              try { await onDeleteUser(dealer.uid); setDeletingId(null); } catch (err) { toast.error('Unauthorized action'); }
                                            }}
                                            className="px-3 py-1.5 text-[9px] font-black text-white bg-red-600 rounded-md hover:bg-red-700 shadow-md shadow-red-500/20 uppercase tracking-widest"
                                          >
                                            Confirm Purge
                                          </button>
                                          <button
                                            onClick={() => setDeletingId(null)}
                                            className="px-3 py-1.5 text-[9px] font-bold text-slate-400 hover:text-slate-900 uppercase tracking-widest"
                                          >
                                            Abort
                                          </button>
                                        </div>
                                      </div>
                                    ) : (
                                      <button
                                        onClick={() => setDeletingId(dealer.uid)}
                                        className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-all"
                                        title="Revoke Permission"
                                      >
                                        <Trash2 size={16} />
                                      </button>
                                    )}
                                 </>
                               )}
                             </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
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

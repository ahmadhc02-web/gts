import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Layers, ShieldAlert, CheckCircle, Shield, Key, User, Bell, Zap, Contact, MapPinned, Volume2, VolumeX, LogOut, Clock, TrendingUp, ClipboardList, BarChart3, Mic, Activity, Flame } from 'lucide-react';
import { Complaint, ComplaintStatus, ComplaintCategory, ComplaintPriority, UserProfile, BrandingConfig, ComplaintReview } from '../types';
import ComplaintForm from './ComplaintForm';
import ComplaintList from './ComplaintList';
import ClientManagement from './ClientManagement';
import RealTimeMonitor from './RealTimeMonitor';
import DistributionList from './DistributionList';
import HighFrequencyNodes from './HighFrequencyNodes';
import { cn } from '../lib/utils';
import { AppConfig } from '../constants';
import MicVisualizer from './MicVisualizer';
import { getCardStyle } from '../lib/styleUtils';

interface MemberPanelProps {
  complaints: Complaint[];
  currentUser: UserProfile;
  appConfig: AppConfig;
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
  onUpdateComplaintStatus: (id: string, status: ComplaintStatus, remarks?: string, reviews?: ComplaintReview[]) => Promise<void>;
  onUpdateRemarks: (id: string, remarks: string) => Promise<void>;
  onUpdateUser: (uid: string, username: string, pass: string, lineCode?: string, companyName?: string, fullName?: string, role?: UserProfile['role']) => Promise<void>;
  onUpdateComplaint: (id: string, data: Partial<Complaint>) => Promise<void>;
  isLoading: boolean;
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
  branding: BrandingConfig;
  activeTab?: string;
  onNavigate?: (id: string) => void;
  isSuspended?: boolean;
  users?: UserProfile[];
}

export default function MemberPanel({
  complaints,
  currentUser,
  appConfig,
  onRegisterComplaint,
  onUpdateComplaintStatus,
  onUpdateRemarks,
  onUpdateUser,
  onUpdateComplaint,
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
  branding,
  activeTab: activeTabProp,
  onNavigate: onNavigateProp,
  isSuspended = false,
  users = []
}: MemberPanelProps) {
  const [forcedStatus, setForcedStatus] = useState<ComplaintStatus | 'all'>('all');
  const [forcedPriority, setForcedPriority] = useState<ComplaintPriority | 'all'>('all');
  const [forcedCategory, setForcedCategory] = useState<ComplaintCategory | 'all'>('all');

  const [newUsername, setNewUsername] = useState(currentUser.username);
  const [newPassword, setNewPassword] = useState(currentUser.password);
  const [newFullName, setNewFullName] = useState(currentUser.fullName || '');
  const [isUpdating, setIsUpdating] = useState(false);
  
  const [localActiveTab, setLocalActiveTab] = useState<'ops' | 'clients' | 'profile' | 'monitor' | 'nodes'>('ops');
  
  // Resolve activeTab from either prop or local state
  const activeTab = activeTabProp !== undefined
    ? (activeTabProp === 'complaints' ? 'ops' : activeTabProp === 'settings' ? 'profile' : activeTabProp) as any
    : localActiveTab;

  // Custom setter that updates the parent or local state
  const setActiveTab = (tabId: 'ops' | 'clients' | 'profile' | 'monitor' | 'nodes') => {
    if (onNavigateProp) {
      let layoutId = tabId as string;
      if (tabId === 'ops') layoutId = 'complaints';
      if (tabId === 'profile') layoutId = 'settings';
      onNavigateProp(layoutId);
    } else {
      setLocalActiveTab(tabId);
    }
  };

  const [isFormVisible, setIsFormVisible] = useState(true);
  const [isChartsVisible, setIsChartsVisible] = useState(true);

  // Synchronize navigation state with Layout dynamic sidebar
  useEffect(() => {
    const handleAdminNav = (e: any) => {
      const id = e.detail;
      if (id === 'complaints' || id === 'ops') {
        setActiveTab('ops');
      } else if (id === 'submit') {
        setActiveTab('ops');
        setIsFormVisible(true);
      } else if (id === 'clients') {
        setActiveTab('clients');
      } else if (id === 'nodes') {
        setActiveTab('nodes');
      } else if (id === 'settings' || id === 'profile') {
        setActiveTab('profile');
      }
    };
    window.addEventListener('admin-nav', handleAdminNav as EventListener);
    return () => window.removeEventListener('admin-nav', handleAdminNav as EventListener);
  }, [setActiveTab]);
  const stats = [
    { label: 'Total Registry', value: complaints.length, tooltip: 'Global volume of operational records currently stored in the central database.', color: 'border-slate-900 dark:border-brand-accent', textColor: 'text-slate-900 dark:text-white', icon: <Layers size={18} />, filter: { status: 'all', priority: 'all', category: 'all' } },
    { label: 'Pending Requests', value: complaints.filter(c => c.status === 'pending').length, tooltip: 'Global operations currently in the queue awaiting technician dispatch.', color: 'border-amber-500', textColor: 'text-amber-500', icon: <Clock size={18} />, filter: { status: 'pending', priority: 'all', category: 'all' } },
    { label: 'New Connection', value: complaints.filter(c => c.category === 'New Connection' && c.status === 'pending').length, tooltip: 'Newly registered connection requests awaiting initial infrastructure deployment.', color: 'border-brand-accent', textColor: 'text-brand-accent', icon: <Zap size={18} />, filter: { status: 'pending', priority: 'all', category: 'New Connection' } },
    { label: 'In Operation', value: complaints.filter(c => c.status === 'in process').length, tooltip: 'Tasks currently under execution by on-site field technicians.', color: 'border-blue-600', textColor: 'text-blue-600', icon: <TrendingUp size={18} />, filter: { status: 'in process', priority: 'all', category: 'all' } },
    { label: 'Finalized', value: complaints.filter(c => c.status === 'complete' && c.category !== 'New Connection').length, tooltip: 'Service successfully restored and verified from the enterprise logs.', color: 'border-emerald-500', textColor: 'text-emerald-500', icon: <CheckCircle size={18} />, filter: { status: 'complete', priority: 'all', category: 'all' } },
    { label: 'Connection Complete', value: complaints.filter(c => c.category === 'New Connection' && c.status === 'complete').length, tooltip: 'Newly registered connection requests that have been successfully deployed.', color: 'border-cyan-500', textColor: 'text-cyan-500', icon: <Zap size={18} />, filter: { status: 'complete', priority: 'all', category: 'New Connection' } },
  ];

  const handleTileClick = (filter: any) => {
    setForcedStatus(filter.status || 'all');
    setForcedPriority(filter.priority || 'all');
    setForcedCategory(filter.category || 'all');
    setActiveTab('ops');
    
    // Smooth scroll to list
    const listElement = document.getElementById('operations-registry-member');
    if (listElement) {
      listElement.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUsername.trim() || !newPassword.trim()) return;
    
    setIsUpdating(true);
    try {
      await onUpdateUser(
        currentUser.uid, 
        newUsername.trim(), 
        newPassword.trim(), 
        currentUser.lineCode, 
        currentUser.companyName, 
        newFullName.trim()
      );
    } finally {
      setIsUpdating(false);
    }
  };

  const inputClasses = "w-full px-4 py-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-accent/30 transition-all font-medium placeholder:text-slate-400";
  const labelClasses = "block text-xs font-black uppercase text-slate-600 dark:text-slate-400 mb-2 tracking-widest ml-1";

  return (
    <div className="space-y-12">
      {/* Member Statistics Summary */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 sm:gap-6">
        {stats.map((stat, idx) => {
          const isTileActive = (
            forcedStatus === stat.filter.status &&
            forcedPriority === stat.filter.priority &&
            forcedCategory === stat.filter.category &&
            stat.label !== 'Total Registry'
          );

          return (
            <motion.div
              key={idx}
              initial={{ opacity: 0, scale: 0.95, y: 30 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ delay: idx * 0.06, type: "spring", stiffness: 280, damping: 20 }}
              whileHover={{ y: -8, scale: 1.03 }}
              whileTap={{ scale: 0.96 }}
              onClick={() => handleTileClick(stat.filter)}
              title={stat.tooltip}
              className={cn(
                "p-3 sm:p-6 bg-white dark:bg-slate-950 rounded-xl sm:rounded-2xl border-l-4 shadow-xl shadow-black/10 dark:shadow-black/50 hover:shadow-2xl hover:shadow-black/20 dark:hover:shadow-black/60 flex flex-col justify-between transition-all group cursor-pointer relative active:scale-95",
                stat.color,
                isTileActive ? "ring-2 ring-brand-accent scale-[1.04] z-10 shadow-2xl shadow-brand-accent/20 dark:shadow-brand-accent/30" : ""
              )}
            >
            <div className="flex justify-between items-start mb-2 sm:mb-4">
              <span className="text-[9px] sm:text-xs font-black uppercase tracking-widest text-slate-500 group-hover:text-slate-700 dark:group-hover:text-slate-200 transition-colors leading-tight">
                {stat.label}
              </span>
                <motion.div 
                  className={cn("p-1.5 sm:p-2 rounded-lg transition-colors shrink-0", 
                    stat.textColor === 'text-rose-500' ? "bg-rose-500/10" :
                    stat.textColor === 'text-blue-600' ? "bg-blue-600/10" :
                    stat.textColor === 'text-emerald-500' ? "bg-emerald-500/10" :
                    "bg-slate-100 dark:bg-slate-900"
                  )}
                  animate={stat.label === 'Finalized' && typeof stat.value === 'number' && stat.value > 0 ? {
                    scale: [1, 1.2, 1],
                    rotate: [0, 10, -10, 0]
                  } : {}}
                  transition={{ duration: 0.5 }}
                >
                  {React.cloneElement(stat.icon as React.ReactElement, { size: window.innerWidth < 640 ? 14 : 18 })}
                </motion.div>
            </div>
            <div className="flex items-end justify-between gap-2">
              <div className={cn("text-2xl sm:text-3xl xl:text-4xl font-black tracking-tight leading-none", stat.textColor)}>
                {stat.value.toString().padStart(2, '0')}
              </div>
              {/* Micro Sparklines matching the uploaded mockup dashboard design perfectly */}
              {(stat.label === 'New Connection' || stat.label === branding?.tabNames?.new_connection_pending) && (
                <div className="w-[60px] sm:w-[80px] h-6 pb-0.5 opacity-80 shrink-0">
                  <svg viewBox="0 0 80 30" width="100%" height="100%" className="overflow-visible">
                    <path
                      d="M 0,22 Q 15,4 32,18 T 64,8 T 80,12"
                      fill="none"
                      stroke="#3b82f6"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                    />
                    <circle cx="80" cy="12" r="3" fill="#3b82f6" className="animate-pulse" />
                  </svg>
                </div>
              )}
              {(stat.label === 'In Operation' || stat.label === branding?.tabNames?.in_operation) && (
                <div className="w-[60px] sm:w-[80px] h-6 pb-0.5 opacity-80 shrink-0">
                  <svg viewBox="0 0 80 30" width="100%" height="100%" className="overflow-visible">
                    <path
                      d="M 0,20 Q 12,28 28,10 T 56,18 T 80,4"
                      fill="none"
                      stroke="#1d4ed8"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                    />
                    <circle cx="80" cy="4" r="3" fill="#1d4ed8" className="animate-pulse" />
                  </svg>
                </div>
              )}
            </div>
            </motion.div>
          );
        })}
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
              initial={{ opacity: 0, scale: 0.9, filter: 'blur(10px)', y: 20 }}
              animate={{ opacity: 1, scale: 1, filter: 'blur(0px)', y: 0 }}
              exit={{ 
                opacity: 0, 
                scale: 0.9, 
                y: -20, 
                filter: 'blur(10px)',
                transition: { duration: 0.3, ease: 'easeIn' }
              }}
              transition={{ 
                type: 'spring',
                stiffness: 260,
                damping: 25,
                mass: 0.8
              }}
              className="grid grid-cols-1 lg:grid-cols-3 gap-6 origin-top"
            >
              <div className="h-[350px] sm:h-[380px] shadow-sm rounded-2xl">
                <DistributionList complaints={complaints} chartType="area" />
              </div>
              <div className="h-[350px] sm:h-[380px] shadow-sm rounded-2xl">
                <RealTimeMonitor complaints={complaints} />
              </div>
              <div className="h-[350px] sm:h-[380px] shadow-sm rounded-2xl">
                <DistributionList complaints={complaints} chartType="category" />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <motion.div
        key={activeTab}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        transition={{ duration: 0.2 }}
      >
        {activeTab === 'ops' && (
          <div className="space-y-12">
            <section>
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
                    initial={{ opacity: 0, scale: 0.95, filter: 'blur(10px)', y: 20 }}
                    animate={{ opacity: 1, scale: 1, filter: 'blur(0px)', y: 0 }}
                    exit={{ 
                      opacity: 0, 
                      scale: 0.95, 
                      y: -20, 
                      filter: 'blur(10px)',
                      transition: { duration: 0.3, ease: 'easeIn' }
                    }}
                    transition={{ 
                      type: 'spring',
                      stiffness: 280,
                      damping: 25
                    }}
                    className="origin-top"
                  >
                    <div className="max-w-4xl mx-auto pt-2 pb-8 relative">
                      {isSuspended && (
                        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-slate-50/50 dark:bg-slate-950/70 backdrop-blur-md rounded-3xl border border-red-500/20 p-6 text-center animate-in fade-in duration-300">
                          <div className="w-16 h-16 rounded-full bg-red-100 dark:bg-red-950/30 text-red-600 dark:text-red-400 flex items-center justify-center mb-4 border border-red-200/50">
                            <ShieldAlert size={28} className="animate-bounce" />
                          </div>
                          <h3 className="text-sm font-black uppercase tracking-[0.2em] text-red-600 dark:text-red-400">
                            Identity Suspended
                          </h3>
                          <p className="text-[10px] text-slate-400 dark:text-slate-500 font-extrabold uppercase mt-1 max-w-xs leading-relaxed">
                            Your dealer network access has been deactivated. Complaint registration is frozen.
                          </p>
                        </div>
                      )}
                      <div className={cn(isSuspended && "blur-[3px] pointer-events-none select-none opacity-30")}>
                        <ComplaintForm 
                          onSubmit={onRegisterComplaint} 
                          isLoading={isLoading} 
                          appConfig={appConfig} 
                          currentUser={currentUser}
                          branding={branding}
                        />
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </section>

            <section className="pt-12" id="operations-registry-member">
              <div className="mb-8 border-b border-slate-100 dark:border-slate-800 pb-4">
                <h3 className="text-sm font-black uppercase tracking-[0.3em] text-slate-500">Operation Logs</h3>
              </div>
              <ComplaintList 
                complaints={complaints}
                users={users}
                isAdmin={false}
                currentUser={currentUser}
                onStatusChange={onUpdateComplaintStatus}
                onUpdateRemarks={onUpdateRemarks}
                onEdit={onUpdateComplaint}
                forcedStatusFilter={forcedStatus}
                forcedPriorityFilter={forcedPriority}
                forcedCategoryFilter={forcedCategory}
                appConfig={appConfig}
                branding={branding}
              />
            </section>
          </div>
        )}

        {activeTab === 'nodes' && (
          <div className="max-w-4xl mx-auto">
            <HighFrequencyNodes complaints={complaints} />
          </div>
        )}

        {activeTab === 'clients' && (
          <ClientManagement appConfig={appConfig} isAdmin={false} currentUser={currentUser} currentUserName={currentUser.username} />
        )}

          {activeTab === 'profile' && (
          <div className="max-w-4xl">
            {/* Identity Profile Section */}
            <section className="mb-12">
              <div className="mb-6">
                <h3 className="text-sm font-black uppercase tracking-[0.3em] text-slate-500 mb-2">Profile System</h3>
                <p className="text-xs text-slate-400 font-medium leading-relaxed">Update your public identity. This name will be visible across all transmissions and notifications.</p>
              </div>

              <form onSubmit={handleUpdateProfile} className="space-y-6">
                <div className="space-y-1.5 max-w-md">
                  <label className={labelClasses}>Full Identity Name</label>
                  <div className="relative">
                    <Contact className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                    <input
                      type="text"
                      placeholder="ENTER FULL NAME..."
                      value={newFullName}
                      onChange={(e) => setNewFullName(e.target.value)}
                      className={cn(inputClasses, "pl-11")}
                    />
                  </div>
                </div>

                <div className="pt-2">
                  <h3 className="text-sm font-black uppercase tracking-[0.3em] text-slate-500 mb-2">Identity Security</h3>
                  <p className="text-xs text-slate-400 font-medium leading-relaxed mb-6">Update your login credentials. Changes will take effect immediately upon confirmation.</p>
                  
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                    <div className="space-y-6">
                      <div className="space-y-1.5">
                        <label className={labelClasses}>Link Access ID (Username)</label>
                        <div className="relative">
                          <User className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                          <input
                            type="text"
                            value={newUsername}
                            onChange={(e) => setNewUsername(e.target.value)}
                            className={cn(inputClasses, "pl-11")}
                            required
                          />
                        </div>
                      </div>
                      
                      <div className="space-y-1.5">
                        <label className={labelClasses}>New Access Passkey</label>
                        <div className="relative">
                          <Key className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                          <input
                            type="text"
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            className={cn(inputClasses, "pl-11")}
                            required
                          />
                        </div>
                      </div>

                      <button
                        type="submit"
                        disabled={isUpdating}
                        className="px-8 py-3.5 rounded-xl bg-slate-900 dark:bg-brand-accent text-white font-black uppercase tracking-widest text-[10px] shadow-lg hover:shadow-brand-accent/20 transition-all active:scale-[0.98] disabled:opacity-50"
                      >
                        {isUpdating ? 'Synchronizing Credentials...' : 'Confirm Identity Update'}
                      </button>
                    </div>

                    <div className="space-y-6">
                      <div className="bg-slate-50 dark:bg-slate-900/50 p-8 rounded-2xl border border-slate-200 dark:border-slate-800">
                        <div className="flex items-center gap-3 mb-6">
                          <Activity className="text-amber-500" size={20} />
                          <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-500">Audio Matrix Hub</h4>
                        </div>
                        
                        <div className="space-y-4">
                          {!alertAuthorized ? (
                            <button
                              type="button"
                              onClick={onAuthorizeAlerts}
                              className="w-full py-3 rounded-xl bg-amber-500 text-white font-black uppercase tracking-widest text-[9px] shadow-lg"
                            >
                              Unlock Speaker Matrix
                            </button>
                          ) : (
                            <>
                              <div className="flex items-center justify-between p-3 rounded-lg bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700">
                                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Speaker State</span>
                                <button
                                  type="button"
                                  onClick={onToggleAudio}
                                  className={cn(
                                    "px-3 py-1 rounded-md text-[9px] font-black uppercase tracking-widest",
                                    isAudioMuted ? "bg-emerald-500 text-white" : "bg-rose-500 text-white"
                                  )}
                                >
                                  {isAudioMuted ? 'Active' : 'Mute'}
                                </button>
                              </div>
                              <button
                                type="button"
                                onClick={onSoundTest}
                                className="w-full py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-500 font-black uppercase tracking-widest text-[9px] hover:bg-slate-100 dark:hover:bg-slate-800 transition-all flex items-center justify-center gap-2"
                              >
                                <Zap size={12} className="text-amber-500" />
                                Ping Speaker Hub
                              </button>
                            </>
                          )}
                        </div>
                      </div>

                      <div className="bg-slate-50 dark:bg-slate-900/50 p-8 rounded-2xl border border-slate-200 dark:border-slate-800">
                        <div className="flex items-center gap-3 mb-6">
                          <Mic className="text-blue-500" size={20} />
                          <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-500">Voice Input Protocol</h4>
                        </div>

                        <div className="space-y-4">
                          {!micAuthorized ? (
                            <button
                              type="button"
                              onClick={onAuthorizeMic}
                              className="w-full py-3 rounded-xl bg-blue-600 text-white font-black uppercase tracking-widest text-[9px] shadow-lg"
                            >
                              Authorize Mic Capture
                            </button>
                          ) : (
                            <>
                              <div className="flex items-center justify-between p-3 rounded-lg bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700">
                                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Mic State</span>
                                <button
                                  type="button"
                                  onClick={onToggleMic}
                                  className={cn(
                                    "px-3 py-1 rounded-md text-[9px] font-black uppercase tracking-widest",
                                    isMicMuted ? "bg-emerald-500 text-white" : "bg-rose-500 text-white"
                                  )}
                                >
                                  {isMicMuted ? 'Active' : 'Mute'}
                                </button>
                              </div>
                              <div className="mt-4 p-3 bg-white dark:bg-slate-800 rounded-lg border border-slate-100 dark:border-slate-700 shadow-sm">
                                <MicVisualizer isMuted={isMicMuted} isAuthorized={micAuthorized} />
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </form>
            </section>

            {/* Sign Out Section */}
            <section className="mt-12 pt-12 border-t border-slate-100 dark:border-slate-800 pb-12">
              <button
                onClick={onLogout}
                className="w-full max-w-sm mx-auto py-4 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-black uppercase tracking-widest text-[11px] shadow-lg flex items-center justify-center gap-3 hover:scale-[1.02] transition-all"
              >
                <LogOut size={16} />
                Sign Out
              </button>
              <p className="text-center text-[9px] font-black uppercase tracking-[0.3em] text-slate-400 mt-4 leading-none">
                Operational Session Exit
              </p>
            </section>
          </div>
        )}
      </motion.div>
    </div>
  );
}

import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Layers, ShieldAlert, CheckCircle, Shield, Key, User, Bell, Zap, Contact, MapPinned, Volume2, VolumeX, LogOut, Clock, TrendingUp, ClipboardList, BarChart3, Mic, Activity, Flame } from 'lucide-react';
import { Complaint, ComplaintStatus, ComplaintCategory, ComplaintPriority, UserProfile } from '../types';
import ComplaintForm from './ComplaintForm';
import ComplaintList from './ComplaintList';
import ClientManagement from './ClientManagement';
import RealTimeMonitor from './RealTimeMonitor';
import DistributionList from './DistributionList';
import HighFrequencyNodes from './HighFrequencyNodes';
import { cn } from '../lib/utils';
import { AppConfig } from '../constants';
import MicVisualizer from './MicVisualizer';

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
  onUpdateUser: (uid: string, username: string, pass: string) => Promise<void>;
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
}

export default function MemberPanel({
  complaints,
  currentUser,
  appConfig,
  onRegisterComplaint,
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
  onToggleMic
}: MemberPanelProps) {
  const [forcedStatus, setForcedStatus] = useState<ComplaintStatus | 'all'>('all');
  const [forcedPriority, setForcedPriority] = useState<ComplaintPriority | 'all'>('all');
  const [forcedCategory, setForcedCategory] = useState<ComplaintCategory | 'all'>('all');

  const [newUsername, setNewUsername] = useState(currentUser.username);
  const [newPassword, setNewPassword] = useState(currentUser.password);
  const [isUpdating, setIsUpdating] = useState(false);
  const [activeTab, setActiveTab] = useState<'ops' | 'clients' | 'profile' | 'monitor'>('ops');
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
      await onUpdateUser(currentUser.uid, newUsername.trim(), newPassword.trim());
    } finally {
      setIsUpdating(false);
    }
  };

  const inputClasses = "w-full px-4 py-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-accent/30 transition-all font-medium placeholder:text-slate-400";
  const labelClasses = "block text-xs font-black uppercase text-slate-600 dark:text-slate-400 mb-2 tracking-widest ml-1";

  return (
    <div className="space-y-12">
      {/* Member Statistics Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-6">
        {stats.map((stat, idx) => (
          <motion.div
            key={idx}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: idx * 0.1 }}
            whileHover={{ y: -5 }}
            onClick={() => handleTileClick(stat.filter)}
            title={stat.tooltip}
            className={cn(
              "p-6 bg-white dark:bg-slate-950 rounded-2xl border-l-4 shadow-xl shadow-slate-200/20 dark:shadow-none flex flex-col justify-between transition-all group cursor-pointer active:scale-95",
              stat.color,
              (forcedStatus === stat.filter.status && forcedPriority === stat.filter.priority && stat.label !== 'Total Registry') ? "ring-2 ring-brand-accent scale-105" : ""
            )}
          >
            <div className="flex justify-between items-start mb-4">
              <span className="text-xs font-black uppercase tracking-widest text-slate-500 group-hover:text-slate-700 dark:group-hover:text-slate-200 transition-colors">
                {stat.label}
              </span>
                <motion.div 
                  className={cn("p-2 rounded-lg transition-colors", 
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
                  {stat.icon}
                </motion.div>
            </div>
            <div className={cn("text-4xl font-black tracking-tighter", stat.textColor)}>
              {stat.value.toString().padStart(2, '0')}
            </div>
          </motion.div>
        ))}
      </div>

      {/* Analytics Dashboards - Below Stat Boxes */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div className="h-[340px] shadow-sm rounded-2xl">
          <RealTimeMonitor complaints={complaints} />
        </div>
        <div className="h-[340px] shadow-sm rounded-2xl">
          <DistributionList complaints={complaints} />
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex flex-wrap gap-2 p-1.5 bg-slate-100 dark:bg-slate-900 rounded-xl w-fit border border-slate-200 dark:border-slate-800">
        {[
          { id: 'ops', label: 'Operations', icon: ClipboardList },
          { id: 'clients', label: 'User Details', icon: Contact },
          { id: 'nodes', label: 'Active Nodes', icon: Flame },
          { id: 'profile', label: 'Security', icon: Shield },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={cn(
              "flex items-center gap-2.5 px-6 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all",
              activeTab === tab.id
                ? "bg-slate-950 dark:bg-brand-accent text-white shadow-lg" 
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white dark:hover:bg-slate-800"
            )}
          >
            <tab.icon size={14} />
            {tab.label}
          </button>
        ))}
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
              <div className="mb-8 p-6 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-100 dark:border-slate-800">
                <h2 className="text-2xl font-black uppercase tracking-tight text-slate-900 dark:text-slate-50 mb-1">Field Operations</h2>
                <p className="text-xs font-black uppercase tracking-widest text-slate-600 dark:text-slate-400">Capture and process enterprise support requests.</p>
              </div>
              
              <div className="max-w-4xl">
                <ComplaintForm onSubmit={onRegisterComplaint} isLoading={isLoading} appConfig={appConfig} />
              </div>
            </section>

            <section className="pt-12" id="operations-registry-member">
              <div className="mb-8 border-b border-slate-100 dark:border-slate-800 pb-4">
                <h3 className="text-sm font-black uppercase tracking-[0.3em] text-slate-500">Operation Logs</h3>
              </div>
              <ComplaintList 
                complaints={complaints}
                isAdmin={false}
                currentUserId={currentUser.uid}
                onEdit={onUpdateComplaint}
                forcedStatusFilter={forcedStatus}
                forcedPriorityFilter={forcedPriority}
                forcedCategoryFilter={forcedCategory}
                appConfig={appConfig}
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
          <ClientManagement appConfig={appConfig} isAdmin={false} currentUserId={currentUser.uid} currentUserName={currentUser.username} />
        )}

        {activeTab === 'profile' && (
          <div className="max-w-4xl">
            {/* Profile Security Section */}
            <section>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                <div>
                  <div className="mb-6">
                    <h3 className="text-sm font-black uppercase tracking-[0.3em] text-slate-500 mb-2">Identity Security</h3>
                    <p className="text-xs text-slate-400 font-medium leading-relaxed">Update your login credentials. Changes will take effect immediately upon confirmation.</p>
                  </div>
                  
                  <form onSubmit={handleUpdateProfile} className="space-y-6">
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
                          type="password"
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
                  </form>

                  {/* Sign Out Section */}
                  <div className="mt-12 pt-12 border-t border-slate-100 dark:border-slate-800">
                    <button
                      onClick={onLogout}
                      className="w-full py-4 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-black uppercase tracking-widest text-[11px] shadow-lg flex items-center justify-center gap-3 hover:scale-[1.02] transition-all"
                    >
                      <LogOut size={16} />
                      Sign Out
                    </button>
                    <p className="text-center text-[9px] font-black uppercase tracking-[0.3em] text-slate-400 mt-4 leading-none">
                      Operational Session Exit
                    </p>
                  </div>
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
            </section>
          </div>
        )}
      </motion.div>
    </div>
  );
}

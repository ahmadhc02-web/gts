import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Sun, Moon, LogOut, User, MessageSquare, ChevronRight, Bell, BellOff, Volume2, VolumeX, Settings, ShieldAlert, AlertTriangle, Mic, WifiOff, Wifi, History, Trash2, Clock, CheckCircle2, X, Menu, ChevronLeft, LayoutDashboard, ClipboardList, TrendingUp, Users, Shield, CloudUpload, Palette, Map as MapIcon, HelpCircle, PlusSquare, Contact, Flame, BarChart3, ChevronDown, Activity, CreditCard } from 'lucide-react';
import { useTheme } from '../hooks/useTheme';
import { cn } from '../lib/utils';
import { UserProfile, Notification, BrandingConfig } from '../types';
import Chat from './Chat';
import FloatingMascot from './FloatingMascot';
import ServiceMonitor from './ServiceMonitor';
import MapViewer from './MapViewer';
import RefreshControl from './RefreshControl';
import FiberLoading from './FiberLoading';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { firebaseService } from '../lib/firebaseService';

interface LayoutProps {
  children: React.ReactNode;
  user?: UserProfile | null;
  users?: UserProfile[];
  notifications?: Notification[];
  onLogout?: () => void;
  onRefresh?: () => void;
  isLoading?: boolean;
  alertAuthorized?: boolean;
  isAudioMuted?: boolean;
  onToggleAudio?: () => void;
  isMicMuted?: boolean;
  micAuthorized?: boolean;
  onToggleMic?: () => void;
  onResetBanner?: () => void;
  onUpdateUser?: (uid: string, username: string, pass: string, lineCode?: string, companyName?: string, fullName?: string, role?: UserProfile['role']) => Promise<void>;
  branding?: BrandingConfig;
}

export default function Layout({ 
  children, 
  user, 
  users = [],
  notifications = [],
  onLogout, 
  onRefresh, 
  isLoading,
  alertAuthorized = false,
  isAudioMuted = false,
  onToggleAudio,
  isMicMuted = false,
  micAuthorized = false,
  onToggleMic,
  onResetBanner,
  onUpdateUser,
  branding
}: LayoutProps) {
  const { theme, toggleTheme } = useTheme();
  const [isChatOpen, setIsChatOpen] = React.useState(false);
  const [selectedChatId, setSelectedChatId] = React.useState<string | null>(null);
  const [isNotificationsOpen, setIsNotificationsOpen] = React.useState(false);
  const [isMonitorOpen, setIsMonitorOpen] = React.useState(false);
  const [isMapOpen, setIsMapOpen] = React.useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [focusedClientId, setFocusedClientId] = React.useState<string | null>(null);
  const [isProfileOpen, setIsProfileOpen] = React.useState(false);
  const [selectedNotif, setSelectedNotif] = React.useState<Notification | null>(null);
  const isOnline = useOnlineStatus();
  const [showSyncStatus, setShowSyncStatus] = useState(false);

  useEffect(() => {
    const handleOpenMap = (e: CustomEvent) => {
      setFocusedClientId(e.detail.clientId);
      setIsMapOpen(true);
    };
    window.addEventListener('open-map-for-client', handleOpenMap as EventListener);
    return () => window.removeEventListener('open-map-for-client', handleOpenMap as EventListener);
  }, []);

  // Profile Edit State
  const [editFullName, setEditFullName] = useState(user?.fullName || '');
  const [editUsername, setEditUsername] = useState(user?.username || '');
  const [editPassword, setEditPassword] = useState(user?.password || '');
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);

  useEffect(() => {
    if (user) {
      setEditFullName(user.fullName || '');
      setEditUsername(user.username || '');
      setEditPassword(user.password || '');
    }
  }, [user]);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !onUpdateUser) return;
    
    setIsUpdatingProfile(true);
    try {
      await onUpdateUser(
        user.uid, 
        editUsername, 
        editPassword, 
        user.lineCode, 
        user.companyName, 
        editFullName, 
        user.role
      );
      setIsProfileOpen(false);
    } catch (error) {
      console.error("Profile update failed:", error);
    } finally {
      setIsUpdatingProfile(false);
    }
  };

  const getBrandingText = () => {
    // If global branding provides a custom name, use it as primary unless dealer overrides
    if (branding?.projectName && branding.projectName !== "Green Tech Services") {
      return branding.projectName;
    }

    if (!user) return "Green Tech Services";
    
    // If dealer logs in, show their company name
    if (user.role === 'dealer' && user.companyName) {
      return user.companyName;
    }
    
    // If member/admin logs in, find their dealer's company name
    if (user.dealerId && user.dealerId !== 'main') {
      const dealer = users.find(u => u.uid === user.dealerId && u.role === 'dealer');
      if (dealer && dealer.companyName) {
        return dealer.companyName;
      }
    }
    
    return "Green Tech Services";
  };

  const brandingText = getBrandingText();
  const isColoredHeader = branding?.sidebarTheme && branding.sidebarTheme !== 'light';

  useEffect(() => {
    if (isOnline) {
      setShowSyncStatus(true);
      const timer = setTimeout(() => setShowSyncStatus(false), 5000);
      return () => clearTimeout(timer);
    }
  }, [isOnline]);

  useEffect(() => {
    const handleOpenChat = (e: any) => {
      setIsChatOpen(true);
      if (e.detail && typeof e.detail === 'string') {
        setSelectedChatId(e.detail);
      }
    };
    window.addEventListener('openChat', handleOpenChat);
    return () => window.removeEventListener('openChat', handleOpenChat);
  }, []);

  const formatTimestamp = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  const getNotifIcon = (type: string) => {
    switch (type) {
      case 'complaint_created': return <ChevronRight className="text-emerald-500" size={14} />;
      case 'complaint_updated': return <AlertTriangle className="text-blue-500" size={14} />;
      case 'complaint_deleted': return <Trash2 className="text-red-500" size={14} />;
      case 'user_created': return <User className="text-brand-accent" size={14} />;
      case 'config_updated': return <Settings className="text-amber-500" size={14} />;
      default: return <Bell className="text-slate-400" size={14} />;
    }
  };

  const handleClearAll = async () => {
    try {
      await firebaseService.clearAllNotifications();
    } catch (error) {
      console.error('Failed to clear notifications:', error);
    }
  };

  const [expandedCats, setExpandedCats] = useState<string[]>(['ops']);

  const categories = [
    {
      id: 'ops',
      label: 'Main Operations',
      items: [
        { id: 'complaints', label: branding?.tabNames?.complaints || 'Operations', icon: ClipboardList },
        { id: 'nodes', label: 'Active Nodes', icon: Flame },
        { id: 'dealers_data', label: 'Dealers Data', icon: BarChart3, roles: ['super_admin'] },
        { id: 'submit', label: branding?.tabNames?.submit || 'Complain Reg', icon: PlusSquare },
        { id: 'map', label: 'Network Map', icon: MapIcon },
      ]
    },
    {
      id: 'analytics',
      label: 'Analytics & Users',
      items: [
        { id: 'clients', label: branding?.tabNames?.clients || 'USER DETAILS', icon: Contact },
        { id: 'top10', label: 'TOP 10 COMPLAINER', icon: TrendingUp },
        { id: 'users', label: 'LOGIN PROFILES', icon: Users },
      ]
    },
    {
      id: 'admin',
      label: 'Configurations',
      items: [
        { id: 'dealers', label: 'Dealer Section', icon: ShieldAlert, roles: ['super_admin'] },
        { id: 'config', label: branding?.tabNames?.config || 'Workflow Config', icon: Settings },
      ]
    },
    {
      id: 'system',
      label: 'System Settings',
      items: [
        { id: 'settings', label: 'Security', icon: Shield },
        { id: 'integrations', label: 'Google Sheet Link', icon: CloudUpload, roles: ['super_admin', 'admin'] },
        { id: 'branding', label: 'CUSTOMIZATION', icon: Palette, roles: ['super_admin', 'editor'] },
      ]
    }
  ];

  const filteredCategories = categories.map(cat => ({
    ...cat,
    items: cat.items.filter(item => {
      // Role-based filtering
      if (!user) return false;
      
      // If user is member, only show specific items requested: Operations, User Details, Active Nodes, Security
      if (user.role === 'member') {
        return ['complaints', 'clients', 'nodes', 'settings'].includes(item.id);
      }
      
      // For other roles, check item.roles if defined
      if (item.roles && !item.roles.includes(user.role)) {
        return false;
      }
      
      return true;
    })
  })).filter(cat => cat.items.length > 0);

  const toggleCat = (id: string) => {
    setExpandedCats(prev => 
      prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]
    );
  };

  const handleSidebarNav = (id: string) => {
    if (id === 'map') {
      setIsMapOpen(true);
    } else {
      window.dispatchEvent(new CustomEvent('admin-nav', { detail: id }));
    }
    setIsSidebarOpen(false);
  };

  return (
    <div className="min-h-screen transition-colors duration-500 overflow-x-hidden">
      {/* Sidebar Overlay */}
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsSidebarOpen(false)}
            className="fixed inset-0 bg-slate-950/40 backdrop-blur-sm z-[140] lg:hidden"
          />
        )}
      </AnimatePresence>

      {/* Modern Sidebar */}
      <motion.aside
        initial={false}
        animate={{ 
          width: isSidebarOpen ? (window.innerWidth < 640 ? '100%' : '280px') : '0px',
          x: isSidebarOpen ? 0 : -50,
          opacity: isSidebarOpen ? 1 : 0
        }}
        className={cn(
          "fixed top-0 bottom-0 left-0 z-[160] overflow-hidden bg-white dark:bg-slate-950 border-r border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col transition-all duration-300 ease-in-out",
          !isSidebarOpen && "pointer-events-none"
        )}
      >
        <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
             <div className="w-8 h-8 rounded-lg bg-emerald-500 flex items-center justify-center text-white">
                <LayoutDashboard size={18} />
             </div>
             <div>
                <h3 className="text-sm font-black uppercase tracking-tight text-slate-900 dark:text-white">Main Menu</h3>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none mt-1">Navigation Panel</p>
             </div>
          </div>
          <button 
            onClick={() => setIsSidebarOpen(false)}
            className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-900 text-slate-400 transition-colors"
          >
            <ChevronLeft size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
          
          {filteredCategories.map((cat) => (
            <div key={cat.id} className="space-y-1">
              <button 
                onClick={() => toggleCat(cat.id)}
                className="w-full flex items-center justify-between px-4 py-2 text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors group"
              >
                <span className="text-[9px] font-black uppercase tracking-[0.2em]">{cat.label}</span>
                <ChevronDown 
                  size={14} 
                  className={cn(
                    "transition-transform duration-300",
                    expandedCats.includes(cat.id) ? "rotate-180" : ""
                  )} 
                />
              </button>
              
              <AnimatePresence>
                {expandedCats.includes(cat.id) && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden space-y-1 pl-2"
                  >
                    {cat.items.map((item) => (
                      <button 
                        key={item.id}
                        onClick={() => handleSidebarNav(item.id)}
                        className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-slate-500 dark:text-slate-400 hover:bg-emerald-500/10 hover:text-emerald-500 transition-all font-bold group"
                      >
                        <item.icon size={16} className="group-hover:scale-110 transition-transform" />
                        <span className="text-[10px] uppercase tracking-widest">{item.label}</span>
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}
        </div>

        <div className="p-4 mt-auto space-y-4">
          {/* Billing Side Button */}
          <button
            onClick={() => handleSidebarNav('billing')}
            className="w-full flex items-center justify-center gap-3 py-3 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 text-white rounded-xl text-[10px] font-black uppercase tracking-[0.2em] shadow-lg shadow-blue-500/20 hover:scale-[1.02] active:scale-95 transition-all group"
          >
            <CreditCard size={16} className="group-hover:rotate-12 transition-transform" />
            Billing Side
          </button>

          {/* 4 Bottom Quick Action Icons */}
          <div className="grid grid-cols-4 gap-2 pb-2">
            {[
              { id: 'dashboard', icon: LayoutDashboard, label: 'Dash', color: 'text-blue-500 bg-blue-500/10' },
              { id: 'chat', icon: MessageSquare, label: 'Chat', color: 'text-emerald-500 bg-emerald-500/10' },
              { id: 'map', icon: MapIcon, label: 'Map', color: 'text-amber-500 bg-amber-500/10' },
              { id: 'monitor', icon: Activity, label: 'Service Monitor', color: 'text-purple-500 bg-purple-500/10' }
            ].map((action) => (
              <button
                key={action.id}
                onClick={() => {
                  if (action.id === 'chat') setIsChatOpen(true);
                  else if (action.id === 'map') setIsMapOpen(true);
                  else if (action.id === 'monitor') setIsMonitorOpen(true);
                  else handleSidebarNav(action.id === 'dashboard' ? 'complaints' : action.id);
                }}
                className={cn(
                  "flex flex-col items-center justify-center p-2 rounded-xl transition-all hover:scale-110 active:scale-95 group",
                  action.color
                )}
              >
                <action.icon size={18} className="transition-transform group-hover:rotate-12" />
                <span className="text-[7px] font-black uppercase tracking-tighter mt-1 opacity-60">{action.label}</span>
              </button>
            ))}
          </div>

          <div className="bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-4 shadow-sm group hover:border-emerald-500/30 transition-all">
             <div className="flex items-center gap-3 mb-3">
               <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-500 flex items-center justify-center shadow-inner">
                 <LogOut size={16} />
               </div>
               <div className="flex-1">
                 <p className="text-[10px] font-black uppercase text-slate-900 dark:text-white leading-none">Security Protocol</p>
                 <p className="text-[8px] font-bold text-slate-500 uppercase tracking-widest mt-1">Active Session</p>
               </div>
             </div>
             <button 
                onClick={() => {
                  if (onLogout) onLogout();
                  setIsSidebarOpen(false);
                }}
                className="w-full py-2 bg-slate-900 dark:bg-emerald-600 text-white rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-black dark:hover:bg-emerald-700 hover:shadow-lg hover:shadow-emerald-500/20 transition-all"
             >
                Sign Out
             </button>
          </div>
        </div>
      </motion.aside>

      {/* Network Status Banner */}
      <AnimatePresence>
        {!isOnline && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="bg-amber-500 text-white py-1.5 px-4 flex items-center justify-center gap-2 overflow-hidden sticky top-0 z-[100] shadow-md"
          >
            <WifiOff size={14} className="animate-pulse" />
            <span className="text-[10px] font-black uppercase tracking-widest">
              Offline Mode — Work will be saved locally and synced automatically when connected.
            </span>
          </motion.div>
        )}
        {showSyncStatus && isOnline && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="bg-emerald-600 text-white py-1.5 px-4 flex items-center justify-center gap-2 overflow-hidden sticky top-0 z-[100] shadow-md"
          >
            <Wifi size={14} />
            <span className="text-[10px] font-black uppercase tracking-widest">
              Connection Restored — Synchronizing data with server...
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Detail Modal Overlay */}
      <AnimatePresence>
        {selectedNotif && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedNotif(null)}
              className="fixed inset-0 bg-slate-950/60 backdrop-blur-md z-[300]"
            />
            <div className="fixed inset-0 flex items-center justify-center z-[310] p-4 pointer-events-none">
              <motion.div
                initial={{ opacity: 0, scale: 0.8, y: 100, filter: 'blur(20px)', rotate: -5 }}
                animate={{ opacity: 1, scale: 1, y: 0, filter: 'blur(0px)', rotate: 0 }}
                exit={{ 
                  opacity: 0, 
                  scale: 0.5, 
                  y: -200, 
                  x: 300, 
                  rotate: 20, 
                  skewX: 20, 
                  filter: 'blur(50px)',
                  transition: { duration: 0.4, ease: [0.4, 0, 0.2, 1] }
                }}
                className="w-full max-w-lg bg-white dark:bg-slate-950 rounded-[2.5rem] border border-slate-200/50 dark:border-white/10 shadow-[0_40px_100px_rgba(0,0,0,0.4)] pointer-events-auto overflow-hidden relative"
              >
                {/* Decorative Elements */}
                <div className="absolute top-0 right-0 -tr-20 -u-20 w-40 h-40 bg-brand-accent/10 blur-[60px] rounded-full" />
                <div className="absolute bottom-0 left-0 -bl-20 -d-20 w-40 h-40 bg-emerald-500/10 blur-[60px] rounded-full" />

                <div className="p-5 sm:p-8 relative z-10">
                  <div className="flex items-center justify-between mb-6 sm:mb-8">
                    <div className="flex items-center gap-3 sm:gap-4">
                      <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-brand-accent/10 flex items-center justify-center border border-brand-accent/20">
                        <Bell size={20} className="text-brand-accent sm:w-[24px] sm:h-[24px]" />
                      </div>
                      <div>
                        <h4 className="text-base sm:text-lg font-black uppercase tracking-tight text-slate-900 dark:text-white">Intelligence Packet</h4>
                        <p className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-widest">Metadata Breakdown</p>
                      </div>
                    </div>
                    <button 
                      onClick={() => setSelectedNotif(null)}
                      className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-slate-100 dark:bg-slate-900 flex items-center justify-center text-slate-500 hover:scale-110 active:scale-95 transition-all"
                    >
                      <X size={18} className="sm:w-[20px] sm:h-[20px]" />
                    </button>
                  </div>

                  <div className="space-y-4 sm:space-y-6">
                    <div className="p-4 sm:p-5 rounded-2xl bg-slate-50 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-800">
                      <p className="text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-200 leading-relaxed">
                        {selectedNotif.message}
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-3 sm:gap-4">
                      <div className="p-3 sm:p-4 rounded-xl border border-slate-100 dark:border-slate-800">
                        <p className="text-[8px] sm:text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">Author</p>
                        <div className="flex items-center gap-1.5 sm:gap-2">
                          <User size={10} className="text-brand-accent sm:w-[12px] sm:h-[12px]" />
                          <span className="text-[10px] sm:text-xs font-bold text-slate-900 dark:text-slate-100">{selectedNotif.authorName}</span>
                        </div>
                      </div>
                      <div className="p-3 sm:p-4 rounded-xl border border-slate-100 dark:border-slate-800">
                        <p className="text-[8px] sm:text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">Timestamp</p>
                        <div className="flex items-center gap-1.5 sm:gap-2">
                          <Clock size={10} className="text-emerald-500 sm:w-[12px] sm:h-[12px]" />
                          <span className="text-[10px] sm:text-xs font-bold text-slate-900 dark:text-slate-100">{new Date(selectedNotif.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                      </div>
                    </div>

                    {selectedNotif.details && (
                      <div className="p-4 sm:p-5 rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/20">
                         <p className="text-[8px] sm:text-[9px] font-black uppercase tracking-widest text-slate-400 mb-2 sm:mb-3">Payload Data</p>
                         <div className="space-y-1.5 sm:space-y-2">
                            {Object.entries(selectedNotif.details).filter(([k]) => k !== 'id' && k !== 'createdAt').slice(0, 5).map(([key, value]) => (
                              <div key={key} className="flex justify-between items-center text-[9px] sm:text-[10px] py-1 border-b border-slate-100 dark:border-slate-800/50 last:border-0">
                                <span className="font-bold uppercase text-slate-500">{key}</span>
                                <span className="font-black text-slate-900 dark:text-slate-100 truncate max-w-[140px] sm:max-w-[200px]">{String(value)}</span>
                              </div>
                            ))}
                         </div>
                      </div>
                    )}
                  </div>

                  <button 
                    onClick={() => setSelectedNotif(null)}
                    className="w-full mt-6 sm:mt-8 py-3 sm:py-4 bg-slate-900 dark:bg-brand-accent text-white rounded-2xl text-[10px] sm:text-xs font-black uppercase tracking-[0.2em] sm:tracking-[0.3em] shadow-xl shadow-brand-accent/20 hover:scale-[1.02] active:scale-95 transition-all"
                  >
                    Acknowledge
                  </button>
                </div>
              </motion.div>
            </div>
          </>
        )}
      </AnimatePresence>

      {/* Global Loading Indicator */}
      <AnimatePresence>
        {isLoading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[9999] bg-slate-950/80 backdrop-blur-md flex items-center justify-center pointer-events-none"
          >
            <FiberLoading className="scale-90" />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Chat Sidebar */}
      <AnimatePresence>
        {isChatOpen && user && (
          <Chat 
            currentUser={user} 
            users={users}
            onClose={() => {
              setIsChatOpen(false);
              setSelectedChatId(null);
            }} 
            isAudioMuted={isAudioMuted} 
            isMicMuted={isMicMuted}
            selectedId={selectedChatId}
          />
        )}
      </AnimatePresence>

      {/* Notifications Panel */}
      <AnimatePresence>
        {isNotificationsOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsNotificationsOpen(false)}
              className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[150]"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, x: 100, y: -100, filter: 'blur(20px)', rotate: 5 }}
              animate={{ opacity: 1, scale: 1, x: 0, y: 0, filter: 'blur(0px)', rotate: 0 }}
              exit={{ 
                opacity: 0, 
                scale: 0.8, 
                x: 400, 
                y: -200, 
                rotate: 15, 
                skewX: 40, 
                filter: 'blur(50px)',
                transition: { duration: 1, ease: [0.4, 0, 0.2, 1] }
              }}
              transition={{ 
                type: "spring",
                damping: 25,
                stiffness: 200,
                duration: 0.2
              }}
              className="fixed top-20 right-4 sm:right-8 w-[calc(100vw-2rem)] sm:w-[380px] max-h-[70vh] bg-white dark:bg-slate-950 rounded-3xl border border-slate-200/60 dark:border-slate-800/80 shadow-[0_20px_60px_rgba(0,0,0,0.15)] dark:shadow-[0_20px_60px_rgba(0,0,0,0.4)] z-[200] overflow-hidden flex flex-col"
            >
              <div className="p-6 border-b border-slate-100 dark:border-slate-800/50 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/50">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-brand-accent/10 flex items-center justify-center">
                    <History size={16} className="text-brand-accent" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black uppercase tracking-tight text-slate-900 dark:text-slate-50 leading-none">Operation History</h3>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mt-1">Live Intelligence Feed</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {notifications.length > 0 && (
                    <button 
                      onClick={handleClearAll}
                      className="p-2 rounded-full hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-400 hover:text-emerald-500 transition-all group"
                      title="Mark all as read / Clear Feed"
                    >
                      <CheckCircle2 size={18} className="group-hover:scale-110 transition-transform" />
                    </button>
                  )}
                  <button 
                    onClick={() => setIsNotificationsOpen(false)}
                    className="p-2 rounded-full hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
                  >
                    <ChevronRight size={18} />
                  </button>
                </div>
              </div>

              {!alertAuthorized && (
                <div className="mx-4 mt-2 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center gap-3 shrink-0">
                  <ShieldAlert size={16} className="text-amber-500 shrink-0" />
                  <div>
                    <p className="text-[10px] font-black text-amber-600 dark:text-amber-400 uppercase tracking-tighter leading-none">Alerts Suppressed</p>
                    <p className="text-[8px] font-bold text-amber-600/70 dark:text-amber-400/70 uppercase tracking-widest mt-1">Initialize Speaker Matrix in Console</p>
                  </div>
                </div>
              )}

              <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
                {notifications.length === 0 ? (
                  <div className="py-20 text-center">
                    <Bell className="mx-auto text-slate-200 dark:text-slate-800 mb-4" size={48} />
                    <p className="text-xs font-black uppercase tracking-widest text-slate-400">Empty Log Cache</p>
                  </div>
                ) : (
                  notifications.map((notif, idx) => (
                    <motion.div
                      key={`${notif.id}-${idx}`}
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.05 }}
                      onClick={() => {
                        setSelectedNotif(notif);
                        setIsNotificationsOpen(false);
                      }}
                      className="p-4 rounded-2xl border border-slate-100 dark:border-slate-800/50 bg-slate-50/30 dark:bg-slate-900/20 hover:bg-white dark:hover:bg-slate-900 transition-all group cursor-pointer"
                    >
                      <div className="flex gap-4 items-start">
                        <div className="mt-1">
                          {getNotifIcon(notif.type)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold text-slate-800 dark:text-slate-200 leading-relaxed mb-2">
                            {notif.message}
                          </p>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <div className="w-4 h-4 rounded-full bg-slate-200 dark:bg-slate-800 flex items-center justify-center overflow-hidden">
                                <User size={10} className="text-slate-500" />
                              </div>
                              <span className="text-[10px] font-black uppercase tracking-tighter text-brand-accent">
                                {notif.authorName}
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5 text-[9px] font-bold text-slate-400">
                              <Clock size={10} />
                              {formatTimestamp(notif.createdAt)}
                            </div>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  ))
                )}
              </div>

              <div className="p-4 bg-slate-50 dark:bg-slate-900/50 border-t border-slate-100 dark:border-slate-800/50">
                <button 
                  onClick={() => setIsNotificationsOpen(false)}
                  className="w-full py-2.5 bg-slate-900 dark:bg-brand-accent text-white rounded-xl text-[10px] font-black uppercase tracking-[0.2em] shadow-lg shadow-brand-accent/10 hover:scale-[1.02] active:scale-95 transition-all"
                >
                  Close Access Feed
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Profile Dropdown */}
      <AnimatePresence>
        {isProfileOpen && user && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsProfileOpen(false)}
              className="fixed inset-0 bg-slate-950/20 backdrop-blur-[2px] z-[150]"
            />
            <motion.div
              initial={{ opacity: 0, y: -20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.95 }}
              className="fixed top-20 right-4 sm:right-24 w-[calc(100vw-2rem)] sm:w-[320px] bg-white dark:bg-slate-950 rounded-3xl border border-slate-200/60 dark:border-slate-800/80 shadow-[0_20px_60px_rgba(0,0,0,0.2)] z-[200] overflow-hidden"
            >
              <div className="p-6 bg-slate-50 dark:bg-slate-900/50 border-b border-slate-100 dark:border-slate-800/50">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-brand-accent/10 flex items-center justify-center border border-brand-accent/20">
                    <User size={20} className="text-brand-accent" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black uppercase tracking-tight text-slate-900 dark:text-slate-50 leading-none">Security Profile</h3>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mt-1">Identity & Access Management</p>
                  </div>
                </div>
              </div>

              <form onSubmit={handleUpdateProfile} className="p-5 space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 ml-1">Full Display Name</label>
                  <input
                    type="text"
                    value={editFullName}
                    onChange={(e) => setEditFullName(e.target.value)}
                    placeholder="Enter Full Name"
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl px-4 py-2.5 text-xs font-bold focus:ring-2 focus:ring-brand-accent/30 outline-none transition-all"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 ml-1">Access ID (Username)</label>
                  <input
                    type="text"
                    value={editUsername}
                    onChange={(e) => setEditUsername(e.target.value)}
                    placeholder="Username"
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl px-4 py-2.5 text-xs font-bold focus:ring-2 focus:ring-brand-accent/30 outline-none transition-all"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 ml-1">Secure Protocol (Password)</label>
                  <input
                    type="password"
                    value={editPassword}
                    onChange={(e) => setEditPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl px-4 py-2.5 text-xs font-bold focus:ring-2 focus:ring-brand-accent/30 outline-none transition-all"
                  />
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={isUpdatingProfile}
                    className="w-full py-3 bg-slate-900 dark:bg-brand-accent text-white rounded-xl text-[10px] font-black uppercase tracking-[0.2em] shadow-lg shadow-brand-accent/10 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50"
                  >
                    {isUpdatingProfile ? 'Propagating Changes...' : 'Update Identity Panel'}
                  </button>
                </div>
              </form>

              <div className="p-4 bg-slate-50 dark:bg-slate-900/30 border-t border-slate-100 dark:border-slate-800/50 flex items-center justify-between">
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Role: {user.role}</span>
                <button
                  onClick={onLogout}
                  className="text-[9px] font-black uppercase tracking-widest text-rose-500 hover:text-rose-600 transition-colors"
                >
                  Terminate Session
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <header className={cn(
        "sticky top-0 z-50 w-full border-b backdrop-blur-md",
        branding?.sidebarTheme === 'dark' ? "bg-slate-950 border-slate-800 text-white" :
        branding?.sidebarTheme === 'accent' ? "bg-brand-accent border-white/20 text-white" :
        branding?.sidebarTheme === 'glass' ? "glass border-white/10" :
        "bg-white/80 dark:bg-slate-950/80 border-slate-200 dark:border-slate-800"
      )}>
        <div className="container mx-auto px-2 sm:px-4 h-16 flex items-center justify-between">
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex items-center gap-2 sm:gap-4"
          >
            {user && (
              <button 
                onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                className={cn(
                  "p-2 rounded-xl transition-all mr-1",
                  isColoredHeader ? "hover:bg-white/10 text-white" : "hover:bg-slate-100 dark:hover:bg-slate-900 text-slate-500"
                )}
              >
                {isSidebarOpen ? <X size={20} /> : <Menu size={20} />}
              </button>
            )}
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="relative group shrink-0">
                {/* Modern Mesh Gradient Background */}
                <div className="absolute -inset-1.5 bg-gradient-to-r from-brand-accent via-blue-500 to-emerald-500 rounded-xl blur-lg opacity-25 group-hover:opacity-60 transition-opacity duration-500 animate-pulse" />
                
                {/* Main Logo Container */}
                <div className="relative w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-slate-950 flex items-center justify-center shadow-2xl border border-white/10 overflow-hidden group/logo">
                  {branding?.logoUrl ? (
                    <img src={branding.logoUrl} alt="Logo" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  ) : (
                    <>
                      {/* Internal Animated Mesh */}
                      <div className="absolute inset-0 opacity-40">
                        <div className="absolute top-0 -left-1/4 w-1/2 h-1/2 bg-brand-accent/40 blur-2xl rounded-full animate-blob" />
                        <div className="absolute bottom-0 -right-1/4 w-1/2 h-1/2 bg-blue-500/40 blur-2xl rounded-full animate-blob animation-delay-2000" />
                      </div>
                      
                      {/* Subtle Grid Pattern */}
                      <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 mix-blend-overlay" />
                      
                      {/* Shimmer Effect */}
                      <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/10 to-transparent -translate-x-full group-hover/logo:translate-x-full transition-transform duration-1000 ease-in-out" />
                      
                      {/* Text with modern styling */}
                      <div className="relative flex items-baseline">
                        <span className="text-white font-black text-xl sm:text-2xl tracking-tighter italic leading-none drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]">
                          G
                        </span>
                        <span className="text-brand-accent font-black text-xl sm:text-2xl tracking-tighter italic leading-none drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]">
                          TS
                        </span>
                      </div>

                      {/* Corner Accents */}
                      <div className="absolute top-1 left-1 w-2 h-0.5 bg-white/20 rounded-full" />
                      <div className="absolute top-1 left-1 w-0.5 h-2 bg-white/20 rounded-full" />
                      <div className="absolute bottom-1 right-1 w-2 h-0.5 bg-white/20 rounded-full" />
                      <div className="absolute bottom-1 right-1 w-0.5 h-2 bg-white/20 rounded-full" />
                    </>
                  )}
                </div>
              </div>
              
              <div className="hidden xs:block sm:block">
                <h1 className={cn(
                  "text-xs sm:text-lg font-black tracking-tight uppercase leading-none font-mono",
                  isColoredHeader ? "text-white" : "text-emerald-600 dark:text-emerald-400"
                )}>
                  {brandingText}
                </h1>
                <p className={cn(
                  "text-[8px] sm:text-[10px] font-bold uppercase tracking-[0.2em] mt-0.5 sm:mt-1 flex items-center gap-1.5 opacity-90",
                  isColoredHeader ? "text-white/70" : "text-emerald-500/80"
                )}>
                  <span className={cn("w-1.5 h-1.5 rounded-full animate-pulse", isColoredHeader ? "bg-white" : "bg-emerald-500")} />
                  Powered by Green Net {user && user.role === 'super_admin' && <span className="text-brand-accent ml-1 font-black px-1.5 py-0.5 rounded bg-brand-accent/10 border border-brand-accent/20">ROOT ADMIN</span>}
                  {user && user.role === 'dealer' && <span className="text-blue-500 ml-1 font-black px-1.5 py-0.5 rounded bg-blue-500/10 border border-blue-500/20">MAIN DEALER PANEL</span>}
                  {user && (user.role === 'admin' || (user.role === 'member' && user.dealerId && user.dealerId !== 'main')) && <span className="text-purple-500 ml-1 font-black px-1.5 py-0.5 rounded bg-purple-500/10 border border-purple-500/20">{user.role === 'admin' ? 'LITE ADMIN PANEL' : 'OPERATIONAL MEMBER'}</span>}
                </p>
              </div>
            </div>
          </motion.div>

          <div className="flex items-center gap-1 sm:gap-3">
            {user && onRefresh && (
              <div className="hidden md:block scale-90 sm:scale-100">
                <RefreshControl onRefresh={onRefresh} isLoading={isLoading} />
              </div>
            )}

            {user && (
              <div className="flex items-center gap-0.5 sm:gap-1.5">
                <button
                  onClick={onToggleAudio}
                  className={cn(
                    "p-1.5 sm:p-2 rounded-lg transition-all",
                    isAudioMuted 
                      ? "text-slate-400 hover:text-amber-500 bg-black/5" 
                      : (isColoredHeader ? "text-white bg-white/10 hover:bg-white/20" : "text-emerald-500 bg-emerald-500/5 hover:bg-emerald-500/10")
                  )}
                  title={isAudioMuted ? "Unmute Audio Alerts" : "Mute Audio Alerts"}
                >
                  {isAudioMuted ? <VolumeX size={16} className="sm:w-[18px] sm:h-[18px]" /> : <Volume2 size={16} className="sm:w-[18px] sm:h-[18px]" />}
                </button>

                <button
                  onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
                  className={cn(
                    "p-1.5 sm:p-2 rounded-lg transition-all relative",
                    alertAuthorized 
                      ? (isAudioMuted 
                          ? "text-slate-400 bg-black/5 hover:bg-black/10" 
                          : (isColoredHeader ? "text-white bg-white/10 hover:bg-white/20" : "text-emerald-500 bg-emerald-500/5 hover:bg-emerald-500/10"))
                      : "text-amber-500 bg-amber-500/5 hover:bg-amber-500/10 shadow-sm"
                  )}
                  title={alertAuthorized ? (isAudioMuted ? "Open Notifications (Muted)" : "Open Notification History") : "Operation History (Alerts Restricted)"}
                >
                  {isAudioMuted && alertAuthorized ? (
                    <BellOff size={16} className="sm:w-[18px] sm:h-[18px]" />
                  ) : (
                    <Bell size={16} className={cn("sm:w-[18px] sm:h-[18px]", !alertAuthorized && "opacity-60")} />
                  )}
                  {notifications.length > 0 && (
                    <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full border border-white dark:border-slate-950 shadow-sm" />
                  )}
                </button>
              </div>
            )}
            
            <button
              onClick={toggleTheme}
              className={cn(
                "p-1.5 sm:p-2 rounded-lg transition-all",
                isColoredHeader ? "hover:bg-white/10 text-white" : "hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400"
              )}
              title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            >
              {theme === 'dark' ? <Sun size={18} className="sm:w-[20px] sm:h-[20px]" /> : <Moon size={18} className="sm:w-[20px] sm:h-[20px]" />}
            </button>

            {user && (
              <button 
                onClick={() => setIsProfileOpen(!isProfileOpen)}
                className={cn(
                  "flex items-center gap-2 sm:gap-3 px-2 sm:px-3 py-1.5 rounded-lg border transition-all hover:scale-[1.02] active:scale-95",
                  isProfileOpen 
                    ? "border-brand-accent bg-brand-accent/20 text-brand-accent shadow-lg shadow-brand-accent/10" 
                    : (isColoredHeader 
                        ? "border-white/20 bg-white/10 text-white"
                        : "border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900")
                )}
              >
                <User size={16} className={cn("transition-transform duration-300", isProfileOpen && "rotate-12")} />
                <span className="text-sm font-semibold hidden sm:block">{user.fullName || user.username}</span>
              </button>
            )}

            <div className={cn(
              "hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-all",
              isOnline 
                ? "border-emerald-500/20 bg-emerald-500/10 opacity-100" 
                : "border-amber-500/20 bg-amber-500/10 opacity-100"
            )}>
              <div className={cn(
                "w-2 h-2 rounded-full animate-pulse",
                isOnline ? "bg-emerald-500" : "bg-amber-500"
              )} />
              <span className={cn(
                "text-[10px] uppercase font-black tracking-widest",
                isOnline 
                  ? (isColoredHeader ? "text-white" : "text-emerald-600 dark:text-emerald-500") 
                  : "text-amber-600 dark:text-amber-500"
              )}>
                {isOnline ? 'Live Relay' : 'Offline Access'}
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className={cn("mx-auto py-4 sm:py-8 transition-all duration-500", user ? "container px-4" : "w-full max-w-none px-0 sm:px-0")}>
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.15 }}
        >
          {children}
        </motion.div>
      </main>

      {/* Footer */}
      <footer className="py-6 sm:py-12 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950">
        <div className="container mx-auto px-4">
          <div className="flex flex-col items-center">
             <div className="relative group mb-3 sm:mb-4">
                <div className="absolute -inset-1 bg-gradient-to-r from-brand-accent to-blue-500 rounded-lg blur opacity-25 group-hover:opacity-50 transition" />
                <div className="relative w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-slate-950 flex items-center justify-center shadow-xl border border-white/10 overflow-hidden">
                  <span className="text-white font-black text-base sm:text-xl tracking-tighter italic leading-none drop-shadow-md">G<span className="text-brand-accent">TS</span></span>
                </div>
             </div>
             <p className="text-[8px] sm:text-[10px] text-slate-400 dark:text-slate-500 uppercase font-black tracking-[0.2em] sm:tracking-[0.3em] mb-1">
               {brandingText}
             </p>
             <h4 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-slate-100 uppercase tracking-tight">ISP Management Pro</h4>
          </div>
          
          <div className="h-px w-6 sm:w-8 bg-slate-200 dark:bg-slate-800 mx-auto my-6 sm:my-8" />

          <div className="flex flex-col md:flex-row items-center justify-between gap-4 sm:gap-6 max-w-4xl mx-auto">
            <p className="text-[9px] sm:text-[11px] text-slate-400 dark:text-slate-500 font-medium text-center md:text-left">
              © {new Date().getFullYear()} Green Tech Services Operations. <br className="xs:hidden" /> Enterprise Edition.
            </p>
            <div className="inline-flex items-center gap-3 sm:gap-4 px-3 sm:px-4 py-1 sm:py-1.5 rounded-full border border-slate-200 dark:border-slate-800 text-[8px] sm:text-[10px] uppercase font-bold tracking-widest text-slate-400 cursor-default">
              Powered by Green Net
            </div>
          </div>
        </div>
      </footer>

      {/* Funny Walking Mascot */}
      {user && !isChatOpen && (
        <FloatingMascot 
          branding={branding}
          onOpenChat={() => setIsChatOpen(true)} 
          onNotificationClick={async () => {
            setIsNotificationsOpen(true);
          }}
          onServicesClick={() => setIsMonitorOpen(true)}
          onMapClick={() => setIsMapOpen(true)}
          latestNotification={notifications.length > 0 ? (notifications[0].message as string) : null}
          unseenMessages={notifications.length}
        />
      )}

      <MapViewer 
        isOpen={isMapOpen} 
        onClose={() => {
          setIsMapOpen(false);
          setFocusedClientId(null);
        }} 
        user={user!}
        focusedClientId={focusedClientId}
      />

      {/* Service Real-time Monitor */}
      <ServiceMonitor 
        isOpen={isMonitorOpen} 
        onClose={() => setIsMonitorOpen(false)} 
        user={user}
      />
    </div>
  );
}

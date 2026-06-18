import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Sun, Moon, LogOut, User, MessageSquare, ChevronRight, Bell, BellOff, Volume2, VolumeX, Settings, ShieldAlert, AlertTriangle, Mic, WifiOff, Wifi, History, Trash2, Clock, CheckCircle2, X, Menu, ChevronLeft, LayoutDashboard, ClipboardList, TrendingUp, Users, Shield, CloudUpload, Palette, Map as MapIcon, HelpCircle, PlusSquare, Contact, Flame, BarChart3, ChevronDown, Activity, CreditCard, PenLine, Home, RefreshCw, Sparkles, Lock, Mail, Camera, Key, Monitor } from 'lucide-react';
import { useTheme } from '../hooks/useTheme';
import { cn } from '../lib/utils';
import { UserProfile, Notification, BrandingConfig } from '../types';
import Chat from './Chat';
import AIHelpPanel from './AIHelpPanel';
import FloatingMascot from './FloatingMascot';
import ServiceMonitor from './ServiceMonitor';
import MapViewer from './MapViewer';
import RefreshControl from './RefreshControl';
import FiberLoading from './FiberLoading';
import InlineTextEditor from './InlineTextEditor';
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
  onUpdateUser?: (uid: string, username: string, pass: string, lineCode?: string, companyName?: string, fullName?: string, role?: UserProfile['role'], profilePicture?: string, email?: string) => Promise<void>;
  branding?: BrandingConfig;
  onUpdateBranding?: (newBranding: BrandingConfig) => Promise<void>;
  activeTab?: string;
  onNavigate?: (id: string) => void;
  isPreview?: boolean;
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
  branding,
  onUpdateBranding,
  activeTab: activeTabProp,
  onNavigate: onNavigateProp,
  isPreview = false
}: LayoutProps) {
  const { theme, toggleTheme } = useTheme();
  const [isThemeTransitioning, setIsThemeTransitioning] = useState(false);
  const [themeTransitionProgress, setThemeTransitionProgress] = useState(0);
  const [targetTheme, setTargetTheme] = useState<'light' | 'dark' | null>(null);

  const handleThemeToggle = () => {
    if (isThemeTransitioning) return;
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    setTargetTheme(nextTheme);
    setIsThemeTransitioning(true);
    setThemeTransitionProgress(0);

    let progress = 0;
    let didToggle = false;
    const interval = setInterval(() => {
      progress += Math.floor(Math.random() * 12) + 8;
      if (progress >= 85 && !didToggle) {
        didToggle = true;
        toggleTheme();
      }

      if (progress >= 100) {
        progress = 100;
        setThemeTransitionProgress(100);
        clearInterval(interval);

        setTimeout(() => {
          setIsThemeTransitioning(false);
          setTargetTheme(null);
        }, 220);
      } else {
        setThemeTransitionProgress(progress);
      }
    }, 38);
  };

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
  const [isInlineEditingActive, setIsInlineEditingActive] = useState(false);
  
  const [localActiveTab, setLocalActiveTab] = useState<string>('complaints');
  const activeTab = activeTabProp !== undefined ? activeTabProp : localActiveTab;
  const setActiveTab = onNavigateProp !== undefined ? onNavigateProp : setLocalActiveTab;

  useEffect(() => {
    const handleAdminTab = (e: any) => {
      if (e.detail) {
        setActiveTab(e.detail);
      }
    };
    window.addEventListener('admin-nav', handleAdminTab);
    return () => window.removeEventListener('admin-nav', handleAdminTab);
  }, [setActiveTab]);

  useEffect(() => {
    const handleOpenMap = (e: CustomEvent) => {
      setFocusedClientId(e.detail.clientId);
      setIsMapOpen(true);
    };
    window.addEventListener('open-map-for-client', handleOpenMap as EventListener);
    return () => window.removeEventListener('open-map-for-client', handleOpenMap as EventListener);
  }, []);

  // Automatically close sidebar if clicked anywhere outside of the sidebar on the viewport
  useEffect(() => {
    if (!isSidebarOpen) return;

    const handleGlobalClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('aside') && !target.closest('#sidebar-toggle-btn')) {
        setIsSidebarOpen(false);
      }
    };

    // Delay setting listener slightly to avoid handling the opening click
    const timer = setTimeout(() => {
      document.addEventListener('click', handleGlobalClick);
    }, 0);

    return () => {
      clearTimeout(timer);
      document.removeEventListener('click', handleGlobalClick);
    };
  }, [isSidebarOpen]);

  // Automatically close profile panel if clicked anywhere outside of it
  useEffect(() => {
    if (!isProfileOpen) return;

    const handleGlobalClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('#profile-panel') && !target.closest('#profile-toggle-btn')) {
        setIsProfileOpen(false);
      }
    };

    const timer = setTimeout(() => {
      document.addEventListener('click', handleGlobalClick);
    }, 0);

    return () => {
      clearTimeout(timer);
      document.removeEventListener('click', handleGlobalClick);
    };
  }, [isProfileOpen]);

  // Profile Edit State
  const [editFullName, setEditFullName] = useState(user?.fullName || '');
  const [editUsername, setEditUsername] = useState(user?.username || '');
  const [editPassword, setEditPassword] = useState(user?.password || '');
  const [editProfilePicture, setEditProfilePicture] = useState(user?.profilePicture || '');
  const [editEmail, setEditEmail] = useState(user?.email || '');
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (user) {
      setEditFullName(user.fullName || '');
      setEditUsername(user.username || '');
      setEditPassword(user.password || '');
      setEditProfilePicture(user.profilePicture || '');
      setEditEmail(user.email || '');
    }
  }, [user]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setEditProfilePicture(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

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
        user.role,
        editProfilePicture,
        editEmail
      );
      setIsProfileOpen(false);
    } catch (error) {
      console.error("Profile update failed:", error);
    } finally {
      setIsUpdatingProfile(false);
    }
  };

  const [intervalTime, setIntervalTime] = useState<number>(0);
  const [showRefreshOptions, setShowRefreshOptions] = useState(false);
  const [lastRefreshedTime, setLastRefreshedTime] = useState<string>("06:05:10");

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const pad = (n: number) => n.toString().padStart(2, '0');
      setLastRefreshedTime(`${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`);
    };
    updateTime();
  }, [isLoading]);

  useEffect(() => {
    if (intervalTime === 0) return;
    const timer = setInterval(() => {
      if (onRefresh) onRefresh();
    }, intervalTime);
    return () => clearInterval(timer);
  }, [intervalTime, onRefresh]);

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

  const [expandedCats, setExpandedCats] = useState<string[]>(['ops', 'analytics', 'system']);

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
      {/* Persistent Left Sidebar Rail for Desktop (Matching Mockup Perfectly) */}
      {user && (
        <div className={cn(
          "top-0 left-0 bottom-0 w-[68px] bg-white dark:bg-slate-950 border-r border-slate-200/60 dark:border-slate-800/60 flex-col items-center pb-5 select-none",
          isSidebarOpen ? "flex z-[160]" : "hidden lg:flex z-[51]",
          isPreview ? "absolute h-full" : "fixed shadow-[1px_0_15px_rgba(0,0,0,0.02)]"
        )}>
          {/* Menu Trigger Button Container (aligned with Header H-16 perfectly) */}
          <div className="w-full h-16 flex items-center justify-center shrink-0 border-b border-slate-100/50 dark:border-slate-900/40">
            <motion.button
              id="rail-menu-btn"
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="p-3 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-900 text-slate-400 dark:text-slate-500 hover:text-slate-900 dark:hover:text-white transition-all duration-300 cursor-pointer"
              title="Toggle Detailed Menu"
            >
              <motion.div
                animate={{ rotate: isSidebarOpen ? 90 : 0 }}
                transition={{ type: "spring", stiffness: 200, damping: 15 }}
              >
                <Menu size={20} />
              </motion.div>
            </motion.button>
          </div>

          {/* Dynamic Icon groups */}
          <div className="flex-1 w-full px-3 flex flex-col gap-5 items-center pt-6 overflow-y-auto overflow-x-hidden no-scrollbar">
            {(() => {
              const items = [
                { id: 'complaints', label: branding?.tabNames?.complaints || 'Operations', icon: ClipboardList },
                { id: 'submit', label: branding?.tabNames?.submit || 'Complain Reg', icon: PlusSquare },
                { id: 'nodes', label: 'Active Nodes', icon: Flame },
                { id: 'clients', label: branding?.tabNames?.clients || 'User Details', icon: Contact },
                { id: 'mypc', label: 'MY PC', icon: Monitor },
                { id: 'billing', label: 'Billing Mod', icon: CreditCard },
                { id: 'config', label: branding?.tabNames?.config || 'Workflow Config', icon: Settings },
                { id: 'map', label: 'Network Map', icon: MapIcon },
                { id: 'monitor', label: 'Service Monitor', icon: Activity },
                { id: 'settings', label: 'Security', icon: Shield },
                { id: 'integrations', label: 'Google Sheet Link', icon: CloudUpload, roles: ['super_admin', 'admin'] }
              ];

              const permitted = items.filter(item => {
                if (!user) return false;
                if (user.role === 'member') {
                  return ['complaints', 'submit', 'nodes', 'clients', 'settings', 'monitor', 'map'].includes(item.id);
                }
                if (item.roles && !item.roles.includes(user.role)) {
                  return false;
                }
                return true;
              });

              const visible = permitted.filter(item => !(branding?.hiddenTabs || []).includes(item.id));

              return visible.map((item) => {
                const isItemActive = (() => {
                  if (item.id === 'chat') return isChatOpen;
                  if (item.id === 'monitor') return isMonitorOpen;
                  if (item.id === 'map') return isMapOpen && !isSidebarOpen;
                  return activeTab === item.id || 
                         (item.id === 'complaints' && activeTab === 'ops') ||
                         (item.id === 'settings' && activeTab === 'profile');
                })();

                const handleItemClick = () => {
                  if (item.id === 'chat') {
                    setIsChatOpen(true);
                  } else if (item.id === 'monitor') {
                    setIsMonitorOpen(true);
                  } else if (item.id === 'map') {
                    setIsMapOpen(true);
                  } else if (item.id === 'billing') {
                    handleSidebarNav('billing');
                  } else {
                    handleSidebarNav(item.id);
                  }
                };

                return (
                  <motion.button
                    key={item.id}
                    onClick={handleItemClick}
                    initial="rest"
                    whileHover="hover"
                    whileTap="tap"
                    className={cn(
                      "w-11 h-11 rounded-2xl flex items-center justify-center relative cursor-pointer border transition-colors duration-300 group",
                      isItemActive
                        ? "bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border-blue-100 dark:border-blue-900/30 shadow-[0_4px_12px_rgba(59,130,246,0.12)]"
                        : "border-transparent text-slate-400 dark:text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-900/50 hover:text-slate-800 dark:hover:text-white"
                    )}
                  >
                    <motion.div
                      variants={{
                        rest: { scale: 1, rotate: 0, y: 0 },
                        hover: { scale: 1.15, rotate: 8, y: -1 }
                      }}
                      transition={{ type: "spring", stiffness: 400, damping: 15 }}
                    >
                      <item.icon size={20} />
                    </motion.div>
                    
                    {isItemActive && (
                      <motion.div
                        layoutId="activeSideLine"
                        className="absolute left-0 top-3 bottom-3 w-1 bg-blue-600 dark:bg-blue-400 rounded-r-full"
                        transition={{ type: "spring", stiffness: 350, damping: 25 }}
                      />
                    )}
                    
                    {/* Tooltip */}
                    <span className="absolute left-16 scale-0 opacity-0 group-hover:scale-100 group-hover:opacity-100 transition-all duration-200 z-[100] bg-slate-900 dark:bg-slate-800 text-white text-[9px] font-black uppercase tracking-wider px-2.5 py-1.5 rounded-lg shadow-lg pointer-events-none whitespace-nowrap">
                      {item.label}
                    </span>
                  </motion.button>
                );
              });
            })()}
          </div>

          {/* Bottom Help Question Icon & Logout */}
          <div className="mt-auto px-3 w-full flex flex-col items-center gap-3">
            {/* Show bottom Sparkles help icon only if 'chat' is hidden from the main custom list to avoid duplication */}
            {(branding?.hiddenTabs || []).includes('chat') && (
              <motion.button
                onClick={() => setIsChatOpen(true)}
                whileHover="hover"
                whileTap="tap"
                className="w-11 h-11 rounded-2xl flex items-center justify-center relative cursor-pointer text-blue-500 dark:text-blue-400 hover:bg-slate-100 dark:hover:bg-slate-900 group"
                title="Launch AI Help Portal"
              >
                <motion.div
                  variants={{
                    hover: { scale: 1.15, rotate: 12 },
                    tap: { scale: 0.95 }
                  }}
                  transition={{ type: "spring", stiffness: 450, damping: 12 }}
                >
                  <Sparkles size={20} className="animate-pulse" />
                </motion.div>
                <span className="absolute left-16 scale-0 opacity-0 group-hover:scale-100 group-hover:opacity-100 transition-all duration-200 z-50 bg-blue-600 text-white text-[9px] font-black uppercase tracking-wider px-2.5 py-1.5 rounded-lg shadow-lg pointer-events-none whitespace-nowrap">
                  AI Help
                </span>
              </motion.button>
            )}

            <motion.button
              onClick={() => {
                if (onLogout) onLogout();
              }}
              whileHover="hover"
              whileTap="tap"
              className="w-11 h-11 rounded-2xl flex items-center justify-center relative cursor-pointer text-slate-400 dark:text-slate-500 hover:bg-red-500/10 hover:text-red-600 dark:hover:bg-red-500/20 dark:hover:text-red-400 group"
              title="Sign Out"
            >
              <motion.div
                variants={{
                  hover: { scale: 1.15, x: 2 },
                  tap: { scale: 0.95 }
                }}
                transition={{ type: "spring", stiffness: 450, damping: 12 }}
              >
                <LogOut size={20} />
              </motion.div>
              <span className="absolute left-16 scale-0 opacity-0 group-hover:scale-100 group-hover:opacity-100 transition-all duration-200 z-50 bg-red-600 text-white text-[9px] font-black uppercase tracking-wider px-2.5 py-1.5 rounded-lg shadow-lg pointer-events-none whitespace-nowrap">
                Logout
              </span>
            </motion.button>
          </div>
        </div>
      )}

      {/* Sidebar Overlay */}
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsSidebarOpen(false)}
            className={cn("inset-0 bg-slate-950/40 backdrop-blur-sm z-[140] lg:hidden", isPreview ? "absolute" : "fixed")}
          />
        )}
      </AnimatePresence>

      {/* Modern Sidebar */}
      <motion.aside
        initial={false}
        animate={{ 
          width: isSidebarOpen ? (window.innerWidth < 640 ? '100%' : '280px') : '0px',
          x: isSidebarOpen ? 0 : -30,
          opacity: isSidebarOpen ? 1 : 0
        }}
        transition={{ type: 'spring', damping: 28, stiffness: 240 }}
        className={cn(
          "top-0 bottom-0 left-0 z-[150] overflow-hidden bg-white/95 dark:bg-slate-950/95 backdrop-blur-md border-r border-slate-200/80 dark:border-slate-800/80 shadow-2xl flex-col hidden lg:flex",
          isPreview ? "absolute" : "fixed",
          !isSidebarOpen && "pointer-events-none"
        )}
      >
        <div className="p-6 border-b border-slate-100 dark:border-slate-800/60 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
             <div className="w-8 h-8 rounded-lg bg-blue-600 dark:bg-blue-500 flex items-center justify-center text-white shadow-md shadow-blue-500/20">
                <LayoutDashboard size={18} />
             </div>
             <div>
                <h3 className="text-sm font-black uppercase tracking-tight text-slate-900 dark:text-white">Main Menu</h3>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none mt-1">Navigation Panel</p>
             </div>
          </div>
          <motion.button 
            onClick={() => setIsSidebarOpen(false)}
            whileHover={{ scale: 1.1, rotate: -90 }}
            whileTap={{ scale: 0.95 }}
            className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-900 text-slate-400 transition-colors cursor-pointer"
          >
            <ChevronLeft size={20} />
          </motion.button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar no-scrollbar">
          {filteredCategories.map((cat) => (
            <div key={cat.id} className="space-y-1">
              <button 
                onClick={() => toggleCat(cat.id)}
                className="w-full flex items-center justify-between px-4 py-2 text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors group cursor-pointer"
              >
                <span className="text-[9px] font-black uppercase tracking-[0.2em]">{cat.label}</span>
                <ChevronDown 
                  size={14} 
                  className={cn(
                    "transition-transform duration-350 ease-out",
                    expandedCats.includes(cat.id) ? "rotate-180" : ""
                  )} 
                />
              </button>
              
              <AnimatePresence initial={false}>
                {expandedCats.includes(cat.id) && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.25, ease: "easeInOut" }}
                    className="overflow-hidden space-y-1 pl-2"
                  >
                    {cat.items.map((item, itemIdx) => {
                      const isItemActive = activeTab === item.id || 
                                           (item.id === 'complaints' && activeTab === 'ops') ||
                                           (item.id === 'settings' && activeTab === 'profile');
                      
                      return (
                        <motion.button 
                          key={item.id}
                          onClick={() => handleSidebarNav(item.id)}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: itemIdx * 0.03, type: "spring", stiffness: 280, damping: 20 }}
                          whileHover={{ x: 4 }}
                          whileTap={{ scale: 0.98 }}
                          className={cn(
                            "w-full flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all font-bold group relative overflow-hidden cursor-pointer",
                            isItemActive
                              ? "bg-blue-600/10 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 font-extrabold"
                              : "text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-900/40 hover:text-slate-800 dark:hover:text-white"
                          )}
                        >
                          <item.icon size={16} className={cn("group-hover:scale-110 transition-transform", isItemActive ? "text-blue-600 dark:text-blue-400" : "text-slate-400 group-hover:text-slate-700 dark:group-hover:text-slate-300")} />
                          <span className="text-[10px] uppercase tracking-widest">{item.label}</span>
                          {isItemActive && (
                            <motion.span 
                              layoutId="activeDot"
                              className="absolute right-3 w-1.5 h-1.5 rounded-full bg-blue-600 dark:bg-blue-400"
                              transition={{ type: "spring", stiffness: 350, damping: 25 }}
                            />
                          )}
                        </motion.button>
                      );
                    })}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}
        </div>

        <div className="p-4 mt-auto space-y-3 shrink-0 border-t border-slate-100 dark:border-slate-850 bg-white/50 dark:bg-slate-950/50 backdrop-blur-sm pb-[calc(1rem+env(safe-area-inset-bottom,0px))]">
          {/* MY PC Sidebar Button */}
          <motion.button
            onClick={() => handleSidebarNav('mypc')}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="w-full flex items-center justify-center gap-2.5 py-3 bg-gradient-to-r from-teal-600 to-emerald-600 hover:opacity-95 text-white rounded-xl text-[10px] font-black uppercase tracking-[0.15em] shadow-lg shadow-teal-500/10 cursor-pointer group shrink-0"
          >
            <Monitor size={15} className="group-hover:rotate-6 transition-transform text-teal-100" />
            <span>MY PC</span>
          </motion.button>

          {/* Billing Side Button */}
          <motion.button
            onClick={() => handleSidebarNav('billing')}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="w-full flex items-center justify-center gap-2.5 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:opacity-95 text-white rounded-xl text-[10px] font-black uppercase tracking-[0.15em] shadow-lg shadow-indigo-500/10 cursor-pointer group shrink-0"
          >
            <CreditCard size={15} className="group-hover:rotate-12 transition-transform text-blue-100" />
            <span>Billing Mod</span>
          </motion.button>

          {/* Clean, fully responsive Sign Out Action bar */}
          <motion.button 
            onClick={() => {
              if (onLogout) onLogout();
              setIsSidebarOpen(false);
            }}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="w-full flex items-center justify-center gap-2.5 py-3 bg-rose-50 hover:bg-rose-100/80 dark:bg-rose-950/15 dark:hover:bg-rose-950/25 border border-rose-100/80 dark:border-rose-900/40 text-rose-600 dark:text-rose-400 rounded-xl text-[10px] font-black uppercase tracking-[0.15em] cursor-pointer group shrink-0 transition-all"
          >
            <LogOut size={15} className="group-hover:-translate-x-0.5 transition-transform" />
            <span>Sign Out</span>
          </motion.button>
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

      {/* Chat Sidebar / AI Help Panel */}
      <AnimatePresence>
        {isChatOpen && user && (
          <AIHelpPanel 
            currentUser={user} 
            onClose={() => {
              setIsChatOpen(false);
            }} 
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
              initial={{ opacity: 0, scale: 0.9, x: 100, y: 100, filter: 'blur(20px)', rotate: -5 }}
              animate={{ opacity: 1, scale: 1, x: 0, y: 0, filter: 'blur(0px)', rotate: 0 }}
              exit={{ 
                opacity: 0, 
                scale: 0.82, 
                x: 300, 
                y: 150, 
                rotate: -10, 
                filter: 'blur(40px)',
                transition: { duration: 0.35, ease: [0.4, 0, 0.2, 1] }
              }}
              transition={{ 
                type: "spring",
                damping: 26,
                stiffness: 220,
                duration: 0.2
              }}
              className="fixed bottom-20 right-4 sm:right-8 w-[calc(100vw-2rem)] sm:w-[380px] max-h-[70vh] bg-white/95 dark:bg-slate-950/95 backdrop-blur-xl rounded-3xl border border-slate-200/60 dark:border-slate-800/80 shadow-[0_20px_60px_rgba(0,0,0,0.18)] dark:shadow-[0_20px_60px_rgba(0,0,0,0.45)] z-[200] overflow-hidden flex flex-col"
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
                      className={`p-3.5 rounded-xl border border-slate-100 dark:border-slate-800/50 bg-slate-50/30 dark:bg-slate-900/20 hover:bg-white dark:hover:bg-slate-900 transition-all duration-300 group cursor-pointer border-l-4 ${
                        notif.type === 'complaint_created' ? 'border-l-emerald-500' :
                        notif.type === 'complaint_updated' ? 'border-l-blue-500' :
                        notif.type === 'complaint_deleted' ? 'border-l-rose-500' :
                        notif.type === 'user_created' ? 'border-l-brand-accent' :
                        notif.type === 'config_updated' ? 'border-l-amber-500' :
                        'border-l-slate-400'
                      } shadow-[0_2px_8px_rgba(0,0,0,0.02)] hover:shadow-[0_8px_20px_rgba(0,0,0,0.06)] dark:hover:shadow-none hover:-translate-y-0.5`}
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

      {/* Relocated Profile dropdown to the header relative toggle container */}

      <header className={cn(
        "z-50 w-full border-b backdrop-blur-md transition-all duration-300 shadow-[0_2px_15px_-3px_rgba(0,0,0,0.05),0_4px_6px_-2px_rgba(0,0,0,0.02)] dark:shadow-[0_4px_20px_-5px_rgba(0,0,0,0.3)]",
        isPreview ? "absolute top-0 pl-[68px]" : "sticky top-0",
        user && !isPreview && "lg:pl-[68px]",
        branding?.sidebarTheme === 'dark' ? "bg-slate-950/95 border-slate-900 text-white" :
        branding?.sidebarTheme === 'accent' ? "bg-brand-accent/95 border-white/10 text-white" :
        branding?.sidebarTheme === 'glass' ? "glass border-white/10" :
        "bg-white/95 dark:bg-slate-950/95 border-slate-200/80 dark:border-slate-900/80"
      )}>
        <div className="max-w-[1850px] w-full mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex items-center gap-2 sm:gap-4"
          >
            {user && (
              <button 
                id="sidebar-toggle-btn"
                onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                className={cn(
                  "p-2 rounded-xl transition-all mr-1 lg:hidden flex items-center justify-center",
                  isColoredHeader ? "hover:bg-white/10 text-white" : "hover:bg-slate-100 dark:hover:bg-slate-900 text-slate-500"
                )}
              >
                {isSidebarOpen ? <X size={20} /> : <Menu size={20} />}
              </button>
            )}
            
            <div className="flex items-center gap-2.5">
              {/* Branded box size and aura matching screenshot */}
              <div className="relative shrink-0 select-none group">
                <div className="absolute -inset-0.5 bg-gradient-to-r from-emerald-500 to-teal-500 rounded-2xl blur-sm opacity-25 group-hover:opacity-40 transition duration-1000 animate-pulse" />
                <div className="relative w-11 h-11 rounded-2xl bg-slate-950 flex items-center justify-center border border-white/10 shadow-lg">
                  <span className="text-white font-black text-lg tracking-tighter italic leading-none">
                    G<span className="text-emerald-500">TS</span>
                  </span>
                </div>
              </div>
              
              <div className="hidden xs:flex sm:flex flex-col justify-center select-none h-11 mt-0">
                <h1 className="text-xs md:text-sm font-black tracking-wider text-emerald-600 dark:text-emerald-400 uppercase leading-none font-sans">
                  {brandingText}
                </h1>
                <div className="flex items-center gap-1.5 mt-1">
                  <span className="text-[7.5px] md:text-[8.5px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest flex items-center gap-1 leading-none">
                    <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse mr-0.5" />
                    POWERED BY GREEN NET
                  </span>
                </div>
              </div>
            </div>
          </motion.div>

          <div className="flex items-center gap-1.5 sm:gap-3">
            {user && onRefresh && (
              <div className="hidden md:flex items-center gap-2 h-9">
                {/* AUTO - OFF dropdown pill matching mockup */}
                <div className="relative h-9 flex items-center">
                  <button
                    onClick={() => setShowRefreshOptions(!showRefreshOptions)}
                    className={cn(
                      "flex items-center gap-1 px-2.5 h-9 rounded-xl border bg-white dark:bg-slate-900 text-[10px] font-extrabold uppercase tracking-wider transition-all focus:outline-none select-none shadow-sm cursor-pointer",
                      showRefreshOptions 
                        ? "border-brand-accent text-brand-accent" 
                        : "border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-700"
                    )}
                  >
                    <span className={cn(
                      "w-1.5 h-1.5 rounded-full mr-1 transition-all duration-300", 
                      intervalTime === 0 
                        ? "bg-slate-300 dark:bg-slate-600" 
                        : "bg-brand-accent animate-pulse shadow-[0_0_8px_rgba(var(--brand-accent),0.5)]"
                    )} />
                    <span>{intervalTime === 0 ? 'AUTO - OFF' : `AUTO - ${intervalTime === 30000 ? '30S' : intervalTime === 60000 ? '1M' : '5M'}`}</span>
                    <ChevronDown size={11} className={cn("text-slate-400 transition-transform ml-1", showRefreshOptions && "rotate-180")} />
                  </button>

                  <AnimatePresence>
                    {showRefreshOptions && (
                      <motion.div
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 8 }}
                        className="absolute top-full left-0 mt-1.5 w-36 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl shadow-[0_10px_25px_-5px_rgba(0,0,0,0.1),0_8px_10px_-6px_rgba(0,0,0,0.1)] dark:shadow-[0_20px_40px_-15px_rgba(0,0,0,0.5)] z-[100] overflow-hidden py-1"
                      >
                        {[
                          { label: 'AUTO - OFF', value: 0 },
                          { label: 'AUTO - 30S', value: 30000 },
                          { label: 'AUTO - 1M', value: 60000 },
                          { label: 'AUTO - 5M', value: 300000 },
                        ].map((opt) => (
                          <button
                            key={opt.value}
                            onClick={() => {
                              setIntervalTime(opt.value);
                              setShowRefreshOptions(false);
                            }}
                            className={cn(
                              "w-full text-left px-4 py-2 text-[9px] font-black uppercase tracking-widest transition-all cursor-pointer",
                              intervalTime === opt.value 
                                ? "text-brand-accent bg-brand-accent/5 dark:bg-brand-accent/10" 
                                : "text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-900/40 hover:text-slate-900 dark:hover:text-white"
                            )}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* REFRESH button pill matching brand-accent theme */}
                <button
                  onClick={() => {
                    if (onRefresh) onRefresh();
                  }}
                  disabled={isLoading}
                  className="flex items-center gap-1.5 px-3.5 h-9 rounded-xl bg-brand-accent hover:opacity-90 active:scale-[0.97] text-white transition-all shadow-md shadow-brand-accent/10 border-none disabled:opacity-40 select-none cursor-pointer"
                >
                  <RefreshCw size={11} className={cn("text-white/90", isLoading && "animate-spin")} />
                  <span className="text-[9px] font-black uppercase tracking-wider font-sans">REFRESH</span>
                </button>

                {/* LASTCHK timer */}
                <div className="flex items-center px-2.5 h-9 bg-slate-50 dark:bg-slate-900 border border-slate-200/50 dark:border-slate-800/50 rounded-xl text-[9px] font-extrabold text-slate-400 dark:text-slate-500 font-mono tracking-tight uppercase shadow-sm select-none">
                  LASTCHK:{lastRefreshedTime}
                </div>
              </div>
            )}

             {user && (
              <div className="flex items-center gap-1.5 h-9">
                {/* Audio voice toggle indicator */}
                <button
                  onClick={onToggleAudio}
                  className={cn(
                    "w-8 h-8 rounded-full border flex items-center justify-center transition-all bg-white dark:bg-slate-900 shadow-sm cursor-pointer hover:scale-105 active:scale-95",
                    isAudioMuted 
                      ? "border-slate-200 dark:border-slate-800 text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800" 
                      : "border-emerald-500/30 text-emerald-600 dark:text-emerald-400 bg-emerald-500/5 hover:bg-emerald-500/10"
                  )}
                  title={isAudioMuted ? "Unmute Alerts" : "Mute Alerts"}
                >
                  {isAudioMuted ? <VolumeX size={14} /> : <Volume2 size={14} />}
                </button>

                {/* Alerts/Bell notification indicator */}
                <button
                  onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
                  className={cn(
                    "w-8 h-8 rounded-full border flex items-center justify-center relative transition-all bg-white dark:bg-slate-900 shadow-sm cursor-pointer hover:scale-105 active:scale-95",
                    alertAuthorized 
                      ? "border-blue-500/30 text-blue-600 dark:text-blue-400 bg-blue-500/5 hover:bg-blue-500/10"
                      : "border-slate-200 dark:border-slate-800 text-amber-500 bg-amber-500/5 hover:bg-amber-500/10"
                  )}
                  title={alertAuthorized ? (isAudioMuted ? "Alert History (Muted)" : "Alert History") : "Alert Restricted"}
                >
                  {isAudioMuted && alertAuthorized ? (
                    <BellOff size={14} />
                  ) : (
                    <Bell size={14} className={!alertAuthorized ? "opacity-60" : ""} />
                  )}
                  {notifications.length > 0 && (
                    <span className="absolute top-1.5 right-1.5 flex h-1.5 w-1.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-red-500"></span>
                    </span>
                  )}
                </button>
              </div>
            )}
            
            {/* Sliding oval toggle theme switch */}
            <div className="flex items-center h-9 select-none" title="Toggle Theme Modes">
              <button
                onClick={handleThemeToggle}
                className={cn(
                  "relative w-12 h-6 rounded-full transition-colors duration-300 outline-none flex items-center shrink-0 border",
                  theme === 'dark' 
                    ? "bg-slate-900 border-slate-800" 
                    : "bg-slate-100 border-slate-300/60"
                )}
              >
                <div
                  className={cn(
                    "absolute w-4 h-4 rounded-full transition-all duration-300 shadow-md",
                    theme === 'dark' 
                      ? "left-[22px] bg-slate-200" 
                      : "left-[4px] bg-slate-800"
                  )}
                />
              </button>
            </div>

            {user && (
              <div className="relative">
                <button 
                  id="profile-toggle-btn"
                  onClick={() => setIsProfileOpen(!isProfileOpen)}
                  className="h-9 flex items-center gap-2.5 px-2.5 bg-slate-50 hover:bg-slate-100 dark:bg-slate-900 dark:hover:bg-slate-800 rounded-xl transition-all border border-slate-200/50 dark:border-slate-800/80 shadow-sm cursor-pointer select-none"
                >
                  <div className="hidden sm:flex flex-col items-end justify-center select-none">
                    <span className="text-[10px] font-black tracking-tight text-slate-800 dark:text-slate-200 leading-none">
                      {user.fullName || user.username || "Muhammad Ahmad"}
                    </span>
                    <span className="text-[7.5px] font-bold text-slate-450 dark:text-slate-500 tracking-wider mt-0.5 uppercase leading-none">
                      {user.role === 'super_admin' ? 'SUPER ADMIN' : 
                       user.role === 'liteadmin' ? 'LITE ADMIN' : 
                       user.role === 'member' ? 'MEMBER' : 
                       user.role === 'dealer' ? 'MAIN DEALER' : 
                       user.role ? user.role.replace('_', ' ').toUpperCase() : 'USER'}
                    </span>
                  </div>
                  {/* avatar photo matching profile image */}
                  <div className="w-6.5 h-6.5 rounded-lg overflow-hidden shrink-0 bg-slate-200 dark:bg-slate-800 border border-slate-200/55 dark:border-slate-750 flex items-center justify-center">
                    {user.profilePicture ? (
                      <img 
                        src={user.profilePicture} 
                        alt="User Profile" 
                        className="w-full h-full object-cover" 
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <User size={12} className="text-slate-400 dark:text-slate-500" />
                    )}
                  </div>
                </button>

                <AnimatePresence>
                  {isProfileOpen && user && (
                    <>
                      <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => setIsProfileOpen(false)}
                        className="fixed inset-0 bg-slate-950/10 backdrop-blur-[1px] z-[150]"
                      />
                      <motion.div
                        id="profile-panel"
                        initial={{ opacity: 0, height: 0, scaleY: 0.8, y: -10, originY: 0 }}
                        animate={{ opacity: 1, height: "auto", scaleY: 1, y: 0, originY: 0 }}
                        exit={{ opacity: 0, height: 0, scaleY: 0.8, y: -10, originY: 0 }}
                        transition={{ type: "spring", damping: 26, stiffness: 320 }}
                        className="absolute right-0 top-full mt-2 w-[calc(100vw-2rem)] sm:w-[340px] bg-white dark:bg-slate-950 rounded-3xl border border-slate-200/70 dark:border-slate-800/80 shadow-[0_20px_50px_rgba(0,0,0,0.12)] dark:shadow-[0_25px_60px_rgba(0,0,0,0.45)] z-[200] overflow-hidden origin-top text-slate-800 dark:text-slate-100 animate-slideDown"
                      >
                        {/* Upper Gradient Accent */}
                        <div className="absolute top-0 left-0 right-0 h-[3.5px] bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-600" />
                        
                        {/* Improved Header */}
                        <div className="p-5 pb-4 bg-slate-50/50 dark:bg-slate-900/40 border-b border-slate-100 dark:border-slate-800/50 relative">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2.5">
                              <div className="w-9 h-9 rounded-xl bg-emerald-500/10 dark:bg-emerald-400/10 flex items-center justify-center text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                                <Shield size={18} className="animate-pulse" />
                              </div>
                              <div>
                                <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-100">IDENTITY PROFILE</h3>
                                <p className="text-[8px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">Access Key Registry Status</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 dark:bg-emerald-500/15 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                              <span className="text-[7.5px] font-mono font-bold uppercase tracking-wider">SECURE</span>
                            </div>
                          </div>
                        </div>

                        {/* Interactive Photo Uploader Section */}
                        <div className="p-5 pb-4 flex flex-col items-center gap-1.5 border-b border-slate-100 dark:border-slate-800/30">
                          <div className="relative group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                            {/* Colorful glow behind on hover */}
                            <div className="absolute -inset-1 rounded-full bg-gradient-to-r from-emerald-500 via-teal-400 to-indigo-500 blur opacity-20 group-hover:opacity-55 transition-opacity duration-500 animate-pulse" />
                            
                            <div className="relative w-20 h-20 rounded-full border-2 border-white dark:border-slate-950 bg-slate-55 dark:bg-slate-900 overflow-hidden shadow-md flex items-center justify-center transition-transform duration-500 group-hover:scale-105">
                              {editProfilePicture ? (
                                <img 
                                  src={editProfilePicture} 
                                  alt="Profile Preview" 
                                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" 
                                  referrerPolicy="no-referrer"
                                />
                              ) : (
                                <div className="flex flex-col items-center justify-center text-slate-400 group-hover:text-emerald-500 dark:group-hover:text-emerald-400 transition-colors">
                                  <User size={26} className="opacity-70" />
                                </div>
                              )}
                              
                              {/* Overlay for uploading */}
                              <div className="absolute inset-0 bg-slate-950/70 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center transition-all duration-300 text-white gap-0.5">
                                <Camera size={14} className="text-emerald-400 animate-bounce" />
                                <span className="text-[7.5px] font-black uppercase tracking-widest">UPLOAD</span>
                              </div>
                            </div>

                            {/* Pen avatar corner badge */}
                            <div className="absolute bottom-0 right-0 w-6 h-6 rounded-full bg-slate-950 dark:bg-emerald-500 text-white dark:text-slate-950 flex items-center justify-center shadow-md border border-white dark:border-slate-950 group-hover:bg-emerald-500 dark:group-hover:bg-emerald-400 transition-colors">
                              <PenLine size={10} />
                            </div>
                          </div>

                          <div className="flex items-center gap-2 mt-1">
                            <button
                              type="button"
                              onClick={() => fileInputRef.current?.click()}
                              className="px-2 py-0.5 bg-slate-55 hover:bg-slate-100 dark:bg-slate-900 dark:hover:bg-slate-800 border border-slate-200/50 dark:border-slate-800 rounded text-[8px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 transition-all active:scale-95 cursor-pointer"
                            >
                              CHOOSE_FILE
                            </button>
                            {editProfilePicture && (
                              <button
                                type="button"
                                onClick={() => setEditProfilePicture('')}
                                className="px-2 py-0.5 bg-rose-500/10 hover:bg-rose-500/15 text-rose-500 rounded text-[8px] font-black uppercase tracking-widest transition-all active:scale-95 cursor-pointer"
                              >
                                CLEAR_IMG
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Form Body with Prefix Icons and custom styling */}
                        <form onSubmit={handleUpdateProfile} className="p-5 space-y-4">
                          {/* Full Name input */}
                          <div className="space-y-1.5">
                            <label className="text-[8.5px] font-black uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500 ml-1 block leading-none">Full Display Name</label>
                            <div className="relative group">
                              <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-emerald-500 transition-colors pointer-events-none">
                                <User size={13.5} />
                              </div>
                              <input
                                type="text"
                                value={editFullName}
                                onChange={(e) => setEditFullName(e.target.value)}
                                placeholder="Enter Full Name"
                                className="w-full bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800/80 rounded-xl pl-10 pr-4 py-2.5 text-xs font-bold focus:bg-white dark:focus:bg-slate-900 focus:border-emerald-500/60 focus:ring-2 focus:ring-emerald-500/10 outline-none transition-all text-slate-850 dark:text-slate-100"
                              />
                            </div>
                          </div>

                          {/* Access ID / Username input */}
                          <div className="space-y-1.5">
                            <label className="text-[8.5px] font-black uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500 ml-1 block leading-none">Access ID (Username)</label>
                            <div className="relative group">
                              <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-emerald-500 transition-colors pointer-events-none">
                                <Key size={13.5} />
                              </div>
                              <input
                                type="text"
                                value={editUsername}
                                onChange={(e) => setEditUsername(e.target.value)}
                                placeholder="Username"
                                className="w-full bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800/80 rounded-xl pl-10 pr-4 py-2.5 text-xs font-bold focus:bg-white dark:focus:bg-slate-900 focus:border-emerald-500/60 focus:ring-2 focus:ring-emerald-500/10 outline-none transition-all text-slate-850 dark:text-slate-100"
                              />
                            </div>
                          </div>

                          {/* Password input */}
                          <div className="space-y-1.5">
                            <label className="text-[8.5px] font-black uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500 ml-1 block leading-none">Secure Passcode (Password)</label>
                            <div className="relative group">
                              <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-emerald-500 transition-colors pointer-events-none">
                                <Lock size={13.5} />
                              </div>
                              <input
                                type="password"
                                value={editPassword}
                                onChange={(e) => setEditPassword(e.target.value)}
                                placeholder="••••••••"
                                className="w-full bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800/80 rounded-xl pl-10 pr-4 py-2.5 text-xs font-bold focus:bg-white dark:focus:bg-slate-900 focus:border-emerald-500/60 focus:ring-2 focus:ring-emerald-500/10 outline-none transition-all text-slate-850 dark:text-slate-100"
                              />
                            </div>
                          </div>

                          {/* Email input */}
                          <div className="space-y-1.5">
                            <label className="text-[8.5px] font-black uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500 ml-1 block leading-none">Recovery Mailbox (OTP Reset Link)</label>
                            <div className="relative group">
                              <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-emerald-500 transition-colors pointer-events-none">
                                <Mail size={13.5} />
                              </div>
                              <input
                                type="email"
                                value={editEmail}
                                onChange={(e) => setEditEmail(e.target.value)}
                                placeholder="example@mail.com"
                                className="w-full bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800/80 rounded-xl pl-10 pr-4 py-2.5 text-xs font-bold focus:bg-white dark:focus:bg-slate-900 focus:border-emerald-500/60 focus:ring-2 focus:ring-emerald-500/10 outline-none transition-all text-slate-850 dark:text-slate-100"
                              />
                            </div>
                          </div>

                          {/* Secure Submit Trigger */}
                          <div className="pt-2">
                            <button
                              type="submit"
                              disabled={isUpdatingProfile}
                              className="w-full py-3 bg-slate-900 hover:bg-slate-800 dark:bg-emerald-500 dark:hover:bg-emerald-400 dark:text-slate-950 text-white font-black uppercase tracking-widest text-[9.5px] rounded-xl transition-all shadow-md dark:shadow-emerald-500/10 disabled:opacity-50 hover:shadow-lg flex items-center justify-center gap-1.5 cursor-pointer border-none"
                            >
                              {isUpdatingProfile ? (
                                <>
                                  <RefreshCw size={12} className="animate-spin text-white dark:text-slate-950" />
                                  <span>Syncing...</span>
                                </>
                              ) : (
                                <>
                                  <Sparkles size={11.5} className="opacity-85 text-white dark:text-slate-950" />
                                  <span>Commit Updates</span>
                                </>
                              )}
                            </button>
                          </div>
                        </form>

                        {/* Dashboard Footer with Roles & Termination Option */}
                        <div className="p-4 bg-slate-50 dark:bg-slate-900/30 border-t border-slate-100 dark:border-slate-850 flex items-center justify-between">
                          <div className="flex flex-col gap-0.5">
                            <span className="text-[7px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">Security Access</span>
                            <span className="text-[9px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest leading-none">
                              {user.role === 'super_admin' ? 'Level 5 (Super Admin)' :
                               user.role === 'liteadmin' ? 'Level 4 (Lite Admin)' :
                               user.role === 'member' ? 'Level 2 (Member)' :
                               user.role === 'dealer' ? 'Level 3 (Main Dealer)' : 'Level 1 (User)'}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setIsProfileOpen(false);
                              if (onLogout) onLogout();
                            }}
                            className="px-3 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500 hover:text-white text-rose-500 text-[8.5px] font-black uppercase tracking-widest transition-all cursor-pointer active:scale-95"
                          >
                            Terminate Session
                          </button>
                        </div>
                      </motion.div>
                    </>
                  )}
                </AnimatePresence>
              </div>
            )}

            {/* Glowing Live Relay Badge */}
            <div className={cn(
              "hidden lg:flex items-center gap-1.5 px-3 h-9 rounded-xl border transition-all select-none shadow-sm",
              isOnline 
                ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" 
                : "border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-500"
            )}>
              <div className={cn(
                "w-1.5 h-1.5 rounded-full animate-pulse",
                isOnline ? "bg-emerald-500" : "bg-amber-500"
              )} />
              <span className="text-[9px] uppercase font-black tracking-widest leading-none">
                {isOnline ? 'Live Relay' : 'Offline Access'}
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className={cn(
        "mx-auto py-4 sm:py-8 transition-all duration-500",
        user ? (
          isPreview 
            ? "w-full px-4 pt-20 pl-[80px]" 
            : "max-w-[1850px] w-full px-4 sm:px-6 lg:px-8 lg:pl-[84px]"
        ) : "w-full max-w-none px-0 sm:px-0"
      )}>
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.15 }}
        >
          {children}
        </motion.div>
      </main>

      {/* Footer */}
      <footer className={cn(
        "py-6 sm:py-12 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950",
        user && (isPreview ? "pl-[80px]" : "lg:pl-[68px]")
      )}>
        <div className="max-w-[1850px] w-full mx-auto px-4 sm:px-6 lg:px-8">
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

      {/* Funny Walking Mascot Removed */}

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

      {/* Global Inline Editor Trigger for Super Admins */}
      <InlineTextEditor 
        isActive={isInlineEditingActive} 
        onToggle={() => setIsInlineEditingActive(!isInlineEditingActive)} 
        branding={branding} 
        userFullName={user?.fullName || user?.username || 'Super Admin'} 
        onUpdateBranding={onUpdateBranding}
      />

      {/* Theme Transition 0% - 100% Loader Overlay */}
      <AnimatePresence>
        {isThemeTransitioning && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22 }}
            className={cn(
              "fixed inset-0 z-[999999] flex flex-col items-center justify-center font-sans select-none overflow-hidden",
              targetTheme === 'dark' 
                ? "bg-slate-950 text-white" 
                : "bg-slate-50 text-slate-950"
            )}
          >
            {/* Ambient visual background glow halos */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-30">
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[550px] h-[550px] bg-blue-500/10 rounded-full blur-[130px] animate-pulse" />
              {targetTheme === 'dark' ? (
                <div className="absolute top-1/4 right-1/4 w-96 h-96 bg-indigo-500/5 rounded-full blur-[100px]" />
              ) : (
                <div className="absolute bottom-1/4 left-1/4 w-96 h-96 bg-amber-500/5 rounded-full blur-[100px]" />
              )}
            </div>

            <div className="relative text-center max-w-sm w-full px-8 flex flex-col items-center gap-6">
              {/* Rotating themed shape container */}
              <div 
                className={cn(
                  "w-16 h-16 rounded-3xl flex items-center justify-center shadow-lg relative border",
                  targetTheme === 'dark'
                    ? "bg-slate-900 border-slate-800 text-yellow-400"
                    : "bg-white border-slate-200 text-indigo-600"
                )}
              >
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ repeat: Infinity, duration: 4, ease: "linear" }}
                  className="absolute inset-[3px] border-2 border-dashed rounded-2xl opacity-40 animate-[spin_8s_linear_infinite]"
                  style={{
                    borderColor: targetTheme === 'dark' ? '#f59e0b' : '#6366f1'
                  }}
                />
                
                {targetTheme === 'dark' ? (
                  <Moon size={28} className="animate-pulse" />
                ) : (
                  <Sun size={28} className="animate-pulse" />
                )}
              </div>

              {/* Text Block */}
              <div className="space-y-1">
                <h4 className="text-[10px] font-black tracking-[0.25em] uppercase text-blue-500">
                  SYSTEM CORE SHIFT
                </h4>
                <h2 className="text-sm font-black uppercase tracking-widest">
                  {targetTheme === 'dark' ? "Transitioning to Dark Mode" : "Transitioning to Light Mode"}
                </h2>
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider leading-relaxed">
                  Optimizing viewport variables & styling constants
                </p>
              </div>

              {/* Glowing progress line bar */}
              <div className="w-full space-y-2">
                <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-wider text-slate-400">
                  <span className="flex items-center gap-1.5 font-sans font-extrabold text-blue-500">
                    <span className="w-1 h-1 rounded-full bg-blue-500 animate-ping" />
                    RECONSTRUCTING UI
                  </span>
                  <span className="font-mono text-blue-500">{themeTransitionProgress}%</span>
                </div>
                
                <div className="w-full h-1 bg-slate-200/50 dark:bg-slate-800/80 rounded-full overflow-hidden shadow-inner">
                  <div 
                    className={cn(
                      "h-full rounded-full transition-all duration-75",
                      targetTheme === 'dark' 
                        ? "bg-gradient-to-r from-yellow-500 via-amber-500 to-emerald-500"
                        : "bg-gradient-to-r from-indigo-500 via-blue-500 to-emerald-500"
                    )}
                    style={{ width: `${themeTransitionProgress}%` }}
                  />
                </div>
              </div>

              <div className="text-[8px] font-bold tracking-widest uppercase text-slate-400 animate-pulse font-mono">
                {themeTransitionProgress < 30 ? "⚡ REPLICATING DOM ROOT CLASSES..." :
                 themeTransitionProgress < 65 ? "💾 COMPUTING TAILWIND COLORS..." :
                 themeTransitionProgress < 90 ? "🚀 APPORTIONING MEMORY BLOCKS..." :
                 "✨ OPTIMIZATION COMPLETED!"}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}

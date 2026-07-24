import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Sun, Moon, LogOut, User, MessageSquare, ChevronRight, Bell, BellOff, Volume2, VolumeX, Settings, ShieldAlert, AlertTriangle, Mic, WifiOff, Wifi, History, Trash2, Clock, CheckCircle2, X, Menu, ChevronLeft, LayoutDashboard, ClipboardList, TrendingUp, Users, Shield, CloudUpload, Palette, Map as MapIcon, HelpCircle, PlusSquare, Contact, Flame, BarChart3, ChevronDown, Activity, CreditCard, PenLine, Home, RefreshCw, Sparkles, Lock, Mail, Camera, Key, Monitor, FileSpreadsheet, FolderOpen, Check, Printer, HardDriveDownload } from 'lucide-react';
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
import { pocketbaseService } from '../lib/pocketbaseService';
import { getAvatarUrl } from '../utils/avatar';
import { toast } from 'sonner';
import ComplaintForm from './ComplaintForm';

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
  appConfig?: any;
  onRegisterComplaint?: (data: any) => Promise<void>;
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
  isPreview = false,
  appConfig,
  onRegisterComplaint
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
  const [isComplaintSwipeDownOpen, setIsComplaintSwipeDownOpen] = useState(false);

  // Special states for integrated billing header
  const [billingMonths, setBillingMonths] = useState<any[]>([]);
  const [currentMonthId, setCurrentMonthId] = useState<string>('');
  const [isBillingUnlocked, setIsBillingUnlocked] = useState<boolean>(false);
  const [isMonthDropdownOpen, setIsMonthDropdownOpen] = useState<boolean>(false);
  const [hasActiveRows, setHasActiveRows] = useState<boolean>(false);
  
  const [localActiveTab, setLocalActiveTab] = useState<string>('complaints');
  const [menuUnlocked, setMenuUnlocked] = useState(false);
  const recentClicks = React.useRef<number[]>([]);

  const handleLogoClick = () => {
    if (window.innerWidth < 1024) return; // Only apply logic to big screens
    const now = Date.now();
    recentClicks.current = recentClicks.current.filter(t => now - t < 2000);
    recentClicks.current.push(now);
    if (recentClicks.current.length >= 3) {
      setMenuUnlocked(prev => {
        const next = !prev;
        setIsSidebarOpen(next); // Auto open/close on state change
        return next;
      });
      recentClicks.current = [];
    }
  };
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

  // Listen to billing state updates broadcast from AdminPanel
  useEffect(() => {
    const handleBillingStateChanged = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail) {
        const { billingMonths: bm, currentMonthId: cm, isBillingUnlocked: bu, hasActiveRows: har } = customEvent.detail;
        if (bm !== undefined) setBillingMonths(bm);
        if (cm !== undefined) setCurrentMonthId(cm);
        if (bu !== undefined) setIsBillingUnlocked(bu);
        if (har !== undefined) setHasActiveRows(har);
      }
    };
    window.addEventListener('gts-billing-state-changed', handleBillingStateChanged);
    return () => {
      window.removeEventListener('gts-billing-state-changed', handleBillingStateChanged);
    };
  }, []);

  // Listen to running frame changes broadcast from AdminPanel (MY PC opened files like WhatsApp Connect)
  const [runningFrame, setRunningFrame] = useState<{ appFile: string; frameTitle: string } | null>(null);

  useEffect(() => {
    const handleRunningFrameChanged = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail) {
        setRunningFrame(customEvent.detail);
      } else {
        setRunningFrame(null);
      }
    };
    window.addEventListener('gts-running-frame-changed', handleRunningFrameChanged);
    return () => {
      window.removeEventListener('gts-running-frame-changed', handleRunningFrameChanged);
    };
  }, []);

  useEffect(() => {
    if (activeTab !== 'mypc' && runningFrame) {
      setRunningFrame(null);
    }
  }, [activeTab]);

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
  const [editGender, setEditGender] = useState<'male'|'female'|'not_set'>(
    user?.profilePicture?.includes(':::gender:female') || user?.profilePicture === 'default:female' 
      ? 'female' 
      : user?.profilePicture?.includes(':::gender:male') || user?.profilePicture === 'default:male'
      ? 'male'
      : 'not_set'
  );
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (user) {
      setEditFullName(user.fullName || '');
      setEditUsername(user.username || '');
      setEditPassword(user.password || '');
      setEditProfilePicture(user.profilePicture || '');
      setEditEmail(user.email || '');
      let initialGender: 'male'|'female'|'not_set' = 'not_set';
      if (user.profilePicture) {
        if (user.profilePicture.includes(':::gender:female') || user.profilePicture === 'default:female') {
          initialGender = 'female';
        } else if (user.profilePicture.includes(':::gender:male') || user.profilePicture === 'default:male') {
          initialGender = 'male';
        }
      }
      setEditGender(initialGender);
    }
  }, [user]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 250;
          const MAX_HEIGHT = 250;
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > MAX_WIDTH) {
              height *= MAX_WIDTH / width;
              width = MAX_WIDTH;
            }
          } else {
            if (height > MAX_HEIGHT) {
              width *= MAX_HEIGHT / height;
              height = MAX_HEIGHT;
            }
          }
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);
          
          // Compress to WebP or JPEG with lower quality
          const dataUrl = canvas.toDataURL('image/jpeg', 0.6);
          setEditProfilePicture(editGender !== 'not_set' ? `${dataUrl}:::gender:${editGender}` : dataUrl);
        };
        img.src = reader.result as string;
      };
      reader.readAsDataURL(file);
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !onUpdateUser) return;
    
    console.log("Updating profile with gender:", editGender, "and picture:", editProfilePicture);
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
      toast.success("Profile & picture updated successfully!");
      setIsProfileOpen(false);
    } catch (error) {
      console.error("Profile update failed:", error);
      toast.error("Failed to update profile.");
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
      await pocketbaseService.clearAllNotifications();
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
        { id: 'recycle_bin', label: 'Recycle Bin', icon: Trash2, roles: ['super_admin', 'admin', 'dealer', 'editor'] },
        { id: 'integrations', label: 'Google Sheet Link', icon: CloudUpload, roles: ['super_admin', 'admin', 'dealer', 'editor'] },
        { id: 'chat', label: 'AI Help', icon: Sparkles },
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
          "group/rail left-0 bottom-0 w-[68px] hover:w-[240px] transition-all duration-500 ease-[cubic-bezier(0.25,1,0.5,1)] bg-white dark:bg-slate-950 border-r border-slate-200/60 dark:border-slate-800/60 flex-col items-stretch pb-5 select-none overflow-hidden",
          isSidebarOpen ? "flex z-[160] top-0" : "hidden lg:flex z-[51] top-0",
          isPreview ? "absolute h-full" : "fixed shadow-[1px_0_15px_rgba(0,0,0,0.02)]"
        )}>
          {/* Menu Trigger Button Container (Hidden on Desktop, replaced by Header Logo) */}
          <div className="w-full h-16 flex items-center justify-start shrink-0 border-b border-slate-100/50 dark:border-slate-900/40 relative overflow-hidden">
            <div className="w-[68px] flex justify-center shrink-0">
              <div className="relative shrink-0 select-none group cursor-pointer transition-all duration-500 ease-[cubic-bezier(0.25,1,0.5,1)]" onClick={handleLogoClick}>
                <div className="absolute -inset-0.5 bg-gradient-to-r from-emerald-500 to-teal-500 rounded-2xl blur-sm opacity-25 group-hover:opacity-40 transition duration-1000 animate-pulse" />
                <div className="relative w-10 h-10 rounded-2xl bg-slate-950 flex items-center justify-center border border-white/10 shadow-lg">
                  <span className="text-white font-black text-sm tracking-tighter italic leading-none">
                    G<span className="text-emerald-500">TS</span>
                  </span>
                </div>
              </div>
            </div>
            
            <div className="opacity-0 group-hover/rail:opacity-100 transition-all duration-500 ease-[cubic-bezier(0.25,1,0.5,1)] flex flex-col justify-center select-none whitespace-nowrap">
              <h1 className="text-xs font-black tracking-wider text-emerald-600 dark:text-emerald-400 uppercase leading-none font-sans">
                {brandingText}
              </h1>
              <div className="flex items-center gap-1 mt-1">
                <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse relative -top-[0.5px]" />
                <span className="text-[7.5px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest leading-none">
                  POWERED BY GREEN NET
                </span>
              </div>
            </div>
          </div>

          {/* Dynamic Icon groups */}
          <div className="flex-1 w-full px-3 flex flex-col gap-5 items-start pt-6 overflow-y-auto overflow-x-hidden no-scrollbar">
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
                { id: 'recycle_bin', label: 'Recycle Bin', icon: Trash2, roles: ['super_admin', 'admin', 'dealer', 'editor'] },
                { id: 'integrations', label: 'Google Sheet Link', icon: CloudUpload, roles: ['super_admin', 'admin', 'dealer', 'editor'] },
                { id: 'chat', label: 'AI Help', icon: Sparkles }
              ];

              const permitted = items.filter(item => {
                if (!user) return false;
                if (user.role === 'member') {
                  return ['complaints', 'submit', 'nodes', 'clients', 'settings', 'monitor', 'map', 'chat'].includes(item.id);
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
                      "h-11 w-full rounded-2xl flex items-center justify-start relative cursor-pointer border transition-all duration-500 ease-[cubic-bezier(0.25,1,0.5,1)] group",
                      isItemActive
                        ? "bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border-blue-100 dark:border-blue-900/30 shadow-[0_4px_12px_rgba(59,130,246,0.12)]"
                        : "border-transparent text-slate-400 dark:text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-900/50 hover:text-slate-800 dark:hover:text-white"
                    )}
                  >
                    <div className="w-11 h-11 flex items-center justify-center shrink-0">
                      <motion.div
                      variants={{
                        rest: { scale: 1, rotate: 0, y: 0 },
                        hover: { scale: 1.15, rotate: 8, y: -1 }
                      }}
                      transition={{ type: "spring", stiffness: 400, damping: 15 }}
                    >
                      <item.icon size={20} />
                    </motion.div>
                    </div>
                    <span className="opacity-0 group-hover/rail:opacity-100 transition-all duration-500 ease-[cubic-bezier(0.25,1,0.5,1)] text-[10px] font-black uppercase tracking-widest whitespace-nowrap ml-3">{item.label}</span>
                    
                    {isItemActive && (
                      <motion.div
                        layoutId="activeSideLine"
                        className="absolute left-0 top-3 bottom-3 w-1 bg-blue-600 dark:bg-blue-400 rounded-r-full"
                        transition={{ type: "spring", stiffness: 350, damping: 25 }}
                      />
                    )}
                    
                    {/* Tooltip */}
                    <span className="absolute left-16 scale-0 opacity-0 group-hover:scale-100 group-hover:opacity-100 group-hover/rail:hidden transition-all duration-200 z-[100] bg-slate-900 dark:bg-slate-800 text-white text-[9px] font-black uppercase tracking-wider px-2.5 py-1.5 rounded-lg shadow-lg pointer-events-none whitespace-nowrap">
                      {item.label}
                    </span>
                  </motion.button>
                );
              });
            })()}
          </div>

          {/* Bottom Help Question Icon & Logout */}
          <div className="mt-auto px-3 w-full flex flex-col items-start gap-3">
            {/* Show bottom Sparkles help icon only if 'chat' is hidden from the main custom list to avoid duplication */}
            {(branding?.hiddenTabs || []).includes('chat') && (
              <motion.button
                onClick={() => setIsChatOpen(true)}
                whileHover="hover"
                whileTap="tap"
                className="h-11 w-full rounded-2xl flex items-center justify-start relative cursor-pointer text-blue-500 dark:text-blue-400 hover:bg-slate-100 dark:hover:bg-slate-900 transition-all duration-500 ease-[cubic-bezier(0.25,1,0.5,1)] group"
                title="Launch AI Help Portal"
              >
                <div className="w-11 h-11 flex items-center justify-center shrink-0">
                      <motion.div
                      variants={{
                    hover: { scale: 1.15, rotate: 12 },
                    tap: { scale: 0.95 }
                  }}
                  transition={{ type: "spring", stiffness: 450, damping: 12 }}
                >
                  <Sparkles size={20} className="animate-pulse" />
                </motion.div>
                </div>
                <span className="opacity-0 group-hover/rail:opacity-100 transition-all duration-500 ease-[cubic-bezier(0.25,1,0.5,1)] text-[10px] font-black uppercase tracking-widest whitespace-nowrap ml-3">AI Help</span>
              </motion.button>
            )}

            <motion.button
              onClick={() => {
                if (onLogout) onLogout();
              }}
              whileHover="hover"
              whileTap="tap"
              className="h-11 w-full rounded-2xl flex items-center justify-start relative cursor-pointer text-slate-400 dark:text-slate-500 hover:bg-red-500/10 hover:text-red-600 dark:hover:bg-red-500/20 dark:hover:text-red-400 transition-all duration-500 ease-[cubic-bezier(0.25,1,0.5,1)] group"
              title="Sign Out"
            >
              <div className="w-11 h-11 flex items-center justify-center shrink-0">
                      <motion.div
                      variants={{
                  hover: { scale: 1.15, x: 2 },
                  tap: { scale: 0.95 }
                }}
                transition={{ type: "spring", stiffness: 450, damping: 12 }}
              >
                <LogOut size={20} />
              </motion.div>
              </div>
              <span className="opacity-0 group-hover/rail:opacity-100 transition-all duration-500 ease-[cubic-bezier(0.25,1,0.5,1)] text-[10px] font-black uppercase tracking-widest whitespace-nowrap ml-3">Logout</span>
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
            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-slate-100 dark:bg-slate-900/50 hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer border border-slate-200/50 dark:border-slate-700/50"
          >
            <Settings size={14} className="text-slate-400" />
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
                          {(() => {
                            // Find the user by ID if available, otherwise by name
                            const authorUser = users.find(u => u.username === selectedNotif.authorName || u.fullName === selectedNotif.authorName);
                            if (authorUser && authorUser.profilePicture) {
                              return (
                                <img 
                                  src={getAvatarUrl(authorUser.profilePicture)} 
                                  alt={selectedNotif.authorName} 
                                  className="h-4 w-4 rounded-full object-cover shrink-0"
                                />
                              );
                            }
                            return (
                              <img 
                                src={getAvatarUrl('default:male')} 
                                alt={selectedNotif.authorName}
                                className="h-4 w-4 rounded-full object-cover shrink-0 opacity-80"
                              />
                            );
                          })()}
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
                              {(() => {
                                const authorUser = users.find(u => u.username === notif.authorName || u.fullName === notif.authorName);
                                if (authorUser && authorUser.profilePicture) {
                                  return (
                                    <img 
                                      src={getAvatarUrl(authorUser.profilePicture)} 
                                      alt={notif.authorName} 
                                      className="w-4 h-4 rounded-full object-cover shrink-0 border border-slate-200 dark:border-slate-700"
                                    />
                                  );
                                }
                                return (
                                  <img 
                                    src={getAvatarUrl('default:male')} 
                                    alt={notif.authorName}
                                    className="w-4 h-4 rounded-full object-cover shrink-0 border border-slate-200 dark:border-slate-700 opacity-80"
                                  />
                                );
                              })()}
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

      {user && (
      <header className={cn(
        "z-50 w-full border-b backdrop-blur-md transition-all duration-300 shadow-[0_2px_15px_-3px_rgba(0,0,0,0.05),0_4px_6px_-2px_rgba(0,0,0,0.02)] dark:shadow-[0_4px_20px_-5px_rgba(0,0,0,0.3)]",
        isPreview ? "absolute top-0" : "sticky top-0",
        user && !isPreview && "lg:pl-[68px]",
        branding?.sidebarTheme === 'dark' ? "bg-slate-950/95 border-slate-900 text-white" :
        branding?.sidebarTheme === 'accent' ? "bg-brand-accent/95 border-white/10 text-white" :
        branding?.sidebarTheme === 'glass' ? "glass border-white/10" :
        "bg-white/95 dark:bg-slate-950/95 border-slate-200/80 dark:border-slate-900/80"
      )}>
        <div className={cn(
          "max-w-[1850px] w-full mx-auto px-4 sm:px-6 lg:pr-8 lg:pl-6 flex items-center justify-between transition-all duration-300",
          runningFrame ? "h-16" : activeTab === 'billing' ? "h-auto min-h-16 py-3.5 md:py-0 md:h-16 flex-wrap md:flex-nowrap gap-3" : "h-16"
        )}>
          {runningFrame ? (
            <div className="flex items-center justify-between w-full gap-3 py-1">
              {/* Left Side: Sidebar trigger + Close App Button + Frame Title */}
              <div className="flex items-center gap-2 sm:gap-4 min-w-0">
                {user && (
                  <motion.button 
                    id="sidebar-toggle-btn"
                    onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                    className={cn(
                      "rounded-xl transition-all mr-1 flex items-center justify-center overflow-hidden -ml-2 sm:ml-0 lg:hidden shrink-0",
                      isColoredHeader ? "hover:bg-white/10 text-white" : "hover:bg-slate-100 dark:hover:bg-slate-900 text-slate-500"
                    )}
                  >
                    <div className="flex items-center justify-center p-2">
                      {isSidebarOpen ? <X size={20} /> : <Menu size={20} />}
                    </div>
                  </motion.button>
                )}

                <motion.button
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => window.dispatchEvent(new CustomEvent('gts-close-mypc-file'))}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-100 border border-slate-200/80 dark:border-slate-800 text-[10px] font-black uppercase tracking-wider cursor-pointer shadow-sm shrink-0 transition-all"
                >
                  <ChevronLeft size={14} className="text-slate-500 shrink-0" />
                  <span>◀ Close Application</span>
                </motion.button>

                <div className="flex items-center gap-2 min-w-0 overflow-hidden">
                  <span className="relative flex h-2.5 w-2.5 shrink-0">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-blue-500" />
                  </span>
                  <div className="flex flex-col min-w-0">
                    <span className="text-[8px] font-extrabold uppercase tracking-widest text-blue-600 dark:text-blue-400 leading-none mb-0.5">
                      Running Frame
                    </span>
                    <h3 className="text-xs sm:text-sm font-black uppercase tracking-tight text-slate-900 dark:text-slate-100 truncate leading-none">
                      {runningFrame.frameTitle}
                    </h3>
                  </div>
                </div>
              </div>

              {/* Right Side: Quick Action Icons */}
              <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
                {user && (
                  <div className="flex items-center gap-2 h-9">
                    <button
                      onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
                      className={cn(
                        "w-9 h-9 rounded-full border flex items-center justify-center relative transition-all bg-white dark:bg-slate-900 shadow-sm cursor-pointer hover:scale-105 active:scale-95",
                        alertAuthorized 
                          ? "border-blue-500/30 text-blue-600 dark:text-blue-400 bg-blue-500/5 hover:bg-blue-500/10"
                          : "border-slate-200 dark:border-slate-800 text-amber-500 bg-amber-500/5 hover:bg-amber-500/10"
                      )}
                      title={alertAuthorized ? (isAudioMuted ? "Alert History (Muted)" : "Alert History") : "Alert Restricted"}
                    >
                      {isAudioMuted && alertAuthorized ? (
                        <BellOff size={15} />
                      ) : (
                        <Bell size={15} className={!alertAuthorized ? "opacity-60" : ""} />
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

                {/* Theme Switcher Button */}
                <button
                  onClick={handleThemeToggle}
                  className="w-9 h-9 rounded-full border border-slate-200/80 dark:border-slate-800 flex items-center justify-center bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:scale-105 active:scale-95 transition-all shadow-sm cursor-pointer"
                  title="Toggle Light/Dark Theme"
                >
                  {theme === 'dark' ? <Sun size={15} className="text-amber-400" /> : <Moon size={15} className="text-slate-600" />}
                </button>
              </div>
            </div>
          ) : activeTab === 'billing' ? (
            <div className="flex flex-col md:flex-row md:items-center justify-between w-full gap-3 md:gap-4">
              {/* Left Side: Title & Monthly Sheets button */}
              <div className="flex items-center gap-2 sm:gap-4 ml-0 justify-between md:justify-start w-full md:w-auto">
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setActiveTab('complaints')}
                    className="flex md:hidden items-center justify-center gap-1 px-2 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800 text-slate-750 dark:text-slate-300 border border-slate-200/50 dark:border-slate-800/50 text-[9px] font-black uppercase tracking-wider cursor-pointer"
                  >
                    <ChevronLeft size={11} className="text-slate-500 shrink-0" />
                    <span>Go Back</span>
                  </motion.button>

                  <div className="flex w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 items-center justify-center text-blue-500 shadow-sm shrink-0">
                    <FileSpreadsheet size={16} className="sm:size-[20px]" />
                  </div>
                  <div className="flex flex-col">
                    <h3 className="text-xs sm:text-sm font-black uppercase tracking-tight text-slate-900 dark:text-slate-100 leading-none">Billing</h3>
                    <p className="text-[7px] sm:text-[8px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider mt-0.5 leading-none">Recovery</p>
                  </div>
                </div>

                {/* Animated Dropdown button for Months selection */}
                <div className="relative z-50 shrink-0">
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    type="button"
                    onClick={() => setIsMonthDropdownOpen(!isMonthDropdownOpen)}
                    className="inline-flex items-center justify-between gap-1 sm:gap-2 px-2.5 sm:px-3.5 py-2 sm:py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-850 text-slate-800 dark:text-slate-200 border border-slate-200/60 dark:border-slate-800/80 font-black uppercase tracking-widest text-[8px] sm:text-[9px] transition-all shadow-sm cursor-pointer select-none w-28 sm:w-56"
                  >
                    <div className="flex items-center gap-1 min-w-0">
                      <FolderOpen size={11} className="text-blue-500 shrink-0 sm:size-[13px]" />
                      <span className="hidden min-[380px]:inline text-slate-400 dark:text-slate-500 truncate">Sheets</span>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <span className="text-blue-600 dark:text-blue-400 truncate max-w-[50px] sm:max-w-[80px]">{currentMonthId || 'Select'}</span>
                      <motion.div
                        animate={{ rotate: isMonthDropdownOpen ? 180 : 0 }}
                        transition={{ duration: 0.2 }}
                        className="inline-flex text-slate-500 dark:text-slate-400"
                      >
                        <ChevronDown size={11} />
                      </motion.div>
                    </div>
                  </motion.button>

                  <AnimatePresence>
                    {isMonthDropdownOpen && (
                      <>
                        <div className="fixed inset-0 z-30 opacity-0 cursor-default" onClick={() => setIsMonthDropdownOpen(false)} />
                        <motion.div
                          initial={{ opacity: 0, y: -10, scaleY: 0.9 }}
                          animate={{ opacity: 1, y: 0, scaleY: 1 }}
                          exit={{ opacity: 0, y: -10, scaleY: 0.9 }}
                          transition={{ type: "spring", stiffness: 450, damping: 25 }}
                          className="absolute right-0 sm:left-0 mt-2 w-60 rounded-2xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 shadow-2xl py-2 z-40 overflow-hidden font-sans border-t-4 border-t-blue-500 max-h-72 overflow-y-auto"
                        >
                          <div className="px-4 pb-2 mb-1.5 border-b border-slate-100 dark:border-slate-900 text-[8.5px] text-slate-400 font-mono font-black uppercase tracking-widest block">
                            Billing Recovery Sheets
                          </div>
                          {billingMonths.length > 0 ? (
                            billingMonths.map((m) => {
                              const isSelected = m.id === currentMonthId;
                              return (
                                <button
                                  key={m.id}
                                  type="button"
                                  onClick={() => {
                                    window.dispatchEvent(new CustomEvent('gts-billing-month-selected', { detail: m.id }));
                                    setIsMonthDropdownOpen(false);
                                  }}
                                  className={cn(
                                    "w-full text-left px-4 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-900/40 flex items-center justify-between text-[10px] font-black uppercase tracking-wider transition-colors cursor-pointer",
                                    isSelected ? "text-blue-600 dark:text-blue-400 bg-blue-50/50 dark:bg-blue-950/25" : "text-slate-700 dark:text-slate-300"
                                  )}
                                >
                                  <div className="flex items-center gap-2">
                                    <span className={cn("w-1.5 h-1.5 rounded-full", isSelected ? "bg-blue-500" : "bg-slate-300 dark:bg-slate-700")} />
                                    <span>{m.id}</span>
                                  </div>
                                  {isSelected && <Check size={12} className="text-blue-500" />}
                                </button>
                              );
                            })
                          ) : (
                            <div className="px-4 py-3 text-[9px] text-slate-400 font-extrabold uppercase tracking-widest text-center">
                              No Recovery Sheets
                            </div>
                          )}
                        </motion.div>
                      </>
                    )}
                  </AnimatePresence>
                </div>
              </div>

              {/* Right Side: Primary Actions */}
              <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap justify-center sm:justify-end w-full md:w-auto">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  type="button"
                  onClick={() => window.dispatchEvent(new CustomEvent('gts-billing-action', { detail: 'ledger-vault' }))}
                  className="inline-flex items-center justify-center gap-1.5 md:gap-2 px-2.5 sm:px-3 md:px-4 py-2 sm:py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-800 font-black uppercase tracking-widest text-[8px] sm:text-[9px] transition-all shadow-sm cursor-pointer select-none shrink-0"
                  title="User Ledger Vault"
                >
                  <Users size={13} className="text-slate-500 dark:text-slate-400 animate-pulse shrink-0" />
                  <span className="hidden md:inline">User Ledger Vault</span>
                </motion.button>

                {isBillingUnlocked && (
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    type="button"
                    onClick={() => window.dispatchEvent(new CustomEvent('gts-billing-action', { detail: 'entry-sheet' }))}
                    className="inline-flex items-center justify-center gap-1.5 md:gap-2 px-2.5 sm:px-3 md:px-4 py-2 sm:py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-800 font-black uppercase tracking-widest text-[8px] sm:text-[9px] transition-all shadow-sm cursor-pointer select-none shrink-0"
                    title="Entry Sheet"
                  >
                    <ClipboardList size={13} className="text-slate-500 dark:text-slate-400 shrink-0" />
                    <span className="hidden md:inline">Entry Sheet</span>
                  </motion.button>
                )}

                {currentMonthId && (
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    type="button"
                    onClick={() => window.dispatchEvent(new CustomEvent('gts-billing-action', { detail: 'batch-print' }))}
                    className="inline-flex items-center justify-center gap-1.5 md:gap-2 px-2.5 sm:px-3 md:px-4 py-2 sm:py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-850 text-slate-800 dark:text-slate-200 border border-slate-200/60 dark:border-slate-800/80 font-black uppercase tracking-widest text-[8px] sm:text-[9px] transition-all shadow-sm cursor-pointer select-none shrink-0"
                    title="Batch Print"
                  >
                    <Printer size={13} className="text-blue-500 shrink-0" />
                    <span className="hidden md:inline">Batch Print</span>
                  </motion.button>
                )}

                {currentMonthId && (
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    type="button"
                    disabled={!hasActiveRows}
                    onClick={() => window.dispatchEvent(new CustomEvent('gts-billing-action', { detail: 'download-csv' }))}
                    className="inline-flex items-center justify-center gap-1.5 md:gap-2 px-2.5 sm:px-3 md:px-4 py-2 sm:py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-850 text-slate-800 dark:text-slate-200 border border-slate-200/60 dark:border-slate-800/80 font-black uppercase tracking-widest text-[8px] sm:text-[9px] transition-all shadow-sm cursor-pointer select-none disabled:opacity-40 shrink-0"
                    title="Download CSV Sheet"
                  >
                    <HardDriveDownload size={13} className="text-emerald-500 shrink-0" />
                    <span className="hidden md:inline">CSV Sheet</span>
                  </motion.button>
                )}

                {isBillingUnlocked && (
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    type="button"
                    onClick={() => window.dispatchEvent(new CustomEvent('gts-billing-action', { detail: 'new-month' }))}
                    className="inline-flex items-center justify-center gap-1.5 md:gap-2 px-2.5 sm:px-3 md:px-4 py-2 sm:py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-850 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-800 font-black uppercase tracking-widest text-[8px] sm:text-[9px] transition-all shadow-sm cursor-pointer select-none shrink-0"
                    title="Create New Month Sheet"
                  >
                    <PlusSquare size={13} className="text-slate-500 dark:text-slate-400 shrink-0" />
                    <span className="hidden md:inline">New Month</span>
                  </motion.button>
                )}

                {isBillingUnlocked && (
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    type="button"
                    onClick={() => window.dispatchEvent(new CustomEvent('gts-billing-action', { detail: 'purge-all' }))}
                    className="inline-flex items-center justify-center gap-1.5 px-2.5 sm:px-3 md:px-4 py-2 sm:py-2.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-600 transition-all border border-red-500/20 cursor-pointer shrink-0 font-black uppercase tracking-widest text-[8px] sm:text-[9px]"
                    title="Delete All Billing Data / Purge All"
                  >
                    <AlertTriangle size={13} className="shrink-0" />
                    <span className="hidden md:inline">Purge All</span>
                  </motion.button>
                )}

                {isBillingUnlocked && currentMonthId && (
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    type="button"
                    onClick={() => window.dispatchEvent(new CustomEvent('gts-billing-action', { detail: 'purge-sheet' }))}
                    className="inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/20 text-rose-600 hover:bg-rose-100 dark:hover:bg-rose-900/30 transition-all border border-rose-100 dark:border-rose-900/20 cursor-pointer shrink-0"
                    title="Purge / Delete Monthly Sheet"
                  >
                    <Trash2 size={13} />
                  </motion.button>
                )}
              </div>
            </div>
          ) : (
            <>
              <motion.div 
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className="flex items-center gap-2 sm:gap-4 lg:gap-3 ml-0"
              >
            {user && (
              <motion.button 
                id="sidebar-toggle-btn"
                onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                className={cn(
                  "rounded-xl transition-all mr-1 flex items-center justify-center overflow-hidden -ml-2 sm:ml-0",
                  menuUnlocked ? "opacity-100 w-10 h-10 p-2 scale-100" : "opacity-100 w-10 h-10 p-2 scale-100 lg:hidden",
                  isColoredHeader ? "hover:bg-white/10 text-white" : "hover:bg-slate-100 dark:hover:bg-slate-900 text-slate-500"
                )}
                transition={{ type: 'spring', stiffness: 300, damping: 25 }}
              >
                <div className="flex items-center justify-center">
                  {isSidebarOpen ? <X size={20} /> : <Menu size={20} />}
                </div>
              </motion.button>
            )}
            
            {/* Custom Complaint Trigger Button */}
            {user && (
              <motion.button
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.96 }}
                onClick={() => setIsComplaintSwipeDownOpen(!isComplaintSwipeDownOpen)}
                className="uiverse-complaint-btn"
              >
                <span className="uiverse-decor"></span>
                <div className="uiverse-content">
                  <div className="uiverse-icon">
                    <svg viewBox="0 0 50 50" fill="none" xmlns="http://www.w3.org/2000/svg" width="22" height="22">
                      <circle opacity="0.5" cx="25" cy="25" r="23" fill="url(#icon-payments-cat_svg__paint0_linear_1141_21101)"></circle>
                      <mask id="icon-payments-cat_svg__a" fill="#fff">
                        <path fillRule="evenodd" clipRule="evenodd" d="M34.42 15.93c.382-1.145-.706-2.234-1.851-1.852l-18.568 6.189c-1.186.395-1.362 2-.29 2.644l5.12 3.072a1.464 1.464 0 001.733-.167l5.394-4.854a1.464 1.464 0 011.958 2.177l-5.154 4.638a1.464 1.464 0 00-.276 1.841l3.101 5.17c.644 1.072 2.25.896 2.645-.29L34.42 15.93z">
                        </path>
                      </mask>
                      <path fillRule="evenodd" clipRule="evenodd" d="M34.42 15.93c.382-1.145-.706-2.234-1.851-1.852l-18.568 6.189c-1.186.395-1.362 2-.29 2.644l5.12 3.072a1.464 1.464 0 001.733-.167l5.394-4.854a1.464 1.464 0 011.958 2.177l-5.154 4.638a1.464 1.464 0 00-.276 1.841l3.101 5.17c.644 1.072 2.25.896 2.645-.29L34.42 15.93z" fill="#fff"></path>
                      <path d="M25.958 20.962l-1.47-1.632 1.47 1.632zm2.067.109l-1.632 1.469 1.632-1.469zm-.109 2.068l-1.469-1.633 1.47 1.633zm-5.154 4.638l-1.469-1.632 1.469 1.632zm-.276 1.841l-1.883 1.13 1.883-1.13zM34.42 15.93l-2.084-.695 2.084.695zm-19.725 6.42l18.568-6.189-1.39-4.167-18.567 6.19 1.389 4.166zm5.265 1.75l-5.12-3.072-2.26 3.766 5.12 3.072 2.26-3.766zm2.072 3.348l5.394-4.854-2.938-3.264-5.394 4.854 2.938 3.264zm5.394-4.854a.732.732 0 01-1.034-.054l3.265-2.938a3.66 3.66 0 00-5.17-.272l2.939 3.265zm-1.034-.054a.732.732 0 01.054-1.034l2.938 3.265a3.66 3.66 0 00.273-5.169l-3.265 2.938zm.054-1.034l-5.154 4.639 2.938 3.264 5.154-4.638-2.938-3.265zm1.023 12.152l-3.101-5.17-3.766 2.26 3.101 5.17 3.766-2.26zm4.867-18.423l-6.189 18.568 4.167 1.389 6.19-18.568-4.168-1.389zm-8.633 20.682c1.61 2.682 5.622 2.241 6.611-.725l-4.167-1.39a.732.732 0 011.322-.144l-3.766 2.26zm-6.003-8.05a3.66 3.66 0 004.332-.419l-2.938-3.264a.732.732 0 01.866-.084l-2.26 3.766zm3.592-1.722a3.66 3.66 0 00-.69 4.603l3.766-2.26c.18.301.122.687-.138.921l-2.938-3.264zm11.97-9.984a.732.732 0 01-.925-.926l4.166 1.389c.954-2.861-1.768-5.583-4.63-4.63l1.39 4.167zm-19.956 2.022c-2.967.99-3.407 5.003-.726 6.611l2.26-3.766a.732.732 0 01-.145 1.322l-1.39-4.167z" fill="#fff" mask="url(#icon-payments-cat_svg__a)"></path>
                      <defs>
                        <linearGradient id="icon-payments-cat_svg__paint0_linear_1141_21101" x1="25" y1="2" x2="25" y2="48" gradientUnits="userSpaceOnUse">
                          <stop stopColor="#fff" stopOpacity="0.71"></stop>
                          <stop offset="1" stopColor="#fff" stopOpacity="0"></stop>
                        </linearGradient>
                      </defs>
                    </svg>
                  </div>
                  <span className="uiverse-text">{branding?.tabNames?.submit || 'Register Complaint'}</span>
                </div>
              </motion.button>
            )}
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
            <div className="flex items-center gap-2 h-9">
              {/* Alerts/Bell notification indicator */}
                <button
                  onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
                  className={cn(
                    "w-9 h-9 rounded-full border flex items-center justify-center relative transition-all bg-white dark:bg-slate-900 shadow-sm cursor-pointer hover:scale-105 active:scale-95",
                    alertAuthorized 
                      ? "border-blue-500/30 text-blue-600 dark:text-blue-400 bg-blue-500/5 hover:bg-blue-500/10"
                      : "border-slate-200 dark:border-slate-800 text-amber-500 bg-amber-500/5 hover:bg-amber-500/10"
                  )}
                  title={alertAuthorized ? (isAudioMuted ? "Alert History (Muted)" : "Alert History") : "Alert Restricted"}
                >
                  {isAudioMuted && alertAuthorized ? (
                    <BellOff size={15} />
                  ) : (
                    <Bell size={15} className={!alertAuthorized ? "opacity-60" : ""} />
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
                        src={getAvatarUrl(user.profilePicture)} 
                        alt="User Profile" 
                        className="w-full h-full object-cover" 
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <img 
                        src={getAvatarUrl('default:male')} 
                        alt="User Profile" 
                        className="w-full h-full object-cover" 
                        referrerPolicy="no-referrer"
                      />
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
                                  src={getAvatarUrl(editProfilePicture)} 
                                  alt="Profile Preview" 
                                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" 
                                  referrerPolicy="no-referrer"
                                />
                              ) : (
                                <img 
                                  src={getAvatarUrl(`default:${editGender}`)} 
                                  alt="Profile Preview" 
                                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" 
                                  referrerPolicy="no-referrer"
                                />
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
                            <input
                              type="file"
                              accept="image/*"
                              ref={fileInputRef}
                              onChange={handleImageUpload}
                              className="hidden"
                            />
                            <button
                              type="button"
                              onClick={() => fileInputRef.current?.click()}
                              className="px-2 py-0.5 bg-slate-55 hover:bg-slate-100 dark:bg-slate-900 dark:hover:bg-slate-800 border border-slate-200/50 dark:border-slate-800 rounded text-[8px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 transition-all active:scale-95 cursor-pointer"
                            >
                              CHOOSE_FILE
                            </button>
                            {editProfilePicture && !editProfilePicture.startsWith('default:') && (
                              <button
                                type="button"
                                onClick={() => setEditProfilePicture(`default:${editGender}`)}
                                className="px-2 py-0.5 bg-rose-500/10 hover:bg-rose-500/15 text-rose-500 rounded text-[8px] font-black uppercase tracking-widest transition-all active:scale-95 cursor-pointer"
                              >
                                CLEAR_IMG
                              </button>
                            )}
                          </div>
                          
                          <div className="flex items-center gap-2 mt-2 bg-slate-100/50 dark:bg-slate-800/30 p-1.5 rounded-lg border border-slate-200/50 dark:border-slate-700/50">
                            <span className="text-[8px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 ml-1">Gender:</span>
                            <button
                              type="button"
                              onClick={() => {
                                setEditGender('not_set');
                                if (!editProfilePicture || editProfilePicture.startsWith('default:')) {
                                  setEditProfilePicture('default:none');
                                } else {
                                  const cleanPic = editProfilePicture.split(':::gender:')[0];
                                  setEditProfilePicture(cleanPic);
                                }
                              }}
                              className={cn(
                                "px-2 py-1 rounded text-[9px] font-bold uppercase tracking-wider transition-all cursor-pointer",
                                editGender === 'not_set' ? "bg-emerald-500 text-white shadow-sm" : "text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700"
                              )}
                            >
                              Not Set
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setEditGender('male');
                                if (!editProfilePicture || editProfilePicture.startsWith('default:')) {
                                  setEditProfilePicture('default:male');
                                } else {
                                  const cleanPic = editProfilePicture.split(':::gender:')[0];
                                  setEditProfilePicture(`${cleanPic}:::gender:male`);
                                }
                              }}
                              className={cn(
                                "px-2 py-1 rounded text-[9px] font-bold uppercase tracking-wider transition-all cursor-pointer",
                                editGender === 'male' ? "bg-emerald-500 text-white shadow-sm" : "text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700"
                              )}
                            >
                              Male
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setEditGender('female');
                                if (!editProfilePicture || editProfilePicture.startsWith('default:')) {
                                  setEditProfilePicture('default:female');
                                } else {
                                  const cleanPic = editProfilePicture.split(':::gender:')[0];
                                  setEditProfilePicture(`${cleanPic}:::gender:female`);
                                }
                              }}
                              className={cn(
                                "px-2 py-1 rounded text-[9px] font-bold uppercase tracking-wider transition-all cursor-pointer",
                                editGender === 'female' ? "bg-emerald-500 text-white shadow-sm" : "text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700"
                              )}
                            >
                              Female
                            </button>
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
          </>)}
        </div>
      </header>
      )}

      <AnimatePresence>
        {isComplaintSwipeDownOpen && user && (
          <div className="fixed inset-0 top-16 z-[100] flex justify-center items-center overflow-hidden bg-slate-950/45 dark:bg-slate-950/65 backdrop-blur-sm p-4 sm:p-6 lg:p-8">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsComplaintSwipeDownOpen(false)}
              className="absolute inset-0 bg-transparent"
            />
            
            <motion.div
              initial={{ y: -150, opacity: 0, scaleY: 0.9, originY: 0 }}
              animate={{ y: 0, opacity: 1, scaleY: 1, originY: 0 }}
              exit={{ y: -150, opacity: 0, scaleY: 0.9, originY: 0 }}
              transition={{ type: 'spring', stiffness: 350, damping: 28 }}
              className="relative w-full max-w-4xl bg-white dark:bg-slate-950 border-2 border-emerald-500/30 dark:border-emerald-500/20 rounded-[32px] shadow-[0_30px_70px_rgba(0,0,0,0.22)] dark:shadow-[0_40px_90px_rgba(0,0,0,0.6)] overflow-hidden"
            >
              {/* Top Accent Gradient Line */}
              <div className="h-2 bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-600 animate-pulse" />
              
              <div className="p-6 sm:p-8 space-y-6">
                {/* Header section with instructions */}
                <div className="flex items-center justify-between border-b-2 border-slate-200 dark:border-slate-800 pb-4">
                  <div className="flex items-center gap-3">
                    <div className="relative flex h-3.5 w-3.5 items-center justify-center">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                    </div>
                    <span className="text-sm sm:text-base font-extrabold uppercase tracking-[0.2em] text-slate-950 dark:text-white">
                      Complaint Entry Portal
                    </span>
                  </div>
                  <button
                    onClick={() => setIsComplaintSwipeDownOpen(false)}
                    className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white transition-all cursor-pointer shadow-sm"
                  >
                    <X size={18} />
                  </button>
                </div>

                {/* Complaint form wrapper */}
                <div className="max-h-[75vh] overflow-y-auto pr-2">
                  <ComplaintForm
                    onSubmit={async (data) => {
                      if (onRegisterComplaint) {
                        await onRegisterComplaint(data);
                      } else {
                        toast.error("Complaint registration service unavailable");
                      }
                      setIsComplaintSwipeDownOpen(false);
                    }}
                    isLoading={isLoading || false}
                    appConfig={appConfig}
                    currentUser={user}
                    branding={branding as any}
                    compact={true}
                  />
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <main className={cn(
        "mx-auto transition-all duration-500",
        user ? (
          isPreview 
            ? "py-4 sm:py-8 w-full px-4 pt-20 pl-[80px]" 
            : "py-4 sm:py-8 max-w-[1850px] w-full px-4 sm:px-6 lg:px-8 lg:pl-[84px]"
        ) : "w-full max-w-none px-0 py-0 sm:px-0 sm:py-0"
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
      {user && (
      <footer className={cn(
        "relative pt-4 pb-4 sm:pt-6 sm:pb-5 border-t border-slate-200 dark:border-slate-800/80 bg-white dark:bg-slate-950 overflow-hidden select-none",
        user && (isPreview ? "pl-[80px]" : "lg:pl-[68px]")
      )}>
        <div className="max-w-[1850px] w-full mx-auto px-4 sm:px-6 lg:px-8 flex flex-col items-center">
          
          {/* Main Animated Display Banner with Fluid Scalable Outlined "Green Tech Services" */}
          <div className="relative w-full flex items-center justify-center my-1 overflow-hidden py-2 sm:py-5">
            <motion.div 
              initial={{ opacity: 0, scale: 0.96 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, ease: "easeOut" }}
              className="w-full text-center font-serif pointer-events-none select-none px-1 flex justify-center items-center"
            >
              <span 
                className="font-extrabold text-transparent transition-all uppercase tracking-normal sm:tracking-wider whitespace-nowrap block text-center"
                style={{
                  fontSize: 'clamp(1.1rem, 6.4vw, 7.2rem)',
                  lineHeight: '1',
                  WebkitTextStroke: theme === 'dark' ? 'clamp(1px, 0.15vw, 2px) #475569' : 'clamp(1px, 0.15vw, 2px) #94a3b8',
                  filter: 'drop-shadow(0px 1px 3px rgba(0,0,0,0.05))'
                }}
              >
                Green Tech Services
              </span>
            </motion.div>
          </div>

          {/* Bottom Info Row with GTS Logo, Copyright & ISP Management Pro */}
          <div className="w-full pt-3 sm:pt-4 flex flex-col md:flex-row items-center justify-between gap-3 border-t border-slate-100 dark:border-slate-900/60 mt-1">
            
            {/* GTS Logo + Copyright Info */}
            <div className="flex items-center gap-2.5 flex-wrap justify-center md:justify-start">
              <div className="relative w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-slate-950 border border-slate-800 shadow-sm flex items-center justify-center overflow-hidden shrink-0">
                <span className="text-white font-black text-[10px] sm:text-xs tracking-tighter italic leading-none">
                  G<span className="text-blue-500">TS</span>
                </span>
              </div>
              <p className="text-[10px] sm:text-[11px] text-slate-500 dark:text-slate-400 font-semibold text-center md:text-left">
                © {new Date().getFullYear()} Green Tech Services Operations. Enterprise Edition.
              </p>
            </div>

            {/* ISP Management Pro + Powered By */}
            <div className="flex items-center gap-2.5 flex-wrap justify-center">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-slate-100/90 dark:bg-slate-900/90 border border-slate-200/80 dark:border-slate-800 text-[9px] sm:text-[10px] font-black uppercase tracking-wider text-slate-800 dark:text-slate-200 shadow-2xs">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                ISP Management Pro
              </div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-slate-200 dark:border-slate-800 text-[8px] sm:text-[9px] uppercase font-extrabold tracking-widest text-slate-500 dark:text-slate-400 bg-slate-50/80 dark:bg-slate-900/80 shadow-2xs hover:border-slate-300 dark:hover:border-slate-700 transition-all cursor-default">
                POWERED BY GREEN NET
              </div>
            </div>

          </div>

        </div>
      </footer>
      )}

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

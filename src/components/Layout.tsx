import React, { useState, useEffect, useRef, useMemo, Suspense, lazy } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Sun, Moon, LogOut, User, MessageSquare, MessageCircle, ChevronRight, Bell, BellOff, Volume2, VolumeX, Settings, Workflow, ShieldAlert, AlertTriangle, Mic, WifiOff, Wifi, History, Trash2, Clock, CheckCircle2, X, Menu, ChevronLeft, LayoutDashboard, ClipboardList, TrendingUp, Users, Shield, CloudUpload, Palette, Map as MapIcon, HelpCircle, PlusSquare, Contact, Flame, BarChart3, ChevronDown, Activity, CreditCard, PenLine, Home, RefreshCw, Sparkles, Lock, Mail, Camera, Key, Monitor, FileSpreadsheet, FolderOpen, Check, Printer, HardDriveDownload, DatabaseBackup, Cpu } from 'lucide-react';
import { useTheme } from '../hooks/useTheme';
import { cn } from '../lib/utils';
import { WhatsAppConnectPanel } from '../whatsapp_data';
import { UserProfile, Notification, BrandingConfig } from '../types';
import RefreshControl from './RefreshControl';
import FiberLoading from './FiberLoading';
import { SkForm } from './skeleton/Skeleton';
import InlineTextEditor from './InlineTextEditor';
import { IndependenceBuntingHeader, PakistanFlagFooter, PakistaniFlagBackground } from '../culture_design';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { supabaseService as pocketbaseService } from '../lib/supabaseService';
import { getAvatarUrl } from '../utils/avatar';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { lazyWithRetry } from '../lib/lazyWithRetry';
import { overlayMotion, dialogMotion } from '../lib/motionPresets';
import { usePopupTiming } from '../lib/usePopupTiming';
import { DeferredBody } from './ui/DeferredBody';

const Chat = lazyWithRetry(() => import('./Chat'));
const AIHelpPanel = lazyWithRetry(() => import('./AIHelpPanel'));
const ServiceMonitor = lazyWithRetry(() => import('./ServiceMonitor'));
const MapViewer = lazyWithRetry(() => import('./MapViewer'));
const ComplaintForm = lazyWithRetry(() => import('./ComplaintForm'));

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

const FooterTypewriterBanner = React.memo(({ text }: { text: string }) => {
  const fullFooterText = useMemo(() => text.toUpperCase(), [text]);
  const [footerTypedText, setFooterTypedText] = useState(fullFooterText);

  useEffect(() => {
    let isMounted = true;
    let charIndex = 0;
    let isDeleting = false;
    let timeoutId: ReturnType<typeof setTimeout>;

    const typeStep = () => {
      if (!isMounted) return;
      if (!isDeleting) {
        if (charIndex < fullFooterText.length) {
          charIndex++;
          setFooterTypedText(fullFooterText.slice(0, charIndex));
          timeoutId = setTimeout(typeStep, 90);
        } else {
          timeoutId = setTimeout(() => {
            isDeleting = true;
            typeStep();
          }, 3600);
        }
      } else {
        if (charIndex > 0) {
          charIndex--;
          setFooterTypedText(fullFooterText.slice(0, charIndex));
          timeoutId = setTimeout(typeStep, 40);
        } else {
          isDeleting = false;
          timeoutId = setTimeout(typeStep, 700);
        }
      }
    };

    typeStep();
    return () => {
      isMounted = false;
      clearTimeout(timeoutId);
    };
  }, [fullFooterText]);

  return (
    <div className="w-full bg-white/80 dark:bg-[#2a2d34] rounded-xl p-3 border border-black/[0.05] dark:border-white/10 flex items-center justify-center relative overflow-hidden">
      <div className="text-center z-10">
        <span className="text-base sm:text-xl font-bold tracking-widest text-slate-800 dark:text-slate-100 uppercase font-mono">
          {footerTypedText}
          <span className="text-[#187233] dark:text-emerald-400 animate-cursor-blink">|</span>
        </span>
      </div>
    </div>
  );
});

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
  const navigate = useNavigate();
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
      progress += 25;
      if (progress >= 75 && !didToggle) {
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
        }, 90);
      } else {
        setThemeTransitionProgress(progress);
      }
    }, 18);
  };

  const [isChatOpen, setIsChatOpen] = React.useState(false);
  const [selectedChatId, setSelectedChatId] = React.useState<string | null>(null);
  const [isNotificationsOpen, setIsNotificationsOpen] = React.useState(false);
  const [isMonitorOpen, setIsMonitorOpen] = React.useState(false);
  const [isMapOpen, setIsMapOpen] = React.useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [focusedClientId, setFocusedClientId] = React.useState<string | null>(null);
  const [isProfileOpen, setIsProfileOpen] = React.useState(false);
  const [selectedNotif, setSelectedNotif] = React.useState<Notification | null>(null);
  usePopupTiming('NotificationDetail', Boolean(selectedNotif));
  const isOnline = useOnlineStatus();
  const [showSyncStatus, setShowSyncStatus] = useState(false);
  const [isInlineEditingActive, setIsInlineEditingActive] = useState(false);
  const [isComplaintSwipeDownOpen, setIsComplaintSwipeDownOpen] = useState(false);
  usePopupTiming('ComplaintSwipeDown', isComplaintSwipeDownOpen);
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  const isUserSuspended = useMemo(() => {
    if (!user) return false;
    if (user.status === 'blocked') return true;
    if (user.dealerId && user.dealerId !== 'main') {
      const parentDealer = users.find((u) => u.uid === user.dealerId && u.role === 'dealer');
      if (parentDealer && parentDealer.status === 'blocked') return true;
    }
    return false;
  }, [user, users]);

  useEffect(() => {
    if (!isComplaintSwipeDownOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsComplaintSwipeDownOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isComplaintSwipeDownOpen]);

  const prefetchedTabsRef = useRef<Set<string>>(new Set());
  const handlePrefetchTab = (tabId: string) => {
    const connection = (navigator as any).connection;
    if (connection && (connection.saveData || connection.effectiveType === '2g' || connection.effectiveType === 'slow-2g')) {
      return;
    }
    if (prefetchedTabsRef.current.has(tabId)) return;
    prefetchedTabsRef.current.add(tabId);
    if (tabId === 'billing') {
      import('./BillingTab').catch(() => {});
      import('./EntrySheet').catch(() => {});
    } else if (tabId === 'clients') {
      import('./ClientManagement').catch(() => {});
    } else if (tabId === 'conversations' || tabId === 'config' || tabId === 'campaigns') {
      import('./ConversationTab').catch(() => {});
    } else if (tabId === 'whatsapp') {
      import('../whatsapp_data/WhatsAppCenter').catch(() => {});
    } else if (tabId === 'monitor' || tabId === 'latency') {
      import('./ServiceMonitor').catch(() => {});
    } else if (tabId === 'map') {
      import('./MapViewer').catch(() => {});
    } else if (tabId === 'nodes') {
      import('./HighFrequencyNodes').catch(() => {});
    } else if (tabId === 'mypc') {
      import('./MyPCTab').catch(() => {});
    }
  };

  // Special states for integrated billing header
  const [billingMonths, setBillingMonths] = useState<any[]>([]);
  const [currentMonthId, setCurrentMonthId] = useState<string>('');
  const [isBillingUnlocked, setIsBillingUnlocked] = useState<boolean>(false);
  const [isMonthDropdownOpen, setIsMonthDropdownOpen] = useState<boolean>(false);
  const [isBackupDropdownOpen, setIsBackupDropdownOpen] = useState<boolean>(false);
  const [isWhatsAppPanelOpen, setIsWhatsAppPanelOpen] = useState<boolean>(false);
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
    if (user) {
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
    }

    // Fallback to global branding if no dealer-specific name
    if (branding?.projectName && branding.projectName !== "Green Tech Services") {
      return branding.projectName;
    }
    
    return "Green Tech Services";
  };

  const brandingText = getBrandingText();
  const isColoredHeader = branding?.sidebarTheme && branding.sidebarTheme !== 'light';

  const isFirstMountRef = useRef(true);
  const prevOnlineRef = useRef(isOnline);

  useEffect(() => {
    if (isFirstMountRef.current) {
      isFirstMountRef.current = false;
      prevOnlineRef.current = isOnline;
      return;
    }

    if (!prevOnlineRef.current && isOnline) {
      setShowSyncStatus(true);
      const timer = setTimeout(() => setShowSyncStatus(false), 4000);
      prevOnlineRef.current = isOnline;
      return () => clearTimeout(timer);
    }
    prevOnlineRef.current = isOnline;
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
      const tenantId = user ? pocketbaseService.getReadTenantId(user) : undefined;
      await pocketbaseService.clearAllNotifications(tenantId);
    } catch (error) {
      console.error('Failed to clear notifications:', error);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      const tenantId = user ? pocketbaseService.getReadTenantId(user) : undefined;
      await pocketbaseService.markAllNotificationsRead(tenantId);
    } catch (error) {
      console.error('Failed to mark all notifications read:', error);
    }
  };

  const unreadNotificationsCount = useMemo(() => {
    return (notifications || []).filter(n => !n.isRead).length;
  }, [notifications]);

  const isSubDealerUser = user ? ((user.role === 'dealer' || Boolean(user.dealerId && user.dealerId !== 'main') || Boolean(user.lineCode)) && user.role !== 'admin') : false;
  const isSubAccount = user && user.role !== 'dealer' && user.dealerId && user.dealerId !== 'main';

  const visibleNavItems = useMemo(() => {
    if (!user) return [];
    const items = [
      { id: 'complaints', label: branding?.tabNames?.complaints || 'Operations', icon: ClipboardList, group: 'MAIN' },
      { id: 'greenradius', label: 'Green Radius OS', icon: Cpu, group: 'MAIN' },
      { id: 'submit', label: branding?.tabNames?.submit || 'Complain Reg', icon: PlusSquare, group: 'MAIN' },
      { id: 'nodes', label: 'Active Complainers', icon: Flame, group: 'MAIN' },
      { id: 'clients', label: branding?.tabNames?.clients || 'Users Management', icon: Contact, group: 'OPERATIONS' },
      { id: 'billing', label: 'Billing Mod', icon: CreditCard, group: 'OPERATIONS' },
      { id: 'config', label: 'WP Campaigns', icon: Workflow, group: 'OPERATIONS' },
      { id: 'map', label: 'Network Map', icon: MapIcon, group: 'OPERATIONS' },
      { id: 'monitor', label: 'Service Monitor', icon: Activity, group: 'OPERATIONS' },
      { id: 'mypc', label: 'Settings', icon: Settings, group: 'WORKSPACE' },
      { id: 'settings', label: 'Security', icon: Shield, group: 'WORKSPACE' },
      { id: 'recycle_bin', label: 'Recycle Bin', icon: Trash2, roles: ['super_admin', 'admin', 'dealer', 'editor'], group: 'WORKSPACE' },
      { id: 'integrations', label: 'Google Sheet Link', icon: CloudUpload, roles: ['super_admin', 'admin', 'dealer', 'editor'], group: 'WORKSPACE' },
      { id: 'chat', label: 'AI Help', icon: Sparkles, group: 'WORKSPACE' }
    ];

    let permitted;
    if (user.role === 'member' || user.role === 'field_agent') {
      const order = ['complaints', 'submit', 'nodes', 'billing', 'mypc', 'map', 'settings'];
      permitted = order.map(id => items.find(i => i.id === id)).filter(Boolean) as typeof items;
    } else if (user.role === 'liteadmin' || isSubAccount) {
      const order = ['complaints', 'submit', 'nodes', 'clients', 'billing', 'mypc', 'map', 'settings'];
      permitted = order.map(id => items.find(i => i.id === id)).filter(Boolean) as typeof items;
    } else {
      permitted = items.filter(item => {
        if (!user) return false;
        if (item.roles && !item.roles.includes(user.role)) return false;
        return true;
      });
    }

    return permitted.filter(item => !(branding?.hiddenTabs || []).includes(item.id));
  }, [user, branding, isSubAccount]);

  const checkIsItemActive = (id: string) => {
    if (id === 'config' || id === 'campaigns') return location.pathname.startsWith('/billingmod/conversation') || location.pathname.startsWith('/conversation');
    if (id === 'submit' || id === 'registry') return activeTab === 'submit' || location.pathname === '/registry' || location.pathname === '/submit';
    if (id === 'chat') return isChatOpen;
    if (id === 'monitor') return activeTab === 'latency' || activeTab === 'monitor' || isMonitorOpen;
    if (id === 'map') return isMapOpen && !isSidebarOpen;
    if (id === 'greenradius') return location.pathname === '/greenradius' || location.pathname.startsWith('/greenradius');
    return activeTab === id ||
           (id === 'complaints' && activeTab === 'ops') ||
           (id === 'settings' && activeTab === 'profile');
  };

  const handleSidebarNav = (id: string) => {
    if (id === 'map') {
      setIsMapOpen(true);
    } else if (id === 'config' || id === 'campaigns' || id === 'conversation') {
      navigate('/conversation');
    } else if (id === 'monitor' || id === 'latency') {
      navigate('/latency');
    } else if (id === 'greenradius' || id === 'radius' || id === 'vertix') {
      navigate('/greenradius');
    } else if (id === 'submit' || id === 'registry') {
      navigate('/registry');
      setActiveTab('submit');
      window.dispatchEvent(new CustomEvent('admin-nav', { detail: 'submit' }));
    } else {
      if (id === 'mypc') {
        window.dispatchEvent(new CustomEvent('mypc-reset-desktop'));
      }
      setActiveTab(id);
      window.dispatchEvent(new CustomEvent('admin-nav', { detail: id }));
    }
    setIsSidebarOpen(false);
  };

  const handleNavClick = (id: string) => {
    if (id === 'chat') {
      setIsChatOpen(true);
      setIsSidebarOpen(false);
    } else if (id === 'monitor') {
      handleSidebarNav('latency');
    } else if (id === 'map') {
      setIsMapOpen(true);
      setIsSidebarOpen(false);
    } else if (id === 'billing') {
      handleSidebarNav('billing');
    } else if (id === 'greenradius' || id === 'radius' || id === 'vertix') {
      navigate('/greenradius');
      setIsSidebarOpen(false);
    } else {
      handleSidebarNav(id);
    }
  };

  const showShellSidebar = Boolean(user && activeTab !== 'mypc' && activeTab !== 'config' && activeTab !== 'latency');

  return (
    <PakistaniFlagBackground className={cn(
      "transition-colors duration-300",
      showShellSidebar && "bg-[#126f51] dark:bg-[#0c4b37] min-h-0 h-[100dvh] max-h-[100dvh] h-dvh-fallback overflow-hidden"
    )}>
      <div className={cn(
        "flex-1 flex w-full",
        showShellSidebar
          ? (isPreview
              ? "relative w-full h-full min-h-0 overflow-hidden bg-[#126f51] dark:bg-[#0c4b37]"
              : "fixed inset-0 z-20 w-screen min-h-0 h-[100dvh] max-h-[100dvh] h-dvh-fallback overflow-hidden bg-[#126f51] dark:bg-[#0c4b37]")
          : "min-h-screen flex-col"
      )}>
      {/* Persistent Forest-Green Left Sidebar (Desktop - Matching Reference Image) */}
      {showShellSidebar && (
        <aside className={cn(
          "hidden lg:flex flex-col shrink-0 h-full select-none relative z-[55] transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] text-white bg-[#126f51] dark:bg-[#0c4b37]",
          isSidebarCollapsed ? "w-[74px]" : "w-[232px]"
        )}>
          {/* Floating Circular Seam Collapse Toggle Button */}
          <button
            type="button"
            onClick={() => setIsSidebarCollapsed(prev => !prev)}
            className="absolute -right-3.5 top-7 w-7 h-7 rounded-full bg-white dark:bg-[#2f333b] text-slate-700 dark:text-slate-200 border border-black/10 dark:border-white/15 shadow-md flex items-center justify-center hover:scale-110 active:scale-95 transition-transform z-[70] cursor-pointer"
            title={isSidebarCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
          >
            <ChevronLeft size={14} className={cn("transition-transform duration-300", isSidebarCollapsed && "rotate-180")} />
          </button>

          {/* Top Website Brand Logo & Name (Website's Own Logo & Name Preserved) */}
          <div
            onClick={handleLogoClick}
            className={cn(
              "px-4 pt-5 pb-4 flex items-center gap-3 cursor-pointer shrink-0 bg-[#126f51] dark:bg-[#0c4b37]",
              isSidebarCollapsed && "justify-center px-2"
            )}
          >
            <div className="w-9 h-9 rounded-xl bg-white/15 backdrop-blur-xs border border-white/25 flex items-center justify-center shadow-sm shrink-0">
              <span className="text-white font-black text-xs tracking-tighter italic leading-none">
                G<span className="text-emerald-200">TS</span>
              </span>
            </div>
            {!isSidebarCollapsed && (
              <div className="min-w-0 flex flex-col">
                <h1 className="text-[14px] font-bold tracking-tight text-white leading-tight truncate">
                  {brandingText}
                </h1>
                <span className="text-[10px] font-medium text-emerald-100/75 truncate leading-tight mt-0.5">
                  Powered by Green Net
                </span>
              </div>
            )}
          </div>

          {/* Navigation Options (Exact Website Options Preserved & Styled per Reference) */}
          <nav className="flex-1 px-3 py-2 flex flex-col gap-1 overflow-y-auto overflow-x-hidden no-scrollbar bg-[#126f51] dark:bg-[#0c4b37]">
            {(() => {
              let lastGroup = '';

              return visibleNavItems.map((item, idx) => {
                const showGroupHeader = !isSidebarCollapsed && item.group !== lastGroup;
                lastGroup = item.group;
                const isItemActive = checkIsItemActive(item.id);

                return (
                  <React.Fragment key={`nav-${item.id}-${idx}`}>
                    {showGroupHeader && (
                      <div className={cn(
                        "px-2.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-emerald-100/55 select-none",
                        idx === 0 ? "pt-1 pb-1" : "pt-3.5 pb-1"
                      )}>
                        {item.group}
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => handleNavClick(item.id)}
                      onPointerEnter={() => handlePrefetchTab(item.id)}
                      onFocus={() => handlePrefetchTab(item.id)}
                      title={isSidebarCollapsed ? item.label : undefined}
                      className={cn(
                        "w-full rounded-xl flex items-center gap-3 transition-all duration-150 cursor-pointer relative group",
                        isSidebarCollapsed ? "h-10 justify-center px-0" : "px-3 py-2",
                        isItemActive
                          ? "bg-white text-[#126f51] shadow-sm font-semibold"
                          : "text-white hover:bg-white/10 hover:text-white font-medium"
                      )}
                    >
                      <item.icon
                        size={17}
                        className={cn(
                          "shrink-0 transition-transform duration-150 group-hover:scale-105",
                          isItemActive ? "text-[#126f51]" : "text-white"
                        )}
                      />
                      {!isSidebarCollapsed && (
                        <span className={cn(
                          "text-[13px] leading-tight truncate whitespace-nowrap",
                          isItemActive ? "text-[#126f51]" : "text-white"
                        )}>
                          {item.label}
                        </span>
                      )}
                    </button>
                  </React.Fragment>
                );
              });
            })()}
          </nav>

          {/* Bottom Utility & Logout Section inside Green Sidebar */}
          <div className="px-3 py-3 border-t border-white/12 flex flex-col gap-1 shrink-0 bg-[#126f51] dark:bg-[#0c4b37]">
            {(branding?.hiddenTabs || []).includes('chat') && (
              <button
                type="button"
                onClick={() => setIsChatOpen(true)}
                className={cn(
                  "w-full rounded-xl flex items-center gap-3 text-white/85 hover:bg-white/10 hover:text-white transition-all cursor-pointer",
                  isSidebarCollapsed ? "h-10 justify-center px-0" : "px-3 py-2"
                )}
                title="AI Help"
              >
                <Sparkles size={17} className="shrink-0 text-emerald-200" />
                {!isSidebarCollapsed && <span className="text-[13px] font-medium whitespace-nowrap">AI Help</span>}
              </button>
            )}

            <button
              type="button"
              onClick={() => setShowLogoutModal(true)}
              className={cn(
                "w-full rounded-xl flex items-center gap-3 text-[#ffffff] hover:bg-white/12 hover:text-[#ffffff] transition-all cursor-pointer",
                isSidebarCollapsed ? "h-10 justify-center px-0" : "px-3 py-2"
              )}
              title="Sign Out"
            >
              <LogOut size={17} className="shrink-0 text-[#ffffff]" />
              {!isSidebarCollapsed && <span className="text-[13px] font-medium whitespace-nowrap text-[#ffffff]">Logout</span>}
            </button>
          </div>
        </aside>
      )}

      {/* Sidebar Overlay for Mobile Drawer */}
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsSidebarOpen(false)}
            className={cn("inset-0 bg-slate-950/50 backdrop-blur-xs z-[140]", isPreview ? "absolute" : "fixed")}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {isWhatsAppPanelOpen && (
          <WhatsAppConnectPanel
            onClose={() => setIsWhatsAppPanelOpen(false)}
            currentUser={user || undefined}
            users={users}
          />
        )}
      </AnimatePresence>

      {/* Mobile / Expanded Drawer Sidebar (Same Green Theme & Website Options) */}
      <motion.aside
        initial={false}
        animate={{
          width: isSidebarOpen ? (typeof window !== 'undefined' && window.innerWidth < 640 ? '86%' : '270px') : '0px',
          x: isSidebarOpen ? 0 : -30,
          opacity: isSidebarOpen ? 1 : 0
        }}
        transition={{ type: 'spring', damping: 28, stiffness: 240 }}
        className={cn(
          "top-0 bottom-0 left-0 z-[150] overflow-hidden bg-[#126f51] dark:bg-[#0c4b37] text-white border-r border-white/15 shadow-2xl flex flex-col",
          isPreview ? "absolute" : "fixed",
          !isSidebarOpen && "pointer-events-none"
        )}
      >
        <div className="p-5 border-b border-white/12 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3 min-w-0">
             <div className="w-9 h-9 rounded-xl bg-white/15 border border-white/25 flex items-center justify-center text-white shrink-0">
                <span className="font-black text-xs tracking-tighter italic">G<span className="text-emerald-200">TS</span></span>
             </div>
             <div className="min-w-0">
                <h3 className="text-sm font-bold tracking-tight text-white truncate">{brandingText}</h3>
                <p className="text-[10px] font-medium text-emerald-100/70 leading-none mt-1 truncate">Navigation Panel</p>
             </div>
          </div>
          <button
            type="button"
            onClick={() => setIsSidebarOpen(false)}
            className="p-2 rounded-xl hover:bg-white/10 text-white/80 hover:text-white transition-colors cursor-pointer"
          >
            <ChevronLeft size={18} />
          </button>
        </div>

        {/* Navigation Options in Mobile Drawer - Identical to Desktop Sidebar */}
        <nav className="flex-1 px-3 py-2 flex flex-col gap-1 overflow-y-auto overflow-x-hidden gts-dashboard-scroll custom-scrollbar no-scrollbar bg-[#126f51] dark:bg-[#0c4b37]">
          {(() => {
            let lastGroup = '';

            return visibleNavItems.map((item, idx) => {
              const showGroupHeader = item.group !== lastGroup;
              lastGroup = item.group;
              const isItemActive = checkIsItemActive(item.id);

              return (
                <React.Fragment key={`mobile-nav-${item.id}-${idx}`}>
                  {showGroupHeader && (
                    <div className={cn(
                      "px-2.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-emerald-100/55 select-none",
                      idx === 0 ? "pt-1 pb-1" : "pt-3.5 pb-1"
                    )}>
                      {item.group}
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => handleNavClick(item.id)}
                    onPointerEnter={() => handlePrefetchTab(item.id)}
                    onFocus={() => handlePrefetchTab(item.id)}
                    className={cn(
                      "w-full rounded-xl flex items-center gap-3 px-3 py-2 transition-all duration-150 cursor-pointer relative group",
                      isItemActive
                        ? "bg-white text-[#126f51] shadow-sm font-semibold"
                        : "text-white hover:bg-white/10 hover:text-white font-medium"
                    )}
                  >
                    <item.icon
                      size={17}
                      className={cn(
                        "shrink-0 transition-transform duration-150 group-hover:scale-105",
                        isItemActive ? "text-[#126f51]" : "text-white"
                      )}
                    />
                    <span className={cn(
                      "text-[13px] leading-tight truncate whitespace-nowrap",
                      isItemActive ? "text-[#126f51]" : "text-white"
                    )}>
                      {item.label}
                    </span>
                  </button>
                </React.Fragment>
              );
            });
          })()}
        </nav>

        {/* Bottom Utility & Logout Section inside Mobile Drawer */}
        <div className="px-3 py-3 border-t border-white/12 flex flex-col gap-1 shrink-0 bg-[#126f51] dark:bg-[#0c4b37] pb-[calc(1rem+env(safe-area-inset-bottom,0px))]">
          {(branding?.hiddenTabs || []).includes('chat') && (
            <button
              type="button"
              onClick={() => {
                setIsChatOpen(true);
                setIsSidebarOpen(false);
              }}
              className="w-full rounded-xl flex items-center gap-3 px-3 py-2 text-white/85 hover:bg-white/10 hover:text-white transition-all cursor-pointer"
              title="AI Help"
            >
              <Sparkles size={17} className="shrink-0 text-emerald-200" />
              <span className="text-[13px] font-medium whitespace-nowrap">AI Help</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              setShowLogoutModal(true);
              setIsSidebarOpen(false);
            }}
            className="w-full rounded-xl flex items-center gap-3 px-3 py-2 text-[#ffffff] hover:bg-white/12 hover:text-[#ffffff] transition-all cursor-pointer"
            title="Sign Out"
          >
            <LogOut size={17} className="shrink-0 text-[#ffffff]" />
            <span className="text-[13px] font-medium whitespace-nowrap text-[#ffffff]">Logout</span>
          </button>
        </div>
      </motion.aside>

      {/* Main Content Shell (Inset Rounded Workspace Sheet on Green Backdrop) */}
      <div className={cn(
        "flex-1 min-w-0 flex flex-col transition-all duration-300",
        showShellSidebar && "lg:py-2.5 lg:pr-2.5 min-h-0 h-full overflow-hidden bg-[#126f51] dark:bg-[#0c4b37]"
      )}>
      <div
        id={showShellSidebar ? "gts-main-scroll" : undefined}
        className={cn(
        "flex-1 min-w-0 flex flex-col transition-colors duration-300",
        showShellSidebar && "bg-[#ffffff] dark:bg-[#24262b] lg:rounded-[24px] shadow-[0_12px_36px_rgba(0,0,0,0.16)] border border-white/50 dark:border-white/10 min-h-0 h-full overflow-y-auto overflow-x-hidden gts-dashboard-scroll custom-scrollbar"
      )}>

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
      <AnimatePresence>
        {isWhatsAppPanelOpen && (
          <WhatsAppConnectPanel onClose={() => setIsWhatsAppPanelOpen(false)} />
        )}
      </AnimatePresence>

      {/* Detail Modal Overlay */}
      <AnimatePresence>
        {selectedNotif && (
          <>
            <motion.div 
              {...overlayMotion}
              onClick={() => setSelectedNotif(null)}
              className="fixed inset-0 bg-slate-950/60 backdrop-blur-md z-[300]"
            />
            <div className="fixed inset-0 flex items-center justify-center z-[310] p-4 pointer-events-none">
              <motion.div
                {...dialogMotion}
                className="w-full max-w-lg bg-white dark:bg-slate-950 rounded-[2.5rem] border border-slate-200/50 dark:border-white/10 shadow-2xl pointer-events-auto overflow-hidden relative transform-gpu will-change-transform"
              >
                {/* Decorative Elements */}
                <div
                  className="absolute top-0 right-0 -tr-20 -u-20 w-40 h-40 rounded-full pointer-events-none"
                  style={{ background: 'radial-gradient(circle, rgba(16,185,129,0.14) 0%, transparent 70%)' }}
                />
                <div
                  className="absolute bottom-0 left-0 -bl-20 -d-20 w-40 h-40 rounded-full pointer-events-none"
                  style={{ background: 'radial-gradient(circle, rgba(16,185,129,0.12) 0%, transparent 70%)' }}
                />

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
                    <div className="p-4 sm:p-5 rounded-2xl bg-slate-50 dark:bg-slate-900/40 border border-slate-100 dark:border-white/10">
                      <p className="text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-200 leading-relaxed">
                        {selectedNotif.message}
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-3 sm:gap-4">
                      <div className="p-3 sm:p-4 rounded-xl border border-slate-100 dark:border-white/10">
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
                                  width={16}
                                  height={16}
                                  className="h-4 w-4 rounded-full object-cover shrink-0"
                                />
                              );
                            }
                            return (
                              <img 
                                src={getAvatarUrl('default:male')} 
                                alt={selectedNotif.authorName}
                                width={16}
                                height={16}
                                className="h-4 w-4 rounded-full object-cover shrink-0 opacity-80"
                              />
                            );
                          })()}
                          <span className="text-[10px] sm:text-xs font-bold text-slate-900 dark:text-slate-100">{selectedNotif.authorName}</span>
                        </div>
                      </div>
                      <div className="p-3 sm:p-4 rounded-xl border border-slate-100 dark:border-white/10">
                        <p className="text-[8px] sm:text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">Timestamp</p>
                        <div className="flex items-center gap-1.5 sm:gap-2">
                          <Clock size={10} className="text-emerald-500 sm:w-[12px] sm:h-[12px]" />
                          <span className="text-[10px] sm:text-xs font-bold text-slate-900 dark:text-slate-100">{new Date(selectedNotif.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                      </div>
                    </div>

                    {selectedNotif.details && (
                      <div className="p-4 sm:p-5 rounded-2xl border border-slate-100 dark:border-white/10 bg-slate-50/50 dark:bg-slate-900/20">
                         <p className="text-[8px] sm:text-[9px] font-black uppercase tracking-widest text-slate-400 mb-2 sm:mb-3">Payload Data</p>
                         <div className="space-y-1.5 sm:space-y-2">
                            {Object.entries(selectedNotif.details).filter(([k]) => k !== 'id' && k !== 'createdAt').slice(0, 5).map(([key, value]) => (
                              <div key={key} className="flex justify-between items-center text-[9px] sm:text-[10px] py-1 border-b border-slate-100 dark:border-white/10 last:border-0">
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
      <AnimatePresence>
        {isWhatsAppPanelOpen && (
          <WhatsAppConnectPanel onClose={() => setIsWhatsAppPanelOpen(false)} />
        )}
      </AnimatePresence>

      {/* Chat Sidebar / AI Help Panel */}
      <AnimatePresence>
        {isChatOpen && user && (
          <Suspense fallback={null}>
            <AIHelpPanel 
              currentUser={user} 
              onClose={() => {
                setIsChatOpen(false);
              }} 
            />
          </Suspense>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {isWhatsAppPanelOpen && (
          <WhatsAppConnectPanel onClose={() => setIsWhatsAppPanelOpen(false)} />
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
              initial={{ opacity: 0, x: 40, scale: 0.96 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 40, scale: 0.96 }}
              transition={{ 
                type: "spring",
                damping: 28,
                stiffness: 250
              }}
              className="fixed bottom-20 right-4 sm:right-8 w-[calc(100vw-2rem)] sm:w-[420px] max-h-[75vh] bg-white/95 dark:bg-slate-950/95 backdrop-blur-xl rounded-3xl border border-slate-200/60 dark:border-white/10 shadow-[0_20px_60px_rgba(0,0,0,0.18)] dark:shadow-[0_20px_60px_rgba(0,0,0,0.45)] z-[200] overflow-hidden flex flex-col"
            >
              {/* Header Bar */}
              <div className="p-4 border-b border-slate-100 dark:border-white/10 bg-slate-50/80 dark:bg-slate-900/80 flex flex-col gap-3 shrink-0">
                {/* Top Row: Title, Unread Badge, and Close Button */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-2xl bg-brand-accent/10 border border-brand-accent/20 flex items-center justify-center shrink-0">
                      <History size={16} className="text-brand-accent" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-xs sm:text-sm font-black uppercase tracking-tight text-slate-900 dark:text-slate-50 leading-none truncate">
                        Operation History
                      </h3>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mt-1 truncate">
                        Live Intelligence Feed
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {unreadNotificationsCount > 0 && (
                      <span className="px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-500 border border-rose-500/20 text-[10px] font-black font-mono shrink-0">
                        {unreadNotificationsCount} unread
                      </span>
                    )}
                    <button 
                      onClick={() => setIsNotificationsOpen(false)}
                      className="p-1.5 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors cursor-pointer"
                      title="Close"
                    >
                      <X size={16} />
                    </button>
                  </div>
                </div>

                {/* Bottom Row: Dedicated Action Toolbar (Mark All Read & Delete All) */}
                {notifications.length > 0 && (
                  <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-200/50 dark:border-white/5">
                    {unreadNotificationsCount > 0 ? (
                      <button 
                        onClick={handleMarkAllRead}
                        className="flex-1 py-1.5 px-3 rounded-xl bg-slate-100 hover:bg-emerald-50 dark:bg-slate-800 dark:hover:bg-emerald-950/40 text-slate-700 dark:text-slate-200 hover:text-emerald-600 dark:hover:text-emerald-400 border border-slate-200/60 dark:border-white/5 flex items-center justify-center gap-1.5 text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer shadow-xs active:scale-95"
                        title="Mark all notifications as read"
                      >
                        <CheckCircle2 size={13} className="text-emerald-500" />
                        <span>Mark All Read</span>
                      </button>
                    ) : (
                      <div className="flex-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider pl-1">
                        All Caught Up
                      </div>
                    )}

                    <button 
                      onClick={handleClearAll}
                      className="py-1.5 px-3 rounded-xl bg-slate-100 hover:bg-rose-50 dark:bg-slate-800 dark:hover:bg-rose-950/40 text-slate-700 dark:text-slate-200 hover:text-rose-600 dark:hover:text-rose-400 border border-slate-200/60 dark:border-white/5 flex items-center justify-center gap-1.5 text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer shadow-xs active:scale-95 shrink-0"
                      title="Delete all notifications"
                    >
                      <Trash2 size={13} className="text-rose-500" />
                      <span>Delete All</span>
                    </button>
                  </div>
                )}
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

              <div className="flex-1 overflow-y-auto p-4 space-y-3 gts-dashboard-scroll custom-scrollbar">
                {notifications.length === 0 ? (
                  <div className="py-20 text-center">
                    <Bell className="mx-auto text-slate-200 dark:text-slate-800 mb-4" size={48} />
                    <p className="text-xs font-black uppercase tracking-widest text-slate-400">Empty Log Cache</p>
                  </div>
                ) : (
                  notifications.map((notif, idx) => {
                    const isRead = Boolean(notif.isRead);
                    return (
                      <motion.div
                        key={`${notif.id}-${idx}`}
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: idx * 0.05 }}
                        onClick={() => {
                          if (!notif.isRead) {
                            const tenantId = user ? pocketbaseService.getReadTenantId(user) : undefined;
                            pocketbaseService.markNotificationRead(notif.id, tenantId).catch(console.error);
                          }
                          setSelectedNotif(notif);
                          setIsNotificationsOpen(false);
                        }}
                        className={`p-3.5 rounded-xl border border-slate-100 dark:border-white/10 transition-all duration-200 group cursor-pointer relative ${
                          isRead
                            ? 'bg-slate-50/20 dark:bg-slate-900/10 opacity-70 hover:opacity-100 border-l-2 border-l-slate-300 dark:border-l-slate-700'
                            : `bg-slate-50/60 dark:bg-slate-900/40 hover:bg-white dark:hover:bg-slate-900 shadow-[0_2px_8px_rgba(0,0,0,0.02)] hover:shadow-[0_8px_20px_rgba(0,0,0,0.06)] dark:hover:shadow-none hover:-translate-y-0.5 border-l-4 ${
                                notif.type === 'complaint_created' ? 'border-l-emerald-500' :
                                notif.type === 'complaint_updated' ? 'border-l-blue-500' :
                                notif.type === 'complaint_deleted' ? 'border-l-rose-500' :
                                notif.type === 'user_created' ? 'border-l-brand-accent' :
                                notif.type === 'config_updated' ? 'border-l-amber-500' :
                                'border-l-slate-400'
                              }`
                        }`}
                      >
                        <div className="flex gap-3.5 items-start">
                          <div className="mt-1 shrink-0">
                            {getNotifIcon(notif.type)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2 mb-2">
                              <p className={`text-xs leading-relaxed ${
                                isRead ? 'font-medium text-slate-600 dark:text-slate-400' : 'font-bold text-slate-800 dark:text-slate-200'
                              }`}>
                                {notif.message}
                              </p>
                              {/* Action buttons: Mark Read & Delete */}
                              <div className="flex items-center gap-1 shrink-0 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                                {!isRead && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      const tenantId = user ? pocketbaseService.getReadTenantId(user) : undefined;
                                      pocketbaseService.markNotificationRead(notif.id, tenantId).catch(console.error);
                                    }}
                                    className="p-1 rounded-lg hover:bg-emerald-50 dark:hover:bg-emerald-950/40 text-slate-400 hover:text-emerald-500 transition-colors"
                                    title="Mark as read"
                                  >
                                    <Check size={13} strokeWidth={2.5} />
                                  </button>
                                )}
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    const tenantId = user ? pocketbaseService.getReadTenantId(user) : undefined;
                                    pocketbaseService.deleteNotification(notif.id, tenantId).catch(console.error);
                                  }}
                                  className="p-1 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 text-slate-400 hover:text-rose-500 transition-colors"
                                  title="Delete notification"
                                >
                                  <Trash2 size={13} />
                                </button>
                              </div>
                            </div>
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                {(() => {
                                  const authorUser = users.find(u => u.username === notif.authorName || u.fullName === notif.authorName);
                                  if (authorUser && authorUser.profilePicture) {
                                    return (
                                      <img 
                                        src={getAvatarUrl(authorUser.profilePicture)} 
                                        alt={notif.authorName} 
                                        width={16}
                                        height={16}
                                        className="w-4 h-4 rounded-full object-cover shrink-0 border border-slate-200 dark:border-slate-700"
                                      />
                                    );
                                  }
                                  return (
                                    <img 
                                      src={getAvatarUrl('default:male')} 
                                      alt={notif.authorName}
                                      width={16}
                                      height={16}
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
                    );
                  })
                )}
              </div>

              <div className="p-4 bg-slate-50 dark:bg-slate-900/50 border-t border-slate-100 dark:border-white/10">
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
      <AnimatePresence>
        {isWhatsAppPanelOpen && (
          <WhatsAppConnectPanel onClose={() => setIsWhatsAppPanelOpen(false)} />
        )}
      </AnimatePresence>

      {/* Relocated Profile dropdown to the header relative toggle container */}

      {user && (
      <header className={cn(
        "z-40 w-full border-b transition-all duration-300",
        showShellSidebar
          ? "bg-[#ffffff] dark:bg-[#24262b] border-black/[0.06] dark:border-white/10"
          : isPreview ? "sticky top-0" : "sticky top-0",
        !showShellSidebar && (
          branding?.sidebarTheme === 'dark' ? "bg-slate-950/90 border-slate-900 text-white" :
          branding?.sidebarTheme === 'accent' ? "bg-brand-accent/90 border-white/10 text-white" :
          branding?.sidebarTheme === 'glass' ? "glass border-white/10" :
          "neu-flat border-slate-200/50 dark:border-white/5"
        )
      )}>
        <div className={cn(
          "max-w-[1850px] w-full mx-auto px-2.5 sm:px-6 lg:px-7 flex items-center justify-between transition-all duration-300 min-w-0",
          showShellSidebar && "bg-[#ffffff] dark:bg-[#24262b]",
          activeTab === 'billing' ? "h-auto min-h-14 py-3 md:py-0 md:h-16 flex-wrap md:flex-nowrap gap-3" : "h-14 gap-1.5"
        )}>
          {activeTab === 'billing' ? (
            <div className="flex flex-col md:flex-row md:items-center justify-between w-full gap-3 md:gap-4">
              {/* Left Side: Title & Monthly Sheets button */}
              <div className="flex items-center gap-2 sm:gap-4 ml-0 justify-between md:justify-start w-full md:w-auto">
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setActiveTab('complaints')}
                    className="flex md:hidden items-center justify-center gap-1 px-2 py-1.5 rounded-lg neu-btn text-slate-750 dark:text-slate-300 text-[9px] font-black uppercase tracking-wider cursor-pointer"
                  >
                    <ChevronLeft size={11} className="text-slate-500 shrink-0" />
                    <span>Go Back</span>
                  </motion.button>

                  <div className="flex w-8 h-8 sm:w-10 sm:h-10 rounded-xl neu-inset items-center justify-center text-blue-500 shadow-sm shrink-0">
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
                    className="inline-flex items-center justify-between gap-1 sm:gap-2 px-2.5 sm:px-3.5 py-2 sm:py-2.5 rounded-xl neu-btn text-slate-800 dark:text-slate-200 font-black uppercase tracking-widest text-[8px] sm:text-[9px] transition-all shadow-sm cursor-pointer select-none w-28 sm:w-56"
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
                          className="absolute right-0 sm:left-0 mt-2 w-60 rounded-2xl neu-raised-lg border border-slate-200/50 dark:border-white/10 py-2 z-40 overflow-hidden font-sans border-t-4 border-t-blue-500 max-h-72 overflow-y-auto"
                        >
                          <div className="px-4 pb-2 mb-1.5 border-b border-slate-100 dark:border-slate-900 text-[8.5px] text-slate-400 font-mono font-black uppercase tracking-widest block">
                            Billing Recovery Sheets
                          </div>
                          {billingMonths.length > 0 ? (
                            billingMonths.map((m, mIdx) => {
                              const isSelected = m.id === currentMonthId;
                              return (
                                <button
                                  key={`m-${m.id}-${mIdx}`}
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
      <AnimatePresence>
        {isWhatsAppPanelOpen && (
          <WhatsAppConnectPanel onClose={() => setIsWhatsAppPanelOpen(false)} />
        )}
      </AnimatePresence>
                </div>
              </div>

              {/* Right Side: Primary Actions */}
              {user && (user.role === 'admin' || user.role === 'super_admin' || user.role === 'dealer' || user.role === 'editor' || (user.dealerId && user.dealerId !== 'main') || Boolean(user.lineCode)) && (
              <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap justify-center sm:justify-end w-full md:w-auto">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  type="button"
                  onClick={() => window.dispatchEvent(new CustomEvent('gts-billing-action', { detail: 'ledger-vault' }))}
                  className="inline-flex items-center justify-center gap-1.5 md:gap-2 px-2.5 sm:px-3 md:px-4 py-2 sm:py-2.5 rounded-xl neu-btn text-slate-800 dark:text-slate-200 font-black uppercase tracking-widest text-[8px] sm:text-[9px] transition-all shadow-sm cursor-pointer select-none shrink-0"
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
                    className="inline-flex items-center justify-center gap-1.5 md:gap-2 px-2.5 sm:px-3 md:px-4 py-2 sm:py-2.5 rounded-xl neu-btn text-slate-800 dark:text-slate-200 font-black uppercase tracking-widest text-[8px] sm:text-[9px] transition-all shadow-sm cursor-pointer select-none shrink-0"
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
                    className="inline-flex items-center justify-center gap-1.5 md:gap-2 px-2.5 sm:px-3 md:px-4 py-2 sm:py-2.5 rounded-xl neu-btn text-slate-800 dark:text-slate-200 font-black uppercase tracking-widest text-[8px] sm:text-[9px] transition-all shadow-sm cursor-pointer select-none shrink-0"
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
                    className="inline-flex items-center justify-center gap-1.5 md:gap-2 px-2.5 sm:px-3 md:px-4 py-2 sm:py-2.5 rounded-xl neu-btn text-slate-800 dark:text-slate-200 font-black uppercase tracking-widest text-[8px] sm:text-[9px] transition-all shadow-sm cursor-pointer select-none disabled:opacity-40 shrink-0"
                    title="Download CSV Sheet"
                  >
                    <HardDriveDownload size={13} className="text-emerald-500 shrink-0" />
                    <span className="hidden md:inline">CSV Sheet</span>
                  </motion.button>
                )}

                {isBillingUnlocked && (
                  <div className="relative">
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      type="button"
                      onClick={() => setIsBackupDropdownOpen(!isBackupDropdownOpen)}
                      className="inline-flex items-center justify-center gap-1.5 md:gap-2 px-2.5 sm:px-3 md:px-4 py-2 sm:py-2.5 rounded-xl neu-btn text-slate-800 dark:text-slate-200 font-black uppercase tracking-widest text-[8px] sm:text-[9px] transition-all shadow-sm cursor-pointer select-none shrink-0"
                      title="Backup Data"
                    >
                      <DatabaseBackup size={13} className="text-indigo-500 shrink-0" />
                      <span className="hidden md:inline">Backup</span>
                    </motion.button>

                    <AnimatePresence>
                      {isBackupDropdownOpen && (
                        <>
                          <div 
                            className="fixed inset-0 z-40" 
                            onClick={() => setIsBackupDropdownOpen(false)} 
                          />
                          <motion.div
                            initial={{ opacity: 0, y: 10, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 10, scale: 0.95 }}
                            transition={{ duration: 0.15 }}
                            className="absolute top-full mt-2 right-0 w-48 neu-raised-lg rounded-xl border border-slate-200/50 dark:border-white/10 p-2 z-50 flex flex-col gap-1 origin-top-right"
                          >
                            <button
                              onClick={() => {
                                setIsBackupDropdownOpen(false);
                                window.dispatchEvent(new CustomEvent('gts-billing-action', { detail: 'get-backup' }));
                              }}
                              className="w-full text-left px-3 py-2 text-sm font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors flex items-center gap-2"
                            >
                              <HardDriveDownload size={14} className="text-emerald-500" />
                              Get Backup
                            </button>
                            <button
                              onClick={() => {
                                setIsBackupDropdownOpen(false);
                                window.dispatchEvent(new CustomEvent('gts-billing-action', { detail: 'upload-backup' }));
                              }}
                              className="w-full text-left px-3 py-2 text-sm font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors flex items-center gap-2"
                            >
                              <CloudUpload size={14} className="text-blue-500" />
                              Upload Backup
                            </button>
                          </motion.div>
                        </>
                      )}
                    </AnimatePresence>
      <AnimatePresence>
        {isWhatsAppPanelOpen && (
          <WhatsAppConnectPanel onClose={() => setIsWhatsAppPanelOpen(false)} />
        )}
      </AnimatePresence>
                  </div>
                )}

                {isBillingUnlocked && (
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    type="button"
                    onClick={() => window.dispatchEvent(new CustomEvent('gts-billing-action', { detail: 'new-month' }))}
                    className="inline-flex items-center justify-center gap-1.5 md:gap-2 px-2.5 sm:px-3 md:px-4 py-2 sm:py-2.5 rounded-xl neu-btn text-slate-800 dark:text-slate-200 font-black uppercase tracking-widest text-[8px] sm:text-[9px] transition-all shadow-sm cursor-pointer select-none shrink-0"
                    title="Create New Month Sheet"
                  >
                    <PlusSquare size={13} className="text-slate-500 dark:text-slate-400 shrink-0" />
                    <span className="hidden md:inline">New Month</span>
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
              )}
            </div>
          ) : (
            <>
              <motion.div 
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className="flex items-center gap-1.5 sm:gap-4 lg:gap-3 ml-0 min-w-0"
              >
            {user && (
              <button
                id="sidebar-toggle-btn"
                onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                className={cn(
                  "rounded-xl transition-all mr-0.5 sm:mr-1 flex items-center justify-center overflow-hidden sm:ml-0 w-9 h-9 bg-white dark:bg-[#31343c] border border-black/[0.08] dark:border-white/10 shadow-xs cursor-pointer shrink-0",
                  menuUnlocked ? "flex" : "flex lg:hidden",
                  "text-slate-700 dark:text-slate-200"
                )}
              >
                <div className="flex items-center justify-center">
                  {isSidebarOpen ? <X size={18} /> : <Menu size={18} />}
                </div>
              </button>
            )}

            {/* Custom Complaint Trigger Button */}
            {user && (
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setIsComplaintSwipeDownOpen(!isComplaintSwipeDownOpen)}
                onPointerEnter={() => {
                  import('./ComplaintForm');
                }}
                onFocus={() => {
                  import('./ComplaintForm');
                }}
                className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3.5 py-1.5 sm:py-2 rounded-xl bg-[#f4f4f4] dark:bg-[#31343c] border border-black/[0.08] dark:border-white/10 shadow-xs hover:bg-[#ececec] dark:hover:bg-[#3a3e47] hover:shadow-sm transition-all cursor-pointer group shrink-0"
              >
                <span className="w-6 h-6 rounded-lg bg-[#187233] text-white flex items-center justify-center shrink-0">
                  <PlusSquare size={14} />
                </span>
                <span className="text-[11px] sm:text-xs font-semibold text-slate-800 dark:text-slate-100 whitespace-nowrap">
                  {branding?.tabNames?.submit || 'Register Complaint'}
                </span>
              </motion.button>
            )}
          </motion.div>

          {/* Independence Bunting Banner Header - Expanded landscape bunting flags */}
          <div className="hidden sm:flex flex-1 items-center justify-center px-1 z-20 overflow-visible relative">
            <IndependenceBuntingHeader />
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {/* Segmented Control Utility Cluster matching Reference Top-Right Controls */}
            <div className="flex items-center gap-1 p-1 rounded-xl bg-[#f4f4f4] dark:bg-[#1c1e22] border border-black/[0.05] dark:border-white/10">
              {user && (
                <button
                  onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
                  className={cn(
                    "w-8 h-8 rounded-lg flex items-center justify-center relative transition-all cursor-pointer hover:bg-white dark:hover:bg-[#2f333b]",
                    alertAuthorized
                      ? "text-slate-700 dark:text-slate-200"
                      : "text-amber-600 dark:text-amber-400"
                  )}
                  title={alertAuthorized ? (isAudioMuted ? "Alert History (Muted)" : "Alert History") : "Alert Restricted"}
                >
                  {isAudioMuted && alertAuthorized ? (
                    <BellOff size={15} />
                  ) : (
                    <Bell size={15} className={!alertAuthorized ? "opacity-75" : ""} />
                  )}
                  {unreadNotificationsCount > 0 && (
                    <span className="absolute top-1.5 right-1.5 flex h-1.5 w-1.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-red-500"></span>
                    </span>
                  )}
                </button>
              )}

              {/* Light / Dark Theme Switch inside Segmented Cluster */}
              <button
                onClick={handleThemeToggle}
                className="px-2.5 h-8 rounded-lg bg-white dark:bg-[#31343c] text-slate-700 dark:text-slate-200 shadow-xs flex items-center gap-1.5 text-[11px] font-semibold cursor-pointer hover:opacity-90 transition-all"
                title="Toggle Theme Modes"
              >
                {theme === 'dark' ? <Moon size={13} className="text-amber-300" /> : <Sun size={13} className="text-amber-500" />}
                <span className="hidden md:inline">{theme === 'dark' ? 'Dark' : 'Light'}</span>
              </button>
            </div>

            {user && (
              <div className="relative">
                <button
                  id="profile-toggle-btn"
                  onClick={() => setIsProfileOpen(!isProfileOpen)}
                  className="h-9 flex items-center gap-2 px-2.5 bg-white dark:bg-[#31343c] border border-black/[0.08] dark:border-white/10 shadow-xs rounded-xl transition-all cursor-pointer select-none hover:shadow-sm"
                >
                  <div className="hidden sm:flex flex-col items-end justify-center select-none">
                    <span className="text-[11px] font-semibold tracking-tight text-slate-800 dark:text-slate-100 leading-none">
                      {user.fullName || user.username || "Muhammad Ahmad"}
                    </span>
                    <span className="text-[9px] font-medium text-slate-500 dark:text-slate-400 mt-0.5 leading-none">
                      {user.role === 'super_admin' ? 'Super Admin' :
                       user.role === 'liteadmin' ? 'Lite Admin' :
                       user.role === 'member' ? 'Member' :
                       user.role === 'dealer' ? 'Main Dealer' :
                       user.role ? user.role.replace('_', ' ') : 'User'}
                    </span>
                  </div>
                  {/* avatar photo matching profile image */}
                  <div className="w-6.5 h-6.5 rounded-lg overflow-hidden shrink-0 neu-inset flex items-center justify-center">
                    {user.profilePicture ? (
                      <img 
                        src={getAvatarUrl(user.profilePicture)} 
                        alt="User Profile" 
                        width={26}
                        height={26}
                        className="w-full h-full object-cover" 
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <img 
                        src={getAvatarUrl('default:male')} 
                        alt="User Profile" 
                        width={26}
                        height={26}
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
                        className="fixed inset-0 bg-slate-950/20 backdrop-blur-[2px] z-[150]"
                      />
                      <motion.div
                        id="profile-panel"
                        initial={{ opacity: 0, height: 0, scaleY: 0.8, y: -10, originY: 0 }}
                        animate={{ opacity: 1, height: "auto", scaleY: 1, y: 0, originY: 0 }}
                        exit={{ opacity: 0, height: 0, scaleY: 0.8, y: -10, originY: 0 }}
                        transition={{ type: "spring", damping: 26, stiffness: 320 }}
                        className="absolute right-0 top-full mt-2 w-[calc(100vw-2rem)] sm:w-[340px] neu-raised-lg rounded-3xl border border-slate-200/50 dark:border-white/10 z-[200] overflow-hidden origin-top text-slate-800 dark:text-slate-100"
                      >
                        {/* Upper Gradient Accent */}
                        <div className="absolute top-0 left-0 right-0 h-[3.5px] bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-600" />
                        
                        {/* Improved Header */}
                        <div className="p-5 pb-4 bg-slate-50/50 dark:bg-slate-900/40 border-b border-slate-100 dark:border-white/10 relative">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2.5">
                              <div className="w-9 h-9 rounded-xl bg-emerald-500/10 dark:bg-emerald-400/10 flex items-center justify-center text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                                <Shield size={18} className="animate-pulse" />
                              </div>
                              <div>
                                <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-100">PROFILE</h3>
                              </div>
                            </div>
                            <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 dark:bg-emerald-500/15 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                              <span className="text-[7.5px] font-mono font-bold uppercase tracking-wider">SECURE</span>
                            </div>
                          </div>
                        </div>

                        {/* Interactive Photo Uploader Section */}
                        <div className="p-5 pb-4 flex flex-col items-center gap-1.5 border-b border-slate-100 dark:border-white/10">
                          <div className="relative group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                            {/* Colorful glow behind on hover */}
                            <div className="absolute -inset-1 rounded-full bg-gradient-to-r from-emerald-500 via-teal-400 to-indigo-500 blur opacity-20 group-hover:opacity-55 transition-opacity duration-500 animate-pulse" />
                            
                            <div className="relative w-20 h-20 rounded-full border-2 border-white dark:border-slate-950 bg-slate-55 dark:bg-slate-900 overflow-hidden shadow-md flex items-center justify-center transition-transform duration-500 group-hover:scale-105">
                              {editProfilePicture ? (
                                <img 
                                  src={getAvatarUrl(editProfilePicture)} 
                                  alt="Profile Preview" 
                                  width={80}
                                  height={80}
                                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" 
                                  referrerPolicy="no-referrer"
                                />
                              ) : (
                                <img 
                                  src={getAvatarUrl(`default:${editGender}`)} 
                                  alt="Profile Preview" 
                                  width={80}
                                  height={80}
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
                              className="px-2 py-0.5 bg-slate-55 hover:bg-slate-100 dark:bg-slate-900 dark:hover:bg-slate-800 border border-slate-200/50 dark:border-white/10 rounded text-[8px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 transition-all active:scale-95 cursor-pointer"
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
                            <label className="text-[8.5px] font-black uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500 ml-1 block leading-none">Full Name</label>
                            <div className="relative group">
                              <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-emerald-500 transition-colors pointer-events-none">
                                <User size={13.5} />
                              </div>
                              <input
                                type="text"
                                value={editFullName}
                                onChange={(e) => setEditFullName(e.target.value)}
                                placeholder="Enter Full Name"
                                className="w-full bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-xs font-bold focus:bg-white dark:focus:bg-slate-900 focus:border-emerald-500/60 focus:ring-2 focus:ring-emerald-500/10 outline-none transition-all text-slate-850 dark:text-slate-100"
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
                                className="w-full bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-xs font-bold focus:bg-white dark:focus:bg-slate-900 focus:border-emerald-500/60 focus:ring-2 focus:ring-emerald-500/10 outline-none transition-all text-slate-850 dark:text-slate-100"
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
                                className="w-full bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-xs font-bold focus:bg-white dark:focus:bg-slate-900 focus:border-emerald-500/60 focus:ring-2 focus:ring-emerald-500/10 outline-none transition-all text-slate-850 dark:text-slate-100"
                              />
                            </div>
                          </div>

                          {/* Email input */}
                          <div className="space-y-1.5">
                            <label className="text-[8.5px] font-black uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500 ml-1 block leading-none">Recovery Mail</label>
                            <div className="relative group">
                              <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-emerald-500 transition-colors pointer-events-none">
                                <Mail size={13.5} />
                              </div>
                              <input
                                type="email"
                                value={editEmail}
                                onChange={(e) => setEditEmail(e.target.value)}
                                placeholder="example@mail.com"
                                className="w-full bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-xs font-bold focus:bg-white dark:focus:bg-slate-900 focus:border-emerald-500/60 focus:ring-2 focus:ring-emerald-500/10 outline-none transition-all text-slate-850 dark:text-slate-100"
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
                                  <span>Save Changes</span>
                                </>
                              )}
                            </button>
                          </div>
                        </form>

                        {/* Dashboard Footer with Roles */}
                        <div className="p-4 bg-slate-50 dark:bg-slate-900/30 border-t border-slate-100 dark:border-white/10 flex items-center justify-center text-center">
                          <div className="flex flex-col gap-0.5">
                            <span className="text-[7px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">Security Access</span>
                            <span className="text-[9px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest leading-none">
                              {user.role === 'super_admin' ? 'Level 5 (Super Admin)' :
                               user.role === 'liteadmin' ? 'Level 4 (Lite Admin)' :
                               user.role === 'member' ? 'Level 2 (Member)' :
                               user.role === 'dealer' ? 'Level 3 (Main Dealer)' : 'Level 1 (User)'}
                            </span>
                          </div>
                        </div>
                      </motion.div>
                    </>
                  )}
                </AnimatePresence>
      <AnimatePresence>
        {isWhatsAppPanelOpen && (
          <WhatsAppConnectPanel onClose={() => setIsWhatsAppPanelOpen(false)} />
        )}
      </AnimatePresence>
              </div>
            )}

            {/* Header Logout Button */}
            {user && (
              <button
                type="button"
                id="header-logout-btn"
                onClick={() => setShowLogoutModal(true)}
                title="Logout from system"
                className="flex items-center gap-1.5 px-2.5 sm:px-3 h-9 rounded-xl border border-black/[0.08] dark:border-white/10 bg-white dark:bg-[#31343c] hover:bg-rose-50 dark:hover:bg-rose-950/40 text-slate-700 hover:text-rose-600 dark:text-slate-200 dark:hover:text-rose-400 transition-all select-none shadow-xs cursor-pointer active:scale-95 group font-sans whitespace-nowrap shrink-0"
              >
                <LogOut size={13} className="text-slate-500 group-hover:text-rose-600 dark:text-slate-400 dark:group-hover:text-rose-400 transition-colors shrink-0" />
                <span className="hidden min-[430px]:inline text-[11px] font-semibold leading-none">
                  Logout
                </span>
              </button>
            )}
          </div>
          </>)}
        </div>
      </header>
      )}

      {/* Logout Confirmation Modal Popup */}
      <AnimatePresence>
        {showLogoutModal && (
          <div className="fixed inset-0 z-[999] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-md">
            <motion.div
              {...overlayMotion}
              onClick={() => setShowLogoutModal(false)}
              className="absolute inset-0 bg-transparent"
            />
            
            <motion.div
              {...dialogMotion}
              className="relative w-full max-w-sm rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-white/10 shadow-2xl overflow-hidden p-6 z-10 text-center transform-gpu will-change-transform"
            >
              {/* Header Icon Accent */}
              <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-rose-500/10 dark:bg-rose-500/20 text-rose-500 flex items-center justify-center border border-rose-500/20 shadow-inner">
                <LogOut size={26} className="text-rose-500 ml-0.5" />
              </div>

              <h3 className="text-lg font-black text-slate-900 dark:text-white tracking-tight">
                Confirm Logout
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 leading-relaxed">
                Are you sure you want to log out from <strong className="text-slate-700 dark:text-slate-200">GTS ISP Management</strong>?
              </p>

              <div className="grid grid-cols-2 gap-3 mt-6">
                <button
                  type="button"
                  id="cancel-logout-btn"
                  onClick={() => setShowLogoutModal(false)}
                  className="w-full py-2.5 px-4 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs hover:bg-slate-100 dark:hover:bg-slate-800/60 transition-all active:scale-95 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  id="confirm-logout-btn"
                  onClick={() => {
                    setShowLogoutModal(false);
                    if (onLogout) onLogout();
                  }}
                  className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-rose-500 to-red-600 hover:from-rose-600 hover:to-red-700 text-white font-extrabold text-xs shadow-lg shadow-rose-500/25 transition-all active:scale-95 cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <LogOut size={13} />
                  <span>Log Out</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isComplaintSwipeDownOpen && user && (
          <div className="fixed inset-0 top-14 z-[100] flex justify-center items-start overflow-y-auto overflow-x-hidden gts-dashboard-scroll px-3 sm:px-6 pb-8 pt-2 sm:pt-4">
            {/* Smooth background overlay with lightweight blur */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18, ease: 'easeOut' }}
              onClick={() => setIsComplaintSwipeDownOpen(false)}
              className="fixed inset-0 top-14 bg-slate-950/45 dark:bg-slate-950/65 backdrop-blur-xs z-10"
            />

            {/* Fast, lightweight, hardware-accelerated top-to-bottom sliding frame */}
            <motion.div
              initial={{ y: '-100%', opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: '-100%', opacity: 0 }}
              transition={{ type: 'spring', stiffness: 360, damping: 32, mass: 0.65 }}
              className="relative z-20 w-full max-w-4xl mx-auto bg-[#ffffff] dark:bg-[#24262b] rounded-b-3xl sm:rounded-3xl shadow-2xl border border-slate-200/80 dark:border-white/10 px-4 sm:px-8 pt-6 pb-8 overflow-visible transform-gpu will-change-transform"
            >
              <button
                type="button"
                onClick={() => setIsComplaintSwipeDownOpen(false)}
                className="absolute top-4 right-4 p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-all cursor-pointer z-30"
                title="Close"
              >
                <X size={18} />
              </button>

              <div className="max-w-4xl mx-auto">
                <div className="text-center space-y-2 mb-10 select-none">
                  <h2 className="text-3xl font-black uppercase tracking-tight text-slate-900 dark:text-slate-50">
                    Field Operations
                  </h2>
                  <p className="text-[10px] font-bold uppercase tracking-[0.4em] text-slate-400 dark:text-slate-500">
                    Capture and process enterprise support requests
                  </p>
                </div>

                <div className="pt-2 pb-2 relative">
                  {isUserSuspended && (
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
                  <div className={cn(isUserSuspended && "blur-[3px] pointer-events-none select-none opacity-30")}>
                    <DeferredBody
                      frames={2}
                      mode="frames"
                      minHeight={420}
                      fallback={<SkForm fields={6} className="w-[896px] max-w-full !pt-[29px] -mt-[31px]" />}
                    >
                      <Suspense fallback={<SkForm fields={6} className="w-[896px] max-w-full !pt-[29px] -mt-[31px]" />}>
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
                          cardClassName="w-[896px] max-w-full !pt-[29px] mr-0 -mt-[31px]"
                        />
                      </Suspense>
                    </DeferredBody>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {isWhatsAppPanelOpen && (
          <WhatsAppConnectPanel onClose={() => setIsWhatsAppPanelOpen(false)} />
        )}
      </AnimatePresence>

      {/* Main Content */}
      <main
        className={cn(
          "mx-auto transition-all duration-300 flex-1 flex flex-col min-w-0",
          user
            ? "pt-2 pb-4 sm:pt-2.5 sm:pb-5 max-w-[1850px] w-full px-3 sm:px-6 lg:px-6 bg-[#ffffff] dark:bg-[#24262b]"
            : "w-full max-w-none px-0 py-0 sm:px-0 sm:py-0"
        )}
        style={user ? { paddingBottom: 'calc(1.25rem + env(safe-area-inset-bottom, 0px))' } : undefined}
      >
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.12 }}
          className="min-w-0 w-full"
        >
          {children}
        </motion.div>
      </main>

      {/* Footer */}
      {user && (
      <footer className="relative mt-auto w-full overflow-hidden border-t border-black/[0.06] dark:border-white/10 bg-[#fafbfa]/70 dark:bg-[#1f2126]/80 transition-all select-none">
        <PakistanFlagFooter />
        <div className="relative z-10 max-w-[1850px] w-full mx-auto px-4 sm:px-6 lg:px-7 py-4 space-y-3">
          {/* Typewriter Banner (Isolated Memo Component) */}
          <FooterTypewriterBanner text={brandingText} />

          {/* Bottom Controls Row: GTS Emblem, System Details & Powered By */}
          <div className="w-full flex flex-col lg:flex-row items-center justify-between gap-3 pt-1">
            <div className="flex flex-col sm:flex-row items-center gap-3 text-center sm:text-left">
              <div className="w-8 h-8 rounded-lg bg-[#187233] text-white flex items-center justify-center shadow-xs shrink-0">
                <span className="font-black text-[11px] tracking-tighter italic leading-none">
                  GTS
                </span>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-2">
                <span className="font-bold text-xs sm:text-sm tracking-tight text-slate-800 dark:text-slate-100">
                  {brandingText}
                </span>
                <span className="hidden sm:inline text-slate-400 dark:text-slate-600">·</span>
                <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                  © {new Date().getFullYear()} {brandingText} Operations. Enterprise Edition.
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0 flex-wrap justify-center">
              <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
                System Online
              </span>
              <span className="text-slate-300 dark:text-slate-600">·</span>
              <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wide">
                Powered by Green Net
              </span>
            </div>
          </div>
        </div>
      </footer>
      )}
      </div>
      </div>
      </div>

      {/* Funny Walking Mascot Removed */}

      <Suspense fallback={null}>
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
          isOpen={location.pathname === '/latency' || location.pathname.startsWith('/latency') || activeTab === 'latency' || activeTab === 'monitor' || isMonitorOpen} 
          onClose={() => {
            setIsMonitorOpen(false);
            navigate('/');
            if (activeTab === 'latency' || activeTab === 'monitor') {
              setActiveTab('complaints');
            }
          }} 
          user={user}
        />
      </Suspense>

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
              <div
                className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[550px] h-[550px] rounded-full"
                style={{ background: 'radial-gradient(circle, rgba(59,130,246,0.14) 0%, transparent 70%)' }}
              />
              {targetTheme === 'dark' ? (
                <div
                  className="absolute top-1/4 right-1/4 w-96 h-96 rounded-full"
                  style={{ background: 'radial-gradient(circle, rgba(99,102,241,0.09) 0%, transparent 70%)' }}
                />
              ) : (
                <div
                  className="absolute bottom-1/4 left-1/4 w-96 h-96 rounded-full"
                  style={{ background: 'radial-gradient(circle, rgba(245,158,11,0.09) 0%, transparent 70%)' }}
                />
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
      <AnimatePresence>
        {isWhatsAppPanelOpen && (
          <WhatsAppConnectPanel onClose={() => setIsWhatsAppPanelOpen(false)} />
        )}
      </AnimatePresence>

    </PakistaniFlagBackground>
  );
}

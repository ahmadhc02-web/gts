import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import BulkRenewView from './vertix/BulkRenewView';
import UserLiveView from './vertix/UserLiveView';
import RenewModal from './vertix/RenewModal';
import ChangePackageModal from './vertix/ChangePackageModal';
import AddUserModal from './vertix/AddUserModal';
import {
  Search,
  Bell,
  Info,
  ChevronDown,
  Sun,
  Moon,
  LayoutGrid,
  Users,
  Settings,
  HelpCircle,
  LogOut,
  ArrowRightLeft,
  ArrowDownLeft,
  Timer,
  Zap,
  Check,
  MoreHorizontal,
  ChevronLeft,
  ChevronRight,
  X,
  CreditCard,
  Wifi,
  UserX,
  Package,
  Ticket,
  UserCog,
  Router,
  BarChart3,
  ScrollText,
  MessageSquare,
  ArrowDownUp,
  DollarSign,
  UserCheck,
  UserMinus,
  CheckCircle2,
  AlertCircle,
  RotateCcw,
  Ban,
  Radio,
  Send,
  Edit,
  PowerOff,
  Layers,
  Sparkles,
  Plus,
  Trash2,
  Download,
  ChevronUp,
  Activity,
  HardDrive,
  Cpu,
  RefreshCw,
  Eye,
  EyeOff,
  Copy,
  History,
  UserPlus,
  WifiOff,
  CalendarClock,
  Clock,
  Award
} from 'lucide-react';
import {
  useRadiusStore,
  RadiusUser,
  RadiusPackage,
  Voucher,
  Payment,
  Manager,
  Nas,
  LogEntry,
  getRelativeDate,
  getDayDiffFromToday,
  isUserCreatedThisMonth,
  isUserExpired,
  formatExpiryDateDisplay,
  getExpiryCountdown
} from './vertix/radiusStore';
import { radiusApi, formatRadiusError } from './vertix/radiusApi';
import { StatCard } from "./vertix/StatCard";
import PackagesView from './vertix/PackagesView';
import VouchersView from './vertix/VouchersView';
import PaymentsView from './vertix/PaymentsView';
import ManagersView from './vertix/ManagersView';
import NasView from './vertix/NasView';
import ReportsView from './vertix/ReportsView';
import LogsView from './vertix/LogsView';
import SmsView from './vertix/SmsView';
import SettingsView from './vertix/SettingsView';
import { getAvatarUrl } from '../utils/avatar';
import { SkBar, SkVertixHeroGrid, SkVertixUsersTable, SkVariantProvider } from './skeleton/Skeleton';
import { useSkeletonGate } from './skeleton/useSkeletonGate';
import { useProgressiveCount } from '../lib/useProgressiveCount';
import { overlayMotion } from '../lib/motionPresets';

interface VertixDashboardProps {
  onBackToMain: () => void;
  complaints?: any[];
  users?: any[];
  currentUser?: any;
}

export type ViewType =
  | 'Dashboard'
  | 'Users'
  | 'Online'
  | 'Expired'
  | 'Expiring'
  | 'Packages'
  | 'Vouchers'
  | 'Payments'
  | 'Managers'
  | 'NAS'
  | 'Reports'
  | 'Logs'
  | 'SMS'
  | 'Settings';

type CurrencyType = 'PKR' | 'USD' | 'EUR' | 'GBP';
type SortField = 'username' | 'package' | 'expiry' | 'dataUsedGB' | 'status';
type SortDirection = 'asc' | 'desc';

interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'info';
  message: string;
}

export function getStaticSessionDuration(onlineSince?: string, userId?: string): string {
  let startMs: number;

  if (onlineSince && !isNaN(new Date(onlineSince).getTime())) {
    startMs = new Date(onlineSince).getTime();
  } else if (userId) {
    const charSum = userId.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
    const offsetMs = ((charSum * 43) % 2700 + 12) * 1000;
    startMs = Date.now() - offsetMs;
  } else {
    startMs = Date.now() - 35000;
  }

  const diffMs = Math.max(0, Date.now() - startMs);
  const totalSeconds = Math.floor(diffMs / 1000);

  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const ss = String(seconds).padStart(2, '0');
  const mm = String(minutes).padStart(2, '0');

  if (hours > 0) {
    const hh = String(hours).padStart(2, '0');
    return `${hh}:${mm}:${ss}`;
  }

  return `${mm}:${ss}`;
}

export default function VertixDashboard({
  onBackToMain,
  complaints = [],
  users = [],
  currentUser,
}: VertixDashboardProps) {
  // Pull all live data and actions from useRadiusStore
  const store = useRadiusStore();
  const isStoreLoading = !store || !Array.isArray(store.users) || store.isLoading || store.authLoading;
  const showDashboardSkeleton =
    useSkeletonGate(isStoreLoading) &&
    store.users.length === 0 &&
    !store.serviceUnavailable &&
    !store.accessDenied;
  const location = useLocation();
  const navigate = useNavigate();
  const isBulkRenewPage = location.pathname === '/greenradius/bulk-renew' || location.pathname.endsWith('/bulk-renew');
  const userPageMatch = location.pathname.match(/^\/greenradius\/user\/([^/]+)/);
  const liveUserId = userPageMatch ? decodeURIComponent(userPageMatch[1]) : null;

  // Shared active view between Top Tabs and Left Dock
  const [activeView, setActiveView] = useState<ViewType>('Dashboard');
  const [currency, setCurrency] = useState<CurrencyType>('PKR');

  const isSettingsPage = location.pathname === '/greenradius/settings' || location.pathname.endsWith('/settings') || activeView === 'Settings';

  // Keep activeView in sync with route between /greenradius and /greenradius/settings
  useEffect(() => {
    if (location.pathname === '/greenradius/settings' || location.pathname.endsWith('/settings')) {
      if (activeView !== 'Settings') {
        setActiveView('Settings');
      }
    } else if (activeView === 'Settings' && (location.pathname === '/greenradius' || location.pathname === '/greenradius/')) {
      setActiveView('Dashboard');
    }
  }, [location.pathname, activeView]);

  // Initialise isDarkMode from document.documentElement.classList.contains('dark')
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    if (typeof document !== 'undefined') {
      return document.documentElement.classList.contains('dark');
    }
    return false;
  });

  // Remember initial dark mode on mount to restore on unmount (back to GTS)
  const initialDarkRef = useRef<boolean>(false);
  useEffect(() => {
    initialDarkRef.current = document.documentElement.classList.contains('dark');
    const wasInitialDark = initialDarkRef.current;
    return () => {
      if (wasInitialDark) {
        document.documentElement.classList.add('dark');
        document.documentElement.style.colorScheme = 'dark';
      } else {
        document.documentElement.classList.remove('dark');
        document.documentElement.style.colorScheme = 'light';
      }
    };
  }, []);

  // Sync isDarkMode to document.documentElement and document.documentElement.style.colorScheme
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      document.documentElement.style.colorScheme = 'dark';
    } else {
      document.documentElement.classList.remove('dark');
      document.documentElement.style.colorScheme = 'light';
    }
  }, [isDarkMode]);

  // Live ticker for 1-second updating reverse countdowns
  const [liveSecondTick, setLiveSecondTick] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setLiveSecondTick(t => t + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<
    | 'All'
    | 'Active'
    | 'Pre-Active'
    | 'Online'
    | 'Offline'
    | 'Expired'
    | 'ExpiredToday'
    | 'Expiring'
    | 'ExpiringToday'
    | 'Expiring3d'
    | 'Expiring1w'
    | 'NewThisMonth'
    | 'Terminated'
    | 'Disabled'
  >('All');
  const [packageFilter, setPackageFilter] = useState<string | null>(null);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [hoveredDockTooltip, setHoveredDockTooltip] = useState<{
    title: string;
    description?: string;
    badge?: number | string;
    badgeTone?: 'emerald' | 'rose' | 'amber' | 'slate';
    top: number;
    left: number;
  } | null>(null);

  // User details derived from real logged-in currentUser prop
  const userDisplayName = currentUser?.fullName || currentUser?.name || currentUser?.username || 'Admin User';
  const userUsername = currentUser?.username ? `@${currentUser.username}` : '@admin';
  const userRoleDisplay = (currentUser?.role || 'System Admin').toUpperCase().replace('_', ' ');
  const userLineCode = currentUser?.lineCode || currentUser?.line_code || 'Main Node';
  const userEmail = currentUser?.email || `${currentUser?.username || 'admin'}@gts.net`;
  const userAvatarUrl = getAvatarUrl(currentUser?.profilePicture || 'default:male');

  const [openActionUserId, setOpenActionUserId] = useState<string | null>(null);

  // Sorting & Pagination
  const [sortField, setSortField] = useState<SortField>('expiry');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  // Modals
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [showRenewModal, setShowRenewModal] = useState(false);
  const [renewTargetUser, setRenewTargetUser] = useState<RadiusUser | null>(null);
  const [showChangePkgModal, setShowChangePkgModal] = useState(false);
  const [changePkgTargetUser, setChangePkgTargetUser] = useState<RadiusUser | null>(null);
  const [showEditUserModal, setShowEditUserModal] = useState(false);
  const [editTargetUser, setEditTargetUser] = useState<RadiusUser | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteTargetUser, setDeleteTargetUser] = useState<RadiusUser | null>(null);
  const [showBulkRenewModal, setShowBulkRenewModal] = useState(false);
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);
  const [showWhatsAppModal, setShowWhatsAppModal] = useState(false);

  // Loan feature state
  const [showLoanModal, setShowLoanModal] = useState(false);
  const [loanStep, setLoanStep] = useState<'check' | 'animating' | 'result' | 'borrow'>('check');
  const [animatedCreditScore, setAnimatedCreditScore] = useState(1000);
  const [assignedCreditLimit, setAssignedCreditLimit] = useState(7500); // Super admin assigned credit limit
  const [borrowAmount, setBorrowAmount] = useState('');
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [showRequestModal, setShowRequestModal] = useState(false);

  // Form States
  // Add User Form
  const [newUsername, setNewUsername] = useState('');
  const [newName, setNewName] = useState('');
  const [newMobile, setNewMobile] = useState('');
  const [newPackage, setNewPackage] = useState(store.packages[0]?.name || '');
  const [newMonths, setNewMonths] = useState(1);
  const [newPassword, setNewPassword] = useState('');
  const [newManagerId, setNewManagerId] = useState('');
  const [addFormError, setAddFormError] = useState('');

  // Inline password verify banner state (for restored GTS session without radius JWT)
  const [verifyPassword, setVerifyPassword] = useState('');
  const [showVerifyPassword, setShowVerifyPassword] = useState(false);
  const [isVerifyingPassword, setIsVerifyingPassword] = useState(false);
  const [verifyPasswordError, setVerifyPasswordError] = useState('');

  // Renew Form
  const [renewPackage, setRenewPackage] = useState('');
  const [renewMonths, setRenewMonths] = useState(1);

  // Edit User Form
  const [editName, setEditName] = useState('');
  const [editMobile, setEditMobile] = useState('');
  const [editPackage, setEditPackage] = useState('');
  const [editManagerId, setEditManagerId] = useState('');

  // Transfer Form state (preserved)
  const [transferAmount, setTransferAmount] = useState('1250');
  const [transferRecipient, setTransferRecipient] = useState('Alex Rivers (alex@codext.studio)');
  const [transferSuccess, setTransferSuccess] = useState(false);

  // Request Form state (preserved)
  const [requestAmount, setRequestAmount] = useState('3400');
  const [requestFrom, setRequestFrom] = useState('Nova Ventures Inc.');
  const [requestSuccess, setRequestSuccess] = useState(false);

  // Floating Toasts
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const addToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 3800);
  };

  // Close row actions menu on click outside
  const tableRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (openActionUserId && tableRef.current && !tableRef.current.contains(e.target as Node)) {
        setOpenActionUserId(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [openActionUserId]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === '?' && !e.ctrlKey && !e.metaKey && (e.target as HTMLElement).tagName !== 'INPUT') {
        setShowHelpModal(prev => !prev);
      }
      if (e.key === 'Escape') {
        setShowAddUserModal(false);
        setShowRenewModal(false);
        setShowEditUserModal(false);
        setShowDeleteModal(false);
        setShowBulkRenewModal(false);
        setShowBulkDeleteModal(false);
        setShowWhatsAppModal(false);
        setShowInfoModal(false);
        setShowHelpModal(false);
        setShowTransferModal(false);
        setShowRequestModal(false);
        setOpenActionUserId(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Copy to clipboard helper
  const handleCopyText = (text: string, label: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    addToast(`${label} copied to clipboard!`, 'info');
  };

  // Time left countdown helper
  const getTimeLeftInfo = (expiryStr: string, status: string) => {
    if (status === 'Disabled') {
      return { text: 'Disabled', colorClass: 'text-slate-500 bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-700' };
    }
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const exp = new Date(expiryStr);
    if (isNaN(exp.getTime())) return { text: 'N/A', colorClass: 'text-slate-500 bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-700' };

    const diffTime = exp.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (status === 'Expired' || diffDays < 0) {
      const daysAgo = Math.abs(diffDays);
      return {
        text: daysAgo === 0 ? 'Expired today' : `Expired ${daysAgo}d ago`,
        colorClass: 'text-rose-700 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/60 border-rose-200 dark:border-rose-800',
      };
    }

    if (diffDays === 0) {
      return {
        text: 'Expires today',
        colorClass: 'text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/60 border-amber-200 dark:border-amber-800',
      };
    }

    if (diffDays <= 3) {
      return {
        text: `${diffDays} ${diffDays === 1 ? 'day' : 'days'} left`,
        colorClass: 'text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/60 border-amber-200 dark:border-amber-800',
      };
    }

    return {
      text: `${diffDays} days left`,
      colorClass: 'text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 border-emerald-200 dark:border-emerald-800',
    };
  };

  // Currency multiplier
  const currencyRate = useMemo(() => {
    switch (currency) {
      case 'EUR':
        return 0.92;
      case 'GBP':
        return 0.79;
      case 'USD':
        return 0.00357;
      case 'PKR':
      default:
        return 1.0;
    }
  }, [currency]);

  const currencySymbol = useMemo(() => {
    switch (currency) {
      case 'EUR':
        return '€';
      case 'GBP':
        return '£';
      case 'USD':
        return '$';
      case 'PKR':
      default:
        return 'Rs. ';
    }
  }, [currency]);

  // Total balance dynamically computed from ledger payments
  const formattedTotalBalance = useMemo(() => {
    if (currency === 'PKR') {
      const raw = store.totalBalancePKR || (store.totalBalanceUSD * 280);
      return `Rs. ${raw.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }
    const raw = store.totalBalanceUSD * currencyRate;
    return `${currencySymbol}${raw.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }, [store.totalBalancePKR, store.totalBalanceUSD, currency, currencyRate, currencySymbol]);

  // Today Spending Amount calculation (daily payment deductions subtracted from total balance)
  const todaySpendingAmount = useMemo(() => {
    const todayStr = new Date().toISOString().split('T')[0];
    const todayPayments = store.payments.filter(p => {
      if (!p.date) return false;
      return p.date.startsWith(todayStr) || p.date.includes('Today');
    });
    return todayPayments.reduce((acc, p) => acc + (p.amount || 0), 0);
  }, [store.payments]);

  // Expiring Today count
  const expiringTodayCount = useMemo(() => {
    if (!store.users || !Array.isArray(store.users)) return 0;
    return store.users.filter(u => u && u.status === 'Active' && getDayDiffFromToday(u.expiry) === 0).length;
  }, [store.users]);

  // Top Tabs
  const topTabs: ViewType[] = [
    'Dashboard',
    'Users',
    'Online',
    'Expired',
    'Packages',
    'Reports',
  ];

  // 14 Left Dock Items
  const reminderDays = store.settings?.expiryReminderDays || 3;

  const dockItems: Array<{
    id: ViewType;
    icon: React.ComponentType<{ className?: string }>;
    title: string;
    description: string;
    badge?: number | string;
    badgeTone?: 'emerald' | 'rose' | 'amber' | 'slate';
  }> = [
    { id: 'Dashboard', icon: LayoutGrid, title: 'Radius Dashboard', description: 'Live overview, balance & analytics' },
    { id: 'Users', icon: Users, title: 'Subscribers / Users', description: 'Manage all PPPoE client accounts', badge: store.stats?.total ?? 0, badgeTone: 'slate' },
    { id: 'Online', icon: Wifi, title: 'Online Sessions', description: 'Active live router connections', badge: store.stats?.online ?? 0, badgeTone: 'emerald' },
    { id: 'Expired', icon: UserX, title: 'Expired Accounts', description: 'Overdue accounts pending renewal', badge: store.stats?.expired ?? 0, badgeTone: 'rose' },
    { id: 'Expiring', icon: Timer, title: `Expiring in ${reminderDays} Days`, description: 'Upcoming account expiration alerts', badge: store.stats?.expiring ?? 0, badgeTone: 'amber' },
    { id: 'Packages', icon: Package, title: 'Internet Packages', description: 'Bandwidth profiles & monthly pricing', badge: store.packages?.length ?? 0, badgeTone: 'slate' },
    { id: 'Vouchers', icon: Ticket, title: 'Vouchers & Scratch Cards', description: 'Prepaid PIN batches & redemptions', badge: store.vouchers?.length ?? 0, badgeTone: 'slate' },
    { id: 'Payments', icon: CreditCard, title: 'Payments Ledger', description: 'Collections, invoices & receipts', badge: store.payments?.length ?? 0, badgeTone: 'emerald' },
    { id: 'Managers', icon: UserCog, title: 'Managers & Dealers', description: 'Reseller balances & permissions', badge: store.managers?.length ?? 0, badgeTone: 'slate' },
    { id: 'NAS', icon: Router, title: 'NAS / Mikrotik Routers', description: 'RouterOS nodes & API link status', badge: store.nasList?.length ?? 0, badgeTone: 'emerald' },
    { id: 'Reports', icon: BarChart3, title: 'Radius Reports', description: 'Revenue summaries & CSV exports' },
    { id: 'Logs', icon: ScrollText, title: 'Audit & System Logs', description: 'Live Radius auth & activity trail', badge: store.logs?.length ?? 0, badgeTone: 'slate' },
    { id: 'SMS', icon: MessageSquare, title: 'WhatsApp & SMS Alerts', description: 'Automated expiry & billing notices' },
    { id: 'Settings', icon: Settings, title: 'Radius Engine Settings', description: 'Core config, ports & backups' },
  ];

  // Sync view selection
  const handleViewChange = (view: ViewType) => {
    if (view === 'Settings') {
      setActiveView('Settings');
      navigate('/greenradius/settings');
      return;
    }
    setActiveView(view);
    setPackageFilter(null);
    if (view === 'Dashboard' || view === 'Users') {
      setStatusFilter('All');
    } else if (view === 'Online') setStatusFilter('Online');
    else if (view === 'Expired') setStatusFilter('Expired');
    else if (view === 'Expiring') setStatusFilter('Expiring');
    setCurrentPage(1);
  };

  // Helper: Expiring in configured reminder days test
  const isExpiringSoon = (expiryStr: string): boolean => {
    const diffDays = getDayDiffFromToday(expiryStr);
    return diffDays !== null && diffDays >= 0 && diffDays <= reminderDays;
  };

  // Filter & Search
  const filteredUsers = useMemo(() => {
    if (!store.users || !Array.isArray(store.users)) return [];
    return store.users.filter(user => {
      if (!user) return false;
      // Search
      const q = (searchQuery || '').toLowerCase().trim();
      const uUsername = (user.username || '').toLowerCase();
      const uName = (user.name || '').toLowerCase();
      const uMobile = user.mobile || '';
      const uIp = user.ip || '';
      const uPkg = (user.package || '').toLowerCase();

      const matchesSearch =
        !q ||
        uUsername.includes(q) ||
        uName.includes(q) ||
        uMobile.includes(q) ||
        uIp.includes(q) ||
        uPkg.includes(q);

      if (!matchesSearch) return false;

      if (packageFilter && user.package !== packageFilter) return false;

      // Status Filter
      if (statusFilter === 'Active') return user.status === 'Active';
      if (statusFilter === 'Pre-Active') return user.status === 'Pre-Active';
      if (statusFilter === 'Online') return user.online === true;
      if (statusFilter === 'Offline') return !user.online && user.status === 'Active';
      if (statusFilter === 'Expired') return user.status === 'Expired';
      if (statusFilter === 'ExpiredToday') return user.status === 'Expired' && getDayDiffFromToday(user.expiry) === 0;
      if (statusFilter === 'Expiring') return user.status === 'Active' && isExpiringSoon(user.expiry);
      if (statusFilter === 'ExpiringToday') return user.status === 'Active' && getDayDiffFromToday(user.expiry) === 0;
      if (statusFilter === 'Expiring3d') {
        const d = getDayDiffFromToday(user.expiry);
        return user.status === 'Active' && d !== null && d >= 0 && d <= 3;
      }
      if (statusFilter === 'Expiring1w') {
        const d = getDayDiffFromToday(user.expiry);
        return user.status === 'Active' && d !== null && d >= 0 && d <= 7;
      }
      if (statusFilter === 'NewThisMonth') return isUserCreatedThisMonth(user);
      if (statusFilter === 'Terminated') return user.status === 'Terminated';
      if (statusFilter === 'Disabled') return user.status === 'Disabled';
      return true;
    });
  }, [store.users, searchQuery, statusFilter, packageFilter, reminderDays]);

  // Status Counts for Chips
  const statusCounts = useMemo(() => {
    const users = store.users || [];
    let all = users.length;
    let active = 0;
    let preActive = 0;
    let online = 0;
    let offline = 0;
    let expired = 0;
    let expiredToday = 0;
    let expiringToday = 0;
    let expiring3d = 0;
    let expiring1w = 0;
    let newThisMonth = 0;
    let terminated = 0;
    let disabled = 0;

    for (const u of users) {
      if (!u) continue;
      if (u.status === 'Active') active++;
      if (u.status === 'Pre-Active') preActive++;
      if (u.online === true) online++;
      if (!u.online && u.status === 'Active') offline++;
      if (u.status === 'Expired') {
        expired++;
        if (getDayDiffFromToday(u.expiry) === 0) expiredToday++;
      }
      if (u.status === 'Active') {
        const diff = getDayDiffFromToday(u.expiry);
        if (diff === 0) expiringToday++;
        if (diff !== null && diff >= 0 && diff <= 3) expiring3d++;
        if (diff !== null && diff >= 0 && diff <= 7) expiring1w++;
      }
      if (isUserCreatedThisMonth(u)) newThisMonth++;
      if (u.status === 'Terminated') terminated++;
      if (u.status === 'Disabled') disabled++;
    }

    return {
      all,
      active,
      preActive,
      online,
      offline,
      expired,
      expiredToday,
      expiringToday,
      expiring3d,
      expiring1w,
      newThisMonth,
      terminated,
      disabled,
    };
  }, [store.users]);

  // Sorted Users
  const sortedUsers = useMemo(() => {
    const copy = [...filteredUsers];
    copy.sort((a, b) => {
      let valA: string | number = '';
      let valB: string | number = '';

      if (sortField === 'username') {
        valA = (a.username || '').toLowerCase();
        valB = (b.username || '').toLowerCase();
      } else if (sortField === 'package') {
        valA = (a.package || '').toLowerCase();
        valB = (b.package || '').toLowerCase();
      } else if (sortField === 'expiry') {
        valA = a.expiry ? new Date(a.expiry).getTime() || 0 : 0;
        valB = b.expiry ? new Date(b.expiry).getTime() || 0 : 0;
      } else if (sortField === 'dataUsedGB') {
        valA = a.dataUsedGB || 0;
        valB = b.dataUsedGB || 0;
      } else if (sortField === 'status') {
        const getStatusVal = (u: RadiusUser) => {
          if (!u) return '9_unknown';
          if (u.status === 'Disabled') return '5_disabled';
          if (u.status === 'Terminated') return '6_terminated';
          if (u.status === 'Expired') return '4_expired';
          if (!u.online && u.status === 'Active') return '2_offline';
          if (u.online) return '1_active';
          return (u.status || '').toLowerCase();
        };
        valA = getStatusVal(a);
        valB = getStatusVal(b);
      }

      if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
      if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
    return copy;
  }, [filteredUsers, sortField, sortDirection]);

  // Paginated Users
  const totalPages = Math.ceil(sortedUsers.length / pageSize) || 1;
  const paginatedUsers = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sortedUsers.slice(start, start + pageSize);
  }, [sortedUsers, currentPage]);

  const visibleUserCount = useProgressiveCount(paginatedUsers.length, {
    initial: 20,
    chunk: 40,
    resetKey: `${searchQuery}|${statusFilter}|${packageFilter}|${reminderDays}|${sortField}|${sortDirection}|${currentPage}|${pageSize}|${paginatedUsers.length}`,
  });

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // Selection handlers
  const toggleSelectUser = (id: string) => {
    setSelectedUserIds(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedUserIds.length === paginatedUsers.length && paginatedUsers.length > 0) {
      setSelectedUserIds([]);
    } else {
      setSelectedUserIds(paginatedUsers.map(u => u.id));
    }
  };

  // Smooth scroll helper
  const scrollToTable = () => {
    const el = document.getElementById('vertix-users-table');
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  };

  // CSV Export handler
  const handleExportCSV = () => {
    if (sortedUsers.length === 0) {
      addToast('No subscribers to export.', 'error');
      return;
    }
    const headers = ['ID', 'Username', 'Full Name', 'Mobile', 'Package', 'Session Duration', 'Online', 'IP Address', 'Expiry Date', 'Data Used (GB)', 'Balance'];
    const rows = sortedUsers.map(u => {
      let duration = 'Offline';
      if (u.online) {
        duration = getStaticSessionDuration(u.onlineSince, u.id);
      }
      return [
        u.id,
        u.username,
        `"${u.name.replace(/"/g, '""')}"`,
        u.mobile,
        `"${u.package}"`,
        duration,
        u.online ? 'Online' : 'Offline',
        u.ip || 'N/A',
        u.expiry,
        u.dataUsedGB,
        u.balance,
      ];
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `vertix_subscribers_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    addToast(`Exported ${sortedUsers.length} subscribers to CSV!`, 'success');
  };

  // Open Renew Modal
  const openRenew = (user: RadiusUser) => {
    setRenewTargetUser(user);
    setRenewPackage(user.package);
    setRenewMonths(1);
    setShowRenewModal(true);
    setOpenActionUserId(null);
  };

  // Confirm Renew
  const handleConfirmRenew = async () => {
    if (!renewTargetUser) return;
    try {
      const res = await store.renewUser(renewTargetUser.id, renewPackage, renewMonths);
      addToast(`Renewed ${renewTargetUser.username} (+${renewMonths} mo)! Expiry: ${res.newExpiry}`, 'success');
      setShowRenewModal(false);
      setRenewTargetUser(null);
    } catch (err: any) {
      addToast(formatRadiusError(err), 'error');
    }
  };

  // Open Edit Modal
  const openEdit = (user: RadiusUser) => {
    setEditTargetUser(user);
    setEditName(user.name);
    setEditMobile(user.mobile);
    setEditPackage(user.package);
    setEditManagerId('');
    setShowEditUserModal(true);
    setOpenActionUserId(null);
  };

  // Confirm Edit
  const handleConfirmEdit = async () => {
    if (!editTargetUser) return;
    try {
      await store.updateUser(editTargetUser.id, {
        name: editName.trim(),
        mobile: editMobile.trim(),
        package: editPackage,
      });
      addToast(`Updated subscriber ${editTargetUser.username}`, 'success');
      setShowEditUserModal(false);
      setEditTargetUser(null);
    } catch (err: any) {
      addToast(formatRadiusError(err), 'error');
    }
  };

  // Open Delete Modal
  const openDelete = (user: RadiusUser) => {
    setDeleteTargetUser(user);
    setShowDeleteModal(true);
    setOpenActionUserId(null);
  };

  // Confirm Delete
  const handleConfirmDelete = async () => {
    if (!deleteTargetUser) return;
    try {
      await store.deleteUser(deleteTargetUser.id);
      setSelectedUserIds(prev => prev.filter(id => id !== deleteTargetUser.id));
      addToast(`Deleted subscriber ${deleteTargetUser.username}`, 'info');
      setShowDeleteModal(false);
      setDeleteTargetUser(null);
    } catch (err: any) {
      addToast(formatRadiusError(err), 'error');
    }
  };

  // Submit Add User
  const handleAddUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanUsername = newUsername.trim().toLowerCase();
    if (!cleanUsername) {
      setAddFormError('Username is required.');
      return;
    }
    const alreadyExists = (store.users || []).some(
      u => u && u.username && u.username.trim().toLowerCase() === cleanUsername
    );
    if (alreadyExists) {
      const err = `Username "${newUsername.trim()}" is already created! Duplicate usernames are strictly not allowed.`;
      setAddFormError(err);
      addToast(err, 'error');
      return;
    }
    if (!newName.trim()) {
      setAddFormError('Full Name is required.');
      return;
    }
    if (!newMobile.trim()) {
      setAddFormError('Mobile number is required.');
      return;
    }

    try {
      const created = await store.addUser({
        username: newUsername,
        name: newName,
        mobile: newMobile,
        package: newPackage,
        months: Number(newMonths) || 1,
        password: newPassword,
      });
      addToast(`Subscribed ${created.username} successfully!`, 'success');
      setShowAddUserModal(false);
      // Reset form
      setNewUsername('');
      setNewName('');
      setNewMobile('');
      setNewMonths(1);
      setNewManagerId('');
    } catch (err: any) {
      setAddFormError(formatRadiusError(err));
    }
  };

  // Bulk Renew Submit
  const handleBulkRenewSubmit = async () => {
    try {
      await store.bulkRenew(selectedUserIds, renewPackage, renewMonths);
      addToast(`Bulk renewed ${selectedUserIds.length} subscribers!`, 'success');
      setShowBulkRenewModal(false);
      setSelectedUserIds([]);
    } catch (err: any) {
      addToast(formatRadiusError(err), 'error');
    }
  };

  // Bulk Delete Submit
  const handleBulkDeleteSubmit = async () => {
    try {
      await store.bulkDelete(selectedUserIds);
      addToast(`Deleted ${selectedUserIds.length} subscribers.`, 'info');
      setShowBulkDeleteModal(false);
      setSelectedUserIds([]);
    } catch (err: any) {
      addToast(formatRadiusError(err), 'error');
    }
  };

  // Bulk Disable
  const handleBulkDisable = async () => {
    try {
      await store.bulkDisable(selectedUserIds);
      addToast(`Disabled ${selectedUserIds.length} subscribers.`, 'info');
      setSelectedUserIds([]);
    } catch (err: any) {
      addToast(formatRadiusError(err), 'error');
    }
  };

  // Transfer submit
  const handleTransferSubmit = async () => {
    const amt = Number(transferAmount) || 0;
    try {
      await store.addPayment({
        userId: 'transfer-out',
        username: transferRecipient,
        amount: amt,
        type: 'Transfer',
        method: 'Online',
        date: getRelativeDate(0),
        note: `Balance transfer to ${transferRecipient}`,
      });
      setTransferSuccess(true);
      addToast(`Transferred ${currencySymbol}${amt} successfully!`, 'success');
    } catch (err: any) {
      addToast(formatRadiusError(err), 'error');
    }
  };

  // Request submit
  const handleRequestSubmit = async () => {
    const amt = Number(requestAmount) || 0;
    try {
      await store.addPayment({
        userId: 'request-in',
        username: requestFrom,
        amount: amt,
        type: 'Request',
        method: 'Online',
        date: getRelativeDate(0),
        note: `Dispatched payment request to ${requestFrom}`,
      });
      setRequestSuccess(true);
      addToast(`Payment request for ${currencySymbol}${amt} dispatched!`, 'success');
    } catch (err: any) {
      addToast(formatRadiusError(err), 'error');
    }
  };

  // Verify password inline for restored GTS session
  const handleVerifyPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser?.uid) {
      setVerifyPasswordError('No active GTS user session.');
      return;
    }
    if (!verifyPassword) {
      setVerifyPasswordError('Please enter your password.');
      return;
    }
    setIsVerifyingPassword(true);
    setVerifyPasswordError('');
    try {
      await radiusApi.auth.session({ uid: currentUser.uid, password: verifyPassword }, 5000);
      setVerifyPassword('');
      await store.refreshAll(true);
      addToast('Radius session unlocked.', 'success');
    } catch (err: any) {
      const msg = formatRadiusError(err);
      setVerifyPasswordError(msg);
      addToast(msg, 'error');
    } finally {
      setIsVerifyingPassword(false);
    }
  };

  if (isBulkRenewPage) {
    return (
      <SkVariantProvider variant="flat">
        <BulkRenewView
          initialSelectedUserIds={selectedUserIds}
          isDarkMode={isDarkMode}
          onBack={() => navigate('/greenradius')}
          addToast={addToast}
        />
      </SkVariantProvider>
    );
  }

  if (isSettingsPage) {
    return (
      <SkVariantProvider variant="flat">
        <SettingsView
          store={store}
          isDarkMode={isDarkMode}
          setIsDarkMode={setIsDarkMode}
          currency={currency}
          setCurrency={setCurrency}
          addToast={addToast}
          onBack={() => {
            setActiveView('Dashboard');
            setStatusFilter('All');
            setPackageFilter(null);
            navigate('/greenradius');
          }}
          isFullPage={true}
        />
      </SkVariantProvider>
    );
  }

  if (liveUserId) {
    const liveUser = store.users.find(
      u => u && (u.id === liveUserId || (u.username || '').toLowerCase() === (liveUserId || '').toLowerCase())
    );
    if (liveUser) {
      return (
        <SkVariantProvider variant="flat">
          <UserLiveView
            user={liveUser}
            isDarkMode={isDarkMode}
            onBack={() => navigate('/greenradius')}
            onDisconnect={async () => {
              try {
                await store.disconnectUser(liveUser.id);
                addToast(`Disconnected ${liveUser.username}`, 'info');
              } catch (err: any) {
                addToast(formatRadiusError(err), 'error');
              }
            }}
            addToast={addToast}
          />
        </SkVariantProvider>
      );
    }
    return (
      <div
        className={`min-h-screen flex flex-col items-center justify-center p-6 ${
          isDarkMode ? 'bg-[#0f131a] text-white' : 'bg-[#eef3f1] text-slate-950'
        }`}
      >
        <div
          className={`max-w-md w-full p-6 sm:p-8 rounded-2xl border text-center shadow-lg ${
            isDarkMode ? 'bg-[#161b24] border-[#2d3648]' : 'bg-white border-slate-300'
          }`}
        >
          <div className="w-14 h-14 rounded-2xl bg-rose-500/15 border border-rose-500/35 text-rose-600 dark:text-rose-400 flex items-center justify-center mx-auto mb-4">
            <UserX className="w-7 h-7" />
          </div>
          <h2 className="text-xl font-black mb-1 text-slate-950 dark:text-white">Subscriber Not Found</h2>
          <p className="text-xs text-slate-700 dark:text-slate-200 mb-6 font-semibold">
            No subscriber with ID or username &quot;{liveUserId}&quot; exists in the subscriber database.
          </p>
          <button
            onClick={() => navigate('/greenradius')}
            className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm cursor-pointer shadow-sm transition-colors"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <SkVariantProvider variant="flat">
    <div
      className={`vertix-root fixed inset-0 z-50 h-[100dvh] max-h-[100dvh] h-dvh-fallback w-full flex items-center justify-center p-0 overflow-hidden font-sans transition-colors duration-200 ${
        isDarkMode ? 'bg-[#0f131a] text-white' : 'bg-[#eef3f1] text-slate-950'
      }`}
    >
      <style>{`
        .vertix-root {
          color-scheme: ${isDarkMode ? 'dark' : 'light'};
          font-family: 'Plus Jakarta Sans', 'Inter', system-ui, -apple-system, sans-serif;
          -webkit-font-smoothing: ${isDarkMode ? 'antialiased' : 'subpixel-antialiased'};
          -moz-osx-font-smoothing: ${isDarkMode ? 'grayscale' : 'auto'};
          text-rendering: optimizeLegibility;
        }
        .vertix-root [data-font-lexend="true"],
        .vertix-root .font-lexend {
          font-family: 'Lexend', system-ui, -apple-system, sans-serif;
        }
        .vertix-root .font-mono, .vertix-root .font-mono * {
          font-family: 'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
          font-variant-numeric: tabular-nums;
        }
        .vertix-root .font-serif, .vertix-root .font-serif * {
          font-family: ui-serif, Georgia, Cambria, "Times New Roman", Times, serif;
        }
        .vertix-dashboard-scroll,
        .vertix-root select,
        .vertix-root option,
        .vertix-root input,
        .vertix-root textarea {
          color-scheme: inherit;
        }
        .vertix-dashboard-scroll {
          -webkit-overflow-scrolling: touch;
          overscroll-behavior-y: contain;
          touch-action: pan-x pan-y;
        }
        .vertix-scroll-x {
          -webkit-overflow-scrolling: touch;
          overscroll-behavior-x: contain;
          touch-action: pan-x pan-y;
        }
        .vertix-scroll-xy {
          -webkit-overflow-scrolling: touch;
          overscroll-behavior-x: contain;
          touch-action: pan-x pan-y;
        }
        .vertix-dashboard-scroll::-webkit-scrollbar {
          width: 5px;
          height: 5px;
        }
        .vertix-dashboard-scroll::-webkit-scrollbar-track {
          background: transparent;
        }
        .vertix-dashboard-scroll::-webkit-scrollbar-thumb {
          background: ${isDarkMode ? '#475569' : '#94a3b8'};
          border-radius: 9999px;
        }
        .no-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .no-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
        .dark .vertix-root select,
        .dark .vertix-root select option {
          background-color: #10141b !important;
          color: #ffffff !important;
        }
        .vertix-root select option {
          padding: 8px 12px;
        }
      `}</style>

      {/* FLOATING TOASTS */}
      <div className="fixed bottom-4 right-4 z-[999] flex flex-col gap-2 pointer-events-none">
        <AnimatePresence>
          {toasts.map(t => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: 15, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.95 }}
              className={`px-4 py-2.5 rounded-2xl shadow-xl border text-xs font-bold flex items-center gap-2 pointer-events-auto ${
                t.type === 'success'
                  ? 'bg-emerald-950 border-emerald-500/70 text-emerald-100'
                  : t.type === 'error'
                  ? 'bg-rose-950 border-rose-500/70 text-rose-100'
                  : 'bg-[#161b24] border-[#333d52] text-white'
              }`}
            >
              {t.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              ) : t.type === 'error' ? (
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              ) : (
                <Info className="w-4 h-4 text-blue-400 shrink-0" />
              )}
              <span>{t.message}</span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      <div
        className={`h-full w-full max-w-full flex flex-col overflow-hidden border-0 shadow-none transition-colors duration-200 relative ${
          isDarkMode
            ? 'bg-[#0f131a] text-white'
            : 'bg-[#eef3f1] text-slate-950'
        }`}
      >
        {/* TOP OS WINDOW HEADER */}
        <header className="h-14 sm:h-16 shrink-0 px-2.5 sm:px-5 lg:px-6 flex items-center justify-between gap-2 border-b border-slate-300 dark:border-[#2d3648] bg-white dark:bg-[#161b24] select-none z-30 w-full min-w-0 relative">
          {/* Left: Brand Logo & Back to GTS Button */}
          <div className="flex items-center gap-2 sm:gap-3 min-w-0 shrink">
            <div className="flex items-center gap-2 sm:gap-2.5 min-w-0 shrink select-none">
              <div className="relative shrink-0 group">
                <div className="relative w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-slate-950 dark:bg-[#10141b] flex items-center justify-center border border-emerald-500/40 shadow-sm">
                  <span className="text-white font-black text-xs sm:text-sm tracking-tighter italic leading-none">
                    G<span className="text-emerald-400">TS</span>
                  </span>
                </div>
              </div>
              <div className="flex flex-col min-w-0 max-w-[110px] xs:max-w-[155px] sm:max-w-none">
                <span className="font-black text-xs sm:text-base tracking-tight text-slate-950 dark:text-white leading-none truncate">
                  Green Tech Services
                </span>
                <div className="hidden sm:flex items-center gap-1.5 mt-1">
                  <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
                  <span className="text-[9.5px] font-extrabold text-slate-700 dark:text-slate-200 uppercase tracking-wider leading-none truncate">
                    POWERED BY GREEN NET
                  </span>
                </div>
              </div>
            </div>

              {/* ROUNDED BACK TO GTS BUTTON */}
              <motion.button
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.96 }}
                onClick={onBackToMain}
                className="flex items-center gap-1 sm:gap-1.5 pl-1.5 sm:pl-2 pr-2.5 sm:pr-3 py-1 sm:py-1.5 rounded-full bg-gradient-to-r from-[#1f6b4f] via-[#14532d] to-[#0b3d2e] hover:from-[#18553f] hover:to-[#0f4424] text-white shadow-sm border border-emerald-500/50 text-[11px] sm:text-xs font-bold tracking-wide transition-colors cursor-pointer group shrink-0 whitespace-nowrap"
                title="Return to GTS"
              >
                <span className="w-4 h-4 rounded-full bg-white/25 flex items-center justify-center">
                  <ChevronLeft className="w-3 h-3 stroke-[2.5]" />
                </span>
                <span>Back to GTS</span>
              </motion.button>
            </div>

          {/* Center: Top Capsule Nav Tabs */}
          <div
            className={`hidden xl:flex items-center p-1 rounded-full border shadow-xs shrink-0 ${
              isDarkMode ? 'bg-[#10141b] border-[#2d3648]' : 'bg-slate-100 border-slate-300'
            }`}
          >
            {topTabs.map(tab => {
              const isActive = activeView === tab;
              return (
                <button
                  key={tab}
                  onClick={() => handleViewChange(tab)}
                  className={`px-3.5 sm:px-4 py-1.5 text-xs font-extrabold rounded-full transition-colors duration-150 cursor-pointer whitespace-nowrap shrink-0 ${
                    isActive
                      ? isDarkMode
                        ? 'bg-white text-slate-950 shadow-sm'
                        : 'bg-slate-950 text-white shadow-sm'
                      : isDarkMode
                      ? 'text-slate-100 hover:text-white hover:bg-[#1e2636]'
                      : 'text-slate-800 hover:text-slate-950 hover:bg-white'
                  }`}
                >
                  {tab}
                </button>
              );
            })}
          </div>

          {/* Right: Actions & User Avatar */}
          <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0 relative">
            <button
              onClick={() => {
                const input = document.getElementById('vertix-table-search');
                if (input) {
                  input.scrollIntoView({ behavior: 'smooth', block: 'center' });
                  input.focus();
                }
              }}
              className={`w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center transition-colors cursor-pointer shrink-0 ${
                isDarkMode
                  ? 'bg-[#10141b] text-white hover:bg-[#1e2636] border border-[#333d52]'
                  : 'bg-slate-100 text-slate-900 hover:text-slate-950 hover:bg-slate-200 border border-slate-300'
              }`}
              title="Search Subscribers"
            >
              <Search className="w-3.5 h-3.5" />
            </button>

            {/* Notification Button & Flyout */}
            <div className="relative">
              <button
                onClick={() => {
                  setShowNotifications(!showNotifications);
                  if (showProfileMenu) setShowProfileMenu(false);
                }}
                className={`w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center relative transition-colors cursor-pointer shrink-0 ${
                  isDarkMode
                    ? 'bg-[#10141b] text-white hover:bg-[#1e2636] border border-[#333d52]'
                    : 'bg-slate-100 text-slate-900 hover:text-slate-950 hover:bg-slate-200 border border-slate-300'
                }`}
                title="Radius Alerts"
              >
                <Bell className="w-3.5 h-3.5" />
                {store.realNotifications.length > 0 && !store.state.readNotificationIds.includes('all-read') && (
                  <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[#ff3b69] ring-2 ring-white dark:ring-[#161b24]" />
                )}
              </button>

              {/* Notifications Flyout */}
              <AnimatePresence>
                {showNotifications && (
                  <>
                    {/* Backdrop for click outside */}
                    <div 
                      className="fixed inset-0 z-40" 
                      onClick={() => setShowNotifications(false)} 
                    />

                    <motion.div
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 8, scale: 0.95 }}
                      className={`fixed inset-x-3 top-16 sm:inset-x-auto sm:absolute sm:right-0 sm:top-full sm:mt-2.5 sm:w-96 max-w-[calc(100vw-1.5rem)] rounded-2xl shadow-2xl border p-4 z-50 max-h-[80dvh] flex flex-col ${
                        isDarkMode
                          ? 'bg-[#161b24] border-[#2d3648] text-white'
                          : 'bg-white border-slate-300 text-slate-950'
                      }`}
                    >
                      <div className="flex items-center justify-between pb-2.5 border-b border-slate-200 dark:border-[#2d3648] shrink-0">
                        <span className="font-extrabold text-xs sm:text-sm flex items-center gap-1.5 text-slate-950 dark:text-white">
                          <Bell className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
                          <span>Radius Alerts & Grace</span>
                        </span>
                        <button
                          onClick={() => {
                            store.markAllNotificationsRead();
                            addToast('All alerts marked as read', 'info');
                          }}
                          className="text-xs text-emerald-700 dark:text-emerald-300 hover:underline font-bold cursor-pointer"
                        >
                          Mark all read
                        </button>
                      </div>
                      <div className="mt-2.5 space-y-2 overflow-y-auto pr-1 flex-1 max-h-72">
                        {store.realNotifications.length === 0 || store.state.readNotificationIds.includes('all-read') ? (
                          <p className="text-xs text-slate-700 dark:text-slate-200 py-6 text-center font-semibold">
                            All systems normal. No active alerts.
                          </p>
                        ) : (
                          store.realNotifications.map(n => (
                            <div
                              key={n.id}
                              className={`p-3 rounded-xl border text-xs transition-colors ${
                                n.type === 'urgent'
                                  ? 'bg-rose-50 dark:bg-rose-950/50 border-rose-300 dark:border-rose-700'
                                  : n.type === 'warning'
                                  ? 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-300 dark:border-emerald-700'
                                  : 'bg-slate-50 dark:bg-[#10141b] border-slate-200 dark:border-[#2d3648]'
                              }`}
                            >
                              <p className="font-bold flex items-center gap-1.5 text-slate-950 dark:text-white">
                                {n.type === 'urgent' ? (
                                  <UserX className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                                ) : n.type === 'warning' ? (
                                  <AlertCircle className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                                ) : (
                                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                )}
                                <span>{n.title}</span>
                              </p>
                              <p className="text-slate-800 dark:text-slate-100 mt-1 leading-relaxed">{n.desc}</p>
                              <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 mt-1.5 block">{n.time}</span>
                            </div>
                          ))
                        )}
                      </div>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>

            {/* Theme Toggle Button */}
            <button
              type="button"
              onClick={() => setIsDarkMode(!isDarkMode)}
              className={`w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center transition-colors cursor-pointer ${
                isDarkMode
                  ? 'bg-[#10141b] text-amber-300 hover:bg-[#1e2636] border border-[#333d52]'
                  : 'bg-slate-100 text-slate-900 hover:text-slate-950 hover:bg-slate-200 border border-slate-300'
              }`}
              title={isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
              aria-label={isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            >
              {isDarkMode ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
            </button>

            {/* Info Button */}
            <button
              onClick={() => setShowInfoModal(true)}
              className={`w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center transition-colors cursor-pointer ${
                isDarkMode
                  ? 'bg-[#10141b] text-white hover:bg-[#1e2636] border border-[#333d52]'
                  : 'bg-slate-100 text-slate-900 hover:text-slate-950 hover:bg-slate-200 border border-slate-300'
              }`}
              title="System Information & Engine Architecture"
            >
              <Info className="w-3.5 h-3.5" />
            </button>

            {/* Real Logged-In User Profile Pill & Dropdown Menu */}
            <div className="relative">
              <button
                onClick={() => {
                  setShowProfileMenu(!showProfileMenu);
                  if (showNotifications) setShowNotifications(false);
                }}
                className={`flex items-center gap-1.5 sm:gap-2 pl-1 pr-2 sm:pr-3 py-1 rounded-full border shadow-xs cursor-pointer transition-colors shrink-0 ${
                  isDarkMode
                    ? 'bg-[#10141b] border-[#333d52] hover:bg-[#1e2636]'
                    : 'bg-slate-100 border-slate-300 hover:bg-slate-200/70'
                }`}
                title="Account Details & Profile Menu"
              >
                <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full overflow-hidden border border-emerald-500/50 bg-emerald-950 shrink-0 flex items-center justify-center">
                  <img 
                    src={userAvatarUrl} 
                    alt={userDisplayName} 
                    width={32}
                    height={32}
                    className="w-full h-full object-cover" 
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = 'none';
                    }}
                  />
                </div>
                <div className="text-left hidden md:block max-w-[140px] truncate">
                  <p className="text-xs font-extrabold leading-tight text-slate-950 dark:text-white truncate">
                    {userDisplayName}
                  </p>
                  <p className="text-[10px] font-bold text-emerald-700 dark:text-emerald-300 leading-tight truncate">
                    {userRoleDisplay} • {userLineCode}
                  </p>
                </div>
                <ChevronDown className={`w-3 h-3 text-slate-700 dark:text-slate-200 transition-transform duration-200 ${showProfileMenu ? 'rotate-180' : ''}`} />
              </button>

              {/* Profile Dropdown Menu */}
              <AnimatePresence>
                {showProfileMenu && (
                  <>
                    <div 
                      className="fixed inset-0 z-40" 
                      onClick={() => setShowProfileMenu(false)} 
                    />

                    <motion.div
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 8, scale: 0.95 }}
                      transition={{ duration: 0.18, ease: 'easeOut' }}
                      className={`fixed inset-x-3 top-16 sm:inset-x-auto sm:absolute sm:right-0 sm:top-full sm:mt-2.5 sm:w-80 max-w-[calc(100vw-1.5rem)] rounded-2xl shadow-2xl border p-4 z-50 overflow-hidden ${
                        isDarkMode
                          ? 'bg-[#161b24] border-[#2d3648] text-white'
                          : 'bg-white border-slate-300 text-slate-950'
                      }`}
                    >
                      {/* Top Banner & Avatar Header */}
                      <div className="relative pb-3.5 mb-3.5 border-b border-slate-200 dark:border-[#2d3648] flex items-center gap-3">
                        <div className="w-12 h-12 rounded-2xl overflow-hidden border-2 border-emerald-500/50 shadow-md shrink-0 bg-slate-900 flex items-center justify-center">
                          <img 
                            src={userAvatarUrl} 
                            alt={userDisplayName} 
                            width={48}
                            height={48}
                            className="w-full h-full object-cover" 
                          />
                        </div>
                        <div className="min-w-0 flex-1">
                          <h4 className="text-sm font-black text-slate-950 dark:text-white truncate">
                            {userDisplayName}
                          </h4>
                          <p className="text-xs font-semibold text-slate-700 dark:text-slate-200 truncate">
                            {userUsername}
                          </p>
                          <div className="flex items-center gap-1.5 mt-1">
                            <span className="inline-block text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border border-emerald-500/35">
                              {userRoleDisplay}
                            </span>
                            {userLineCode && (
                              <span className="inline-block text-[10px] font-bold text-slate-700 dark:text-slate-200">
                                Line: {userLineCode}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Details List */}
                      <div className="space-y-2 text-xs font-semibold mb-3.5">
                        <div className="flex items-center justify-between p-2 rounded-xl bg-slate-100 dark:bg-[#10141b] text-slate-900 dark:text-white border border-slate-200 dark:border-[#2d3648]">
                          <span className="text-slate-700 dark:text-slate-300 font-semibold">Email:</span>
                          <span className="font-bold text-slate-950 dark:text-white truncate max-w-[170px]">{userEmail}</span>
                        </div>
                        <div className="flex items-center justify-between p-2 rounded-xl bg-slate-100 dark:bg-[#10141b] text-slate-900 dark:text-white border border-slate-200 dark:border-[#2d3648]">
                          <span className="text-slate-700 dark:text-slate-300 font-semibold">Session:</span>
                          <span className="font-bold text-emerald-700 dark:text-emerald-300 flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full bg-emerald-500" />
                            Active Radius Core
                          </span>
                        </div>
                      </div>

                      {/* Action Menu Buttons */}
                      <div className="space-y-1.5 pt-1 border-t border-slate-200 dark:border-[#2d3648]">
                        <button
                          onClick={() => {
                            setShowProfileMenu(false);
                            setActiveView('Settings');
                            navigate('/greenradius/settings');
                          }}
                          className="w-full px-3 py-2 rounded-xl flex items-center justify-between text-xs font-bold text-slate-900 dark:text-slate-100 hover:bg-emerald-500/15 hover:text-emerald-700 dark:hover:text-emerald-300 transition-colors cursor-pointer"
                        >
                          <div className="flex items-center gap-2">
                            <Settings className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                            <span>Radius Engine Settings</span>
                          </div>
                          <ChevronRight className="w-3.5 h-3.5 text-slate-600 dark:text-slate-300" />
                        </button>

                        <button
                          onClick={() => {
                            setShowProfileMenu(false);
                            onBackToMain();
                          }}
                          className="w-full px-3 py-2.5 rounded-xl flex items-center justify-between text-xs font-bold bg-gradient-to-r from-[#1f6b4f] to-[#14532d] text-white hover:from-[#18553f] hover:to-[#0f4424] transition-all shadow-sm cursor-pointer"
                        >
                          <div className="flex items-center gap-2">
                            <ChevronLeft className="w-4 h-4" />
                            <span>Return to GTS App</span>
                          </div>
                        </button>
                      </div>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>
          </div>
        </header>

        {/* TABLET & ANDROID HORIZONTAL TOUCH NAVIGATION BAR (< lg) */}
        <nav
          aria-label="Radius Sections"
          className={`lg:hidden shrink-0 border-b px-2.5 sm:px-4 py-1.5 flex items-center gap-1.5 overflow-x-auto no-scrollbar vertix-scroll-x select-none z-20 ${
            isDarkMode ? 'bg-[#161b24] border-[#2d3648]' : 'bg-white border-slate-300'
          }`}
        >
          {dockItems.map(item => {
            const IconComp = item.icon;
            const isActive = activeView === item.id;
            const shortTitle =
              item.id === 'Dashboard'
                ? 'Overview'
                : item.id === 'Managers'
                ? 'Dealers'
                : item.id;
            return (
              <button
                key={`mob-nav-${item.id}`}
                type="button"
                onClick={() => handleViewChange(item.id)}
                className={`px-3 py-1.5 rounded-full text-xs font-bold flex items-center gap-1.5 whitespace-nowrap shrink-0 border transition-colors cursor-pointer touch-manipulation ${
                  isActive
                    ? 'bg-gradient-to-r from-[#1f6b4f] to-[#14532d] text-white border-emerald-500 shadow-xs'
                    : isDarkMode
                    ? 'bg-[#10141b] border-[#333d52] text-slate-100 hover:bg-[#1e2636]'
                    : 'bg-slate-100 border-slate-300 text-slate-900 hover:bg-slate-200'
                }`}
              >
                <IconComp className="w-3.5 h-3.5 shrink-0" />
                <span>{shortTitle}</span>
                {item.badge !== undefined && Number(item.badge) > 0 && (
                  <span
                    className={`px-1.5 py-0.5 rounded-full text-[10px] font-black leading-none ${
                      isActive
                        ? 'bg-white/25 text-white'
                        : isDarkMode
                        ? 'bg-[#242c3d] text-white'
                        : 'bg-slate-200 text-slate-900'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* MAIN BODY: LEFT DOCK + CONTENT */}
        <div className="flex-1 min-h-0 flex overflow-hidden p-2 sm:p-3.5 lg:p-4 gap-3 lg:gap-4 w-full min-w-0 max-w-full">
          {/* LEFT FLOATING ICON DOCK (Original Compact Rail) */}
          <aside
            className={`hidden lg:flex flex-col items-center justify-between w-14 shrink-0 rounded-3xl border shadow-sm py-2.5 px-1.5 select-none transition-colors ${
              isDarkMode
                ? 'bg-[#161b24] border-[#2d3648] text-white'
                : 'bg-white border-slate-300 text-slate-900'
            }`}
          >
            <div className="flex-1 min-h-0 w-full overflow-y-auto no-scrollbar flex flex-col items-center gap-1">
              {dockItems.map(item => {
                const IconComp = item.icon;
                const isActive = activeView === item.id;
                const hasBadge = item.badge !== undefined && Number(item.badge) > 0;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleViewChange(item.id)}
                    onMouseEnter={(e) => {
                      const rect = e.currentTarget.getBoundingClientRect();
                      setHoveredDockTooltip({
                        title: item.title,
                        description: item.description,
                        badge: item.badge,
                        badgeTone: item.badgeTone,
                        top: rect.top + rect.height / 2,
                        left: rect.right + 12,
                      });
                    }}
                    onMouseLeave={() => setHoveredDockTooltip(null)}
                    className={`w-10 h-10 shrink-0 rounded-2xl flex items-center justify-center relative transition-colors duration-150 cursor-pointer ${
                      isActive
                        ? 'bg-gradient-to-br from-[#1f6b4f] to-[#14532d] text-white shadow-md shadow-emerald-950/30'
                        : isDarkMode
                        ? 'text-slate-100 hover:bg-[#222a3a] hover:text-white'
                        : 'text-slate-800 hover:bg-slate-100 hover:text-slate-950'
                    }`}
                  >
                    <IconComp className="w-4 h-4 shrink-0" />
                    {hasBadge && !isActive && (
                      <span
                        className={`absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full ${
                          item.badgeTone === 'rose'
                            ? 'bg-rose-500'
                            : item.badgeTone === 'amber'
                            ? 'bg-amber-500'
                            : item.badgeTone === 'emerald'
                            ? 'bg-emerald-500'
                            : 'bg-slate-400'
                        }`}
                      />
                    )}
                  </button>
                );
              })}
            </div>

            <div className={`w-full pt-2 mt-1.5 border-t flex flex-col items-center gap-1 shrink-0 ${isDarkMode ? 'border-[#2d3648]' : 'border-slate-300'}`}>
              <button
                type="button"
                onClick={() => setShowHelpModal(true)}
                onMouseEnter={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  setHoveredDockTooltip({
                    title: 'Help & Shortcuts',
                    description: 'Keyboard shortcuts & ledger guide',
                    top: rect.top + rect.height / 2,
                    left: rect.right + 12,
                  });
                }}
                onMouseLeave={() => setHoveredDockTooltip(null)}
                className={`w-9 h-9 rounded-xl flex items-center justify-center transition-colors cursor-pointer ${
                  isDarkMode ? 'text-emerald-300 hover:bg-[#222a3a]' : 'text-emerald-700 hover:bg-emerald-100'
                }`}
              >
                <HelpCircle className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={onBackToMain}
                onMouseEnter={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  setHoveredDockTooltip({
                    title: 'Exit to GTS App',
                    description: 'Return to main GTS dashboard',
                    top: rect.top + rect.height / 2,
                    left: rect.right + 12,
                  });
                }}
                onMouseLeave={() => setHoveredDockTooltip(null)}
                className={`w-9 h-9 rounded-xl flex items-center justify-center transition-colors cursor-pointer ${
                  isDarkMode ? 'text-rose-400 hover:bg-rose-950/60' : 'text-rose-700 hover:bg-rose-100'
                }`}
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </aside>

          {/* Floating Dock Hover Popover Tooltip (Never clipped by scroll) */}
          {hoveredDockTooltip && (
            <div
              style={{ top: `${hoveredDockTooltip.top}px`, left: `${hoveredDockTooltip.left}px` }}
              className={`fixed -translate-y-1/2 z-[120] pointer-events-none px-3 py-2 rounded-2xl border shadow-2xl min-w-[180px] max-w-[240px] ${
                isDarkMode
                  ? 'bg-[#161b24] border-[#333d52] text-white'
                  : 'bg-slate-950 border-slate-800 text-white'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-extrabold leading-tight text-white">{hoveredDockTooltip.title}</span>
                {hoveredDockTooltip.badge !== undefined && (
                  <span
                    className={`px-1.5 py-0.5 rounded-full text-[10px] font-black leading-none ${
                      hoveredDockTooltip.badgeTone === 'rose'
                        ? 'bg-rose-500/25 text-rose-200'
                        : hoveredDockTooltip.badgeTone === 'amber'
                        ? 'bg-amber-500/25 text-amber-200'
                        : hoveredDockTooltip.badgeTone === 'emerald'
                        ? 'bg-emerald-500/25 text-emerald-200'
                        : 'bg-white/20 text-white'
                    }`}
                  >
                    {hoveredDockTooltip.badge}
                  </span>
                )}
              </div>
              {hoveredDockTooltip.description && (
                <p className="text-[11px] font-medium text-slate-200 mt-0.5 leading-snug">{hoveredDockTooltip.description}</p>
              )}
            </div>
          )}

          {/* DASHBOARD CONTENT AREA */}
          <main
            className="flex-1 min-w-0 max-w-full flex flex-col h-full overflow-y-auto overflow-x-hidden pr-0.5 sm:pr-1.5 pb-10 space-y-3.5 sm:space-y-4 vertix-dashboard-scroll"
            style={{ paddingBottom: 'calc(2.5rem + env(safe-area-inset-bottom, 0px))' }}
          >
            {store.serviceUnavailable && (
              <div
                className={`w-full rounded-2xl border p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0 ${
                  isDarkMode
                    ? 'bg-rose-950/60 border-rose-500/60 text-rose-100'
                    : 'bg-rose-50 border-rose-300 text-rose-950'
                }`}
              >
                <div className="flex items-start gap-3 min-w-0">
                  <AlertCircle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    <h4 className="text-sm font-black tracking-tight">Radius service is not reachable</h4>
                    <p className="text-[11px] font-semibold opacity-80 break-all mt-0.5">
                      {store.serviceUnavailableReason || store.apiError || 'Unable to connect to the Radius backend service.'}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => store.refreshAll(true)}
                  className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs inline-flex items-center gap-1.5 shadow-sm cursor-pointer shrink-0 self-start sm:self-center"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${store.isLoading ? 'animate-spin' : ''}`} />
                  <span>Retry</span>
                </button>
              </div>
            )}

            {!store.serviceUnavailable && store.accessDenied && (
              <div
                className={`w-full rounded-2xl border p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0 ${
                  isDarkMode
                    ? 'bg-amber-950/50 border-amber-500/50 text-amber-100'
                    : 'bg-amber-50 border-amber-300 text-amber-950'
                }`}
              >
                <div className="flex items-start gap-3 min-w-0">
                  <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    <h4 className="text-sm font-black tracking-tight">No Green Radius access for this account</h4>
                    <p className="text-[11px] font-semibold opacity-85 mt-0.5">
                      {store.authError || 'Ask your line owner or super admin to grant Green Radius access.'}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={onBackToMain}
                  className="px-4 py-2 rounded-xl bg-slate-950 dark:bg-white text-white dark:text-slate-950 font-bold text-xs inline-flex items-center gap-1.5 shadow-sm cursor-pointer shrink-0 self-start sm:self-center"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  <span>Back to GTS</span>
                </button>
              </div>
            )}

            {!store.serviceUnavailable && !store.accessDenied && store.needsPasswordVerify && (
              <div
                className={`w-full rounded-2xl border p-3.5 sm:p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 shrink-0 ${
                  isDarkMode
                    ? 'bg-[#161b24] border-emerald-500/50 text-white'
                    : 'bg-white border-emerald-400 text-slate-950'
                }`}
              >
                <div className="min-w-0">
                  <h4 className="text-xs sm:text-sm font-extrabold tracking-tight">
                    Verify your password {currentUser?.username ? `(@${currentUser.username})` : ''}
                  </h4>
                  <p className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 mt-0.5">
                    Enter your GTS account password to establish your Green Radius API session.
                  </p>
                  {verifyPasswordError && (
                    <p className="text-[11px] font-bold text-rose-600 dark:text-rose-400 mt-1">
                      {verifyPasswordError}
                    </p>
                  )}
                </div>
                <form onSubmit={handleVerifyPassword} className="flex items-center gap-2 shrink-0">
                  <div className="relative">
                    <input
                      type={showVerifyPassword ? 'text' : 'password'}
                      value={verifyPassword}
                      onChange={e => setVerifyPassword(e.target.value)}
                      placeholder="Verify your password"
                      autoComplete="current-password"
                      className={`text-xs pl-3 pr-8 py-2 rounded-xl border outline-none font-semibold w-48 sm:w-56 ${
                        isDarkMode
                          ? 'bg-[#10141b] border-[#333d52] text-white placeholder-slate-400 focus:border-emerald-400'
                          : 'bg-slate-50 border-slate-300 text-slate-950 placeholder-slate-500 focus:border-emerald-600'
                      }`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowVerifyPassword(s => !s)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-800 dark:text-slate-300 dark:hover:text-white cursor-pointer"
                      aria-label={showVerifyPassword ? 'Hide password' : 'Show password'}
                    >
                      {showVerifyPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                  <button
                    type="submit"
                    disabled={isVerifyingPassword}
                    className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-bold text-xs shadow-sm cursor-pointer shrink-0"
                  >
                    {isVerifyingPassword ? 'Verifying...' : 'Verify'}
                  </button>
                </form>
              </div>
            )}


            {/* TOP MAIN GRID: COLUMN 1 (BALANCE CARD - VISIBLE IN EVERY VIEW!) + COLUMN 2 (15 LANDSCAPE STATS IN 3/3/3/3/3 ROWS) */}
            {showDashboardSkeleton ? (
              <SkVertixHeroGrid />
            ) : (
            <div 
              className="grid grid-cols-1 md:grid-cols-12 gap-3 sm:gap-3.5 lg:gap-4 items-stretch shrink-0 w-full min-w-0 h-auto lg:min-h-[380.833px] pt-[5px] pl-0 pr-[2px] sm:pr-[5px]"
            >
              {/* COLUMN 1 (md:col-span-5 lg:col-span-4): TOTAL BALANCE CARD (VISIBLE IN EVERY VIEW!) */}
              <div className="md:col-span-5 lg:col-span-4 flex flex-col gap-3.5 justify-between min-w-0">
                {/* Total Balance Card */}
                <div
                  className={`p-4 sm:p-5 rounded-2xl sm:rounded-3xl border shadow-sm flex-1 flex flex-col justify-between transition-colors min-w-0 ${
                    isDarkMode ? 'bg-[#161b24] border-[#2d3648] shadow-black/30' : 'bg-white border-slate-300'
                  }`}
                >
                  {/* Header: Label + Currency Select */}
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs sm:text-sm font-extrabold text-slate-900 dark:text-white">
                      Total Balance
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setLoanStep('check');
                          setShowLoanModal(true);
                        }}
                        className="px-2.5 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950 hover:bg-blue-200 dark:hover:bg-blue-900 text-blue-800 dark:text-blue-200 font-black text-[10.5px] uppercase tracking-wider border border-blue-300 dark:border-blue-500/40 transition-colors cursor-pointer shadow-xs flex items-center gap-1"
                        title="Check & Borrow Credit Loan"
                      >
                        <span>💳 Loan</span>
                      </button>
                      <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100 dark:bg-emerald-950 border border-emerald-300 dark:border-emerald-500/40 text-emerald-900 dark:text-emerald-200 font-extrabold text-xs shrink-0 whitespace-nowrap">
                        <span>🇵🇰</span>
                        <span>PKR (Rs.)</span>
                      </div>
                    </div>
                  </div>

                  {/* Balance Value */}
                  <div className="my-2 sm:my-2.5 min-w-0">
                    <h2 className="text-2xl sm:text-3xl xl:text-4xl font-black tracking-tight text-slate-950 dark:text-white tabular-nums truncate">
                      {formattedTotalBalance}
                    </h2>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                      <span className="inline-flex items-center gap-1 text-[11px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-900 dark:text-emerald-200 border border-emerald-300 dark:border-emerald-600">
                        ↑ 5%
                      </span>
                      <span className="text-xs font-bold text-slate-700 dark:text-slate-200">than last month</span>
                    </div>
                  </div>

                  {/* Actions: Transfer & Request */}
                  <div className="grid grid-cols-2 gap-2.5 my-2">
                    <button
                      onClick={() => setShowTransferModal(true)}
                      className={`py-2.5 sm:py-2 px-3 rounded-xl flex items-center justify-center gap-2 font-extrabold text-xs sm:text-sm transition-colors shadow-xs cursor-pointer touch-manipulation ${
                        isDarkMode
                          ? 'bg-white text-slate-950 hover:bg-slate-100'
                          : 'bg-slate-950 text-white hover:bg-slate-800'
                      }`}
                    >
                      <ArrowRightLeft className="w-3.5 h-3.5" />
                      <span>Transfer</span>
                    </button>
                    <button
                      onClick={() => setShowRequestModal(true)}
                      className={`py-2.5 sm:py-2 px-3 rounded-xl flex items-center justify-center gap-2 font-extrabold text-xs sm:text-sm transition-colors border cursor-pointer touch-manipulation ${
                        isDarkMode
                          ? 'bg-[#10141b] border-[#333d52] text-white hover:bg-[#1e2636]'
                          : 'bg-slate-50 border-slate-300 text-slate-950 hover:bg-slate-100'
                      }`}
                    >
                      <ArrowDownLeft className="w-3.5 h-3.5" />
                      <span>Request</span>
                    </button>
                  </div>

                  {/* Sub-Card: Monthly Spending Amount Section (Replaces Wallets USD/EUR/GBP) */}
                  <div
                    className={`mt-2 p-3 sm:p-4 rounded-xl border transition-colors min-w-0 ${
                      isDarkMode ? 'bg-[#10141b] border-[#2d3648]' : 'bg-slate-50 border-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 text-xs font-bold text-slate-900 dark:text-white mb-1.5 sm:mb-2">
                      <span className="font-extrabold text-slate-950 dark:text-white truncate">Today Spending Amount</span>
                      <span className="text-[10.5px] font-extrabold text-emerald-900 dark:text-emerald-200 bg-emerald-100 dark:bg-emerald-950 px-2 py-0.5 rounded-md border border-emerald-300 dark:border-emerald-600/50 shrink-0">
                        Utilized
                      </span>
                    </div>

                    <div className="my-1.5 sm:my-2 min-w-0">
                      <p className="text-xl sm:text-2xl xl:text-3xl font-black text-slate-950 dark:text-white tracking-tight tabular-nums truncate">
                        Rs. {todaySpendingAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </p>
                      <p className="text-[11.5px] font-semibold text-slate-700 dark:text-slate-200 mt-0.5 leading-snug">
                        Daily payment amount deducted from total balance today
                      </p>
                    </div>

                    {/* Striped Progress Bar */}
                    <div className="relative w-full h-3 rounded-full overflow-hidden bg-slate-200 dark:bg-slate-800 flex items-center my-2 sm:my-2.5">
                      <svg className="absolute w-full h-full inset-0 pointer-events-none">
                        <defs>
                          <pattern
                            id="diagonalHatchClean"
                            width="8"
                            height="8"
                            patternTransform="rotate(45 0 0)"
                            patternUnits="userSpaceOnUse"
                          >
                            <line
                              x1="0"
                              y1="0"
                              x2="0"
                              y2="8"
                              stroke={isDarkMode ? '#334155' : '#cbd5e1'}
                              strokeWidth="2.5"
                            />
                          </pattern>
                        </defs>
                        <rect width="100%" height="100%" fill="url(#diagonalHatchClean)" />
                      </svg>

                      <div
                        className="h-full bg-gradient-to-r from-emerald-600 to-teal-500 rounded-full relative z-10 shadow-xs"
                        style={{ width: '68%' }}
                      />
                    </div>

                    <div className="mt-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-xs font-bold">
                      <span className="text-slate-800 dark:text-slate-100">
                        Expiring Today: <span className="text-rose-700 dark:text-rose-400 font-black tabular-nums">{expiringTodayCount}</span>
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* COLUMN 2 (md:col-span-7 lg:col-span-8): 15 LANDSCAPE RADIUS STAT CARDS (3/3/3/3/3 ROWS) */}
              <div className="md:col-span-7 lg:col-span-8 min-w-0 flex flex-col justify-between">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 sm:gap-3 content-stretch min-w-0">
                  {/* Card 1: Active Users */}
                  <StatCard
                    label="Active Users"
                    value={store.stats.active}
                    pill={`${store.stats.total ? Math.round((store.stats.active / store.stats.total) * 100) : 0}%`}
                    icon={UserCheck}
                    tone="emerald"
                    isDarkMode={isDarkMode}
                    active={statusFilter === 'Active' && !packageFilter && activeView === 'Users'}
                    onClick={() => {
                      setPackageFilter(null);
                      setStatusFilter('Active');
                      setActiveView('Users');
                      setCurrentPage(1);
                      scrollToTable();
                    }}
                  />

                  {/* Card 2: Online Users */}
                  <StatCard
                    label="Online Users"
                    value={store.stats.online}
                    pill={`${store.stats.total ? Math.round((store.stats.online / store.stats.total) * 100) : 0}%`}
                    icon={Wifi}
                    tone="teal"
                    isDarkMode={isDarkMode}
                    active={statusFilter === 'Online' && !packageFilter && (activeView === 'Online' || activeView === 'Users')}
                    onClick={() => {
                      setPackageFilter(null);
                      setStatusFilter('Online');
                      setActiveView('Online');
                      setCurrentPage(1);
                      scrollToTable();
                    }}
                  />

                  {/* Card 3: Offline Users */}
                  <StatCard
                    label="Offline Users"
                    value={store.stats.offline}
                    pill={`${store.stats.total ? Math.round((store.stats.offline / store.stats.total) * 100) : 0}%`}
                    icon={WifiOff}
                    tone="slate"
                    isDarkMode={isDarkMode}
                    active={statusFilter === 'Offline' && !packageFilter && activeView === 'Users'}
                    onClick={() => {
                      setPackageFilter(null);
                      setStatusFilter('Offline');
                      setActiveView('Users');
                      setCurrentPage(1);
                      scrollToTable();
                    }}
                  />

                  {/* Card 4: Expired Users */}
                  <StatCard
                    label="Expired Users"
                    value={store.stats.expired}
                    pill={`${store.stats.total ? Math.round((store.stats.expired / store.stats.total) * 100) : 0}%`}
                    icon={UserX}
                    tone="rose"
                    isDarkMode={isDarkMode}
                    active={statusFilter === 'Expired' && !packageFilter && (activeView === 'Expired' || activeView === 'Users')}
                    onClick={() => {
                      setPackageFilter(null);
                      setStatusFilter('Expired');
                      setActiveView('Expired');
                      setCurrentPage(1);
                      scrollToTable();
                    }}
                  />

                  {/* Card 5: New Users This Month */}
                  <StatCard
                    label="New Users This Month"
                    value={store.stats.newThisMonth}
                    pill="This Month"
                    icon={UserPlus}
                    tone="lime"
                    isDarkMode={isDarkMode}
                    active={statusFilter === 'NewThisMonth' && !packageFilter && activeView === 'Users'}
                    onClick={() => {
                      setPackageFilter(null);
                      setStatusFilter('NewThisMonth');
                      setActiveView('Users');
                      setCurrentPage(1);
                      scrollToTable();
                    }}
                  />

                  {/* Card 6: Registered (Pre Active) */}
                  <StatCard
                    label="Registered (Pre Active)"
                    value={store.stats.preActive}
                    pill={`${store.stats.total ? Math.round((store.stats.preActive / store.stats.total) * 100) : 0}%`}
                    icon={Clock}
                    tone="deepGreen"
                    isDarkMode={isDarkMode}
                    active={statusFilter === 'Pre-Active' && !packageFilter && activeView === 'Users'}
                    onClick={() => {
                      setPackageFilter(null);
                      setStatusFilter('Pre-Active');
                      setActiveView('Users');
                      setCurrentPage(1);
                      scrollToTable();
                    }}
                  />

                  {/* Card 7: Expiring Today */}
                  <StatCard
                    label="Expiring Today"
                    value={store.stats.expiringToday}
                    pill="Today"
                    icon={Timer}
                    tone="green700"
                    isDarkMode={isDarkMode}
                    active={statusFilter === 'ExpiringToday' && !packageFilter && activeView === 'Users'}
                    onClick={() => {
                      setPackageFilter(null);
                      setStatusFilter('ExpiringToday');
                      setActiveView('Users');
                      setCurrentPage(1);
                      scrollToTable();
                    }}
                  />

                  {/* Card 8: Expiring Soon (3d) */}
                  <StatCard
                    label="Expiring Soon (3d)"
                    value={store.stats.expiring3d}
                    pill="3 Days"
                    icon={CalendarClock}
                    tone="lime"
                    isDarkMode={isDarkMode}
                    active={statusFilter === 'Expiring3d' && !packageFilter && activeView === 'Users'}
                    onClick={() => {
                      setPackageFilter(null);
                      setStatusFilter('Expiring3d');
                      setActiveView('Users');
                      setCurrentPage(1);
                      scrollToTable();
                    }}
                  />

                  {/* Card 9: Expiring Soon (1w) */}
                  <StatCard
                    label="Expiring Soon (1w)"
                    value={store.stats.expiring1w}
                    pill="7 Days"
                    icon={CalendarClock}
                    tone="teal"
                    isDarkMode={isDarkMode}
                    active={statusFilter === 'Expiring1w' && !packageFilter && activeView === 'Users'}
                    onClick={() => {
                      setPackageFilter(null);
                      setStatusFilter('Expiring1w');
                      setActiveView('Users');
                      setCurrentPage(1);
                      scrollToTable();
                    }}
                  />

                  {/* Card 10: Disabled Users */}
                  <StatCard
                    label="Disabled Users"
                    value={store.stats.disabled}
                    pill={`${store.stats.total ? Math.round((store.stats.disabled / store.stats.total) * 100) : 0}%`}
                    icon={UserMinus}
                    tone="slate"
                    isDarkMode={isDarkMode}
                    active={statusFilter === 'Disabled' && !packageFilter && activeView === 'Users'}
                    onClick={() => {
                      setPackageFilter(null);
                      setStatusFilter('Disabled');
                      setActiveView('Users');
                      setCurrentPage(1);
                      scrollToTable();
                    }}
                  />

                  {/* Card 11: 1st Tier Package */}
                  <StatCard
                    label="1st Tier Package"
                    value={store.stats.topPackages[0]?.count ?? 0}
                    pill={store.stats.topPackages[0]?.name || 'No Package'}
                    icon={Award}
                    tone="deepGreen"
                    isDarkMode={isDarkMode}
                    active={Boolean(store.stats.topPackages[0]?.name && packageFilter === store.stats.topPackages[0]?.name)}
                    onClick={() => {
                      const pkgName = store.stats.topPackages[0]?.name;
                      if (!pkgName) return;
                      setStatusFilter('All');
                      setPackageFilter(pkgName);
                      setActiveView('Users');
                      setCurrentPage(1);
                      scrollToTable();
                    }}
                  />

                  {/* Card 12: 2nd Tier Package */}
                  <StatCard
                    label="2nd Tier Package"
                    value={store.stats.topPackages[1]?.count ?? 0}
                    pill={store.stats.topPackages[1]?.name || 'No Package'}
                    icon={Package}
                    tone="emerald"
                    isDarkMode={isDarkMode}
                    active={Boolean(store.stats.topPackages[1]?.name && packageFilter === store.stats.topPackages[1]?.name)}
                    onClick={() => {
                      const pkgName = store.stats.topPackages[1]?.name;
                      if (!pkgName) return;
                      setStatusFilter('All');
                      setPackageFilter(pkgName);
                      setActiveView('Users');
                      setCurrentPage(1);
                      scrollToTable();
                    }}
                  />

                  {/* Card 13: 3rd Tier Package */}
                  <StatCard
                    label="3rd Tier Package"
                    value={store.stats.topPackages[2]?.count ?? 0}
                    pill={store.stats.topPackages[2]?.name || 'No Package'}
                    icon={Layers}
                    tone="green700"
                    isDarkMode={isDarkMode}
                    active={Boolean(store.stats.topPackages[2]?.name && packageFilter === store.stats.topPackages[2]?.name)}
                    onClick={() => {
                      const pkgName = store.stats.topPackages[2]?.name;
                      if (!pkgName) return;
                      setStatusFilter('All');
                      setPackageFilter(pkgName);
                      setActiveView('Users');
                      setCurrentPage(1);
                      scrollToTable();
                    }}
                  />

                  {/* Card 14: 4th Tier Package */}
                  <StatCard
                    label="4th Tier Package"
                    value={store.stats.topPackages[3]?.count ?? 0}
                    pill={store.stats.topPackages[3]?.name || 'No Package'}
                    icon={Package}
                    tone="teal"
                    isDarkMode={isDarkMode}
                    active={Boolean(store.stats.topPackages[3]?.name && packageFilter === store.stats.topPackages[3]?.name)}
                    onClick={() => {
                      const pkgName = store.stats.topPackages[3]?.name;
                      if (!pkgName) return;
                      setStatusFilter('All');
                      setPackageFilter(pkgName);
                      setActiveView('Users');
                      setCurrentPage(1);
                      scrollToTable();
                    }}
                  />

                  {/* Card 15: Required Balance Today (Click shows today's expired users) */}
                  <StatCard
                    label="Required Balance Today"
                    value={`Rs ${store.stats.requiredBalanceToday.toLocaleString()}`}
                    pill="Expired Today"
                    icon={CreditCard}
                    tone="darkGreen"
                    isDarkMode={isDarkMode}
                    active={statusFilter === 'ExpiredToday' && !packageFilter && activeView === 'Users'}
                    onClick={() => {
                      setPackageFilter(null);
                      setStatusFilter('ExpiredToday');
                      setActiveView('Users');
                      setCurrentPage(1);
                      scrollToTable();
                    }}
                  />
                </div>
              </div>
            </div>
            )}

            {/* DYNAMIC VIEW CONTENT (REPLACES COMING SOON PLACEHOLDERS) */}
            {activeView === 'Packages' ? (
              <PackagesView
                store={store}
                isDarkMode={isDarkMode}
                currencySymbol={currencySymbol}
                currencyRate={currencyRate}
                addToast={addToast}
              />
            ) : activeView === 'Vouchers' ? (
              <VouchersView
                store={store}
                isDarkMode={isDarkMode}
                currencySymbol={currencySymbol}
                currencyRate={currencyRate}
                addToast={addToast}
              />
            ) : activeView === 'Payments' ? (
              <PaymentsView
                store={store}
                isDarkMode={isDarkMode}
                currencySymbol={currencySymbol}
                currencyRate={currencyRate}
                addToast={addToast}
              />
            ) : activeView === 'Managers' ? (
              <ManagersView
                store={store}
                isDarkMode={isDarkMode}
                currencySymbol={currencySymbol}
                currencyRate={currencyRate}
                addToast={addToast}
              />
            ) : activeView === 'NAS' ? (
              <NasView
                store={store}
                isDarkMode={isDarkMode}
                addToast={addToast}
              />
            ) : activeView === 'Logs' ? (
              <LogsView
                store={store}
                isDarkMode={isDarkMode}
                addToast={addToast}
              />
            ) : activeView === 'Reports' ? (
              <ReportsView
                store={store}
                isDarkMode={isDarkMode}
                currencySymbol={currencySymbol}
                currencyRate={currencyRate}
                addToast={addToast}
              />
            ) : activeView === 'SMS' ? (
              <SmsView
                store={store}
                isDarkMode={isDarkMode}
                addToast={addToast}
                initialSelectedUserIds={selectedUserIds}
              />
            ) : activeView === 'Settings' ? (
              <SettingsView
                store={store}
                isDarkMode={isDarkMode}
                setIsDarkMode={setIsDarkMode}
                currency={currency}
                setCurrency={setCurrency}
                addToast={addToast}
              />
            ) : showDashboardSkeleton ? (
              <SkVertixUsersTable rows={8} />
            ) : (
              /* SUBSCRIBERS USERS TABLE (Dashboard, Users, Online, Expired, Expiring) */
              <div
                id="vertix-users-table"
                ref={tableRef}
                data-font-lexend="true"
                style={{ fontFamily: "'Lexend', sans-serif" }}
                className={`p-4 sm:p-5 rounded-2xl sm:rounded-3xl border shadow-sm flex flex-col transition-colors w-full min-w-0 font-lexend ${
                  isDarkMode ? 'bg-[#161b24] border-[#2d3648] shadow-black/30' : 'bg-white border-slate-300'
                }`}
              >
                {/* Table Header Controls */}
                <div className="flex flex-col gap-2.5 pb-3 border-b border-slate-200 dark:border-[#2d3648] shrink-0 w-full">
                  {/* Top Line: Title & Breadcrumbs on left, Search in center, Add Subscriber & Export CSV on right */}
                  <div className="flex flex-wrap sm:flex-nowrap items-center justify-between gap-2 sm:gap-3 w-full">
                    {/* Left: SUBSCRIBER Title + Breadcrumbs (Dashboard » Subscriber) */}
                    <div className="flex flex-col min-w-0 shrink-0">
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm sm:text-base md:text-lg font-black tracking-wider text-slate-950 dark:text-white uppercase leading-none whitespace-nowrap">
                          SUBSCRIBER
                        </h3>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 dark:bg-emerald-950 text-emerald-900 dark:text-emerald-200 border border-emerald-300 dark:border-emerald-600/50">
                          {filteredUsers.length}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 mt-1 text-[11px] font-bold text-blue-700 dark:text-emerald-300">
                        <button
                          type="button"
                          onClick={() => handleViewChange('Dashboard')}
                          className="hover:underline cursor-pointer"
                        >
                          Dashboard
                        </button>
                        <span className="text-slate-500 dark:text-slate-300">»</span>
                        <span className="text-slate-800 dark:text-slate-100">Subscriber</span>
                        {packageFilter && (
                          <button
                            type="button"
                            onClick={() => {
                              setPackageFilter(null);
                              setCurrentPage(1);
                            }}
                            className="ml-1 px-1.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 border border-emerald-300 dark:border-emerald-500/40 text-emerald-900 dark:text-emerald-200 text-[10px] font-bold flex items-center gap-1 cursor-pointer"
                            title="Clear package filter"
                          >
                            <span>Pkg: {packageFilter}</span>
                            <X className="w-2.5 h-2.5" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Center: Search input */}
                    <div className="flex-1 max-w-xs sm:max-w-sm md:max-w-md mx-auto min-w-0 px-1 sm:px-2 order-last sm:order-none w-full sm:w-auto mt-1 sm:mt-0">
                      <div className="relative w-full">
                        <Search className="w-3.5 h-3.5 text-slate-700 dark:text-slate-200 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                        <input
                          id="vertix-table-search"
                          type="text"
                          placeholder="Filter users..."
                          value={searchQuery}
                          onChange={e => {
                            setSearchQuery(e.target.value);
                            setCurrentPage(1);
                          }}
                          className={`text-xs pl-8 pr-7 py-1.5 rounded-full border outline-none transition-colors w-full font-semibold ${
                            isDarkMode
                              ? 'bg-[#10141b] border-[#333d52] text-white placeholder-slate-300 focus:border-emerald-400'
                              : 'bg-slate-50 border-slate-300 text-slate-950 placeholder-slate-600 focus:border-emerald-600'
                          }`}
                        />
                        {searchQuery && (
                          <button
                            type="button"
                            onClick={() => {
                              setSearchQuery('');
                              setCurrentPage(1);
                            }}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-700 dark:text-slate-200 hover:text-slate-950 dark:hover:text-white cursor-pointer"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Right: + Add Subscriber & Export CSV Buttons */}
                    <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                      <button
                        onClick={() => {
                          setAddFormError('');
                          setShowAddUserModal(true);
                        }}
                        className="px-2.5 sm:px-3.5 py-1.5 rounded-lg bg-[#0f172a] hover:bg-slate-900 dark:bg-emerald-600 dark:hover:bg-emerald-700 text-white font-bold text-[11px] sm:text-xs flex items-center gap-1 sm:gap-1.5 shadow-sm transition-colors cursor-pointer shrink-0 touch-manipulation"
                      >
                        <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                        <span className="hidden xs:inline">Add Subscriber</span>
                        <span className="xs:hidden">Add</span>
                      </button>
                      <button
                        onClick={handleExportCSV}
                        className="px-2 sm:px-3 py-1.5 rounded-lg border border-slate-300 dark:border-[#333d52] bg-white dark:bg-[#10141b] hover:bg-slate-100 dark:hover:bg-[#1e2636] text-slate-950 dark:text-white text-[11px] sm:text-xs font-bold flex items-center gap-1 sm:gap-1.5 cursor-pointer shrink-0 transition-colors touch-manipulation shadow-xs"
                        title="Export Filtered Subscribers as CSV"
                      >
                        <Download className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-300" />
                        <span className="hidden sm:inline">Export</span>
                        <span className="text-[10px] font-black uppercase text-slate-700 dark:text-slate-200">CSV</span>
                      </button>
                    </div>
                  </div>
                </div>

                  {/* Bulk Action Bar (When rows are selected) */}
                <AnimatePresence>
                  {selectedUserIds.length > 0 && (
                    <motion.div
                      initial={{ opacity: 0, y: -8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      className="mt-3 p-2.5 px-3 sm:px-4 rounded-xl bg-emerald-500/10 dark:bg-emerald-950/40 border border-emerald-600/40 flex flex-wrap items-center justify-between gap-2"
                    >
                      <div className="flex items-center gap-2 text-xs font-bold text-emerald-950 dark:text-emerald-200">
                        <span className="w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center text-[10px]">
                          {selectedUserIds.length}
                        </span>
                        <span>Subscribers Selected</span>
                      </div>

                      <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                        <button
                          onClick={() => navigate('/greenradius/bulk-renew')}
                          className="px-3 py-1.5 sm:py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold cursor-pointer"
                        >
                          Renew Bulk
                        </button>
                        <button
                          onClick={handleBulkDisable}
                          className="px-3 py-1.5 sm:py-1 rounded-lg bg-emerald-700 hover:bg-[#0b3d2e] text-white text-xs font-bold cursor-pointer"
                        >
                          Disable Selected
                        </button>
                        <button
                          onClick={() => setShowBulkDeleteModal(true)}
                          className="px-3 py-1.5 sm:py-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold cursor-pointer"
                        >
                          Delete Selected
                        </button>
                        <button
                          onClick={() => setShowWhatsAppModal(true)}
                          className="px-3 py-1.5 sm:py-1 rounded-lg bg-green-600 hover:bg-green-700 text-white text-xs font-bold flex items-center gap-1 cursor-pointer"
                        >
                          <Send className="w-3 h-3" />
                          <span>Send WhatsApp</span>
                        </button>
                        <button
                          onClick={() => setSelectedUserIds([])}
                          className="px-2 py-1.5 sm:py-1 text-xs text-slate-800 dark:text-slate-100 hover:underline cursor-pointer font-bold"
                        >
                          Clear
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Users Table */}
                <div
                  className="overflow-x-auto vertix-scroll-xy w-full min-w-0 mt-3 pb-2"
                >
                  <table className="w-full text-left text-xs sm:text-sm">
                    <thead>
                      <tr className="text-xs font-extrabold text-slate-900 dark:text-white bg-slate-100/90 dark:bg-[#10141b] border-b border-slate-300 dark:border-[#2d3648]">
                        <th className="py-2 px-3 w-8" style={{ height: '40.5px' }}>
                          <input
                            type="checkbox"
                            checked={
                              paginatedUsers.length > 0 &&
                              selectedUserIds.length === paginatedUsers.length
                            }
                            onChange={toggleSelectAll}
                            className="rounded border-slate-400 dark:border-[#475569] dark:bg-[#10141b] text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                          />
                        </th>
                        <th
                          onClick={() => toggleSort('username')}
                          className="py-2 px-3 sm:px-4 cursor-pointer hover:text-slate-950 dark:hover:text-white font-lexend text-left"
                          style={{ height: '40.5px', width: '220px', fontSize: '15px', textAlign: 'left' }}
                        >
                          <div className="w-full flex items-center justify-start gap-1.5 font-lexend text-left" style={{ textAlign: 'left' }}>
                            <span style={{ color: isDarkMode ? '#ffffff' : '#020617', textAlign: 'left' }}>Customer</span>
                            {sortField === 'username' && (
                              sortDirection === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
                            )}
                          </div>
                        </th>
                        <th
                          className="py-2 px-3 sm:px-4 font-lexend text-center"
                          style={{
                            height: '40.5px',
                            color: isDarkMode ? '#ffffff' : '#020617',
                            fontSize: '15px',
                            textAlign: 'center',
                            width: '158px',
                          }}
                        >
                          <div className="w-full flex items-center justify-center text-center font-lexend">
                            <span style={{ textAlign: 'center' }}>Username</span>
                          </div>
                        </th>
                        <th className="py-2 px-3 sm:px-4" style={{ height: '40.5px', textAlign: 'center', fontSize: '15px', color: isDarkMode ? '#ffffff' : '#020617' }}>Owner</th>
                        <th
                          onClick={() => toggleSort('package')}
                          className="py-2 px-3 sm:px-4 cursor-pointer hover:text-slate-950 dark:hover:text-white"
                          style={{ height: '40.5px', textAlign: 'center', width: '65.953px', paddingLeft: '46px' }}
                        >
                          <div className="flex items-center gap-1" style={{ textAlign: 'center', width: '68.1719px' }}>
                            <span style={{ fontSize: '15px', color: isDarkMode ? '#ffffff' : '#020617', width: '61.1719px', paddingLeft: '0px', paddingRight: '0px', marginLeft: '-1px', marginRight: '0px' }}>Service</span>
                            {sortField === 'package' && (
                              sortDirection === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
                            )}
                          </div>
                        </th>
                        <th
                          onClick={() => toggleSort('status')}
                          className="py-2 px-3 sm:px-4 cursor-pointer hover:text-slate-950 dark:hover:text-white"
                          style={{ height: '40.5px', color: isDarkMode ? '#ffffff' : '#020617', fontSize: '15px', textAlign: 'center' }}
                          title="Sort by Status"
                        >
                          <div className="flex items-center justify-center gap-1.5">
                            <span>Status</span>
                            <ArrowDownUp className="w-3.5 h-3.5 text-slate-600 dark:text-slate-300" />
                          </div>
                        </th>
                        <th
                          onClick={() => toggleSort('expiry')}
                          className="py-2 px-3 sm:px-4 cursor-pointer hover:text-slate-950 dark:hover:text-white font-lexend"
                          style={{ height: '40.5px', fontSize: '13px', textAlign: 'center' }}
                        >
                          <div className="flex items-center justify-center gap-1 font-lexend" style={{ textAlign: 'center', fontSize: '13px' }}>
                            <span style={{ fontSize: '13px', color: isDarkMode ? '#ffffff' : '#020617' }}>Expiration</span>
                            {sortField === 'expiry' && (
                              sortDirection === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
                            )}
                          </div>
                        </th>
                        <th className="py-2 px-3 sm:px-4 font-lexend" style={{ height: '40.5px', textAlign: 'center', width: '173.297px', paddingLeft: '0px', paddingRight: '16px', fontSize: '15px', color: isDarkMode ? '#ffffff' : '#020617' }}>User MAC</th>
                        <th className="py-2 px-3 text-right font-lexend" style={{ height: '40.5px', textAlign: 'center', width: '240.781px', fontSize: '15px', color: isDarkMode ? '#ffffff' : '#020617' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-[#2d3648]">
                      {paginatedUsers.length === 0 ? (
                        <tr>
                          <td colSpan={9} className="py-8 text-center text-slate-700 dark:text-slate-200 font-bold text-xs">
                            No subscribers match this criteria.
                          </td>
                        </tr>
                      ) : (() => {
                        const renderUserRow = (user: RadiusUser) => {
                          const isSelected = selectedUserIds.includes(user.id);
                          const isActionOpen = openActionUserId === user.id;

                          return (
                            <tr
                              key={user.id}
                              onClick={() => navigate('/greenradius/user/' + encodeURIComponent(user.id))}
                              className={`transition-colors cursor-pointer ${
                                isSelected
                                  ? isDarkMode
                                    ? 'bg-emerald-950/60'
                                    : 'bg-emerald-50'
                                  : 'hover:bg-emerald-50/60 dark:hover:bg-[#1e2636]'
                              }`}
                            >
                              {/* Checkbox */}
                              <td
                                className="py-3 px-3"
                                style={{ width: '30px' }}
                                onClick={(e) => e.stopPropagation()}
                              >
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() => toggleSelectUser(user.id)}
                                  className="rounded border-slate-400 dark:border-[#475569] dark:bg-[#10141b] text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                                />
                              </td>

                              {/* Customer (Name & Phone) */}
                              <td className="py-3 px-3 sm:px-4 font-lexend" style={{ width: '220px' }}>
                                <div className="flex items-center gap-2" style={{ width: '200px' }}>
                                  <div
                                    className="w-8 h-8 rounded-full flex items-center justify-center font-black text-xs shrink-0 shadow-xs border border-black dark:border-slate-500"
                                    style={{ backgroundColor: '#000000', color: '#ffffff' }}
                                  >
                                    {user.name.slice(0, 2).toUpperCase()}
                                  </div>
                                  <div style={{ width: '160px', minWidth: '160px', maxWidth: '160px' }} className="shrink-0 font-lexend">
                                    <p
                                      className="font-extrabold text-slate-950 dark:text-white leading-tight hover:underline hover:text-emerald-700 dark:hover:text-emerald-300 truncate font-lexend text-left"
                                      style={{ width: '160px', minWidth: '160px', display: 'block' }}
                                      title={user.name}
                                    >
                                      {user.name}
                                    </p>
                                    <p
                                      className="text-xs font-bold text-slate-700 dark:text-slate-200 truncate font-lexend text-left"
                                      style={{ width: '160px', minWidth: '160px', display: 'block' }}
                                      title={user.mobile}
                                    >
                                      {user.mobile}
                                    </p>
                                  </div>
                                </div>
                              </td>

                              {/* Username (with Copy) */}
                              <td
                                className="py-3 px-3 sm:px-4 whitespace-nowrap font-lexend text-xs text-center"
                                style={{ width: '158px', textAlign: 'center' }}
                              >
                                <div
                                  className="w-full flex items-center justify-center gap-1.5 text-center font-lexend"
                                  style={{
                                    backgroundColor: '#000000',
                                    color: '#000000',
                                    borderWidth: '1px',
                                    borderColor: isDarkMode ? '#475569' : '#000000',
                                    borderRadius: '8px',
                                    width: '149.733px',
                                  }}
                                >
                                  <span
                                    className="font-extrabold text-slate-900 dark:text-slate-100 hover:underline hover:text-emerald-700 dark:hover:text-emerald-400 text-center font-lexend"
                                    style={{
                                      textAlign: 'center',
                                      color: '#ffffff',
                                      fontSize: '13px',
                                      fontFamily: 'Inter',
                                      fontWeight: 'bold',
                                    }}
                                  >
                                    {user.username}
                                  </span>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleCopyText(user.username, 'Username');
                                    }}
                                    className="p-1 rounded hover:bg-slate-800 transition-colors cursor-pointer"
                                    title="Copy Username"
                                  >
                                    <Copy className="w-3.5 h-3.5" style={{ color: '#ffffff' }} />
                                  </button>
                                </div>
                              </td>

                                  {/* Owner */}
                                  <td className="py-3 px-3 sm:px-4 whitespace-nowrap text-xs font-bold text-slate-900 dark:text-white" style={{ width: '157.359px', textAlign: 'center', height: '55.2031px' }}>
                                    <span className="px-2.5 py-1 rounded-md bg-slate-100 dark:bg-[#10141b] border border-slate-300 dark:border-[#333d52] text-slate-950 dark:text-white font-bold">
                                      {user.owner || '—'}
                                    </span>
                                  </td>

                                  {/* Service (Package) */}
                                  <td className="py-3 px-3 sm:px-4 whitespace-nowrap font-bold text-xs text-slate-950 dark:text-white" style={{ textAlign: 'center' }}>
                                    <span className="px-2.5 py-1 rounded-lg border font-bold" style={{ color: isDarkMode ? '#ffffff' : '#020617', backgroundColor: isDarkMode ? '#10141b' : '#f1f5f9', borderColor: isDarkMode ? '#333d52' : '#cbd5e1', fontWeight: 'bold' }}>
                                      {user.package}
                                    </span>
                                  </td>

                                  {/* Status Badge (Placed on the right side of Service, before Expiration) */}
                                  <td
                                    className="py-3 px-3 sm:px-4 whitespace-nowrap text-center"
                                    style={{ width: '167.75px' }}
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    {(() => {
                                      const isExpired = user.status === 'Expired' || isUserExpired(user);
                                      let label = 'Active';
                                      let badgeStyle: React.CSSProperties = isDarkMode
                                        ? { backgroundColor: 'rgba(6, 78, 59, 0.75)', color: '#86efac', border: '1px solid rgba(74, 222, 128, 0.5)' }
                                        : { backgroundColor: '#bcf5dc', color: '#065f46', border: '1px solid #6ee7b7' };

                                      if (user.status === 'Pre-Active') {
                                        label = 'Preactive';
                                        badgeStyle = isDarkMode
                                          ? { backgroundColor: 'rgba(120, 53, 15, 0.75)', color: '#fef08a', border: '1px solid rgba(250, 204, 21, 0.5)' }
                                          : { backgroundColor: '#fef08a', color: '#713f12', border: '1px solid #eab308' };
                                      } else if (user.status === 'Disabled') {
                                        label = 'Disabled';
                                        badgeStyle = isDarkMode
                                          ? { backgroundColor: 'rgba(127, 29, 29, 0.75)', color: '#fecaca', border: '1px solid rgba(248, 113, 113, 0.5)' }
                                          : { backgroundColor: '#fecaca', color: '#991b1b', border: '1px solid #f87171' };
                                      } else if (user.status === 'Terminated') {
                                        label = 'Terminated';
                                        badgeStyle = isDarkMode
                                          ? { backgroundColor: 'rgba(30, 41, 59, 0.9)', color: '#f1f5f9', border: '1px solid rgba(148, 163, 184, 0.5)' }
                                          : { backgroundColor: '#cbd5e1', color: '#0f172a', border: '1px solid #94a3b8' };
                                      } else if (isExpired) {
                                        label = 'Expired';
                                        badgeStyle = isDarkMode
                                          ? { backgroundColor: 'rgba(127, 29, 29, 0.75)', color: '#fecaca', border: '1px solid rgba(248, 113, 113, 0.5)' }
                                          : { backgroundColor: '#fecaca', color: '#991b1b', border: '1px solid #f87171' };
                                      } else if (!user.online && user.status === 'Active') {
                                        label = 'Offline';
                                        badgeStyle = isDarkMode
                                          ? { backgroundColor: 'rgba(51, 65, 85, 0.85)', color: '#f1f5f9', border: '1px solid rgba(148, 163, 184, 0.5)' }
                                          : { backgroundColor: '#e2e8f0', color: '#1e293b', border: '1px solid #94a3b8' };
                                      } else if (user.online) {
                                        label = 'Active';
                                        badgeStyle = isDarkMode
                                          ? { backgroundColor: 'rgba(6, 78, 59, 0.75)', color: '#86efac', border: '1px solid rgba(74, 222, 128, 0.5)' }
                                          : { backgroundColor: '#bcf5dc', color: '#065f46', border: '1px solid #6ee7b7' };
                                      }

                                      return (
                                        <button
                                          onClick={async (e) => {
                                            e.stopPropagation();
                                            if (user.status === 'Pre-Active') {
                                              openRenew(user);
                                            } else {
                                              try {
                                                await store.toggleUserOnline(user.id);
                                                addToast(`${user.username} session updated`, 'info');
                                              } catch (err: any) {
                                                addToast(formatRadiusError(err), 'error');
                                              }
                                            }
                                          }}
                                          style={badgeStyle}
                                          className="inline-flex items-center justify-center px-4 py-1 rounded-[6px] font-extrabold text-xs shadow-xs min-w-[74px] transition-opacity cursor-pointer font-lexend hover:opacity-90"
                                          title={user.status === 'Pre-Active' ? 'Status: Preactive (Click to Activate Account)' : `Status: ${label} (Click to toggle session)`}
                                        >
                                          {label}
                                        </button>
                                      );
                                    })()}
                                  </td>


                              {/* Expiration (Reverse Countdown Ticker on top + Formatted Date below) */}
                              <td className="py-3 px-3 sm:px-4 whitespace-nowrap text-center font-lexend" style={{ textAlign: 'center', width: '150px' }}>
                                {user.status === 'Pre-Active' || user.expiry === 'Not Activated' ? (
                                  <div className="flex flex-col items-center justify-center font-lexend">
                                    <p className="font-extrabold text-xs text-amber-700 dark:text-amber-300 font-lexend">Not Activated</p>
                                    <p className="text-xs font-bold text-slate-600 dark:text-slate-300 font-lexend">—</p>
                                  </div>
                                ) : (
                                  (() => {
                                    const isExpired = user.status === 'Expired' || isUserExpired(user);
                                    const countdownStr = getExpiryCountdown(user.expiry);
                                    const formattedDate = formatExpiryDateDisplay(user.expiry);

                                    return (
                                      <div className="flex flex-col items-center justify-center font-lexend">
                                        {/* Top Line: Live Reverse Countdown Ticker */}
                                        <p className={`font-black text-xs leading-tight font-lexend tracking-tight ${
                                          isExpired ? 'text-red-700 dark:text-red-400' : 'text-emerald-700 dark:text-emerald-300'
                                        }`}>
                                          {isExpired ? '0d 00h 00m 00s' : countdownStr}
                                        </p>

                                        {/* Bottom Line: Formatted Expiration Date (e.g. 12 Nov 2026) */}
                                        <p className={`text-[11.5px] font-bold font-lexend ${
                                          isExpired ? 'text-red-700 dark:text-red-300 font-extrabold' : 'text-slate-700 dark:text-slate-200 font-bold'
                                        }`}>
                                          {formattedDate}
                                        </p>
                                      </div>
                                    );
                                  })()
                                )}
                              </td>

                              {/* User MAC (with Copy) */}
                              <td className="py-3 px-3 sm:px-4 whitespace-nowrap font-lexend text-xs" style={{ textAlign: 'center' }}>
                                <div className="flex items-center justify-center gap-1.5 font-lexend">
                                  <span className="text-slate-900 dark:text-white font-bold font-lexend tracking-wide">{user.mac || '—'}</span>
                                  {user.mac && (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleCopyText(user.mac!, 'MAC Address');
                                      }}
                                      className="p-1 rounded hover:bg-slate-200 dark:hover:bg-[#1e2636] text-slate-700 dark:text-slate-200 hover:text-slate-950 dark:hover:text-white transition-colors cursor-pointer"
                                      title="Copy MAC Address"
                                    >
                                      <Copy className="w-3.5 h-3.5" />
                                    </button>
                                  )}
                                </div>
                              </td>

                              {/* Actions (Recharge / Active, Disable, Menu) */}
                              <td
                                className="py-3 px-3 text-right whitespace-nowrap"
                                style={{ textAlign: 'center', width: '240.781px' }}
                                onClick={(e) => e.stopPropagation()}
                              >
                                <div className="flex items-center justify-end gap-1.5">
                                  {/* Recharge (Renew) or Active Button */}
                                  {user.status === 'Pre-Active' ? (
                                    <button
                                      onClick={() => openRenew(user)}
                                      className="px-3.5 py-1 rounded-[6px] bg-[#0098ca] hover:bg-[#0087b3] text-white font-bold text-xs inline-flex items-center justify-center gap-1.5 shadow-xs cursor-pointer transition-all min-w-[84px]"
                                      title="Active / Activate Subscriber Account"
                                    >
                                      <CheckCircle2 className="w-3.5 h-3.5" />
                                      <span>Active</span>
                                    </button>
                                  ) : (
                                    <button
                                      onClick={() => openRenew(user)}
                                      className="px-3.5 py-1 rounded-[6px] bg-[#22a06b] hover:bg-[#1b8557] text-white font-bold text-xs inline-flex items-center justify-center gap-1.5 shadow-xs cursor-pointer transition-all min-w-[84px]"
                                      title="Recharge / Renew Account"
                                    >
                                      <RotateCcw className="w-3 h-3" />
                                      <span>Recharge</span>
                                    </button>
                                  )}

                                  {/* Disable / Enable Button - Matching solid red/green design */}
                                  <button
                                    onClick={async () => {
                                      try {
                                        await store.toggleUserStatus(user.id);
                                        addToast(
                                          user.status === 'Active' ? `Disabled ${user.username}` : `Activated ${user.username}`,
                                          'info'
                                        );
                                      } catch (err: any) {
                                        addToast(formatRadiusError(err), 'error');
                                      }
                                    }}
                                    className={`px-3.5 py-1 rounded-[6px] font-bold text-xs inline-flex items-center justify-center gap-1.5 text-white shadow-xs transition-all cursor-pointer min-w-[76px] ${
                                      user.status === 'Active'
                                        ? 'bg-[#d32f2f] hover:bg-[#b71c1c]'
                                        : 'bg-[#22a06b] hover:bg-[#1b8557]'
                                    }`}
                                    title={user.status === 'Active' ? 'Disable Account' : 'Enable Account'}
                                  >
                                    <PowerOff className="w-3 h-3" />
                                    <span>{user.status === 'Active' ? 'Disable' : 'Enable'}</span>
                                  </button>

                                  {/* Menu Options */}
                                  <div className="relative inline-block text-left">
                                    <button
                                      onClick={() => setOpenActionUserId(isActionOpen ? null : user.id)}
                                      className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-800 dark:text-slate-100 hover:text-slate-950 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#1e2636] transition-colors cursor-pointer border border-slate-300 dark:border-[#333d52]"
                                      title="More Options"
                                    >
                                      <MoreHorizontal className="w-4 h-4" />
                                    </button>

                                    {isActionOpen && (
                                      <div
                                        className={`absolute right-0 mt-1 w-44 rounded-xl shadow-xl border py-1.5 z-40 ${
                                          isDarkMode
                                            ? 'bg-[#161b24] border-[#2d3648] text-white'
                                            : 'bg-white border-slate-300 text-slate-950'
                                        }`}
                                      >
                                        <button
                                          onClick={() => openEdit(user)}
                                          className="w-full px-3 py-1.5 text-xs font-bold text-slate-900 dark:text-white hover:bg-slate-100 dark:hover:bg-[#1e2636] rounded-lg flex items-center gap-2 text-left cursor-pointer"
                                        >
                                          <Edit className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                                          <span>Edit Profile</span>
                                        </button>
                                        <button
                                          onClick={() => {
                                            setOpenActionUserId(null);
                                            setChangePkgTargetUser(user);
                                            setShowChangePkgModal(true);
                                          }}
                                          className="w-full px-3 py-1.5 text-xs font-bold hover:bg-slate-100 dark:hover:bg-[#1e2636] rounded-lg flex items-center gap-2 text-left cursor-pointer text-slate-900 dark:text-white"
                                        >
                                          <ArrowRightLeft className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
                                          <span>Change Package</span>
                                        </button>
                                        {user.online && (
                                          <button
                                            onClick={async () => {
                                              setOpenActionUserId(null);
                                              try {
                                                await store.disconnectUser(user.id);
                                                addToast(`Disconnected ${user.username}`, 'info');
                                              } catch (err: any) {
                                                addToast(formatRadiusError(err), 'error');
                                              }
                                            }}
                                            className="w-full px-3 py-1.5 text-xs font-bold text-amber-700 dark:text-amber-300 hover:bg-slate-100 dark:hover:bg-[#1e2636] rounded-lg flex items-center gap-2 text-left cursor-pointer"
                                          >
                                            <PowerOff className="w-3.5 h-3.5" />
                                            <span>Disconnect Session</span>
                                          </button>
                                        )}
                                        <button
                                          onClick={() => openDelete(user)}
                                          className="w-full px-3 py-1.5 text-xs font-bold text-rose-700 dark:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-950/60 rounded-lg flex items-center gap-2 text-left cursor-pointer"
                                        >
                                          <Trash2 className="w-3.5 h-3.5" />
                                          <span>Delete User</span>
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </td>
                            </tr>
                          );
                        };
                        return (
                          <>
                            {paginatedUsers.slice(0, visibleUserCount).map(renderUserRow)}
                            {visibleUserCount < paginatedUsers.length &&
                              Array.from({ length: 3 }).map((_, i) => (
                                <tr key={`vertix-lazy-skel-${i}`} className="border-b border-slate-200 dark:border-[#2d3648]">
                                  <td colSpan={9} className="py-3 px-4">
                                    <div className="grid grid-cols-7 gap-4 items-center">
                                      <SkBar w="w-28" h="h-3.5" />
                                      <SkBar w="w-20" h="h-3" />
                                      <SkBar w="w-16" h="h-3" />
                                      <SkBar w="w-24" h="h-3" />
                                      <SkBar w="w-16" h="h-5" rounded="rounded-md" />
                                      <SkBar w="w-20" h="h-3" />
                                      <SkBar w="w-24" h="h-6" className="ml-auto" />
                                    </div>
                                  </td>
                                </tr>
                              ))}
                          </>
                        );
                      })()}
                    </tbody>
                  </table>
                </div>

                {/* Pagination Controls */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3.5 border-t border-slate-200 dark:border-[#2d3648] mt-2 shrink-0">
                  <span className="text-xs text-slate-800 dark:text-slate-100 font-bold">
                    Page {currentPage} of {totalPages} ({sortedUsers.length} total subscribers)
                  </span>

                  <div className="flex flex-wrap items-center gap-1.5">
                    <button
                      disabled={currentPage <= 1}
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      className="px-3 py-1.5 sm:py-1 rounded-lg border text-xs font-bold disabled:opacity-40 disabled:cursor-not-allowed border-slate-300 dark:border-[#333d52] bg-white dark:bg-[#10141b] text-slate-900 dark:text-white hover:bg-slate-100 dark:hover:bg-[#1e2636] cursor-pointer touch-manipulation"
                    >
                      Previous
                    </button>

                    {Array.from({ length: totalPages }).map((_, idx) => {
                      const pageNum = idx + 1;
                      return (
                        <button
                          key={pageNum}
                          onClick={() => setCurrentPage(pageNum)}
                          className={`w-8 h-8 sm:w-7 sm:h-7 rounded-lg text-xs font-bold transition-colors cursor-pointer touch-manipulation ${
                            currentPage === pageNum
                              ? 'bg-[#14532d] text-white border border-emerald-500'
                              : 'border border-slate-300 dark:border-[#333d52] bg-white dark:bg-[#10141b] text-slate-900 dark:text-white hover:bg-slate-100 dark:hover:bg-[#1e2636]'
                          }`}
                        >
                          {pageNum}
                        </button>
                      );
                    })}

                    <button
                      disabled={currentPage >= totalPages}
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      className="px-3 py-1.5 sm:py-1 rounded-lg border text-xs font-bold disabled:opacity-40 disabled:cursor-not-allowed border-slate-300 dark:border-[#333d52] bg-white dark:bg-[#10141b] text-slate-900 dark:text-white hover:bg-slate-100 dark:hover:bg-[#1e2636] cursor-pointer touch-manipulation"
                    >
                      Next
                    </button>
                  </div>
                </div>
              </div>
            )}
          </main>
        </div>
      </div>

      {/* --- SUBSCRIBER MODALS --- */}

      {/* ADD SUBSCRIBER USER MODAL */}
      <AddUserModal
        isOpen={showAddUserModal}
        onClose={() => setShowAddUserModal(false)}
        isDarkMode={isDarkMode}
        addToast={addToast}
      />

      {/* RENEW / RECHARGE MODAL */}
      {showRenewModal && renewTargetUser && (
        <RenewModal
          user={store.users.find(u => u.id === renewTargetUser.id) || renewTargetUser}
          isOpen={showRenewModal}
          onClose={() => {
            setShowRenewModal(false);
            setRenewTargetUser(null);
          }}
          isDarkMode={isDarkMode}
          addToast={addToast}
        />
      )}

      {/* CHANGE PACKAGE MODAL */}
      {showChangePkgModal && changePkgTargetUser && (
        <ChangePackageModal
          user={store.users.find(u => u.id === changePkgTargetUser.id) || changePkgTargetUser}
          isOpen={showChangePkgModal}
          onClose={() => {
            setShowChangePkgModal(false);
            setChangePkgTargetUser(null);
          }}
          isDarkMode={isDarkMode}
          addToast={addToast}
        />
      )}

      {/* EDIT USER MODAL */}
      <AnimatePresence>
        {showEditUserModal && editTargetUser && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 overflow-y-auto vertix-dashboard-scroll">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className={`w-full max-w-sm max-h-[90dvh] overflow-y-auto vertix-dashboard-scroll rounded-3xl p-5 shadow-2xl border my-auto ${
                isDarkMode ? 'bg-[#161b24] border-[#2d3648] text-white' : 'bg-white border-slate-300 text-slate-950'
              }`}
            >
              <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-[#2d3648]">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 flex items-center justify-center">
                    <Edit className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-sm text-slate-950 dark:text-white">Edit Subscriber</h3>
                    <p className="text-[11px] font-semibold text-slate-700 dark:text-slate-200">{editTargetUser.username}</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowEditUserModal(false)}
                  className="p-1.5 rounded-full text-slate-700 dark:text-slate-200 hover:text-slate-950 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#1e2636] cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="mt-4 space-y-3">
                <div>
                  <label className="text-xs font-bold text-slate-900 dark:text-slate-100 mb-1 block">
                    Full Customer Name
                  </label>
                  <input
                    type="text"
                    value={editName}
                    onChange={e => setEditName(e.target.value)}
                    className={`w-full text-xs px-3 py-2 rounded-xl border outline-none font-semibold ${
                      isDarkMode ? 'bg-[#10141b] border-[#333d52] text-white' : 'bg-slate-50 border-slate-300 text-slate-950'
                    }`}
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-900 dark:text-slate-100 mb-1 block">
                    Mobile Number
                  </label>
                  <input
                    type="text"
                    value={editMobile}
                    onChange={e => setEditMobile(e.target.value)}
                    className={`w-full text-xs px-3 py-2 rounded-xl border outline-none font-semibold ${
                      isDarkMode ? 'bg-[#10141b] border-[#333d52] text-white' : 'bg-slate-50 border-slate-300 text-slate-950'
                    }`}
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-900 dark:text-slate-100 mb-1 block">
                    Assigned Package
                  </label>
                  <select
                    value={editPackage}
                    onChange={e => setEditPackage(e.target.value)}
                    className={`w-full text-xs px-3 py-2 rounded-xl border outline-none font-bold ${
                      isDarkMode ? 'bg-[#10141b] border-[#333d52] text-white' : 'bg-slate-50 border-slate-300 text-slate-950'
                    }`}
                  >
                    {store.packages.map(p => (
                      <option key={p.id} value={p.name}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-900 dark:text-slate-100 mb-1 block">
                    Assigned Dealer / Manager
                  </label>
                  <select
                    value={editManagerId}
                    onChange={e => setEditManagerId(e.target.value)}
                    className={`w-full text-xs px-3 py-2 rounded-xl border outline-none font-bold ${
                      isDarkMode ? 'bg-[#10141b] border-[#333d52] text-white' : 'bg-slate-50 border-slate-300 text-slate-950'
                    }`}
                  >
                    <option value="">Direct Admin (No Dealer)</option>
                    {store.managers.map(m => (
                      <option key={m.id} value={m.id}>
                        {m.name} ({m.role})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="pt-2 flex items-center justify-end gap-2.5">
                  <button
                    onClick={() => setShowEditUserModal(false)}
                    className="px-4 py-2 text-xs font-bold text-slate-800 dark:text-slate-200 hover:text-slate-950 dark:hover:text-white cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleConfirmEdit}
                    className="px-5 py-2 rounded-full bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md shadow-blue-500/20 cursor-pointer"
                  >
                    Save Changes
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* DELETE CONFIRMATION MODAL */}
      <AnimatePresence>
        {showDeleteModal && deleteTargetUser && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className={`w-full max-w-sm rounded-3xl p-5 shadow-2xl border ${
                isDarkMode ? 'bg-[#161b24] border-[#2d3648] text-white' : 'bg-white border-slate-300 text-slate-950'
              }`}
            >
              <div className="flex items-center gap-2 pb-3 border-b border-slate-200 dark:border-[#2d3648]">
                <div className="w-8 h-8 rounded-full bg-rose-100 dark:bg-rose-950 text-rose-600 dark:text-rose-400 flex items-center justify-center">
                  <Trash2 className="w-4 h-4" />
                </div>
                <h3 className="font-extrabold text-sm text-rose-600 dark:text-rose-400">Delete Subscriber</h3>
              </div>

              <div className="my-4 text-xs space-y-2">
                <p className="text-slate-900 dark:text-slate-100 font-semibold">
                  Are you sure you want to delete subscriber{' '}
                  <strong className="text-slate-950 dark:text-white font-black">{deleteTargetUser.username}</strong> ({deleteTargetUser.name})?
                </p>
                <p className="text-[11px] font-medium text-slate-700 dark:text-slate-300">
                  This will purge their radius credentials and disconnect any active session.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2.5">
                <button
                  onClick={() => setShowDeleteModal(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-800 dark:text-slate-200 hover:text-slate-950 dark:hover:text-white cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmDelete}
                  className="px-5 py-2 rounded-full bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-md shadow-rose-500/20 cursor-pointer"
                >
                  Yes, Delete
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* BULK RENEW MODAL */}
      <AnimatePresence>
        {showBulkRenewModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 overflow-y-auto vertix-dashboard-scroll">
            <motion.div
              data-font-lexend="true"
              style={{ fontFamily: "'Lexend', sans-serif" }}
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className={`w-full max-w-lg rounded-3xl p-4 sm:p-5 shadow-2xl border flex flex-col max-h-[90dvh] my-auto font-lexend ${
                isDarkMode ? 'bg-[#161b24] border-[#2d3648] text-white' : 'bg-white border-slate-300 text-slate-950'
              }`}
            >
              {/* Header */}
              <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-[#2d3648] shrink-0">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 flex items-center justify-center">
                    <RotateCcw className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-base leading-tight text-slate-950 dark:text-white">Renew Bulk</h3>
                    <p className="text-[11px] text-slate-700 dark:text-slate-200 font-semibold">
                      {selectedUserIds.length} subscriber{selectedUserIds.length === 1 ? '' : 's'} selected for renewal
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowBulkRenewModal(false)}
                  className="p-1.5 rounded-full text-slate-700 dark:text-slate-200 hover:text-slate-950 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#1e2636] transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Scrollable Modal Body */}
              <div className="mt-4 space-y-4 overflow-y-auto pr-1 flex-1 vertix-dashboard-scroll">
                {/* Package & Duration Selectors */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-slate-900 dark:text-slate-100 mb-1 block">
                      Target Package
                    </label>
                    <select
                      value={renewPackage}
                      onChange={e => setRenewPackage(e.target.value)}
                      className={`w-full text-xs px-3 py-2 rounded-xl border outline-none font-bold ${
                        isDarkMode ? 'bg-[#10141b] border-[#333d52] text-white' : 'bg-slate-50 border-slate-300 text-slate-950'
                      }`}
                    >
                      {store.packages.map(p => (
                        <option key={p.id} value={p.name}>
                          {p.name} (Rs. {p.pricePerMonth.toLocaleString()})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-900 dark:text-slate-100 mb-1 block">
                      Duration
                    </label>
                    <select
                      value={renewMonths}
                      onChange={e => setRenewMonths(Number(e.target.value))}
                      className={`w-full text-xs px-3 py-2 rounded-xl border outline-none font-bold ${
                        isDarkMode ? 'bg-[#10141b] border-[#333d52] text-white' : 'bg-slate-50 border-slate-300 text-slate-950'
                      }`}
                    >
                      <option value={1}>1 Month (30 Days)</option>
                      <option value={2}>2 Months (60 Days)</option>
                      <option value={3}>3 Months (90 Days)</option>
                      <option value={6}>6 Months (180 Days)</option>
                      <option value={12}>12 Months (365 Days)</option>
                    </select>
                  </div>
                </div>

                {/* Selected Users List with Unselect option */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                      Selected Subscribers ({selectedUserIds.length})
                    </span>
                    {selectedUserIds.length > 0 && (
                      <button
                        onClick={() => setSelectedUserIds([])}
                        className="text-[11px] font-bold text-rose-600 dark:text-rose-400 hover:underline cursor-pointer"
                      >
                        Unselect All
                      </button>
                    )}
                  </div>

                  <div className={`rounded-2xl border p-2 space-y-1.5 max-h-52 overflow-y-auto vertix-dashboard-scroll ${
                    isDarkMode ? 'bg-[#10141b] border-[#2d3648]' : 'bg-slate-50 border-slate-300'
                  }`}>
                    {selectedUserIds.length === 0 ? (
                      <div className="py-6 text-center text-xs text-slate-700 dark:text-slate-200 font-semibold">
                        No subscribers selected.
                      </div>
                    ) : (
                      store.users
                        .filter(u => selectedUserIds.includes(u.id))
                        .map(u => {
                          const pkgPrice = store.packages.find(p => p.name === (renewPackage || u.package))?.pricePerMonth || 0;
                          return (
                            <div
                              key={u.id}
                              className={`flex items-center justify-between p-2 rounded-xl border transition-colors ${
                                isDarkMode
                                  ? 'bg-[#161b24] border-[#333d52] hover:border-emerald-500'
                                  : 'bg-white border-slate-300 hover:border-slate-400'
                              }`}
                            >
                              <div className="flex items-center gap-2.5 min-w-0">
                                <div className="w-7 h-7 rounded-full bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 flex items-center justify-center font-bold text-xs shrink-0">
                                  {u.name.charAt(0).toUpperCase()}
                                </div>
                                <div className="min-w-0">
                                  <div className="flex items-center gap-1.5">
                                    <span className="font-bold text-xs truncate text-slate-950 dark:text-white">
                                      {u.name}
                                    </span>
                                    <span className="text-[10.5px] font-semibold text-slate-700 dark:text-slate-300 font-mono">
                                      @{u.username}
                                    </span>
                                  </div>
                                  <div className="text-[10.5px] text-slate-700 dark:text-slate-200 font-medium">
                                    Current: <span className="font-bold text-emerald-700 dark:text-emerald-300">{u.package}</span> • Rs. {pkgPrice.toLocaleString()} / mo
                                  </div>
                                </div>
                              </div>

                              <button
                                onClick={() => setSelectedUserIds(prev => prev.filter(id => id !== u.id))}
                                className="px-2.5 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/60 dark:hover:bg-rose-900/70 text-rose-700 dark:text-rose-200 border border-rose-300 dark:border-rose-700 text-[11px] font-bold transition-colors cursor-pointer shrink-0 flex items-center gap-1"
                                title="Unselect subscriber"
                              >
                                <UserMinus className="w-3 h-3" />
                                <span>Unselect</span>
                              </button>
                            </div>
                          );
                        })
                    )}
                  </div>
                </div>

                {/* Total Balance Required Summary Box */}
                {(() => {
                  const selectedCount = selectedUserIds.length;
                  const pkgPrice = store.packages.find(p => p.name === renewPackage)?.pricePerMonth || 0;
                  const totalRequiredBalance = selectedCount * pkgPrice * renewMonths;
                  return (
                    <div className="p-3.5 rounded-2xl bg-gradient-to-r from-emerald-500/15 via-teal-500/10 to-emerald-500/5 dark:from-emerald-950/80 dark:via-emerald-900/50 dark:to-teal-950/60 border border-emerald-500/40 text-xs flex items-center justify-between font-bold text-emerald-950 dark:text-white shadow-xs">
                      <div>
                        <span className="block text-[11px] font-extrabold text-emerald-800 dark:text-emerald-200">
                          Total Required Balance
                        </span>
                        <span className="text-[10.5px] text-slate-700 dark:text-slate-200 font-semibold">
                          ({selectedCount} user{selectedCount === 1 ? '' : 's'} × Rs. {pkgPrice.toLocaleString()} × {renewMonths} month{renewMonths === 1 ? '' : 's'})
                        </span>
                      </div>
                      <span className="text-base sm:text-lg font-black text-emerald-800 dark:text-emerald-300 tracking-tight tabular-nums">
                        Rs. {totalRequiredBalance.toLocaleString()}
                      </span>
                    </div>
                  );
                })()}
              </div>

              {/* Modal Footer: Cancel and Recharge Buttons */}
              <div className="pt-3 mt-3 border-t border-slate-200 dark:border-[#2d3648] flex items-center justify-end gap-2.5 shrink-0">
                <button
                  onClick={() => setShowBulkRenewModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-800 hover:text-slate-950 dark:text-slate-100 dark:hover:text-white border border-slate-300 dark:border-[#333d52] hover:bg-slate-100 dark:hover:bg-[#1e2636] transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={handleBulkRenewSubmit}
                  disabled={selectedUserIds.length === 0}
                  className={`px-5 py-2 rounded-xl text-white font-extrabold text-xs shadow-md transition-colors flex items-center gap-1.5 cursor-pointer ${
                    selectedUserIds.length === 0
                      ? 'bg-slate-400 dark:bg-slate-700 opacity-50 cursor-not-allowed shadow-none'
                      : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-500/20'
                  }`}
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Recharge</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* BULK DELETE CONFIRMATION MODAL */}
      <AnimatePresence>
        {showBulkDeleteModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className={`w-full max-w-sm rounded-3xl p-5 shadow-2xl border ${
                isDarkMode ? 'bg-[#161b24] border-[#2d3648] text-white' : 'bg-white border-slate-300 text-slate-950'
              }`}
            >
              <div className="flex items-center gap-2 pb-3 border-b border-slate-200 dark:border-[#2d3648]">
                <div className="w-8 h-8 rounded-full bg-rose-100 dark:bg-rose-950 text-rose-600 dark:text-rose-400 flex items-center justify-center">
                  <Trash2 className="w-4 h-4" />
                </div>
                <h3 className="font-extrabold text-sm text-rose-600 dark:text-rose-400">Bulk Delete Subscribers</h3>
              </div>

              <div className="my-4 text-xs space-y-2">
                <p className="text-slate-900 dark:text-slate-100 font-semibold">
                  Are you sure you want to permanently delete{' '}
                  <strong className="text-rose-600 dark:text-rose-400 font-black">{selectedUserIds.length} subscribers</strong>?
                </p>
                <p className="text-[11px] font-medium text-slate-700 dark:text-slate-300">
                  This action cannot be undone. All active sessions will be terminated.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2.5">
                <button
                  onClick={() => setShowBulkDeleteModal(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-800 dark:text-slate-200 hover:text-slate-950 dark:hover:text-white cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={handleBulkDeleteSubmit}
                  className="px-5 py-2 rounded-full bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-md shadow-rose-500/20 cursor-pointer"
                >
                  Confirm Bulk Delete
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* WHATSAPP BROADCAST MODAL */}
      <AnimatePresence>
        {showWhatsAppModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className={`w-full max-w-md rounded-3xl p-5 shadow-2xl border ${
                isDarkMode ? 'bg-[#161b24] border-[#2d3648] text-white' : 'bg-white border-slate-300 text-slate-950'
              }`}
            >
              <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-[#2d3648]">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-green-100 dark:bg-green-950 text-green-700 dark:text-green-300 flex items-center justify-center">
                    <Send className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-sm text-slate-950 dark:text-white">WhatsApp Reminder Broadcast</h3>
                    <p className="text-[11px] font-semibold text-slate-700 dark:text-slate-200">{selectedUserIds.length} recipients selected</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowWhatsAppModal(false)}
                  className="p-1.5 rounded-full text-slate-700 dark:text-slate-200 hover:text-slate-950 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#1e2636] cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="mt-4 space-y-3">
                <div className="p-3 rounded-2xl bg-slate-100 dark:bg-[#10141b] border border-slate-200 dark:border-[#2d3648] text-xs font-mono space-y-1">
                  <p className="font-bold text-green-700 dark:text-green-300">Message Template Preview:</p>
                  <p className="text-slate-900 dark:text-slate-100">
                    &quot;Dear Valued Customer, Your Green Pro High-Speed Internet subscription is due for renewal. Please submit payment or recharge via scratch card to avoid service disconnection. Green Pro Support: 0300-1234567&quot;
                  </p>
                </div>

                <div className="pt-2 flex items-center justify-end gap-2.5">
                  <button
                    onClick={() => setShowWhatsAppModal(false)}
                    className="px-4 py-2 text-xs font-bold text-slate-800 dark:text-slate-200 hover:text-slate-950 dark:hover:text-white cursor-pointer"
                  >
                    Close
                  </button>
                  <button
                    onClick={() => {
                      addToast(`Broadcast dispatched to ${selectedUserIds.length} subscribers!`, 'success');
                      setShowWhatsAppModal(false);
                      setSelectedUserIds([]);
                    }}
                    className="px-5 py-2 rounded-full bg-green-600 hover:bg-green-700 text-white font-bold text-xs shadow-md shadow-green-500/20 cursor-pointer"
                  >
                    Send Broadcast Now
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* SYSTEM INFO MODAL */}
      <AnimatePresence>
        {showInfoModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 overflow-y-auto vertix-dashboard-scroll">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className={`w-full max-w-md max-h-[90dvh] overflow-y-auto vertix-dashboard-scroll rounded-3xl p-5 shadow-2xl border my-auto ${
                isDarkMode ? 'bg-[#161b24] border-[#2d3648] text-white' : 'bg-white border-slate-300 text-slate-950'
              }`}
            >
              <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-[#2d3648]">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 flex items-center justify-center">
                    <Info className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-sm text-slate-950 dark:text-white">Green Pro RADIUS Architecture</h3>
                    <p className="text-[11px] font-semibold text-slate-700 dark:text-slate-200">v3.2 Production Build</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowInfoModal(false)}
                  className="p-1.5 rounded-full text-slate-700 dark:text-slate-200 hover:text-slate-950 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#1e2636] cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="my-4 space-y-3 text-xs">
                <div className="grid grid-cols-2 gap-2 text-slate-800 dark:text-slate-100 font-semibold">
                  <div className="p-2.5 rounded-xl border border-slate-200 dark:border-[#2d3648] bg-slate-50 dark:bg-[#10141b]">
                    <span className="text-[10px] text-slate-700 dark:text-slate-300 block uppercase font-bold">Engine Protocol</span>
                    <span className="font-bold text-slate-950 dark:text-white">Green Pro RADIUS Core</span>
                  </div>
                  <div className="p-2.5 rounded-xl border border-slate-200 dark:border-[#2d3648] bg-slate-50 dark:bg-[#10141b]">
                    <span className="text-[10px] text-slate-700 dark:text-slate-300 block uppercase font-bold">Storage State</span>
                    <span className="font-bold text-slate-950 dark:text-white">Radius API Service</span>
                  </div>
                  <div className="p-2.5 rounded-xl border border-slate-200 dark:border-[#2d3648] bg-slate-50 dark:bg-[#10141b]">
                    <span className="text-[10px] text-slate-700 dark:text-slate-300 block uppercase font-bold">Mikrotik API</span>
                    <span className="font-bold text-slate-950 dark:text-white">RouterOS v6 & v7</span>
                  </div>
                  <div className="p-2.5 rounded-xl border border-slate-200 dark:border-[#2d3648] bg-slate-50 dark:bg-[#10141b]">
                    <span className="text-[10px] text-slate-700 dark:text-slate-300 block uppercase font-bold">Server Uptime</span>
                    <span className="font-bold text-emerald-700 dark:text-emerald-300">48d 14h 22m</span>
                  </div>
                </div>

                <p className="text-slate-800 dark:text-slate-200 leading-relaxed font-medium">
                  Green Pro RADIUS manages subscriber authentication, authorization, accounting, bandwidth queues, dynamic IP assignment, and voucher billing for high-density internet service providers.
                </p>
              </div>

              <div className="flex justify-end">
                <button
                  onClick={() => setShowInfoModal(false)}
                  className="px-5 py-2 rounded-full bg-slate-950 text-white dark:bg-white dark:text-slate-950 font-bold text-xs shadow-xs cursor-pointer"
                >
                  Close Info
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* HELP & KEYBOARD SHORTCUTS MODAL */}
      <AnimatePresence>
        {showHelpModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 overflow-y-auto vertix-dashboard-scroll">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className={`w-full max-w-md max-h-[90dvh] overflow-y-auto vertix-dashboard-scroll rounded-3xl p-5 shadow-2xl border my-auto ${
                isDarkMode ? 'bg-[#161b24] border-[#2d3648] text-white' : 'bg-white border-slate-300 text-slate-950'
              }`}
            >
              <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-[#2d3648]">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 flex items-center justify-center">
                    <HelpCircle className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-sm text-slate-950 dark:text-white">Help & Shortcuts</h3>
                    <p className="text-[11px] font-semibold text-slate-700 dark:text-slate-200">Radius Management Quick Reference</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowHelpModal(false)}
                  className="p-1.5 rounded-full text-slate-700 dark:text-slate-200 hover:text-slate-950 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#1e2636] cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="my-4 space-y-3 text-xs">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between p-2 rounded-xl bg-slate-50 dark:bg-[#10141b] border border-slate-200 dark:border-[#2d3648]">
                    <span className="font-bold text-slate-900 dark:text-slate-100">Toggle Help & Shortcuts</span>
                    <kbd className="px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-slate-950 dark:text-white font-mono text-[10px] font-bold">?</kbd>
                  </div>
                  <div className="flex items-center justify-between p-2 rounded-xl bg-slate-50 dark:bg-[#10141b] border border-slate-200 dark:border-[#2d3648]">
                    <span className="font-bold text-slate-900 dark:text-slate-100">Close Open Modal</span>
                    <kbd className="px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-slate-950 dark:text-white font-mono text-[10px] font-bold">Esc</kbd>
                  </div>
                  <div className="flex items-center justify-between p-2 rounded-xl bg-slate-50 dark:bg-[#10141b] border border-slate-200 dark:border-[#2d3648]">
                    <span className="font-bold text-slate-900 dark:text-slate-100">Search Subscribers</span>
                    <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-200">Click Search icon or input</span>
                  </div>
                  <div className="flex items-center justify-between p-2 rounded-xl bg-slate-50 dark:bg-[#10141b] border border-slate-200 dark:border-[#2d3648]">
                    <span className="font-bold text-slate-900 dark:text-slate-100">Data Persistence</span>
                    <span className="text-[11px] text-emerald-700 dark:text-emerald-300 font-bold">Synced via Radius API</span>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-700 text-[11px] font-semibold text-emerald-950 dark:text-emerald-100">
                  Tip: Clicking any of the landscape stat cards filters the subscriber table and smoothly navigates to it!
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  onClick={() => setShowHelpModal(false)}
                  className="px-5 py-2 rounded-full bg-slate-950 text-white dark:bg-white dark:text-slate-950 font-bold text-xs shadow-xs cursor-pointer"
                >
                  Understood
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* TRANSFER MODAL (PRESERVED) */}
      <AnimatePresence>
        {showTransferModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 overflow-y-auto vertix-dashboard-scroll">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className={`w-full max-w-sm max-h-[90dvh] overflow-y-auto vertix-dashboard-scroll rounded-3xl p-5 shadow-2xl border my-auto ${
                isDarkMode ? 'bg-[#161b24] border-[#2d3648] text-white' : 'bg-white border-slate-300 text-slate-950'
              }`}
            >
              <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-[#2d3648]">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 flex items-center justify-center">
                    <ArrowRightLeft className="w-3.5 h-3.5" />
                  </div>
                  <h3 className="font-extrabold text-sm text-slate-950 dark:text-white">Instant Balance Transfer</h3>
                </div>
                <button
                  onClick={() => setShowTransferModal(false)}
                  className="p-1.5 rounded-full text-slate-700 dark:text-slate-200 hover:text-slate-950 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#1e2636] cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {transferSuccess ? (
                <div className="py-6 text-center space-y-2">
                  <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 mx-auto flex items-center justify-center">
                    <Check className="w-6 h-6" />
                  </div>
                  <h4 className="font-bold text-base text-slate-950 dark:text-white">Transfer Completed!</h4>
                  <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                    {currencySymbol}{transferAmount} sent to {transferRecipient}.
                  </p>
                  <button
                    onClick={() => {
                      setTransferSuccess(false);
                      setShowTransferModal(false);
                    }}
                    className="mt-3 px-5 py-2 rounded-full bg-slate-950 text-white dark:bg-white dark:text-slate-950 font-bold text-xs shadow-xs cursor-pointer"
                  >
                    Done
                  </button>
                </div>
              ) : (
                <div className="mt-4 space-y-3">
                  <div>
                    <label className="text-[11px] font-bold text-slate-900 dark:text-slate-100 mb-1 block">
                      Recipient Dealer / Client
                    </label>
                    <input
                      type="text"
                      value={transferRecipient}
                      onChange={e => setTransferRecipient(e.target.value)}
                      className={`w-full text-xs px-3 py-2 rounded-xl border outline-none font-semibold ${
                        isDarkMode
                          ? 'bg-[#10141b] border-[#333d52] text-white'
                          : 'bg-slate-50 border-slate-300 text-slate-950'
                      }`}
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-slate-900 dark:text-slate-100 mb-1 block">
                      Amount ({currency})
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-xs text-slate-700 dark:text-slate-200">
                        {currencySymbol}
                      </span>
                      <input
                        type="number"
                        value={transferAmount}
                        onChange={e => setTransferAmount(e.target.value)}
                        className={`w-full text-xs pl-7 pr-3 py-2 rounded-xl border outline-none font-bold ${
                          isDarkMode
                            ? 'bg-[#10141b] border-[#333d52] text-white'
                            : 'bg-slate-50 border-slate-300 text-slate-950'
                        }`}
                      />
                    </div>
                  </div>

                  <div className="pt-2 flex items-center justify-end gap-2.5">
                    <button
                      onClick={() => setShowTransferModal(false)}
                      className="px-3 py-1.5 text-xs font-bold text-slate-800 dark:text-slate-200 hover:text-slate-950 dark:hover:text-white cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleTransferSubmit}
                      className="px-5 py-2 rounded-full bg-gradient-to-r from-[#1f6b4f] to-[#14532d] text-white font-bold text-xs shadow-xs shadow-emerald-950/20 cursor-pointer"
                    >
                      Confirm Transfer
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* REQUEST MODAL (PRESERVED) */}
      <AnimatePresence>
        {showRequestModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 overflow-y-auto vertix-dashboard-scroll">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className={`w-full max-w-sm max-h-[90dvh] overflow-y-auto vertix-dashboard-scroll rounded-3xl p-5 shadow-2xl border my-auto ${
                isDarkMode ? 'bg-[#161b24] border-[#2d3648] text-white' : 'bg-white border-slate-300 text-slate-950'
              }`}
            >
              <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-[#2d3648]">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 flex items-center justify-center">
                    <ArrowDownLeft className="w-3.5 h-3.5" />
                  </div>
                  <h3 className="font-extrabold text-sm text-slate-950 dark:text-white">Payment Request</h3>
                </div>
                <button
                  onClick={() => setShowRequestModal(false)}
                  className="p-1.5 rounded-full text-slate-700 dark:text-slate-200 hover:text-slate-950 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#1e2636] cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {requestSuccess ? (
                <div className="py-6 text-center space-y-2">
                  <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 mx-auto flex items-center justify-center">
                    <Check className="w-6 h-6" />
                  </div>
                  <h4 className="font-bold text-base text-slate-950 dark:text-white">Invoice Dispatched!</h4>
                  <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                    Payment link for {currencySymbol}{requestAmount} sent to {requestFrom}.
                  </p>
                  <button
                    onClick={() => {
                      setRequestSuccess(false);
                      setShowRequestModal(false);
                    }}
                    className="mt-3 px-5 py-2 rounded-full bg-slate-950 text-white dark:bg-white dark:text-slate-950 font-bold text-xs shadow-xs cursor-pointer"
                  >
                    Done
                  </button>
                </div>
              ) : (
                <div className="mt-4 space-y-3">
                  <div>
                    <label className="text-[11px] font-bold text-slate-900 dark:text-slate-100 mb-1 block">
                      Subscriber / Entity Name
                    </label>
                    <input
                      type="text"
                      value={requestFrom}
                      onChange={e => setRequestFrom(e.target.value)}
                      className={`w-full text-xs px-3 py-2 rounded-xl border outline-none font-semibold ${
                        isDarkMode
                          ? 'bg-[#10141b] border-[#333d52] text-white'
                          : 'bg-slate-50 border-slate-300 text-slate-950'
                      }`}
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-slate-900 dark:text-slate-100 mb-1 block">
                      Request Amount ({currency})
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-xs text-slate-700 dark:text-slate-200">
                        {currencySymbol}
                      </span>
                      <input
                        type="number"
                        value={requestAmount}
                        onChange={e => setRequestAmount(e.target.value)}
                        className={`w-full text-xs pl-7 pr-3 py-2 rounded-xl border outline-none font-bold ${
                          isDarkMode
                            ? 'bg-[#10141b] border-[#333d52] text-white'
                            : 'bg-slate-50 border-slate-300 text-slate-950'
                        }`}
                      />
                    </div>
                  </div>

                  <div className="pt-2 flex items-center justify-end gap-2.5">
                    <button
                      onClick={() => setShowRequestModal(false)}
                      className="px-3 py-1.5 text-xs font-bold text-slate-800 dark:text-slate-200 hover:text-slate-950 dark:hover:text-white cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleRequestSubmit}
                      className="px-5 py-2 rounded-full bg-slate-950 text-white dark:bg-white dark:text-slate-950 font-bold text-xs shadow-xs cursor-pointer"
                    >
                      Dispatch Request
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* LOAN CREDIT CHECK & BORROW MODAL */}
      <AnimatePresence>
        {showLoanModal && (
          <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/80 overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className={`w-full max-w-md rounded-3xl p-6 shadow-2xl border relative z-10 my-auto ${
                isDarkMode ? 'bg-[#161b24] border-[#2d3648] text-white' : 'bg-white border-slate-300 text-slate-950'
              }`}
            >
              <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-[#2d3648]">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-blue-500/15 text-blue-700 dark:text-blue-300 flex items-center justify-center border border-blue-500/30">
                    <Award className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-black text-sm uppercase tracking-wider text-slate-950 dark:text-white">Credit & Loan Facility</h3>
                    <p className="text-[10px] text-slate-700 dark:text-slate-300 font-bold uppercase tracking-widest">Green Radius OS Financing</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowLoanModal(false)}
                  className="p-1.5 rounded-full text-slate-700 dark:text-slate-200 hover:text-slate-950 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#1e2636] cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="py-6 text-center space-y-4">
                {loanStep === 'check' && (
                  <div className="space-y-4">
                    <div className="w-16 h-16 rounded-3xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 flex items-center justify-center mx-auto shadow-inner">
                      <Zap className="w-8 h-8" />
                    </div>
                    <div>
                      <h4 className="font-extrabold text-base text-slate-950 dark:text-white">Check Your Credits</h4>
                      <p className="text-xs font-medium text-slate-700 dark:text-slate-200 mt-1">
                        Verify your available credit score and admin approved borrowing limit for instant network reload.
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        setLoanStep('animating');
                        setAnimatedCreditScore(1000);
                        let current = 1000;
                        const target = assignedCreditLimit;
                        const stepTime = 20;
                        const totalDuration = 1200;
                        const steps = totalDuration / stepTime;
                        const increment = (target - 1000) / steps;

                        const timer = setInterval(() => {
                          current += increment;
                          if (current >= target) {
                            current = target;
                            clearInterval(timer);
                            setAnimatedCreditScore(target);
                            setLoanStep('result');
                          } else {
                            setAnimatedCreditScore(Math.round(current));
                          }
                        }, stepTime);
                      }}
                      className="w-full py-3 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-black text-xs uppercase tracking-widest shadow-lg shadow-blue-500/25 cursor-pointer transition-colors"
                    >
                      Check Credit Score
                    </button>
                  </div>
                )}

                {loanStep === 'animating' && (
                  <div className="py-8 space-y-4">
                    <div className="relative w-32 h-32 mx-auto flex items-center justify-center">
                      <div className="absolute inset-0 rounded-full border-4 border-blue-500/20 border-t-blue-600 animate-spin" />
                      <div className="flex flex-col items-center justify-center">
                        <span className="text-[10px] font-black uppercase text-slate-700 dark:text-slate-200">Scanning</span>
                        <span className="text-2xl font-black text-blue-700 dark:text-blue-300 tabular-nums">
                          {animatedCreditScore.toLocaleString()}
                        </span>
                      </div>
                    </div>
                    <p className="text-xs font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider">
                      Credit Analysis...
                    </p>
                  </div>
                )}

                {loanStep === 'result' && (
                  <div className="space-y-4">
                    <div className="p-4 rounded-2xl bg-slate-100 dark:bg-[#10141b] border border-slate-300 dark:border-[#333d52] text-center">
                      <span className="text-[10px] font-black text-slate-700 dark:text-slate-300 uppercase tracking-widest block mb-1">Approved Credit Score</span>
                      <h2 className="text-4xl font-black text-emerald-700 dark:text-emerald-300 tracking-tight tabular-nums">
                        {assignedCreditLimit.toLocaleString()}
                      </h2>
                      <p className="text-[11px] font-bold text-slate-700 dark:text-slate-200 mt-1">
                        Authorized Load Limit: <span className="text-slate-950 dark:text-white font-black">Rs. {assignedCreditLimit.toLocaleString()}</span>
                      </p>
                    </div>

                    <div className="flex gap-3">
                      <button
                        onClick={() => setLoanStep('check')}
                        className="flex-1 py-3 rounded-xl border border-slate-300 dark:border-[#333d52] text-slate-900 dark:text-slate-100 font-extrabold text-xs uppercase tracking-wider hover:bg-slate-100 dark:hover:bg-[#1e2636] transition-colors cursor-pointer"
                      >
                        Recheck
                      </button>
                      <button
                        onClick={() => {
                          setBorrowAmount('');
                          setLoanStep('borrow');
                        }}
                        className="flex-1 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs uppercase tracking-widest shadow-lg shadow-emerald-500/25 cursor-pointer transition-colors"
                      >
                        Borrow Load
                      </button>
                    </div>
                  </div>
                )}

                {loanStep === 'borrow' && (
                  <div className="space-y-4 text-left">
                    <div>
                      <label className="text-[11px] font-extrabold text-slate-900 dark:text-slate-100 mb-1.5 block uppercase tracking-wider">
                        Enter Amount to Borrow (Max: Rs. {assignedCreditLimit.toLocaleString()})
                      </label>
                      <div className="relative">
                        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-black text-xs text-slate-700 dark:text-slate-200">
                          Rs.
                        </span>
                        <input
                          type="number"
                          value={borrowAmount}
                          onChange={e => setBorrowAmount(e.target.value)}
                          placeholder={`Enter <= ${assignedCreditLimit}`}
                          className={`w-full text-sm font-black pl-10 pr-4 py-3 rounded-xl border outline-none ${
                            isDarkMode
                              ? 'bg-[#10141b] border-[#333d52] text-white'
                              : 'bg-slate-50 border-slate-300 text-slate-950'
                          }`}
                        />
                      </div>
                    </div>

                    <div className="p-3 rounded-xl bg-amber-500/15 border border-amber-500/40 text-[11px] font-bold text-amber-900 dark:text-amber-200">
                      ⚡ The borrowed load amount will be added directly to your Total Balance instantly.
                    </div>

                    <div className="pt-2 flex items-center justify-end gap-3">
                      <button
                        onClick={() => setLoanStep('result')}
                        className="px-4 py-2.5 text-xs font-bold text-slate-800 dark:text-slate-200 hover:text-slate-950 dark:hover:text-white cursor-pointer"
                      >
                        Back
                      </button>
                      <button
                        onClick={() => {
                          const val = Number(borrowAmount);
                          if (!val || val <= 0) {
                            addToast("Please enter a valid loan amount.", "error");
                            return;
                          }
                          if (val > assignedCreditLimit) {
                            addToast(`Requested amount exceeds your assigned credit limit of Rs. ${assignedCreditLimit.toLocaleString()}`, "error");
                            return;
                          }

                          const currentBal = store.totalBalancePKR || 0;
                          const newBal = currentBal + val;
                          if (typeof (store as any).setTotalBalancePKR === 'function') {
                            (store as any).setTotalBalancePKR(newBal);
                          } else {
                            (store as any).totalBalancePKR = newBal;
                          }
                          addToast(`🎉 LOAN DISBURSED SUCCESSFULLY: Rs. ${val.toLocaleString()} added to your Total Balance.`, "success");
                          setShowLoanModal(false);
                        }}
                        className="px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs uppercase tracking-widest shadow-lg shadow-emerald-500/25 cursor-pointer transition-colors"
                      >
                        Confirm & Add to Balance
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
    </SkVariantProvider>
  );
}

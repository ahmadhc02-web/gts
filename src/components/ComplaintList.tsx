import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Trash2, Clock, CheckCircle, AlertCircle, PlayCircle, Printer, FileDown, Calendar, MapPin, Phone, User, X, ChevronRight, ChevronLeft, ChevronUp, ChevronDown, Download, Wifi, Pencil, Save, CloudUpload, Package, MapPinned, Send, Users, Activity, RotateCcw, FileSpreadsheet, Flag, UserPlus, Info, Sparkles } from 'lucide-react';
import { Complaint, ComplaintStatus, ComplaintCategory, ComplaintPriority, UserProfile, BrandingConfig } from '../types';
import { cn } from '../lib/utils';
import { getCardStyle } from '../lib/styleUtils';
import { Network, ShieldAlert, Zap, Layers } from 'lucide-react';
import { googleSheetsService } from '../services/googleSheetsService';
import { toast } from 'sonner';
import { AppConfig, DEFAULT_STATUSES, DEFAULT_PRIORITIES } from '../constants';
import { calculateProtocolProgress } from '../utils/protocolProgress';

interface ComplaintListProps {
  complaints: Complaint[];
  onDelete?: (id: string) => Promise<void>;
  onStatusChange?: (id: string, status: ComplaintStatus, remarks?: string, customerReview?: string) => Promise<void>;
  onUpdateRemarks?: (id: string, remarks: string) => Promise<void>;
  onEdit?: (id: string, data: Partial<Complaint>) => Promise<void>;
  isAdmin?: boolean;
  currentUser: UserProfile;
  forcedStatusFilter?: ComplaintStatus | 'all';
  forcedPriorityFilter?: ComplaintPriority | 'all';
  forcedCategoryFilter?: ComplaintCategory | 'all';
  appConfig: AppConfig;
  branding: BrandingConfig;
}

const getEffectiveStatus = (c: Complaint, currentTime: number = Date.now()): ComplaintStatus => {
  if (c.status === 'scheduled' && c.scheduledAt) {
    const TWELVE_HOURS = 12 * 60 * 60 * 1000;
    if (c.scheduledAt - currentTime <= TWELVE_HOURS) {
      return 'pending';
    }
  }
  return c.status;
};

export default function ComplaintList({ 
  complaints, 
  onDelete, 
  onStatusChange, 
  onUpdateRemarks,
  onEdit,
  isAdmin,
  currentUser,
  forcedStatusFilter = 'all',
  forcedPriorityFilter = 'all',
  forcedCategoryFilter = 'all',
  appConfig,
  branding
}: ComplaintListProps) {
  const now = Date.now();
  const customNames = branding.customNames || {};
  const currentUserId = currentUser.uid;
  const [startDate, setStartDate] = React.useState('');
  const [endDate, setEndDate] = React.useState('');
  const [timeRange, setTimeRange] = React.useState('All Time');
  const [timeRangeOpen, setTimeRangeOpen] = React.useState(false);
  const [exportOpen, setExportOpen] = React.useState(false);
  const [statusFilter, setStatusFilter] = React.useState<ComplaintStatus | 'all'>(forcedStatusFilter);
  const [priorityFilter, setPriorityFilter] = React.useState<ComplaintPriority | 'all'>(forcedPriorityFilter);
  const [categoryFilter, setCategoryFilter] = React.useState<ComplaintCategory | 'all'>(forcedCategoryFilter);
  const [zoneFilter, setZoneFilter] = React.useState<string | 'all'>('all');
  const [searchQuery, setSearchQuery] = React.useState('');
  const [currentPage, setCurrentPage] = React.useState(1);
  const [itemsPerPage, setItemsPerPage] = React.useState(20);
  const [selectedComplaint, setSelectedComplaint] = React.useState<Complaint | null>(null);
  const [statusRemarks, setStatusRemarks] = React.useState('');
  const [customerReview, setCustomerReview] = React.useState('');
  const [hideStatusRemarksBox, setHideStatusRemarksBox] = React.useState(false);
  const [hideCustomerReviewBox, setHideCustomerReviewBox] = React.useState(false);
  const [isEditingRemarks, setIsEditingRemarks] = React.useState(false);
  const [editedRemarks, setEditedRemarks] = React.useState('');
  const [animateRemarksLeft, setAnimateRemarksLeft] = React.useState(false);
  const [animateReviewLeft, setAnimateReviewLeft] = React.useState(false);
  const [showLeftThankYou, setShowLeftThankYou] = React.useState(false);
  const [showScheduleModal, setShowScheduleModal] = React.useState(false);
  const [showInlineSchedulePicker, setShowInlineSchedulePicker] = React.useState(false);
  const [scheduleModalDate, setScheduleModalDate] = React.useState('');

  const playPopupSound = () => {
    try {
      const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2358/2358-preview.mp3');
      audio.volume = 0.4;
      audio.play().catch(e => console.log('Audio play blocked:', e));
    } catch (e) {
      console.log('Audio error:', e);
    }
  };

  const handleTimeRangeChange = (range: string) => {
    setTimeRange(range);
    setTimeRangeOpen(false);
    
    const today = new Date();
    
    if (range === 'Today') {
      const todayStr = today.toISOString().split('T')[0];
      setStartDate(todayStr);
      setEndDate(todayStr);
    } else if (range === 'Yesterday') {
      const yesterday = new Date();
      yesterday.setDate(today.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split('T')[0];
      setStartDate(yesterdayStr);
      setEndDate(yesterdayStr);
    } else if (range === 'Last 7 Days') {
      const last7 = new Date();
      last7.setDate(today.getDate() - 7);
      const last7Str = last7.toISOString().split('T')[0];
      const todayStr = today.toISOString().split('T')[0];
      setStartDate(last7Str);
      setEndDate(todayStr);
    } else if (range === 'This Month') {
      const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
      const firstDayStr = firstDay.toISOString().split('T')[0];
      const lastDayStr = today.toISOString().split('T')[0];
      setStartDate(firstDayStr);
      setEndDate(lastDayStr);
    } else if (range === 'All Time') {
      setStartDate('');
      setEndDate('');
    }
  };

  React.useEffect(() => {
    if (selectedComplaint) {
      playPopupSound();
      setStatusRemarks(selectedComplaint.remarks || '');
      setCustomerReview(selectedComplaint.customerReview || '');
      setHideStatusRemarksBox(!!selectedComplaint.remarks);
      setHideCustomerReviewBox(!!selectedComplaint.customerReview);
      setAnimateRemarksLeft(false);
      setAnimateReviewLeft(false);
      setShowLeftThankYou(false);
    } else {
      setStatusRemarks('');
      setCustomerReview('');
      setHideStatusRemarksBox(false);
      setHideCustomerReviewBox(false);
      setAnimateRemarksLeft(false);
      setAnimateReviewLeft(false);
      setShowLeftThankYou(false);
    }
  }, [selectedComplaint]);
  const [sortConfig, setSortConfig] = React.useState<{
    key: keyof Complaint | 'registry' | 'urgency' | 'client' | 'tactical' | 'category' | 'profile';
    direction: 'asc' | 'desc';
  }>({ key: 'registry', direction: 'desc' });

  // Edit state
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [editData, setEditData] = React.useState<Partial<Complaint>>({});

  React.useEffect(() => {
    setStatusFilter(forcedStatusFilter);
  }, [forcedStatusFilter]);

  React.useEffect(() => {
    setPriorityFilter(forcedPriorityFilter);
  }, [forcedPriorityFilter]);

  React.useEffect(() => {
    setCategoryFilter(forcedCategoryFilter);
  }, [forcedCategoryFilter]);

  React.useEffect(() => {
    setCurrentPage(1);
  }, [statusFilter, priorityFilter, categoryFilter, zoneFilter, searchQuery, startDate, endDate]);

  const getFilteredComplaints = () => {
    let filtered = [...complaints];
    
    // Search filter
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(c => 
        c.customerName.toLowerCase().includes(q) || 
        (c.customerUsername && c.customerUsername.toLowerCase().includes(q)) ||
        c.number.toLowerCase().includes(q) || 
        c.area.toLowerCase().includes(q) ||
        (c.pkgDetails && c.pkgDetails.toLowerCase().includes(q)) ||
        (c.userNearby && c.userNearby.toLowerCase().includes(q)) ||
        (c.panelDetails && c.panelDetails.toLowerCase().includes(q)) ||
        (c.memberName && c.memberName.toLowerCase().includes(q)) ||
        c.description.toLowerCase().includes(q)
      );
    }
    
    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(c => {
        const effStatus = getEffectiveStatus(c, now);
        if (statusFilter === 'pending') {
          return effStatus === 'pending';
        }
        if (statusFilter === 'scheduled') {
          return c.status === 'scheduled';
        }
        return effStatus === statusFilter;
      });
    }

    // Priority filter
    if (priorityFilter !== 'all') {
      filtered = filtered.filter(c => c.priority === priorityFilter);
    }

    // Category filter
    if (categoryFilter !== 'all') {
      filtered = filtered.filter(c => c.category === categoryFilter);
    }

    // Zone filter
    if (zoneFilter !== 'all') {
      filtered = filtered.filter(c => c.area === zoneFilter);
    }

    // Date filters
    if (startDate) {
      const start = new Date(startDate).setHours(0, 0, 0, 0);
      filtered = filtered.filter(c => c.createdAt >= start);
    }
    if (endDate) {
      const end = new Date(endDate).setHours(23, 59, 59, 999);
      filtered = filtered.filter(c => c.createdAt <= end);
    }

    // 12h Scheduled Rule
    const TWELVE_HOURS = 12 * 60 * 60 * 1000;
    filtered = filtered.filter(c => {
      if (statusFilter === 'scheduled') return true;
      if (c.status === 'scheduled' && c.scheduledAt) {
        return c.scheduledAt - now <= TWELVE_HOURS;
      }
      return true;
    });

    // Comprehensive Sorting
    filtered.sort((a, b) => {
      // Prioritize active scheduled complaints at the absolute top of the list
      const aIsSch = a.status === 'scheduled' && !!a.scheduledAt;
      const bIsSch = b.status === 'scheduled' && !!b.scheduledAt;
      if (aIsSch && !bIsSch) return -1;
      if (!aIsSch && bIsSch) return 1;
      if (aIsSch && bIsSch) {
        return (a.scheduledAt || 0) - (b.scheduledAt || 0); // sort earlier scheduled times first
      }

      let valA: any;
      let valB: any;

      switch (sortConfig.key) {
        case 'client':
          valA = a.customerName.toLowerCase();
          valB = b.customerName.toLowerCase();
          break;
        case 'tactical':
          valA = a.area.toLowerCase();
          valB = b.area.toLowerCase();
          break;
        case 'description':
          valA = a.description.toLowerCase();
          valB = b.description.toLowerCase();
          break;
        case 'urgency':
          const priorityWeight = { 'Critical': 4, 'High': 3, 'Medium': 2, 'Low': 1 };
          valA = priorityWeight[a.priority || 'Low'] || 0;
          valB = priorityWeight[b.priority || 'Low'] || 0;
          break;
        case 'status':
          const statusWeight = { 'pending': 1, 'in process': 2, 'scheduled': 3, 'important': 4, 'complete': 5 };
          valA = statusWeight[getEffectiveStatus(a, now)] || 0;
          valB = statusWeight[getEffectiveStatus(b, now)] || 0;
          break;
        case 'category':
          valA = (a.category || '').toLowerCase();
          valB = (b.category || '').toLowerCase();
          break;
        case 'profile':
          valA = (a.pkgDetails || '').toLowerCase();
          valB = (b.pkgDetails || '').toLowerCase();
          break;
        case 'registry':
          valA = a.createdAt;
          valB = b.createdAt;
          break;
        default:
          valA = (a as any)[sortConfig.key];
          valB = (b as any)[sortConfig.key];
      }

      if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
      if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });

    return filtered;
  };

  const handleSort = (key: typeof sortConfig.key) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const setFilterToday = () => {
    const today = new Date().toISOString().split('T')[0];
    setStartDate(today);
    setEndDate(today);
  };

  const setFilterYesterday = () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yStr = yesterday.toISOString().split('T')[0];
    setStartDate(yStr);
    setEndDate(yStr);
  };

  const clearDateFilters = () => {
    setStartDate('');
    setEndDate('');
  };

  const filteredComplaints = React.useMemo(() => {
    return getFilteredComplaints();
  }, [complaints, searchQuery, statusFilter, priorityFilter, categoryFilter, zoneFilter, startDate, endDate, sortConfig]);

  // Pagination Logic
  const totalPages = Math.ceil(filteredComplaints.length / itemsPerPage);
  const paginatedComplaints = filteredComplaints.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const getStatusColor = (status: ComplaintStatus) => {
    switch (status) {
      case 'complete': return 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20';
      case 'in process': return 'text-blue-500 bg-blue-500/10 border-blue-500/20';
      case 'scheduled': return 'text-purple-500 bg-purple-500/10 border-purple-500/20';
      case 'important': return 'text-amber-500 bg-amber-500/10 border-amber-500/20 shadow-sm shadow-amber-500/10';
      case 'pending': default: return 'text-slate-400 bg-slate-400/10 border-slate-400/20';
    }
  };

  const getPriorityColor = (priority: ComplaintPriority) => {
    switch (priority) {
      case 'Critical': return 'bg-rose-500 text-white border-rose-600 shadow-lg shadow-rose-500/20';
      case 'High': return 'bg-orange-500/10 text-orange-500 border-orange-500/20';
      case 'Medium': return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
      case 'Low': default: return 'bg-slate-500/10 text-slate-500 border-slate-500/20';
    }
  };

  const getStatusIcon = (status: ComplaintStatus) => {
    if (status === 'complete') {
      return (
        <motion.div
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ 
            type: "spring",
            stiffness: 260,
            damping: 20 
          }}
        >
          <CheckCircle size={16} className="text-emerald-500" />
        </motion.div>
      );
    }
    return <Wifi size={16} className={cn(
      "transition-all duration-500 animate-pulse"
    )} />;
  };

  const exportToPDF = () => {
    const filtered = getFilteredComplaints();
    if (filtered.length === 0) {
      toast.error('No records found for the selected parameters.');
      return;
    }
    const doc = new jsPDF();
    doc.setFontSize(20);
    doc.setTextColor(15, 23, 42); 
    doc.text('Green Tech Services', 14, 22);
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text('Operations Registry Export | Enterprise Management System', 14, 30);
    doc.text(`Official Log Date: ${new Date().toLocaleString()}`, 14, 35);
    const tableRows = filtered.map(c => [
      c.customerName,
      c.customerUsername || 'N/A',
      c.category,
      c.priority,
      c.status.toUpperCase(),
      c.area,
      c.panelDetails || 'N/A',
      c.pkgDetails || 'N/A',
      c.userNearby || 'N/A',
      c.description,
      c.remarks || 'N/A',
      new Date(c.createdAt).toLocaleDateString()
    ]);
    autoTable(doc, {
      startY: 45,
      head: [['Client', 'Username', 'Category', 'Priority', 'Status', 'Sector', 'Panel Details', 'Package', 'Nearby', 'Dispatch Details', 'Team Remarks', 'Date']],
      body: tableRows,
      theme: 'grid',
      headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255] },
      styles: { fontSize: 7 }
    });
    doc.save(`GreenTech_Registry_${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  const exportToCSV = () => {
    const filtered = getFilteredComplaints();
    if (filtered.length === 0) {
      toast.error('No records found for the selected parameters.');
      return;
    }

    const headers = ['Client', 'Username', 'Category', 'Priority', 'Status', 'Sector', 'Panel Details', 'Package', 'Nearby', 'Dispatch Details', 'Team Remarks', 'Date'];
    const rows = filtered.map(c => [
      c.customerName,
      c.customerUsername || 'N/A',
      c.category,
      c.priority,
      c.status.toUpperCase(),
      c.area,
      c.panelDetails || 'N/A',
      c.pkgDetails || 'N/A',
      c.userNearby || 'N/A',
      `"${c.description.replace(/"/g, '""')}"`,
      `"${(c.remarks || 'N/A').replace(/"/g, '""')}"`,
      new Date(c.createdAt).toLocaleDateString()
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(r => r.join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `GreenTech_Registry_${new Date().toISOString().slice(0, 10)}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const [isBackingUp, setIsBackingUp] = React.useState(false);
  const [isGoogleConnected, setIsGoogleConnected] = React.useState(!!googleSheetsService.getTokens());

  React.useEffect(() => {
    const handleAuthChange = (e: any) => {
      setIsGoogleConnected(!!e.detail);
    };
    window.addEventListener('google-auth-changed', handleAuthChange);
    return () => window.removeEventListener('google-auth-changed', handleAuthChange);
  }, []);

  const handleBackupToDrive = async () => {
    const filtered = getFilteredComplaints();
    if (filtered.length === 0) {
      toast.error('No operational records found for the selected parameters.');
      return;
    }

    let tokens = googleSheetsService.getTokens();
    const isAlreadyConnected = !!tokens;

    if (!isAlreadyConnected) {
      if (confirm('Google account not connected. Connect now to backup to Drive?')) {
        try {
          // Explicitly wait for auth to complete
          const tokens = await googleSheetsService.initiateAuth();
          setIsGoogleConnected(true);
          console.log('Successfully connected to Google');
          // Give the user a moment to see the connection happened
          toast.success('Connected! Initializing backup...');
        } catch (error: any) {
          console.warn('Auth failed or window closed:', error);
          return; // Auth failed or window closed
        }
      } else {
        return;
      }
    }

    // Now proceed with tokens (tokens should be available here if connected)
    setIsBackingUp(true);
    try {
      const headers = ['Client', 'Username', 'Category', 'Priority', 'Status', 'Sector', 'Panel Details', 'Package', 'Nearby', 'Dispatch Details', 'Team Remarks', 'Date'];
      const rows = filtered.map(c => [
        c.customerName,
        c.customerUsername || 'N/A',
        c.category,
        c.priority || 'Medium',
        c.status.toUpperCase(),
        c.area,
        c.panelDetails || 'N/A',
        c.pkgDetails || 'N/A',
        c.userNearby || 'N/A',
        `"${c.description.replace(/"/g, '""')}"`,
        `"${(c.remarks || 'N/A').replace(/"/g, '""')}"`,
        new Date(c.createdAt).toLocaleDateString()
      ]);

      const csvContent = [
        headers.join(','),
        ...rows.map(r => r.join(','))
      ].join('\n');

      const filename = `Backup_GreenTech_${new Date().toISOString().slice(0, 10)}.csv`;
      
      console.log('Uploading backup to Drive...');
      await googleSheetsService.backupToDrive(filename, csvContent);
      toast.success('SUCCESS! Operations backup has been securely archived in your "GreenTech_Backups" folder on Google Drive.');
    } catch (error: any) {
      console.error('Critical Backup Error:', error instanceof Error ? error.message : String(error));
      const errorMessage = error.message || '';
      
      if (errorMessage.includes('insufficient permissions') || errorMessage.includes('403') || errorMessage.includes('401')) {
        if (confirm('Security token expired or lacks Drive permissions. Re-connect now?')) {
          try {
            await googleSheetsService.initiateAuth();
            setIsGoogleConnected(true);
            toast.success('Security clearance granted! Please try the backup again.');
          } catch (authError) {
            console.error('Re-auth failed:', authError instanceof Error ? authError.message : String(authError));
          }
        }
      } else if (errorMessage.toLowerCase().includes('account not connected')) {
         setIsGoogleConnected(false);
         toast.error('Local security cleared. Please re-authenticate your Google account.');
      } else {
        toast.error('SYSTEM ERROR: Backup sequence failed. ' + errorMessage);
      }
    } finally {
      setIsBackingUp(false);
    }
  };

  const handleGoogleDisconnect = () => {
    if (confirm('Disconnect Google account? You will need to re-connect to backup to Drive.')) {
      googleSheetsService.clearAuth();
      setIsGoogleConnected(false);
    }
  };

  const [complaintToDelete, setComplaintToDelete] = React.useState<string | null>(null);

  const confirmDelete = () => {
    if (complaintToDelete && onDelete) {
      // Execute deletion without awaiting to make UI feel instant
      onDelete(complaintToDelete).catch(err => {
        console.error("Delete failed:", err);
        toast.error("Critical failure during record termination.");
      });
      setComplaintToDelete(null);
      setSelectedComplaint(null);
    }
  };

  return (
    <div className="space-y-8">
      {/* Print-only CSS Stylesheet overrides to format complaint list for A4 Portrait paper */}
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          /* Setup A4 Page Layout */
          @page {
            size: A4 portrait;
            margin: 12mm 12mm 12mm 12mm;
          }

          /* Force exact print background adjustments & override colors */
          body, html, #root, .space-y-8, table, tr, td, th {
            background: #ffffff !important;
            background-color: #ffffff !important;
            color: #0c0f17 !important;
            box-shadow: none !important;
            text-shadow: none !important;
            border-color: #cccccc !important;
          }

          /* General element reset for crisp print typography with Arial constraint */
          * {
            font-family: Arial, "Helvetica Neue", Helvetica, sans-serif !important;
            transition: none !important;
            animation: none !important;
            box-shadow: none !important;
            text-shadow: none !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          /* Hide UI layout: navigation bar, sidebar, chatbot, buttons, tabs, dropdowns, limit controls, pagination */
          header,
          aside,
          footer,
          #rail-menu-btn,
          #sidebar-toggle-btn,
          .print\\:hidden,
          .fixed,
          button,
          select,
          input,
          nav,
          .toast,
          .sonner,
          iframe,
          .mb-6,
          /* Hide search/filter bar container */
          .bg-slate-50\\/50, 
          /* Hide parent section/filters block */
          .grid,
          .flex-wrap,
          .overflow-x-auto::-webkit-scrollbar,
          /* Hide pagination wrapper */
          .px-6.py-4.bg-slate-50 {
            display: none !important;
          }

          /* Allow content container to stretch full length */
          .min-h-screen, 
          .min-h-screen > div, 
          main, 
          .overflow-hidden,
          .overflow-x-auto,
          .space-y-8,
          div {
            overflow: visible !important;
            display: block !important;
            width: 100% !important;
            max-width: 100% !important;
            padding: 0 !important;
            margin: 0 !important;
            box-shadow: none !important;
            border: none !important;
            transform: none !important;
            min-height: 0 !important;
            height: auto !important;
          }

          /* Strict table optimization for A4 width boundary */
          table {
            display: table !important;
            width: 100% !important;
            min-width: 0 !important;
            border-collapse: collapse !important;
            margin-top: 10px !important;
            page-break-inside: auto !important;
          }

          tr {
            page-break-inside: avoid !important;
            page-break-after: auto !important;
          }

          thead {
            display: table-header-group !important;
          }

          th, td {
            padding: 7px 8px !important;
            font-size: 9.5px !important;
            border-bottom: 1px solid #c0c0c0 !important;
            text-align: left !important;
            color: #0c0f17 !important;
            background: transparent !important;
          }

          th {
            border-bottom: 2px solid #000000 !important;
            font-weight: bold !important;
            text-transform: uppercase !important;
            letter-spacing: 0.05em !important;
          }

          /* Hide Quick Actions column (last column) when printing list */
          th:last-child,
          td:last-child {
            display: none !important;
          }

          /* Ensure category badge, priority & status indicators align cleanly without fancy colors */
          .status-print-indicator,
          .priority-print-indicator {
            font-weight: bold !important;
            text-transform: uppercase !important;
            color: #000000 !important;
          }
        }
      ` }} />

      {/* Modern, Highly Polished Print-Only Header (Invisible in Dashboard context) */}
      <div className="hidden print:block border-b-2 border-black pb-4 mb-6">
        <div className="flex justify-between items-end">
          <div>
            <h1 className="text-xl font-bold uppercase tracking-wider text-slate-950 font-sans">
              GTS Operational Complaints Registry
            </h1>
            <p className="text-xs text-slate-500 font-sans mt-1">
              Enterprise Network & Client Status Management System
            </p>
          </div>
          <div className="text-right text-[10px] font-mono text-slate-500">
            <p className="font-bold">Date Exported: {new Date().toLocaleString()}</p>
            <p>Active Scope: {timeRange} // {filteredComplaints.length} Records</p>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {complaintToDelete && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.1 }}
              onClick={() => setComplaintToDelete(null)}
              className="absolute inset-0 bg-slate-950/40 backdrop-blur-[1px]"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.97, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.97, y: 10 }}
              transition={{ duration: 0.1, ease: 'easeOut' }}
              className="relative w-full max-w-sm bg-white dark:bg-slate-950 rounded-2xl shadow-2xl border border-rose-500/30 overflow-hidden"
            >
              <div className="p-8 text-center space-y-6">
                <div className="w-16 h-16 bg-rose-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <ShieldAlert size={32} className="text-rose-500 animate-pulse" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-xl font-black uppercase tracking-tight text-slate-900 dark:text-white">Security Protocol</h3>
                  <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest leading-loose">
                    Permanently terminate this operational record from the central registry?
                  </p>
                </div>
                <div className="flex flex-col gap-3">
                  <button
                    onClick={confirmDelete}
                    className="w-full py-3 rounded-xl bg-rose-500 text-white font-black uppercase tracking-widest text-[11px] shadow-lg shadow-rose-500/20 hover:bg-rose-600 transition-all active:scale-95"
                  >
                    Confirm Termination
                  </button>
                  <button
                    onClick={() => setComplaintToDelete(null)}
                    className="w-full py-3 rounded-xl border-2 border-slate-100 dark:border-slate-800 text-slate-500 font-black uppercase tracking-widest text-[11px] hover:bg-slate-50 dark:hover:bg-slate-900 transition-all"
                  >
                    Cancel Action
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Header Area */}
      <div className="mb-6 flex flex-col items-center justify-center text-center gap-2">
        <h3 className="text-2xl font-black flex items-center justify-center gap-3 uppercase tracking-tight text-slate-900 dark:text-white">
          {customNames.complaint || 'Operational Registry'}
          <span className="text-xs font-black px-3 py-1 bg-brand-accent/10 border border-brand-accent/20 text-brand-accent rounded leading-none">
            {filteredComplaints.length} Records
          </span>
        </h3>
        <p className="text-[10px] text-slate-500 dark:text-slate-400 font-extrabold uppercase tracking-[0.2em] flex items-center justify-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          Real-time Logs <span className="text-slate-300 dark:text-slate-700">|</span> {complaints.filter(c => new Date(c.createdAt).toDateString() === new Date().toDateString()).length} entries today
        </p>
      </div>

      {/* Search Bar, Time Range & Action Line */}
      <div className="flex flex-col gap-4 bg-slate-50/50 dark:bg-slate-900/10 p-4 rounded-2xl border border-slate-200/50 dark:border-slate-800/60 mb-2">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          
          {/* Leftside search field */}
          <div className="relative flex-1 max-w-md">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
              <Printer size={16} />
            </span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search registry (Name, Phone, Area)..."
              className="w-full pl-11 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 text-xs font-semibold focus:ring-2 focus:ring-brand-accent/20 outline-none transition-all"
            />
          </div>

          {/* Quick Active and Dropdowns Section */}
          <div className="flex flex-wrap items-center gap-3">
            
            {/* Time Range dropdown card */}
            <div className="relative">
              <button
                onClick={() => setTimeRangeOpen(!timeRangeOpen)}
                className="flex items-center justify-between gap-2 px-4 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-350 shadow-sm min-w-[130px] hover:border-brand-accent transition-all cursor-pointer"
              >
                <span>{timeRange}</span>
                <ChevronDown size={14} className={cn("text-slate-400 transition-transform duration-300", timeRangeOpen && "rotate-180")} />
              </button>
              
              <AnimatePresence>
                {timeRangeOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 8 }}
                    className="absolute right-0 mt-2 w-48 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden z-50 text-left"
                  >
                    <div className="p-1.5 space-y-1">
                      {['Today', 'Yesterday', 'Last 7 Days', 'This Month', 'All Time'].map((r) => (
                        <button
                          key={r}
                          onClick={() => handleTimeRangeChange(r)}
                          className={cn(
                            "w-full text-left px-3 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer",
                            timeRange === r 
                              ? "bg-brand-accent/10 text-brand-accent" 
                              : "text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-900/60 hover:text-slate-900 dark:hover:text-white"
                          )}
                        >
                          {r}
                        </button>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* RESET filter action */}
            <button
              onClick={() => {
                clearDateFilters();
                setSearchQuery('');
                setStatusFilter('all');
                setPriorityFilter('all');
                setCategoryFilter('all');
                setZoneFilter('all');
                setTimeRange('All Time');
              }}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-black uppercase tracking-widest text-slate-400 hover:text-brand-accent hover:bg-slate-100 dark:hover:bg-slate-900 rounded-xl cursor-pointer transition-all"
            >
              <RotateCcw size={13} />
              <span>Reset</span>
            </button>

            {/* Split status filters pill toggler */}
            <div className="flex bg-slate-100 dark:bg-slate-900 p-1 rounded-xl border border-slate-200 dark:border-slate-800">
              <button
                onClick={() => setStatusFilter('all')}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all cursor-pointer",
                  statusFilter === 'all'
                    ? "bg-white dark:bg-slate-800 text-brand-accent shadow-sm"
                    : "text-slate-500 hover:text-slate-900 dark:hover:text-slate-355"
                )}
              >
                All
              </button>
              <button
                onClick={() => setStatusFilter('pending')}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all cursor-pointer",
                  statusFilter === 'pending'
                    ? "bg-white dark:bg-slate-800 text-brand-accent shadow-sm"
                    : "text-slate-500 hover:text-slate-900 dark:hover:text-slate-355"
                )}
              >
                Pending
              </button>
              <button
                onClick={() => setStatusFilter('in process')}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all cursor-pointer",
                  statusFilter === 'in process'
                    ? "bg-white dark:bg-slate-800 text-brand-accent shadow-sm"
                    : "text-slate-500 hover:text-slate-900 dark:hover:text-slate-330"
                )}
              >
                In Process
              </button>
              <button
                onClick={() => setStatusFilter('scheduled')}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all cursor-pointer",
                  statusFilter === 'scheduled'
                    ? "bg-white dark:bg-slate-800 text-brand-accent shadow-sm"
                    : "text-slate-500 hover:text-slate-900 dark:hover:text-slate-330"
                )}
              >
                Scheduled
              </button>
            </div>

            {/* EXPORT consolidated dropdown */}
            <div className="relative">
              <button
                onClick={() => setExportOpen(!exportOpen)}
                className="flex items-center gap-1.5 px-4 py-2 bg-slate-900 dark:bg-slate-850 hover:bg-black text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-md transition-all cursor-pointer border border-transparent dark:border-slate-800"
              >
                <Download size={13} />
                <span>Export</span>
                <ChevronDown size={11} className={cn("transition-transform duration-300", exportOpen && "rotate-180")} />
              </button>
              
              <AnimatePresence>
                {exportOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 8 }}
                    className="absolute right-0 mt-2 w-48 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden z-50 text-left"
                  >
                    <div className="p-1.5 space-y-1">
                      <button
                        onClick={() => {
                          exportToPDF();
                          setExportOpen(false);
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-900 rounded-lg transition-all cursor-pointer"
                      >
                        <FileDown size={14} className="text-rose-500" />
                        <span>Export PDF document</span>
                      </button>
                      <button
                        onClick={() => {
                          exportToCSV();
                          setExportOpen(false);
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-900 rounded-lg transition-all cursor-pointer"
                      >
                        <FileSpreadsheet size={14} className="text-emerald-500" />
                        <span>Export CSV datasheet</span>
                      </button>
                      <button
                        onClick={() => {
                          handleBackupToDrive();
                          setExportOpen(false);
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-900 rounded-lg transition-all cursor-pointer"
                      >
                        <CloudUpload size={14} className="text-blue-500" />
                        <span>Cloud Backup (Drive)</span>
                      </button>
                      <button
                        onClick={() => {
                          window.print();
                          setExportOpen(false);
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-900 rounded-lg transition-all cursor-pointer border-t border-slate-150 dark:border-slate-800/85 pt-1.5 mt-1"
                      >
                        <Printer size={14} className="text-indigo-500" />
                        <span>Print Registry (A4)</span>
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

          </div>
        </div>

        {/* Dropdown filters grid line */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2 border-t border-slate-200/40 dark:border-slate-800/40">
          <div>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value as any)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-[10px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-400 focus:ring-1 focus:ring-brand-accent/20 outline-none appearance-none"
              style={{ 
                backgroundPosition: 'right 0.75rem center', 
                backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' fill=\'none\' viewBox=\'0 0 24 24\' stroke=\'%2364748b\'%3E%3Cpath stroke-linecap=\'round\' stroke-linejoin=\'round\' stroke-width=\'2\' d=\'M19 9l-7 7-7-7\'/%3E%3C/svg%3E")', 
                backgroundSize: '0.85rem',
                backgroundRepeat: 'no-repeat'
              }}
            >
              <option value="all">ALL CATEGORIES</option>
              {appConfig.categories.map((cat, i) => (
                <option key={`cat-${i}`} value={cat}>{cat.toUpperCase()}</option>
              ))}
            </select>
          </div>

          <div>
            <select
              value={zoneFilter}
              onChange={(e) => setZoneFilter(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-[10px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-400 focus:ring-1 focus:ring-brand-accent/20 outline-none appearance-none"
              style={{ 
                backgroundPosition: 'right 0.75rem center', 
                backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' fill=\'none\' viewBox=\'0 0 24 24\' stroke=\'%2364748b\'%3E%3Cpath stroke-linecap=\'round\' stroke-linejoin=\'round\' stroke-width=\'2\' d=\'M19 9l-7 7-7-7\'/%3E%3C/svg%3E")', 
                backgroundSize: '0.85rem',
                backgroundRepeat: 'no-repeat'
              }}
            >
              <option value="all">ALL ZONES</option>
              {appConfig.zones?.map((zone, i) => (
                <option key={`zone-${i}`} value={zone}>{zone.toUpperCase()}</option>
              ))}
            </select>
          </div>

          <div>
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value as any)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-[10px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-400 focus:ring-1 focus:ring-brand-accent/20 outline-none appearance-none"
              style={{ 
                backgroundPosition: 'right 0.75rem center', 
                backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' fill=\'none\' viewBox=\'0 0 24 24\' stroke=\'%2364748b\'%3E%3Cpath stroke-linecap=\'round\' stroke-linejoin=\'round\' stroke-width=\'2\' d=\'M19 9l-7 7-7-7\'/%3E%3C/svg%3E")', 
                backgroundSize: '0.85rem',
                backgroundRepeat: 'no-repeat'
              }}
            >
              <option value="all">ALL PRIORITIES</option>
              {appConfig.priorities.map((pri, i) => (
                <option key={`pri-${i}`} value={pri}>{pri.toUpperCase()} PRIORITY</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Row-based Grid (Table View) - High-Fidelity Professional ISP Layout */}
      <motion.div 
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className={cn("overflow-hidden shadow-2xl border bg-white dark:bg-slate-950/40 border-slate-200/50 dark:border-slate-800/80 backdrop-blur-md", getCardStyle(branding.cardStyle))}
      >
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[1250px]">
            <thead className="bg-slate-50/75 dark:bg-slate-900/40 border-b border-slate-150 dark:border-slate-800/85">
              <tr>
                <th 
                  className="px-6 py-4 text-[10px] font-black uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500 cursor-pointer hover:text-brand-accent transition-colors"
                  onClick={() => handleSort('client')}
                >
                  <div className="flex items-center gap-1.5">
                    <span>{customNames.client || 'Client & Contact'}</span>
                    {sortConfig.key === 'client' && (
                       sortConfig.direction === 'asc' ? <ChevronUp size={11} className="text-brand-accent" /> : <ChevronDown size={11} className="text-brand-accent" />
                    )}
                  </div>
                </th>
                
                <th 
                  className="px-6 py-4 text-[10px] font-black uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500 cursor-pointer hover:text-brand-accent transition-colors"
                  onClick={() => handleSort('category')}
                >
                  <div className="flex items-center gap-1.5">
                    <span>{customNames.category || 'Category'}</span>
                    {sortConfig.key === 'category' && (
                       sortConfig.direction === 'asc' ? <ChevronUp size={11} className="text-brand-accent" /> : <ChevronDown size={11} className="text-brand-accent" />
                    )}
                  </div>
                </th>

                <th 
                  className="px-6 py-4 text-[10px] font-black uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500 cursor-pointer hover:text-brand-accent transition-colors"
                  onClick={() => handleSort('tactical')}
                >
                  <div className="flex items-center gap-1.5 ">
                    <span>User ID & Sector</span>
                    {sortConfig.key === 'tactical' && (
                       sortConfig.direction === 'asc' ? <ChevronUp size={11} className="text-brand-accent" /> : <ChevronDown size={11} className="text-brand-accent" />
                    )}
                  </div>
                </th>

                <th 
                  className="px-6 py-4 text-[10px] font-black uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500 cursor-pointer hover:text-brand-accent transition-colors"
                  onClick={() => handleSort('description')}
                >
                  <div className="flex items-center gap-1.5">
                    <span>{customNames.description || 'Issue Details'}</span>
                    {sortConfig.key === 'description' && (
                       sortConfig.direction === 'asc' ? <ChevronUp size={11} className="text-brand-accent" /> : <ChevronDown size={11} className="text-brand-accent" />
                    )}
                  </div>
                </th>

                <th 
                  className="px-4 py-4 text-[10px] font-black uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500 text-center cursor-pointer hover:text-brand-accent transition-colors"
                  onClick={() => handleSort('urgency')}
                >
                  <div className="flex items-center justify-center gap-1.5">
                    <span>Priority</span>
                    {sortConfig.key === 'urgency' && (
                       sortConfig.direction === 'asc' ? <ChevronUp size={11} className="text-brand-accent" /> : <ChevronDown size={11} className="text-brand-accent" />
                    )}
                  </div>
                </th>

                <th 
                  className="px-6 py-4 text-[10px] font-black uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500 text-center cursor-pointer hover:text-brand-accent transition-colors"
                  onClick={() => handleSort('status')}
                >
                  <div className="flex items-center justify-center gap-1.5">
                    <span>Status</span>
                    {sortConfig.key === 'status' && (
                       sortConfig.direction === 'asc' ? <ChevronUp size={11} className="text-brand-accent" /> : <ChevronDown size={11} className="text-brand-accent" />
                    )}
                  </div>
                </th>

                <th 
                  className="px-6 py-4 text-[10px] font-black uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500 text-right cursor-pointer hover:text-brand-accent transition-colors"
                  onClick={() => handleSort('registry')}
                >
                  <div className="flex items-center justify-end gap-1.5">
                    <span>Dates</span>
                    {sortConfig.key === 'registry' && (
                       sortConfig.direction === 'asc' ? <ChevronUp size={11} className="text-brand-accent" /> : <ChevronDown size={11} className="text-brand-accent" />
                    )}
                  </div>
                </th>

                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500 text-right">Quick Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-105 dark:divide-slate-800/40">
              <AnimatePresence mode="popLayout">
                {paginatedComplaints.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="py-24 text-center">
                      <Clock size={40} className="text-slate-200 mx-auto mb-4 animate-bounce" style={{ animationDuration: '3s' }} />
                      <p className="text-slate-400 font-bold uppercase tracking-widest text-[11px]">No operational records fit active criteria</p>
                    </td>
                  </tr>
                ) : (
                  paginatedComplaints.map((complaint, index) => (
                    <motion.tr
                      key={complaint.id}
                      layout="position"
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ 
                        opacity: 1, 
                        y: 0,
                        transition: {
                          type: "spring",
                          stiffness: 140,
                          damping: 15,
                          delay: index * 0.02
                        }
                      }}
                      exit={{ 
                        opacity: 0, 
                        scale: 0.98,
                        transition: { duration: 0.15 }
                      }}
                      onClick={() => setSelectedComplaint(complaint)}
                      className={cn(
                        "group hover:scale-[1.002] active:scale-[0.999] hover:shadow-[0_4px_24px_rgba(0,0,0,0.02)] dark:hover:shadow-[0_4px_24px_rgba(0,0,0,0.25)] border-y border-slate-100/50 dark:border-slate-800/40 transition-all duration-300 cursor-pointer relative",
                        getEffectiveStatus(complaint, now) === 'complete' 
                          ? 'bg-emerald-500/[0.005] dark:bg-slate-950/20 hover:bg-emerald-500/[0.02] dark:hover:bg-emerald-500/[0.03]' 
                          : getEffectiveStatus(complaint, now) === 'in process'
                            ? 'bg-blue-500/[0.005] dark:bg-slate-950/20 hover:bg-blue-500/[0.02] dark:hover:bg-blue-500/[0.03]'
                            : getEffectiveStatus(complaint, now) === 'scheduled'
                              ? 'bg-purple-500/[0.005] dark:bg-slate-950/20 hover:bg-purple-500/[0.02] dark:hover:bg-purple-500/[0.03]'
                              : 'bg-white dark:bg-slate-950/20 hover:bg-slate-500/[0.015] dark:hover:bg-slate-500/[0.025]'
                      )}
                    >
                      {/* CLIENT & CONTACT */}
                      <td className="px-6 py-4.5 relative">
                        {/* Interactive Status Indicator bar */}
                        <div className={cn(
                          "absolute left-0 top-2.5 bottom-2.5 w-1 rounded-r-md transition-all duration-300 group-hover:w-1.5",
                          getEffectiveStatus(complaint, now) === 'complete' ? 'bg-emerald-500 shadow-[2px_0_10px_rgba(16,185,129,0.4)]' :
                          getEffectiveStatus(complaint, now) === 'in process' ? 'bg-blue-500 shadow-[2px_0_10px_rgba(59,130,246,0.4)]' :
                          getEffectiveStatus(complaint, now) === 'scheduled' ? 'bg-purple-500 shadow-[2px_0_10px_rgba(168,85,247,0.4)]' :
                          'bg-amber-500 shadow-[2px_0_10px_rgba(245,158,11,0.4)]'
                        )} />
                        
                        <div className="flex items-center gap-3.5 pl-1.5">
                          <div className="shrink-0 w-10 h-10 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 flex items-center justify-center text-slate-500 dark:text-slate-400 group-hover:scale-110 group-hover:bg-brand-accent/10 group-hover:text-brand-accent group-hover:border-brand-accent/20 transition-all duration-300 shadow-[inset_0_1px_2px_rgba(0,0,0,0.01)]">
                            <Wifi size={17} className="shrink-0" />
                          </div>
                          <div className="flex flex-col">
                            <span className="font-extrabold text-slate-950 dark:text-white uppercase tracking-tight text-xs group-hover:text-brand-accent transition-colors duration-300 leading-tight">
                              {complaint.customerName}
                            </span>
                            {complaint.scheduledAt && (
                              <div className="flex items-center gap-1.5 mt-1 text-[8.5px] font-black text-indigo-600 dark:text-indigo-400 bg-indigo-50/80 dark:bg-indigo-950/40 border border-indigo-200/50 dark:border-indigo-900/40 px-2 py-0.5 rounded-lg w-max uppercase tracking-wider animate-pulse">
                                <Calendar size={10} className="shrink-0 text-indigo-500" />
                                <span>Scheduled At: {new Date(complaint.scheduledAt).toLocaleString()}</span>
                              </div>
                            )}
                            <span className="text-[10px] font-mono font-bold text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-1">
                              <Phone size={10} className="text-slate-400 shrink-0" />
                              <span>({complaint.number.slice(0,4)}) {complaint.number.slice(4)}</span>
                            </span>
                            {complaint.pkgDetails && (
                              <span className="inline-block mt-1 text-[8.5px] font-black uppercase tracking-wider text-brand-accent bg-brand-accent/10 border border-brand-accent/15 px-1.5 py-0.5 rounded w-max">
                                {complaint.pkgDetails}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* CATEGORY */}
                      <td className="px-6 py-4.5">
                        <span className={cn(
                          "text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-lg border inline-block leading-none",
                          complaint.category === 'Fiber Break' 
                            ? 'bg-rose-500/5 text-rose-500 border-rose-500/10' 
                            : complaint.category === 'Offline'
                            ? 'bg-purple-500/5 text-purple-500 border-purple-500/10'
                            : 'bg-indigo-505/5 text-indigo-500 border-indigo-500/10'
                        )}>
                          {complaint.category}
                        </span>
                      </td>

                      {/* USER ID & SECTOR */}
                      <td className="px-6 py-4.5 font-sans">
                        <div className="flex flex-col">
                          <span className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider bg-slate-100/50 dark:bg-slate-900/60 px-2.5 py-1 rounded-lg border border-slate-200/20 dark:border-slate-800/20 w-max leading-none">
                            {complaint.customerUsername || 'NO USER_ID'}
                          </span>
                          <span className="text-[10px] font-extrabold text-slate-500 mt-1.5 flex items-center gap-1">
                            <MapPin size={11} className="text-slate-400 shrink-0" />
                            <span>{complaint.area || 'Unknown Sector'}</span>
                          </span>
                        </div>
                      </td>

                      {/* ISSUE DETAILS */}
                      <td className="px-6 py-4.5">
                        <div className="flex flex-col gap-1.5 max-w-[280px]">
                          {complaint.panelDetails ? (
                            <span className="text-[9.5px] font-mono font-black text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-900 px-2 py-0.5 rounded border border-slate-200/50 dark:border-slate-800/60 block truncate select-all leading-tight">
                              {complaint.panelDetails}
                            </span>
                          ) : (
                            <span className="text-[9px] font-mono font-bold text-slate-400 dark:text-slate-500 italic">No Device Panel specified</span>
                          )}
                          <p className="text-xs text-slate-600 dark:text-slate-350 leading-relaxed font-semibold italic truncate">
                            "{complaint.description}"
                          </p>
                        </div>
                      </td>

                      {/* PRIORITY (with Flags correctly aligned with metadata) */}
                      <td className="px-4 py-4.5 text-center">
                        <div className="flex flex-col items-center justify-center gap-1">
                          <Flag size={14} className={cn(
                            "shrink-0",
                            complaint.priority === 'Critical' || complaint.priority === 'High' ? 'text-rose-500 fill-rose-500 animate-pulse' :
                            complaint.priority === 'Medium' ? 'text-amber-500 fill-amber-500' :
                            'text-slate-400 fill-slate-300 dark:fill-slate-700'
                          )} />
                          <span className={cn(
                            "text-[9px] font-black uppercase tracking-widest",
                            complaint.priority === 'Critical' || complaint.priority === 'High' ? 'text-rose-600 dark:text-rose-400' :
                            complaint.priority === 'Medium' ? 'text-amber-600 dark:text-amber-400' :
                            'text-slate-500'
                          )}>
                            {complaint.priority || 'Medium'}
                          </span>
                        </div>
                      </td>

                      {/* STATUS (With badge and delegator avatar) */}
                      <td className="px-6 py-4.5">
                        <div className="flex flex-col items-center justify-center gap-1.5 matches-status-cell">
                          <div className="flex items-center gap-2">
                            <span className={cn(
                              "flex items-center gap-1.5 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border shadow-[inset_0_1px_2px_rgba(255,255,255,0.05)]",
                              getEffectiveStatus(complaint, now) === 'complete' 
                                ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20 dark:text-emerald-400' 
                                : getEffectiveStatus(complaint, now) === 'in process'
                                ? 'bg-blue-500/10 text-blue-600 border-blue-500/25 dark:text-blue-400'
                                : getEffectiveStatus(complaint, now) === 'scheduled'
                                ? 'bg-purple-500/10 text-purple-600 border-purple-500/25 dark:text-purple-400'
                                : 'bg-amber-500/10 text-amber-600 border-amber-500/25 dark:text-amber-400'
                            )}>
                              <span className={cn(
                                "w-1.5 h-1.5 rounded-full",
                                getEffectiveStatus(complaint, now) === 'complete' ? 'bg-emerald-500 shadow-[0_0_6px_#10b981]' :
                                getEffectiveStatus(complaint, now) === 'in process' ? 'bg-blue-500 shadow-[0_0_6px_#3b82f6]' : 
                                getEffectiveStatus(complaint, now) === 'scheduled' ? 'bg-purple-500 shadow-[0_0_6px_#a855f7]' : 
                                'bg-amber-500 shadow-[0_0_6px_#f59e0b]'
                              )} />
                              <span>{getEffectiveStatus(complaint, now)}</span>
                            </span>
                            
                            {/* Delegate staff avatar */}
                            <div className="h-6 w-6 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-205 dark:border-slate-700 text-slate-650 dark:text-slate-350 flex items-center justify-center font-black text-[9px] uppercase shadow-sm shrink-0" title={`Logged by: ${complaint.memberName || 'System'}`}>
                              {complaint.memberName ? complaint.memberName.slice(0,2) : 'SY'}
                            </div>
                          </div>
                          
                          {getEffectiveStatus(complaint, now) === 'in process' && (() => {
                            const prog = calculateProtocolProgress(complaint.remarks);
                            if (prog.percentage <= 0) return null;
                            return (
                              <div className="w-24 flex flex-col items-center gap-1" title={prog.stepText}>
                                <div className="w-full bg-slate-100 dark:bg-slate-800/80 h-1 rounded-full overflow-hidden border border-slate-205/25 dark:border-slate-700/30">
                                  <motion.div 
                                    initial={{ width: 0 }}
                                    animate={{ width: `${prog.percentage}%` }}
                                    transition={{ duration: 0.6, ease: "easeOut" }}
                                    className="bg-blue-500 dark:bg-blue-400 h-full rounded-full"
                                  />
                                </div>
                                <span className="text-[7.5px] font-mono font-black text-blue-500 dark:text-blue-400 uppercase tracking-tighter leading-none shrink-0 animate-pulse">
                                  {prog.percentage}% Complete
                                </span>
                              </div>
                            );
                          })()}
                        </div>
                      </td>

                      {/* DATES */}
                      <td className="px-6 py-4.5 text-right font-sans">
                        <div className="flex flex-col items-end">
                          <span className="text-[11px] font-extrabold text-slate-850 dark:text-slate-300 uppercase tracking-tighter">
                            {new Date(complaint.createdAt).toLocaleDateString()}
                          </span>
                          <span className="text-[9.5px] font-mono text-slate-400 dark:text-slate-500 mt-1 flex items-center gap-1">
                            <Clock size={10} className="text-slate-350" />
                            <span>{new Date(complaint.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                          </span>
                        </div>
                      </td>

                      {/* QUICK ACTIONS */}
                      <td className="px-6 py-4.5 text-right">
                        <div className="flex justify-end gap-1.5" onClick={e => e.stopPropagation()}>
                           {(isAdmin || (currentUserId && complaint.memberId === currentUserId)) && (
                             <button
                               onClick={(e) => {
                                 e.stopPropagation();
                                 setEditingId(complaint.id);
                                 setEditData({ ...complaint });
                                 setSelectedComplaint(null); // Close detail modal if open
                               }}
                               className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/40 border border-transparent hover:border-blue-100 rounded-lg transition-all cursor-pointer"
                               title="Edit Operational Log"
                             >
                               <Pencil size={13} />
                             </button>
                           )}
                           {isAdmin && onDelete && (
                             <button
                               onClick={(e) => {
                                 e.stopPropagation();
                                 setComplaintToDelete(complaint.id);
                               }}
                               className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 border border-transparent hover:border-rose-100 rounded-lg transition-all cursor-pointer"
                               title="Revoke Registry"
                             >
                               <Trash2 size={13} />
                             </button>
                           )}
                        </div>
                      </td>
                    </motion.tr>
                  ))
                )}
              </AnimatePresence>
            </tbody>
          </table>
        </div>

        {filteredComplaints.length > 0 && (
          <div className="px-6 py-4 bg-slate-50 dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Display Limit:</span>
                <select
                  value={itemsPerPage}
                  onChange={(e) => {
                    setItemsPerPage(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                  className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-md px-2 py-1 text-[10px] font-black text-slate-600 dark:text-slate-300 outline-none focus:ring-1 focus:ring-brand-accent transition-all"
                >
                  <option value={20}>20 UNITS</option>
                  <option value={50}>50 UNITS</option>
                  <option value={100}>100 UNITS</option>
                  <option value={500}>500 UNITS</option>
                </select>
              </div>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                Matrix Status: <span className="text-slate-900 dark:text-white">{(currentPage - 1) * itemsPerPage + 1} - {Math.min(currentPage * itemsPerPage, filteredComplaints.length)}</span> of <span className="text-brand-accent">{filteredComplaints.length}</span>
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className="p-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-400 hover:text-brand-accent disabled:opacity-30 disabled:cursor-not-allowed transition-all"
              >
                <ChevronLeft size={16} />
              </button>
              
              <div className="flex items-center gap-1">
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum: number;
                  if (totalPages <= 5) {
                    pageNum = i + 1;
                  } else if (currentPage <= 3) {
                    pageNum = i + 1;
                  } else if (currentPage >= totalPages - 2) {
                    pageNum = totalPages - 4 + i;
                  } else {
                    pageNum = currentPage - 2 + i;
                  }

                  return (
                    <button
                      key={'page-'+pageNum}
                      onClick={() => setCurrentPage(pageNum)}
                      className={cn(
                        "w-8 h-8 rounded-lg text-[10px] font-black uppercase transition-all",
                        currentPage === pageNum 
                          ? "bg-slate-900 dark:bg-brand-accent text-white shadow-lg" 
                          : "bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-500 hover:border-brand-accent hover:text-brand-accent"
                      )}
                    >
                      {pageNum}
                    </button>
                  );
                })}
              </div>

              <button
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
                className="p-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-400 hover:text-brand-accent disabled:opacity-30 disabled:cursor-not-allowed transition-all"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </motion.div>

      <AnimatePresence>
        {editingId && (
          <EditModal
            complaint={editData}
            appConfig={appConfig}
            branding={branding}
            onClose={() => setEditingId(null)}
            onSave={async (data) => {
              if (onEdit) {
                await onEdit(editingId, data);
              }
            }}
          />
        )}

        {selectedComplaint && (
          <div className="fixed inset-0 z-[500] flex items-center justify-center p-2 sm:p-3 md:p-4 lg:p-6 overflow-y-auto custom-scrollbar">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedComplaint(null)}
              className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm"
            />
            
            <motion.div
              layoutId={selectedComplaint.id}
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-6xl bg-white dark:bg-slate-950 rounded-2xl shadow-[0_45px_120px_rgba(0,0,0,0.5)] overflow-hidden border border-slate-200/50 dark:border-white/10 origin-center my-auto scale-100 transition-all duration-300 shrink-0"
            >
              <div className="p-5 sm:p-7 md:p-9 space-y-5 sm:space-y-6 max-h-[96vh] md:max-h-[90vh] overflow-y-auto custom-scrollbar">
                <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
                  <div className="flex items-center gap-4 sm:gap-6">
                    <div className="space-y-1.5">
                      <div className="flex flex-wrap items-center gap-3 mb-1 sm:mb-2">
                        <div className={cn(
                          "inline-flex items-center gap-2.5 px-3 py-1.5 rounded-full text-[9px] sm:text-[10px] font-black uppercase tracking-widest border",
                          getStatusColor(selectedComplaint.status)
                        )}>
                          {getStatusIcon(selectedComplaint.status)}
                          {selectedComplaint.status}
                        </div>
                        
                        {selectedComplaint.status === 'in process' && (() => {
                          const prog = calculateProtocolProgress(selectedComplaint.remarks);
                          if (prog.percentage <= 0) return null;
                          return (
                            <div className="inline-flex items-center gap-2.5 px-3.5 py-1.5 bg-blue-500/5 border border-blue-500/10 rounded-full">
                              <div className="w-20 bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden border border-slate-200/40 dark:border-slate-700/40 shadow-inner">
                                <motion.div 
                                  initial={{ width: 0 }}
                                  animate={{ width: `${prog.percentage}%` }}
                                  transition={{ duration: 0.5, ease: "easeOut" }}
                                  className="bg-blue-500 dark:bg-blue-400 h-full rounded-full shadow-sm"
                                />
                              </div>
                              <span className="text-[9px] font-mono font-black text-blue-500 dark:text-blue-400 uppercase tracking-tighter leading-none">
                                {prog.stepText}
                              </span>
                            </div>
                          );
                        })()}
                      </div>
                      <h2 className="text-xl sm:text-2xl md:text-3xl font-extrabold text-slate-950 dark:text-white uppercase tracking-tight leading-none">
                        {selectedComplaint.customerName}
                      </h2>
                    </div>
                    
                    {selectedComplaint.customerUsername && (
                      <div className="flex flex-col gap-1 px-3 py-1.5 bg-slate-50 dark:bg-slate-900 rounded-lg border border-slate-100 dark:border-slate-800">
                        <span className="text-[8px] sm:text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none">Access ID</span>
                        <span className="text-xs sm:text-sm font-black text-slate-900 dark:text-brand-accent uppercase tracking-widest leading-none">
                          {selectedComplaint.customerUsername}
                        </span>
                      </div>
                    )}
                  </div>

                  <button 
                    onClick={() => setSelectedComplaint(null)}
                    className="absolute top-3 right-3 sm:relative sm:top-0 sm:right-0 w-9 h-9 rounded-full bg-slate-50 dark:bg-slate-900 flex items-center justify-center text-slate-400 hover:text-rose-500 hover:scale-110 active:scale-95 transition-all shadow-sm cursor-pointer"
                  >
                    <X size={18} />
                  </button>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 p-4 rounded-xl bg-slate-50 dark:bg-slate-900/45 border border-slate-100 dark:border-slate-800/60">
                  <div className="space-y-1 md:border-r border-slate-105 dark:border-slate-800 pr-1.5 sm:pr-3">
                    <p className="text-[9px] sm:text-[10px] font-black uppercase tracking-wider text-slate-400">{customNames.zone || 'Sector'}</p>
                    <div className="flex items-center gap-2 text-slate-900 dark:text-slate-100 font-bold overflow-hidden">
                      <MapPin size={13} className="text-brand-accent shrink-0" />
                      <span className="uppercase text-xs sm:text-sm truncate">{selectedComplaint.area}</span>
                    </div>
                  </div>
                  <div className="space-y-1 md:border-r border-slate-105 dark:border-slate-800 pr-1.5 sm:pr-3">
                    <p className="text-[9px] sm:text-[10px] font-black uppercase tracking-wider text-slate-400">Contact</p>
                    <div className="flex items-center gap-2 text-slate-900 dark:text-slate-100 font-bold overflow-hidden">
                      <Phone size={13} className="text-brand-accent shrink-0" />
                      <span className="font-mono text-xs sm:text-sm truncate">{selectedComplaint.number}</span>
                    </div>
                  </div>
                  <div className="space-y-1 md:border-r border-slate-105 dark:border-slate-800 pr-1.5 sm:pr-3">
                    <p className="text-[9px] sm:text-[10px] font-black uppercase tracking-wider text-slate-400">{customNames.pkg || 'Profile'}</p>
                    <div className="flex items-center gap-2 text-slate-900 dark:text-slate-100 font-bold overflow-hidden">
                      <Package size={13} className="text-brand-accent shrink-0" />
                      <span className="uppercase text-xs sm:text-sm truncate">{selectedComplaint.pkgDetails || 'N/A'}</span>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[9px] sm:text-[10px] font-black uppercase tracking-wider text-slate-400">{customNames.panel || 'Panel'}/{customNames.nearby || 'Nearby'}</p>
                    <div className="flex items-center gap-2 text-slate-900 dark:text-slate-100 font-bold overflow-hidden">
                      <Layers size={13} className="text-brand-accent shrink-0" />
                      <span className="uppercase text-xs sm:text-sm truncate leading-tight">
                        {selectedComplaint.panelDetails || 'N/A'} / {selectedComplaint.userNearby || 'N/A'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-5">
                  {/* Left Side: Descriptions */}
                  <div className="col-span-12 lg:col-span-7 space-y-3 sm:space-y-4">
                    
                    {/* Block 1: Operational Log */}
                    <motion.div 
                      initial={{ opacity: 0, y: 15 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3 }}
                      className="group relative rounded-xl border border-slate-200/60 dark:border-slate-800/85 bg-white dark:bg-slate-950 shadow-sm overflow-hidden transition-all duration-300"
                    >
                      {/* Side indicator with priority color */}
                      <div className={cn(
                        "absolute left-0 top-0 bottom-0 w-1 transition-all duration-300 group-hover:w-1.5",
                        selectedComplaint.priority === 'High' ? 'bg-rose-500 shadow-[2px_0_10px_rgba(244,63,94,0.4)]' :
                        selectedComplaint.priority === 'Critical' ? 'bg-red-600 shadow-[2px_0_12px_rgba(220,38,38,0.5)]' :
                        selectedComplaint.priority === 'Medium' ? 'bg-amber-500 shadow-[2px_0_10px_rgba(245,158,11,0.4)]' :
                        'bg-emerald-500 shadow-[2px_0_10px_rgba(16,185,129,0.4)]'
                      )} />

                      <div className="p-3 pl-5 space-y-2">
                        <div className="flex justify-between items-center">
                          <div className="flex items-center gap-1.5">
                            <span className="p-0.5 rounded bg-slate-100 dark:bg-slate-900 text-slate-500 dark:text-slate-400">
                              <Network size={10} className="animate-pulse" />
                            </span>
                            <span className="text-[9px] font-black uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
                              {customNames.complaint || 'Operational Log'}
                            </span>
                          </div>
                          
                          <motion.div 
                            whileHover={{ scale: 1.05 }}
                            className={cn(
                              "flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest border transition-all",
                              selectedComplaint.priority === 'High' || selectedComplaint.priority === 'Critical'
                                ? 'bg-rose-500/10 dark:bg-rose-500/5 text-rose-500 border-rose-500/20'
                                : selectedComplaint.priority === 'Medium'
                                ? 'bg-amber-500/10 dark:bg-amber-500/5 text-amber-500 border-amber-500/20'
                                : 'bg-emerald-500/10 dark:bg-emerald-500/5 text-emerald-500 border-emerald-500/20'
                            )}
                          >
                            <Zap size={8} className="shrink-0" />
                            <span>{selectedComplaint.priority || 'Medium'} PRIORITY</span>
                          </motion.div>
                        </div>

                        <div className="relative p-4 sm:p-5 rounded-xl bg-slate-50/50 dark:bg-slate-900/40 border border-slate-100/50 dark:border-slate-900/80 flex items-center">
                          <div className="absolute top-1 left-2.5 text-slate-300 dark:text-slate-800 text-3xl font-serif pointer-events-none select-none">“</div>
                          <p className="text-sm sm:text-base font-semibold text-slate-800 dark:text-slate-200 leading-relaxed italic relative z-10 pl-3 pr-3">
                            {selectedComplaint.description}
                          </p>
                          <div className="absolute bottom-1 right-2.5 text-slate-300 dark:text-slate-800 text-3xl font-serif pointer-events-none select-none">”</div>
                        </div>
                      </div>
                    </motion.div>

                    {/* Block 2: Team Resolution Protocol */}
                    <motion.div 
                      initial={{ opacity: 0, y: 15 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3, delay: 0.05 }}
                      className="group relative rounded-xl border border-slate-200/60 dark:border-slate-800/85 bg-white dark:bg-slate-950 shadow-sm overflow-hidden transition-all duration-300"
                    >
                      <div className="p-3 space-y-2 relative overflow-hidden">
                        {/* Thank You Animation Background Overlay */}
                        <AnimatePresence>
                          {showLeftThankYou && (
                            <motion.div 
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              exit={{ opacity: 0 }}
                              className="absolute inset-0 bg-gradient-to-r from-emerald-500/10 to-teal-500/10 dark:from-emerald-950/20 dark:to-teal-950/25 backdrop-blur-[2.5px] z-20 flex flex-col items-center justify-center pointer-events-none"
                            >
                              <motion.div
                                initial={{ scale: 0, rotate: -15 }}
                                animate={{ scale: [0, 1.25, 1], rotate: 0 }}
                                transition={{ duration: 0.5, ease: "easeOut" }}
                                className="flex flex-col items-center gap-1"
                              >
                                <CheckCircle className="text-emerald-500 dark:text-emerald-400 animate-bounce" size={22} />
                                <span className="text-[9px] font-black uppercase tracking-[0.22em] text-emerald-600 dark:text-emerald-400">Thank You!</span>
                              </motion.div>
                            </motion.div>
                          )}
                        </AnimatePresence>

                        <div className="flex justify-between items-center">
                          <div className="flex items-center gap-1.5">
                            <span className="p-0.5 rounded bg-slate-100 dark:bg-slate-900 text-emerald-500">
                              <CheckCircle size={10} />
                            </span>
                            <span className="text-[9px] font-black uppercase tracking-[0.18em] text-emerald-500">
                              Team Resolution Protocol
                            </span>
                          </div>
                          
                          {isAdmin && !isEditingRemarks && (
                            <motion.button 
                              whileHover={{ scale: 1.05 }}
                              whileTap={{ scale: 0.95 }}
                              onClick={() => {
                                  setEditedRemarks(selectedComplaint.remarks || '');
                                  setIsEditingRemarks(true);
                              }}
                              className="text-[8px] font-black uppercase tracking-wider text-brand-accent hover:text-brand-accent/80 flex items-center gap-1 px-1.5 py-0.5 rounded bg-brand-accent/5 border border-brand-accent/10 hover:border-brand-accent/20 cursor-pointer transition-all"
                            >
                              <Pencil size={9} />
                              <span>{selectedComplaint.remarks ? 'Amend' : 'Formulate'}</span>
                            </motion.button>
                          )}
                        </div>

                        <AnimatePresence mode="wait">
                          {isEditingRemarks ? (
                            <motion.div 
                              initial={{ opacity: 0, scale: 0.98 }}
                              animate={{ opacity: 1, scale: 1 }}
                              exit={{ opacity: 0, scale: 0.98 }}
                              className="space-y-1.5"
                            >
                              <textarea
                                value={editedRemarks}
                                onChange={(e) => setEditedRemarks(e.target.value)}
                                className="w-full p-3 bg-slate-50 dark:bg-slate-900/60 border border-brand-accent/30 dark:border-brand-accent/20 rounded-xl text-sm focus:ring-2 focus:ring-brand-accent/25 focus:border-brand-accent outline-none h-24 resize-none"
                                placeholder="Type structural logging protocol..."
                                autoFocus
                              />
                              <div className="flex justify-end gap-1.5 text-[9px] font-black uppercase tracking-widest">
                                <button 
                                  type="button"
                                  onClick={() => setIsEditingRemarks(false)}
                                  className="px-2 py-1 text-slate-400 hover:text-slate-600 hover:bg-slate-50 dark:hover:bg-slate-900 rounded cursor-pointer transition-all"
                                >
                                  Cancel
                                </button>
                                <button 
                                  type="button"
                                  onClick={async () => {
                                    if (onUpdateRemarks) {
                                      await onUpdateRemarks(selectedComplaint.id, editedRemarks);
                                      setSelectedComplaint({ ...selectedComplaint, remarks: editedRemarks });
                                      setIsEditingRemarks(false);
                                    }
                                  }}
                                  className="px-3 py-1 bg-brand-accent text-white rounded shadow-sm shadow-brand-accent/15 cursor-pointer hover:bg-brand-accent-hover transition-all"
                                >
                                  Commit Updates
                                </button>
                              </div>
                            </motion.div>
                          ) : selectedComplaint.remarks ? (
                            <motion.div 
                              key={selectedComplaint.remarks}
                              initial={animateRemarksLeft ? { x: 180, opacity: 0, scale: 0.9 } : { opacity: 0, scale: 0.95 }}
                              animate={{ x: 0, opacity: 1, scale: 1 }}
                              transition={{ type: "spring", stiffness: 150, damping: 15 }}
                              className="p-4 sm:p-5 bg-gradient-to-r from-emerald-500/10 via-emerald-500/5 to-transparent rounded-xl border border-emerald-500/20 text-emerald-800 dark:text-emerald-400 text-sm sm:text-base font-semibold whitespace-pre-wrap leading-relaxed shadow-inner"
                            >
                              <div className="flex items-center gap-2 mb-2">
                                <span className="relative flex h-2 w-2">
                                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                                </span>
                                <span className="text-[8px] sm:text-[9.5px] font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400">Verifiably Deployed</span>
                              </div>
                              <p className="italic">"{selectedComplaint.remarks}"</p>
                            </motion.div>
                          ) : (
                            <motion.div 
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              className="p-2.5 bg-amber-500/5 rounded-xl border border-dashed border-amber-500/20 text-[10px] text-amber-600 dark:text-amber-400 font-bold uppercase italic tracking-wider text-center flex flex-col items-center justify-center gap-1"
                            >
                              <ShieldAlert size={12} className="text-amber-500 animate-bounce" />
                              <span>⚠️ Protocol Outstanding</span>
                            </motion.div>
                          )}
                        </AnimatePresence>

                        {selectedComplaint.remarkAuthorName && !isEditingRemarks && (
                          <div className="flex justify-end items-center gap-1 text-[7px] font-black text-slate-400 uppercase tracking-widest leading-none pr-1">
                            <span>COMMITTED BY:</span> 
                            <span className="text-emerald-600 dark:text-emerald-400 bg-emerald-500/5 px-1 py-0.5 rounded border border-emerald-500/10">
                              {selectedComplaint.remarkAuthorName}
                            </span>
                          </div>
                        )}
                      </div>
                    </motion.div>

                    {/* Block 3: Customer Review */}
                    <motion.div 
                      initial={{ opacity: 0, y: 15 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3, delay: 0.1 }}
                      className="group relative rounded-xl border border-slate-200/60 dark:border-slate-800/85 bg-white dark:bg-slate-950 shadow-sm overflow-hidden transition-all duration-300"
                    >
                      <div className="p-3 space-y-2 relative overflow-hidden">
                        {/* Thank You Animation Background Overlay */}
                        <AnimatePresence>
                          {showLeftThankYou && (
                            <motion.div 
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              exit={{ opacity: 0 }}
                              className="absolute inset-0 bg-gradient-to-r from-indigo-500/10 to-purple-500/10 dark:from-indigo-950/20 dark:to-teal-950/25 backdrop-blur-[2.5px] z-20 flex flex-col items-center justify-center pointer-events-none"
                            >
                              <motion.div
                                initial={{ scale: 0, rotate: 15 }}
                                animate={{ scale: [0, 1.25, 1], rotate: 0 }}
                                transition={{ duration: 0.5, ease: "easeOut" }}
                                className="flex flex-col items-center gap-1"
                              >
                                <Sparkles className="text-indigo-500 dark:text-indigo-400 animate-bounce" size={22} />
                                <span className="text-[9px] font-black uppercase tracking-[0.22em] text-indigo-600 dark:text-indigo-400">Thank You!</span>
                              </motion.div>
                            </motion.div>
                          )}
                        </AnimatePresence>

                        <div className="flex justify-between items-center">
                          <div className="flex items-center gap-1.5">
                            <span className="p-0.5 rounded bg-slate-100 dark:bg-slate-900 text-brand-accent">
                              <User size={10} />
                            </span>
                            <span className="text-[9px] font-black uppercase tracking-[0.18em] text-brand-accent">
                              Customer Review
                            </span>
                          </div>
                        </div>

                        {selectedComplaint.customerReview ? (
                          <motion.div 
                            key={selectedComplaint.customerReview}
                            initial={animateReviewLeft ? { x: 180, opacity: 0, scale: 0.9 } : { opacity: 0, scale: 0.95 }}
                            animate={{ x: 0, opacity: 1, scale: 1 }}
                            transition={{ type: "spring", stiffness: 150, damping: 15 }}
                            className="p-4 sm:p-5 bg-gradient-to-r from-brand-accent/10 via-brand-accent/5 to-transparent rounded-xl border border-brand-accent/20 text-brand-accent text-sm sm:text-base font-semibold whitespace-pre-wrap leading-relaxed shadow-inner italic"
                          >
                            "{selectedComplaint.customerReview}"
                          </motion.div>
                        ) : (
                          <div className="p-4 sm:p-5 bg-slate-50 dark:bg-slate-900/40 rounded-xl border border-dashed border-slate-200 dark:border-slate-800/85 text-xs text-slate-400 dark:text-slate-500 font-bold uppercase italic tracking-wider text-center flex flex-col items-center justify-center gap-1.5">
                            <span>💬 Awaiting Telemetry / No Review Logged</span>
                          </div>
                        )}
                      </div>
                    </motion.div>

                    {/* Footer Stats / Delegates */}
                    <motion.div 
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 0.3, delay: 0.15 }}
                      className="flex flex-row items-center justify-between p-2 rounded-xl border border-slate-200/50 dark:border-slate-800/60 bg-slate-50/60 dark:bg-slate-950/40 gap-2"
                    >
                      <div className="flex items-center gap-1 text-[8px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest truncate leading-none">
                        <User size={10} className="shrink-0" />
                        <span className="whitespace-nowrap">Delegate:</span>
                        <span className="text-brand-accent px-1.5 py-0.5 rounded bg-brand-accent/5 border border-brand-accent/10 truncate max-w-[100px]">{selectedComplaint.memberName || 'System'}</span>
                      </div>
                      <div className="flex items-center gap-1 text-slate-400 dark:text-slate-500 font-mono text-[8.5px] font-bold leading-none">
                        <Clock size={10} className="shrink-0 animate-spin-slow" />
                        <span className="uppercase tracking-wider">REG DATE: {new Date(selectedComplaint.createdAt).toLocaleDateString()}</span>
                      </div>
                    </motion.div>
                  </div>

                  {/* Right Side: Admin Protocol */}
                  <div className="col-span-12 lg:col-span-5 flex flex-col bg-slate-50/50 dark:bg-white/[0.02] border border-slate-200/50 dark:border-white/5 rounded-xl p-3 sm:p-4 relative overflow-hidden">
                    {isAdmin && onStatusChange ? (
                      <div className="flex flex-col h-full space-y-4">
                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-1">Tactical Protocol Command</p>
                        
                        <div className="space-y-3 relative">
                          <AnimatePresence mode="wait">
                            {hideStatusRemarksBox && hideCustomerReviewBox ? (
                              <motion.div
                                key="thank-you-view"
                                initial={{ scale: 0.9, opacity: 0, y: 15 }}
                                animate={{ scale: 1, opacity: 1, y: 0 }}
                                exit={{ scale: 0.9, opacity: 0, y: -15 }}
                                transition={{ type: "spring", stiffness: 200, damping: 20 }}
                                className="p-5 bg-gradient-to-br from-emerald-500/10 via-brand-accent/5 to-transparent rounded-2xl border border-emerald-500/30 text-center relative overflow-hidden flex flex-col items-center justify-center min-h-[220px]"
                              >
                                <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(16,185,129,0.08)_0%,transparent_70%)] pointer-events-none" />
                                
                                <motion.div
                                  initial={{ scale: 0, rotate: -45 }}
                                  animate={{ scale: 1, rotate: 0 }}
                                  transition={{ delay: 0.15, type: "spring", stiffness: 220, damping: 12 }}
                                  className="w-14 h-14 rounded-full bg-emerald-500/20 border border-emerald-500 flex items-center justify-center text-emerald-500 mb-3.5 shadow-lg shadow-emerald-500/10"
                                >
                                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                  </svg>
                                </motion.div>

                                <motion.h3 
                                  initial={{ opacity: 0, y: 5 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  transition={{ delay: 0.25 }}
                                  className="text-[11px] font-black uppercase text-emerald-500 tracking-[0.25em] mb-1"
                                >
                                  Thank You!
                                </motion.h3>
                                
                                <motion.p 
                                  initial={{ opacity: 0 }}
                                  animate={{ opacity: 1 }}
                                  transition={{ delay: 0.35 }}
                                  className="text-[9px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider mb-3.5"
                                >
                                  Resolution & Review telemetry verified.
                                </motion.p>

                                <div className="w-full text-left space-y-1.5 p-3 bg-slate-100/50 dark:bg-slate-900/40 rounded-xl border border-slate-200 dark:border-slate-800">
                                  <div className="flex items-center gap-1.5 justify-between">
                                    <span className="text-[8px] font-black uppercase tracking-widest text-slate-400">Team Resolution:</span>
                                    <span className="text-[9px] font-bold text-emerald-600 dark:text-emerald-400 truncate max-w-[140px]">{statusRemarks || 'Confirmed'}</span>
                                  </div>
                                  <div className="flex items-center gap-1.5 justify-between">
                                    <span className="text-[8px] font-black uppercase tracking-widest text-slate-400">Customer Review:</span>
                                    <span className="text-[9px] font-bold text-indigo-600 dark:text-indigo-400 truncate max-w-[140px]">{customerReview || 'Confirmed'}</span>
                                  </div>
                                </div>

                                <button
                                  type="button"
                                  onClick={() => {
                                    setHideStatusRemarksBox(false);
                                    setHideCustomerReviewBox(false);
                                  }}
                                  className="mt-3.5 text-[9px] font-black uppercase text-brand-accent tracking-widest hover:underline cursor-pointer"
                                >
                                  Revise Log Fields
                                </button>
                              </motion.div>
                            ) : (
                              <div className="space-y-4">
                                {/* 1. Team Resolution Protocol Field */}
                                <AnimatePresence mode="wait">
                                  {!hideStatusRemarksBox ? (
                                    <motion.div
                                      key="resolution-input"
                                      initial={{ x: 50, opacity: 0 }}
                                      animate={{ x: 0, opacity: 1 }}
                                      exit={{ x: -100, opacity: 0 }}
                                      transition={{ type: 'spring', stiffness: 220, damping: 20 }}
                                      className="space-y-1"
                                    >
                                      <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-1">Team Resolution Protocol (Required for completion)</label>
                                      <div className="relative">
                                        <textarea
                                          value={statusRemarks}
                                          onChange={(e) => setStatusRemarks(e.target.value.toUpperCase())}
                                          placeholder="Enter resolution protocol details..."
                                          className="w-full h-14 sm:h-16 p-2 pr-12 pb-6 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-semibold focus:ring-1 focus:ring-brand-accent/20 outline-none resize-none placeholder:text-slate-400 dark:placeholder:text-slate-600 shadow-sm uppercase placeholder:normal-case"
                                        />
                                        <button
                                          type="button"
                                          onClick={async () => {
                                            if (!statusRemarks.trim()) {
                                              toast.error("Please enter a Team Resolution Protocol first.");
                                              return;
                                            }
                                            // Copy to selected complaint remarks trigger
                                            setSelectedComplaint(prev => prev ? { ...prev, remarks: statusRemarks } : null);
                                            
                                            // Enable slide transition shifting right to left
                                            setAnimateRemarksLeft(true);
                                            setHideStatusRemarksBox(true);
                                            
                                            // Check if both elements are completed to trigger Thank You animations
                                            if (customerReview.trim() && hideCustomerReviewBox) {
                                              setShowLeftThankYou(true);
                                            }
                                            
                                            try {
                                              const sound = new Audio('https://assets.mixkit.co/active_storage/sfx/2019/2019-preview.mp3');
                                              sound.volume = 0.2;
                                              sound.play().catch(() => {});
                                            } catch (e) {}

                                            try {
                                              if (onUpdateRemarks) {
                                                await onUpdateRemarks(selectedComplaint.id, statusRemarks);
                                                toast.success("Protocol remark saved to database.");
                                              } else if (onEdit) {
                                                await onEdit(selectedComplaint.id, { remarks: statusRemarks });
                                                toast.success("Protocol remark saved to database.");
                                              } else {
                                                toast.success("Protocol saved in memory.");
                                              }
                                            } catch (err) {
                                              console.error("Failed to update database remarks:", err);
                                              toast.error("Failed to save to database. Kept in memory.");
                                            }
                                          }}
                                          className="absolute bottom-2 right-2 px-2 py-1 bg-emerald-500 hover:bg-emerald-600 text-white rounded-md text-[8px] font-black uppercase tracking-widest flex items-center gap-1 transition-all active:scale-95 cursor-pointer shadow-md shadow-emerald-500/20"
                                        >
                                          <span>Enter</span>
                                          <Send size={7} />
                                        </button>
                                      </div>
                                    </motion.div>
                                  ) : (
                                    <motion.div
                                      key="resolution-badge"
                                      initial={{ x: 100, opacity: 0 }}
                                      animate={{ x: 0, opacity: 1 }}
                                      exit={{ x: -50, opacity: 0 }}
                                      transition={{ type: 'spring', stiffness: 220, damping: 20 }}
                                      className="p-2 bg-emerald-500/5 rounded-lg border border-emerald-500/25 flex items-center justify-between shadow-sm"
                                    >
                                      <div className="flex items-center gap-1.5">
                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 anim-pulse" />
                                        <span className="text-[8px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest leading-none">Team Resolution Protocol Checked In</span>
                                      </div>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setHideStatusRemarksBox(false);
                                          setAnimateRemarksLeft(false);
                                          setShowLeftThankYou(false);
                                        }}
                                        className="text-[8px] font-black uppercase text-brand-accent hover:underline cursor-pointer"
                                      >
                                        Edit
                                      </button>
                                    </motion.div>
                                  )}
                                </AnimatePresence>

                                {/* 2. Customer Review Field */}
                                <AnimatePresence mode="wait">
                                  {!hideCustomerReviewBox ? (
                                    <motion.div
                                      key="review-input"
                                      initial={{ x: 50, opacity: 0 }}
                                      animate={{ x: 0, opacity: 1 }}
                                      exit={{ x: -100, opacity: 0 }}
                                      transition={{ type: 'spring', stiffness: 220, damping: 20 }}
                                      className="space-y-1"
                                    >
                                      <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-1">Customer Review (Required for completion)</label>
                                      <div className="relative">
                                        <textarea
                                          value={customerReview}
                                          onChange={(e) => setCustomerReview(e.target.value.toUpperCase())}
                                          placeholder="Type customer feedback or review here..."
                                          className="w-full h-14 sm:h-16 p-2 pr-12 pb-6 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-semibold focus:ring-1 focus:ring-brand-accent/20 outline-none resize-none placeholder:text-slate-400 dark:placeholder:text-slate-600 shadow-sm uppercase placeholder:normal-case"
                                        />
                                        <button
                                          type="button"
                                          onClick={async () => {
                                            if (!customerReview.trim()) {
                                              toast.error("Please type a Customer Review first.");
                                              return;
                                            }
                                            // Copy to selected complaint customerReview trigger
                                            setSelectedComplaint(prev => prev ? { ...prev, customerReview: customerReview } : null);
                                            
                                            // Enable slide transition shifting right to left
                                            setAnimateReviewLeft(true);
                                            setHideCustomerReviewBox(true);
                                            
                                            // Check if both elements are completed to trigger Thank You animations
                                            if (statusRemarks.trim() && hideStatusRemarksBox) {
                                              setShowLeftThankYou(true);
                                            }
                                            
                                            try {
                                              const sound = new Audio('https://assets.mixkit.co/active_storage/sfx/2019/2019-preview.mp3');
                                              sound.volume = 0.2;
                                              sound.play().catch(() => {});
                                            } catch (e) {}

                                            try {
                                              if (onEdit) {
                                                await onEdit(selectedComplaint.id, { customerReview: customerReview });
                                                toast.success("Customer review saved to database.");
                                              } else {
                                                toast.success("Customer review saved in memory.");
                                              }
                                            } catch (err) {
                                              console.error("Failed to update customer review:", err);
                                              toast.error("Failed to save to database. Kept in memory.");
                                            }
                                          }}
                                          className="absolute bottom-2 right-2 px-2 py-1 bg-indigo-500 hover:bg-indigo-600 text-white rounded-md text-[8px] font-black uppercase tracking-widest flex items-center gap-1 transition-all active:scale-95 cursor-pointer shadow-md shadow-indigo-500/20"
                                        >
                                          <span>Enter</span>
                                          <Send size={7} />
                                        </button>
                                      </div>
                                    </motion.div>
                                  ) : (
                                    <motion.div
                                      key="review-badge"
                                      initial={{ x: 100, opacity: 0 }}
                                      animate={{ x: 0, opacity: 1 }}
                                      exit={{ x: -50, opacity: 0 }}
                                      transition={{ type: 'spring', stiffness: 220, damping: 20 }}
                                      className="p-2 bg-indigo-500/5 rounded-lg border border-indigo-500/25 flex items-center justify-between shadow-sm"
                                    >
                                      <div className="flex items-center gap-1.5">
                                        <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 anim-pulse" />
                                        <span className="text-[8px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest leading-none">Customer Review Checked In</span>
                                      </div>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setHideCustomerReviewBox(false);
                                          setAnimateReviewLeft(false);
                                          setShowLeftThankYou(false);
                                        }}
                                        className="text-[8px] font-black uppercase text-brand-accent hover:underline cursor-pointer"
                                      >
                                        Edit
                                      </button>
                                    </motion.div>
                                  )}
                                </AnimatePresence>
                              </div>
                            )}
                          </AnimatePresence>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          {appConfig.statuses.map((s, i) => (
                            <button
                              key={`stat-${i}`}
                              onClick={() => {
                                if (s.toLowerCase() === 'scheduled') {
                                  const existingDate = selectedComplaint.scheduledAt 
                                    ? new Date(selectedComplaint.scheduledAt - (new Date().getTimezoneOffset() * 60000)).toISOString().slice(0, 16) 
                                    : '';
                                  setScheduleModalDate(existingDate);
                                  setShowInlineSchedulePicker(!showInlineSchedulePicker);
                                  return;
                                }
                                setShowInlineSchedulePicker(false);
                                if (s.toLowerCase() === 'complete' && (!statusRemarks.trim() || !customerReview.trim())) {
                                  toast.error('Both Resolution Protocol and Customer Review are required for completion.');
                                  return;
                                }
                                if (onEdit && selectedComplaint.scheduledAt && s.toLowerCase() !== 'scheduled') {
                                  onEdit(selectedComplaint.id, { status: s as ComplaintStatus, scheduledAt: undefined });
                                }
                                if (onStatusChange) {
                                  onStatusChange(selectedComplaint.id, s as ComplaintStatus, statusRemarks, customerReview);
                                }
                                setSelectedComplaint({ ...selectedComplaint, status: s as ComplaintStatus, scheduledAt: undefined, remarks: statusRemarks, customerReview: customerReview });
                                setStatusRemarks('');
                                setCustomerReview('');
                                setHideStatusRemarksBox(false);
                                setHideCustomerReviewBox(false);
                              }}
                              className={cn(
                                "py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all border",
                                selectedComplaint.status.toLowerCase() === s.toLowerCase() 
                                  ? "bg-slate-900 dark:bg-brand-accent text-white border-slate-900 dark:border-brand-accent shadow-lg shadow-brand-accent/20" 
                                  : "bg-white dark:bg-slate-900 text-slate-500 border-slate-200 dark:border-slate-800 hover:border-slate-300"
                              )}
                            >
                              {s}
                            </button>
                          ))}
                        </div>

                        {/* INLINE ANIMATED SCHEDULE DATEPICKER */}
                        <AnimatePresence>
                          {showInlineSchedulePicker && (
                            <motion.div
                              initial={{ height: 0, opacity: 0, marginTop: 0 }}
                              animate={{ height: 'auto', opacity: 1, marginTop: 8 }}
                              exit={{ height: 0, opacity: 0, marginTop: 0 }}
                              transition={{ type: "spring", stiffness: 200, damping: 22 }}
                              className="overflow-hidden bg-purple-500/[0.04] dark:bg-purple-950/20 border border-purple-500/20 rounded-xl p-3.5 space-y-3 origin-top"
                            >
                              <div className="flex items-center gap-2">
                                <div className="p-1.5 bg-purple-100 dark:bg-purple-950 text-purple-600 dark:text-purple-400 rounded-lg">
                                  <Calendar size={12} />
                                </div>
                                <span className="text-[9px] font-black uppercase tracking-widest text-slate-700 dark:text-slate-300">Set Dispatch Window</span>
                              </div>
                              <input
                                type="datetime-local"
                                value={scheduleModalDate}
                                onChange={(e) => setScheduleModalDate(e.target.value)}
                                className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-bold text-slate-800 dark:text-slate-100 outline-none focus:ring-1 focus:ring-purple-500 text-center"
                              />
                              <p className="text-[8px] font-medium text-slate-400 dark:text-slate-500 text-center leading-normal">
                                Scheduled records will remain visually submerged until 12 hours prior to dispatch.
                              </p>
                              <div className="flex gap-2">
                                <button
                                  type="button"
                                  onClick={() => setShowInlineSchedulePicker(false)}
                                  className="flex-1 py-1.5 text-[9px] font-black uppercase tracking-widest border border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-900 rounded-lg transition-all cursor-pointer"
                                >
                                  Cancel
                                </button>
                                <button
                                  type="button"
                                  onClick={async () => {
                                    if (!scheduleModalDate) {
                                      toast.error('Please select a valid schedule date.');
                                      return;
                                    }
                                    const scheduledTime = new Date(scheduleModalDate).getTime();
                                    if (onEdit) {
                                      await onEdit(selectedComplaint.id, {
                                        status: 'scheduled',
                                        scheduledAt: scheduledTime
                                      });
                                    }
                                    if (onStatusChange) {
                                      await onStatusChange(selectedComplaint.id, 'scheduled', statusRemarks, customerReview);
                                    }
                                    setSelectedComplaint({ 
                                      ...selectedComplaint, 
                                      status: 'scheduled', 
                                      scheduledAt: scheduledTime,
                                      remarks: statusRemarks,
                                      customerReview: customerReview
                                    });
                                    setStatusRemarks('');
                                    setCustomerReview('');
                                    setHideStatusRemarksBox(false);
                                    setHideCustomerReviewBox(false);
                                    setShowInlineSchedulePicker(false);
                                    toast.success('Complaint Scheduled successfully.');
                                  }}
                                  className="flex-1 py-1.5 bg-purple-600 hover:bg-purple-700 text-white text-[9px] font-black uppercase tracking-widest rounded-lg shadow-md shadow-purple-500/20 transition-all flex items-center justify-center gap-1 cursor-pointer"
                                >
                                  <CheckCircle size={10} />
                                  <span>Done</span>
                                </button>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                        
                        {onDelete && (
                          <button
                            onClick={() => setComplaintToDelete(selectedComplaint.id)}
                            className="mt-2 w-full py-1 text-[8px] sm:text-[9px] font-black text-rose-500 uppercase tracking-widest hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-lg transition-all opacity-60 hover:opacity-100"
                          >
                            Purge Entry
                          </button>
                        )}
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center flex-1 text-center py-6 sm:py-8">
                         <ShieldAlert className="text-slate-200 dark:text-slate-800 mb-2 sm:mb-4" size={32} sm:size={48} />
                         <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Admin Only Access</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>



    </div>
  );
}

function EditModal({ 
  complaint, 
  appConfig,
  branding,
  onClose, 
  onSave 
}: { 
  complaint: Partial<Complaint>, 
  appConfig: AppConfig,
  branding: BrandingConfig,
  onClose: () => void, 
  onSave: (data: Partial<Complaint>) => Promise<void> 
}) {
  const customNames = branding.customNames || {};
  const [data, setData] = React.useState({ ...complaint });
  const [isSaving, setIsSaving] = React.useState(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await onSave(data);
      onClose();
      toast.success('Registry record synchronized.');
    } catch (err) {
      toast.error('Failed to update registry.');
    } finally {
      setIsSaving(false);
    }
  };

  const inputClasses = "w-full px-4 py-2.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-accent/30 transition-all font-medium placeholder:text-slate-400 uppercase placeholder:normal-case";
  const labelClasses = "block text-[11px] font-bold uppercase text-slate-500 dark:text-slate-400 mb-1.5 tracking-widest ml-1";

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm"
      />
      
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="relative w-full max-w-2xl bg-white dark:bg-slate-950 rounded-2xl shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-800"
      >
        <form onSubmit={handleSave} className="p-8 space-y-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-xl font-black uppercase tracking-tight flex items-center gap-3">
              <Pencil size={20} className="text-brand-accent" />
              Modify Operational Log
            </h3>
            <button type="button" onClick={onClose} className="p-2 text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-900 rounded-full transition-all">
              <X size={20} />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-1.5">
              <label className={labelClasses}>{customNames.client || 'Client Name'}</label>
              <input
                type="text"
                value={data.customerName || ''}
                onChange={(e) => setData({ ...data, customerName: e.target.value.toUpperCase() })}
                className={inputClasses}
                required
              />
            </div>
            <div className="space-y-1.5">
              <label className={labelClasses}>{customNames.username || 'Client Username'}</label>
              <input
                type="text"
                value={data.customerUsername || ''}
                onChange={(e) => setData({ ...data, customerUsername: e.target.value.toUpperCase() })}
                className={inputClasses}
                required
              />
            </div>
            <div className="space-y-1.5">
              <label className={labelClasses}>{customNames.zone || 'Tactical Sector (Area)'}</label>
              <select
                value={data.area || (appConfig.zones?.[0] || '')}
                onChange={(e) => setData({ ...data, area: e.target.value })}
                className={cn(inputClasses, "appearance-none")}
              >
                {appConfig.zones?.map((zone, i) => (
                  <option key={`edit-zone-${i}`} value={zone}>{zone}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className={labelClasses}>{customNames.number || 'Communication No.'}</label>
              <input
                type="text"
                value={data.number || ''}
                onChange={(e) => setData({ ...data, number: e.target.value.toUpperCase() })}
                className={inputClasses}
                required
              />
            </div>
            <div className="space-y-1.5">
              <label className={labelClasses}>{customNames.pkg || 'Profile (Package)'}</label>
              <input
                type="text"
                value={data.pkgDetails || ''}
                onChange={(e) => setData({ ...data, pkgDetails: e.target.value.toUpperCase() })}
                className={inputClasses}
              />
            </div>
            <div className="space-y-1.5">
              <label className={labelClasses}>{customNames.nearby || 'User Nearby'}</label>
              <input
                type="text"
                value={data.userNearby || ''}
                onChange={(e) => setData({ ...data, userNearby: e.target.value.toUpperCase() })}
                className={inputClasses}
              />
            </div>
            <div className="space-y-1.5">
              <label className={labelClasses}>{customNames.panel || 'Pannal Details'}</label>
              <input
                type="text"
                value={data.panelDetails || ''}
                onChange={(e) => setData({ ...data, panelDetails: e.target.value.toUpperCase() })}
                className={inputClasses}
              />
            </div>
            <div className="space-y-1.5">
              <label className={labelClasses}>{customNames.category || 'Service Category'}</label>
              <select
                value={data.category || (appConfig.categories[0])}
                onChange={(e) => setData({ ...data, category: e.target.value as ComplaintCategory })}
                className={cn(inputClasses, "appearance-none")}
              >
                {appConfig.categories.map((cat, i) => (
                  <option key={`edit-cat-${i}`} value={cat}>{cat.toUpperCase()}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className={labelClasses}>{customNames.priority || 'Urgency Rating'}</label>
            <div className="grid grid-cols-4 gap-2">
              {appConfig.priorities.map((p, i) => (
                <button
                  key={`edit-pri-${i}`}
                  type="button"
                  onClick={() => setData({ ...data, priority: p })}
                  className={cn(
                    "py-2 rounded-lg text-[9px] font-black uppercase tracking-widest border transition-all",
                    data.priority === p 
                      ? "bg-slate-900 dark:bg-brand-accent text-white border-slate-900 dark:border-brand-accent shadow-md"
                      : "bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800 text-slate-400"
                  )}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <label className={labelClasses}>{customNames.description || 'Log Dispatch Details'}</label>
            <textarea
              value={data.description || ''}
              onChange={(e) => setData({ ...data, description: e.target.value })}
              className={cn(inputClasses, "h-32 resize-none")}
              required
            />
          </div>

          <div className="flex gap-4 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3.5 rounded-xl border-2 border-slate-100 dark:border-slate-800 text-slate-500 font-black uppercase tracking-widest text-[10px] hover:bg-slate-50 dark:hover:bg-slate-900 transition-all"
            >
              Abort Changes
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="flex-1 py-3.5 rounded-xl bg-slate-900 dark:bg-brand-accent text-white font-black uppercase tracking-widest text-[10px] shadow-lg hover:shadow-brand-accent/20 transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isSaving ? 'Processing...' : (
                <>
                  Commit Updates
                  <Save size={14} />
                </>
              )}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

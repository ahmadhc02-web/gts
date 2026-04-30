import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Trash2, Clock, CheckCircle, AlertCircle, PlayCircle, Printer, FileDown, Calendar, MapPin, Phone, User, X, ChevronRight, ChevronLeft, ChevronUp, ChevronDown, Download, Wifi, Pencil, Save, CloudUpload, Package, MapPinned } from 'lucide-react';
import { Complaint, ComplaintStatus, ComplaintCategory, ComplaintPriority } from '../types';
import { cn } from '../lib/utils';
import { Network, ShieldAlert, Zap, Layers, Activity } from 'lucide-react';
import { googleSheetsService } from '../services/googleSheetsService';
import { toast } from 'sonner';
import { AppConfig, DEFAULT_STATUSES, DEFAULT_PRIORITIES } from '../constants';

interface ComplaintListProps {
  complaints: Complaint[];
  onDelete?: (id: string) => Promise<void>;
  onStatusChange?: (id: string, status: ComplaintStatus) => Promise<void>;
  onEdit?: (id: string, data: Partial<Complaint>) => Promise<void>;
  isAdmin?: boolean;
  currentUserId?: string;
  forcedStatusFilter?: ComplaintStatus | 'all';
  forcedPriorityFilter?: ComplaintPriority | 'all';
  forcedCategoryFilter?: ComplaintCategory | 'all';
  appConfig: AppConfig;
}

export default function ComplaintList({ 
  complaints, 
  onDelete, 
  onStatusChange, 
  onEdit,
  isAdmin,
  currentUserId,
  forcedStatusFilter = 'all',
  forcedPriorityFilter = 'all',
  forcedCategoryFilter = 'all',
  appConfig
}: ComplaintListProps) {
  const [startDate, setStartDate] = React.useState('');
  const [endDate, setEndDate] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState<ComplaintStatus | 'all'>(forcedStatusFilter);
  const [priorityFilter, setPriorityFilter] = React.useState<ComplaintPriority | 'all'>(forcedPriorityFilter);
  const [categoryFilter, setCategoryFilter] = React.useState<ComplaintCategory | 'all'>(forcedCategoryFilter);
  const [zoneFilter, setZoneFilter] = React.useState<string | 'all'>('all');
  const [searchQuery, setSearchQuery] = React.useState('');
  const [currentPage, setCurrentPage] = React.useState(1);
  const [itemsPerPage, setItemsPerPage] = React.useState(20);
  const [selectedComplaint, setSelectedComplaint] = React.useState<Complaint | null>(null);
  const [sortConfig, setSortConfig] = React.useState<{
    key: keyof Complaint | 'registry' | 'urgency' | 'client' | 'tactical' | 'category';
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
        (c.memberName && c.memberName.toLowerCase().includes(q)) ||
        c.description.toLowerCase().includes(q)
      );
    }
    
    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(c => c.status === statusFilter);
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

    // Comprehensive Sorting
    filtered.sort((a, b) => {
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
          const statusWeight = { 'pending': 1, 'in process': 2, 'important': 3, 'complete': 4 };
          valA = statusWeight[a.status] || 0;
          valB = statusWeight[b.status] || 0;
          break;
        case 'category':
          valA = (a.category || '').toLowerCase();
          valB = (b.category || '').toLowerCase();
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

  const filteredComplaints = getFilteredComplaints();

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
      c.pkgDetails || 'N/A',
      c.userNearby || 'N/A',
      c.description,
      new Date(c.createdAt).toLocaleDateString()
    ]);
    autoTable(doc, {
      startY: 45,
      head: [['Client', 'Username', 'Category', 'Priority', 'Status', 'Sector', 'Package', 'Nearby', 'Dispatch Details', 'Date']],
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

    const headers = ['Client', 'Username', 'Category', 'Priority', 'Status', 'Sector', 'Package', 'Nearby', 'Dispatch Details', 'Date'];
    const rows = filtered.map(c => [
      c.customerName,
      c.customerUsername || 'N/A',
      c.category,
      c.priority,
      c.status.toUpperCase(),
      c.area,
      c.pkgDetails || 'N/A',
      c.userNearby || 'N/A',
      `"${c.description.replace(/"/g, '""')}"`,
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
      const headers = ['Client', 'Username', 'Category', 'Priority', 'Status', 'Sector', 'Package', 'Nearby', 'Dispatch Details', 'Date'];
      const rows = filtered.map(c => [
        c.customerName,
        c.customerUsername || 'N/A',
        c.category,
        c.priority || 'Medium',
        c.status.toUpperCase(),
        c.area,
        c.pkgDetails || 'N/A',
        c.userNearby || 'N/A',
        `"${c.description.replace(/"/g, '""')}"`,
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
      console.error('Critical Backup Error:', error);
      const errorMessage = error.message || '';
      
      if (errorMessage.includes('insufficient permissions') || errorMessage.includes('403') || errorMessage.includes('401')) {
        if (confirm('Security token expired or lacks Drive permissions. Re-connect now?')) {
          try {
            await googleSheetsService.initiateAuth();
            setIsGoogleConnected(true);
            toast.success('Security clearance granted! Please try the backup again.');
          } catch (authError) {
            console.error('Re-auth failed:', authError);
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

  const confirmDelete = async () => {
    if (complaintToDelete && onDelete) {
      await onDelete(complaintToDelete);
      setComplaintToDelete(null);
      setSelectedComplaint(null);
    }
  };

  return (
    <div className="space-y-8">
      <AnimatePresence>
        {complaintToDelete && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setComplaintToDelete(null)}
              className="absolute inset-0 bg-slate-950/80 backdrop-blur-md"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
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

      {/* Search & Filters */}
      <div className="flex flex-col gap-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="flex flex-col gap-2">
            <h3 className="text-2xl font-black flex items-center gap-3 uppercase tracking-tight">
              Operational Registry
              <span className="text-xs font-black px-3 py-1.5 bg-brand-accent/10 border border-brand-accent/20 text-brand-accent rounded leading-none">
                {filteredComplaints.length} Records
              </span>
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 font-black uppercase tracking-[0.2em] flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-sm" />
              Real-time Logs <span className="text-slate-300 dark:text-slate-700">|</span> {complaints.filter(c => new Date(c.createdAt).toDateString() === new Date().toDateString()).length} entries today
            </p>
          </div>
          
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex bg-slate-100 dark:bg-slate-900 rounded-lg p-1 border border-slate-200 dark:border-slate-800">
              <button
                onClick={setFilterToday}
                className="px-4 py-2 rounded-md text-xs font-black uppercase tracking-wider hover:bg-white dark:hover:bg-slate-800 transition-all text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              >
                Today
              </button>
              <button
                onClick={setFilterYesterday}
                className="px-4 py-2 rounded-md text-xs font-black uppercase tracking-wider hover:bg-white dark:hover:bg-slate-800 transition-all text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              >
                Yesterday
              </button>
            </div>
            
            <button
              onClick={() => {
                clearDateFilters();
                setSearchQuery('');
                setStatusFilter('all');
              }}
              className="px-3 py-1.5 text-[10px] font-bold text-slate-400 hover:text-red-500 uppercase tracking-widest transition-colors"
            >
              Reset
            </button>
            
            {complaints.length > 0 && (
              <div className="flex items-center gap-2">
                <button
                  onClick={exportToPDF}
                  className="flex items-center gap-2 px-5 py-2 rounded-lg bg-slate-900 dark:bg-slate-800 text-white transition-all text-[11px] font-bold uppercase tracking-widest shadow-lg hover:bg-black dark:hover:bg-slate-700"
                >
                  <Download size={14} />
                  PDF
                </button>
                <button
                  onClick={exportToCSV}
                  className="flex items-center gap-2 px-5 py-2 rounded-lg bg-emerald-500 text-white transition-all text-[11px] font-bold uppercase tracking-widest shadow-lg hover:bg-emerald-600"
                >
                  <FileDown size={14} />
                  CSV
                </button>
                <div className="flex items-center gap-1 group/google">
                  <button
                    onClick={handleBackupToDrive}
                    disabled={isBackingUp}
                    className={cn(
                      "flex items-center gap-2 px-5 py-2 rounded-lg transition-all text-[11px] font-bold uppercase tracking-widest shadow-lg",
                      isGoogleConnected 
                        ? "bg-brand-accent text-white hover:bg-blue-700" 
                        : "bg-slate-100 dark:bg-slate-900 text-slate-400 border border-slate-200 dark:border-slate-800 hover:border-brand-accent/50 hover:text-brand-accent",
                      isBackingUp && "opacity-50 cursor-not-allowed"
                    )}
                  >
                    <CloudUpload size={14} className={isBackingUp ? "animate-bounce" : ""} />
                    {isBackingUp ? 'Backing up...' : isGoogleConnected ? 'Backup to Drive' : 'Sync Google'}
                  </button>
                  {isGoogleConnected && !isBackingUp && (
                    <button 
                      onClick={handleGoogleDisconnect}
                      className="p-2 text-slate-300 hover:text-rose-500 transition-colors"
                      title="Disconnect Google Account"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
          <div className="md:col-span-12 lg:col-span-3 relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search registry (Name, Phone, Area)..."
              className="w-full pl-11 pr-4 py-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 font-medium focus:ring-2 focus:ring-brand-accent/20"
            />
            <Printer size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
          </div>

          <div className="md:col-span-6 lg:col-span-2">
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value as any)}
              className="w-full px-4 py-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-[11px] font-bold uppercase tracking-widest text-slate-600 dark:text-slate-100 placeholder:text-slate-400 focus:ring-2 focus:ring-brand-accent/20 appearance-none bg-no-repeat"
              style={{ 
                backgroundPosition: 'right 1rem center', 
                backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' fill=\'none\' viewBox=\'0 0 24 24\' stroke=\'%2364748b\'%3E%3Cpath stroke-linecap=\'round\' stroke-linejoin=\'round\' stroke-width=\'2\' d=\'M19 9l-7 7-7-7\'/%3E%3C/svg%3E")', 
                backgroundSize: '1rem' 
              }}
            >
              <option value="all">ALL CATEGORIES</option>
              {appConfig.categories.map(cat => (
                <option key={cat} value={cat}>{cat.toUpperCase()}</option>
              ))}
            </select>
          </div>

          <div className="md:col-span-6 lg:col-span-2">
            <select
              value={zoneFilter}
              onChange={(e) => setZoneFilter(e.target.value)}
              className="w-full px-4 py-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-[11px] font-bold uppercase tracking-widest text-slate-600 dark:text-slate-100 focus:ring-2 focus:ring-brand-accent/20 appearance-none bg-no-repeat"
              style={{ 
                backgroundPosition: 'right 1rem center', 
                backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' fill=\'none\' viewBox=\'0 0 24 24\' stroke=\'%2364748b\'%3E%3Cpath stroke-linecap=\'round\' stroke-linejoin=\'round\' stroke-width=\'2\' d=\'M19 9l-7 7-7-7\'/%3E%3C/svg%3E")', 
                backgroundSize: '1rem' 
              }}
            >
              <option value="all">ALL ZONES</option>
              {appConfig.zones?.map(zone => (
                <option key={zone} value={zone}>{zone.toUpperCase()}</option>
              ))}
            </select>
          </div>

          <div className="md:col-span-6 lg:col-span-2">
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value as any)}
              className="w-full px-4 py-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-[11px] font-bold uppercase tracking-widest text-slate-600 dark:text-slate-100 focus:ring-2 focus:ring-brand-accent/20 appearance-none bg-no-repeat"
              style={{ 
                backgroundPosition: 'right 1rem center', 
                backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' fill=\'none\' viewBox=\'0 0 24 24\' stroke=\'%2364748b\'%3E%3Cpath stroke-linecap=\'round\' stroke-linejoin=\'round\' stroke-width=\'2\' d=\'M19 9l-7 7-7-7\'/%3E%3C/svg%3E")', 
                backgroundSize: '1rem' 
              }}
            >
              <option value="all">ALL PRIORITIES</option>
              {appConfig.priorities.map(pri => (
                <option key={pri} value={pri}>{pri.toUpperCase()} PRIORITY</option>
              ))}
            </select>
          </div>

          <div className="md:col-span-12 lg:col-span-3">
            <div className="flex p-1 bg-slate-100 dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 w-full h-full overflow-x-auto">
              <button
                onClick={() => setStatusFilter('all')}
                className={cn(
                  "flex-1 px-2 py-1 rounded-md text-[8px] font-black uppercase tracking-tighter transition-all whitespace-nowrap",
                  statusFilter === 'all' 
                    ? "bg-white dark:bg-slate-800 text-brand-accent shadow-sm border border-slate-200 dark:border-slate-700" 
                    : "text-slate-500 hover:text-slate-900 dark:hover:text-slate-300"
                )}
              >
                ALL
              </button>
              {appConfig.statuses.map((s) => (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className={cn(
                    "flex-1 px-2 py-1 rounded-md text-[8px] font-black uppercase tracking-tighter transition-all whitespace-nowrap",
                    statusFilter === s 
                      ? "bg-white dark:bg-slate-800 text-brand-accent shadow-sm border border-slate-200 dark:border-slate-700" 
                      : "text-slate-500 hover:text-slate-900 dark:hover:text-slate-300"
                  )}
                >
                  {s.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex justify-end">
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm w-full lg:w-72">
            <Calendar size={14} className="text-brand-accent shrink-0" />
            <input 
              type="date" 
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="bg-transparent border-none text-[10px] focus:outline-none text-slate-600 dark:text-slate-100 w-full uppercase font-bold"
            />
            <span className="text-slate-300">|</span>
            <input 
              type="date" 
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="bg-transparent border-none text-[10px] focus:outline-none text-slate-600 dark:text-slate-100 w-full uppercase font-bold"
            />
          </div>
        </div>
      </div>

      {/* Row-based Grid (Table View) */}
      <motion.div 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="business-card overflow-hidden bg-white dark:bg-slate-950 shadow-xl border border-slate-100 dark:border-slate-800/50"
      >
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[800px]">
            <thead className="bg-slate-50 dark:bg-slate-900/50 border-b border-slate-100 dark:border-slate-800">
              <tr>
                <th 
                  className="px-6 py-4 text-xs font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 cursor-pointer hover:text-brand-accent transition-colors"
                  onClick={() => handleSort('client')}
                >
                  <div className="flex items-center gap-2">
                    Client Name
                    {sortConfig.key === 'client' && (
                       sortConfig.direction === 'asc' ? <ChevronUp size={12} className="text-brand-accent" /> : <ChevronDown size={12} className="text-brand-accent" />
                    )}
                  </div>
                </th>
                <th 
                  className="px-6 py-4 text-xs font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 cursor-pointer hover:text-brand-accent transition-colors"
                  onClick={() => handleSort('category')}
                >
                  <div className="flex items-center gap-2">
                    Category
                    {sortConfig.key === 'category' && (
                       sortConfig.direction === 'asc' ? <ChevronUp size={12} className="text-brand-accent" /> : <ChevronDown size={12} className="text-brand-accent" />
                    )}
                  </div>
                </th>
                <th 
                  className="px-6 py-4 text-xs font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 cursor-pointer hover:text-brand-accent transition-colors"
                  onClick={() => handleSort('tactical')}
                >
                  <div className="flex items-center gap-2">
                    Sector
                    {sortConfig.key === 'tactical' && (
                       sortConfig.direction === 'asc' ? <ChevronUp size={12} className="text-brand-accent" /> : <ChevronDown size={12} className="text-brand-accent" />
                    )}
                  </div>
                </th>
                <th 
                  className="px-6 py-4 text-xs font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 cursor-pointer hover:text-brand-accent transition-colors"
                  onClick={() => handleSort('description')}
                >
                  <div className="flex items-center gap-2">
                    Issue Details
                    {sortConfig.key === 'description' && (
                       sortConfig.direction === 'asc' ? <ChevronUp size={12} className="text-brand-accent" /> : <ChevronDown size={12} className="text-brand-accent" />
                    )}
                  </div>
                </th>
                <th 
                  className="px-6 py-4 text-xs font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 text-center cursor-pointer hover:text-brand-accent transition-colors"
                  onClick={() => handleSort('urgency')}
                >
                  <div className="flex items-center justify-center gap-2">
                    Priority
                    {sortConfig.key === 'urgency' && (
                       sortConfig.direction === 'asc' ? <ChevronUp size={12} className="text-brand-accent" /> : <ChevronDown size={12} className="text-brand-accent" />
                    )}
                  </div>
                </th>
                <th 
                  className="px-6 py-4 text-xs font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 text-center cursor-pointer hover:text-brand-accent transition-colors"
                  onClick={() => handleSort('status')}
                >
                  <div className="flex items-center justify-center gap-2">
                    Status
                    {sortConfig.key === 'status' && (
                       sortConfig.direction === 'asc' ? <ChevronUp size={12} className="text-brand-accent" /> : <ChevronDown size={12} className="text-brand-accent" />
                    )}
                  </div>
                </th>
                <th 
                  className="px-6 py-4 text-xs font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 text-right cursor-pointer hover:text-brand-accent transition-colors"
                  onClick={() => handleSort('registry')}
                >
                  <div className="flex items-center justify-end gap-2">
                    Registry Date
                    {sortConfig.key === 'registry' && (
                       sortConfig.direction === 'asc' ? <ChevronUp size={12} className="text-brand-accent" /> : <ChevronDown size={12} className="text-brand-accent" />
                    )}
                  </div>
                </th>
                <th className="px-6 py-4 text-xs font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 text-right">Protocol</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 dark:divide-slate-800/40">
              <AnimatePresence mode="popLayout">
                {paginatedComplaints.length === 0 ? (
                   <tr>
                     <td colSpan={8} className="py-24 text-center">
                       <Clock size={40} className="text-slate-200 mx-auto mb-4" />
                       <p className="text-slate-400 font-bold uppercase tracking-widest text-sm">No records meet current parameters</p>
                    </td>
                  </tr>
                ) : (
                  paginatedComplaints.map((complaint) => (
                    <motion.tr
                      key={complaint.id}
                      layout
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      onClick={() => setSelectedComplaint(complaint)}
                      className="group hover:bg-slate-50/50 dark:hover:bg-slate-900/30 transition-all cursor-pointer"
                    >
                      <td className="px-6 py-5">
                        <div className="flex items-center gap-4">
                          <div className="shrink-0 w-10 h-10 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 group-hover:bg-brand-accent/10 group-hover:text-brand-accent transition-colors">
                            {complaint.category === 'Fiber Break' ? <Zap size={20} /> : <Wifi size={20} />}
                          </div>
                          <div className="flex flex-col">
                            <span className="font-extrabold text-slate-900 dark:text-white uppercase tracking-tight leading-none mb-1">
                              {complaint.customerName}
                            </span>
                            <span className="text-[10px] font-mono text-slate-400 uppercase tracking-widest">{complaint.customerUsername || '---'}</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-5">
                        <span className="text-xs font-black text-slate-800 dark:text-slate-100 uppercase tracking-widest bg-slate-100/50 dark:bg-slate-800/50 px-2.5 py-1.5 rounded-lg border border-slate-200/50 dark:border-slate-700/50">
                          {complaint.category}
                        </span>
                      </td>
                      <td className="px-6 py-5">
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-1.5 text-xs font-black text-slate-700 dark:text-slate-200 uppercase tracking-widest">
                             <MapPin size={12} className="text-brand-accent/60" />
                             {complaint.area}
                          </div>
                          {complaint.userNearby && (
                            <span className="text-[10px] font-bold text-brand-accent/70 uppercase tracking-widest flex items-center gap-1">
                              <MapPinned size={10} /> {complaint.userNearby}
                            </span>
                          )}
                          <span className="text-xs font-mono text-slate-500 dark:text-slate-400">{complaint.number}</span>
                        </div>
                      </td>
                      <td className="px-6 py-5">
                        <span className="text-sm text-slate-700 dark:text-slate-300 font-medium line-clamp-2 max-w-[200px]">
                          {complaint.description}
                        </span>
                      </td>
                      <td className="px-6 py-5">
                        <div className="flex justify-center">
                          <div className={cn(
                            "px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-widest border",
                            getPriorityColor(complaint.priority || 'Medium')
                          )}>
                            {complaint.priority || 'Medium'}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-5">
                        <div className="flex justify-center">
                          <div className={cn(
                            "flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-widest border shadow-sm",
                            getStatusColor(complaint.status)
                          )}>
                            {getStatusIcon(complaint.status)}
                            {complaint.status}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-5 text-right">
                        <div className="flex flex-col items-end">
                          <span className="text-xs font-black text-slate-600 dark:text-slate-400 uppercase tracking-tighter">
                            {new Date(complaint.createdAt).toLocaleDateString()}
                          </span>
                          <span className="text-xs font-mono text-slate-400">{new Date(complaint.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                      </td>
                      <td className="px-6 py-5 text-right">
                        <div className="flex justify-end gap-2">
                           {(isAdmin || (currentUserId && complaint.memberId === currentUserId)) && (
                             <button
                               onClick={(e) => {
                                 e.stopPropagation();
                                 setEditingId(complaint.id);
                                 setEditData({ ...complaint });
                                 setSelectedComplaint(null); // Close detail modal if open
                               }}
                               className="p-2 text-slate-300 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-500/10 rounded-lg transition-all"
                               title="Edit Operational Log"
                             >
                               <Pencil size={16} />
                             </button>
                           )}
                           {isAdmin && onDelete && (
                             <button
                               onClick={(e) => {
                                 e.stopPropagation();
                                 setComplaintToDelete(complaint.id);
                               }}
                               className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-all"
                               title="Revoke Registry"
                             >
                               <Trash2 size={16} />
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
                      key={pageNum}
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
            onClose={() => setEditingId(null)}
            onSave={async (data) => {
              if (onEdit) {
                await onEdit(editingId, data);
              }
            }}
          />
        )}

        {selectedComplaint && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedComplaint(null)}
              className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm"
            />
            
            <motion.div
              layoutId={selectedComplaint.id}
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-2xl bg-white dark:bg-slate-950 rounded-2xl shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-800"
            >
              <div className="p-8 space-y-8">
                <div className="flex justify-between items-start">
                  <div className="space-y-1">
                    <div className={cn(
                      "inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-widest border mb-4",
                      getStatusColor(selectedComplaint.status)
                    )}>
                      {getStatusIcon(selectedComplaint.status)}
                      {selectedComplaint.status} Protocol
                    </div>
                    <h2 className="text-4xl font-black text-slate-950 dark:text-white uppercase tracking-tight leading-tight">
                      {selectedComplaint.customerName}
                    </h2>
                    {selectedComplaint.customerUsername && (
                      <div className="flex items-center gap-2 mt-2">
                        <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Access ID:</span>
                        <span className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-widest bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-md border border-slate-200 dark:border-slate-700">
                          {selectedComplaint.customerUsername}
                        </span>
                      </div>
                    )}
                  </div>
                  <button 
                    onClick={() => setSelectedComplaint(null)}
                    className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-900 text-slate-400 transition-all"
                  >
                    <X size={24} />
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-8">
                  <div className="space-y-6">
                    <div className="space-y-1">
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Tactical Sector</p>
                      <div className="flex items-center gap-2 text-slate-900 dark:text-slate-100 font-bold">
                        <MapPin size={16} className="text-brand-accent/60" />
                        <span className="uppercase tracking-tight text-lg">{selectedComplaint.area}</span>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Link Access</p>
                      <div className="flex items-center gap-2 text-slate-900 dark:text-slate-100 font-bold">
                        <Phone size={16} className="text-brand-accent/60" />
                        <span className="font-mono text-lg">{selectedComplaint.number}</span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-6">
                    <div className="space-y-1">
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Package Details</p>
                      <div className="flex items-center gap-2 text-slate-900 dark:text-slate-100 font-bold">
                        <Package size={16} className="text-brand-accent/60" />
                        <span className="uppercase tracking-tight text-lg">{selectedComplaint.pkgDetails || 'N/A'}</span>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">User Nearby / Landmark</p>
                      <div className="flex items-center gap-2 text-slate-900 dark:text-slate-100 font-bold">
                        <MapPinned size={16} className="text-brand-accent/60" />
                        <span className="uppercase tracking-tight text-lg">{selectedComplaint.userNearby || 'N/A'}</span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-6">
                    <div className="space-y-1">
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Issue Category</p>
                      <div className="flex items-center gap-2 text-slate-900 dark:text-slate-100 font-bold">
                        <Layers size={16} className="text-brand-accent/60" />
                        <span className="uppercase tracking-tight text-lg">{selectedComplaint.category || 'N/A'}</span>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Urgency Level</p>
                      <div className="flex items-center gap-2 text-slate-900 dark:text-slate-100 font-bold">
                        <Activity size={16} className="text-brand-accent/60" />
                        <div className={cn(
                          "px-3 py-0.5 rounded text-sm uppercase tracking-widest border",
                          getPriorityColor(selectedComplaint.priority || 'Medium')
                        )}>
                          {selectedComplaint.priority || 'Medium'}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-8 pt-6 border-t border-slate-100 dark:border-slate-800">
                  <div className="space-y-1">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Registry Delegate</p>
                    <div className="flex items-center gap-2 text-slate-900 dark:text-slate-100 font-bold">
                      <User size={16} className="text-slate-300" />
                      <span className="uppercase tracking-tight">{selectedComplaint.memberName || 'System Core'}</span>
                    </div>
                  </div>
                  <div className="space-y-1 text-right">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Timestamp</p>
                    <div className="flex items-center gap-2 justify-end text-slate-400 font-bold">
                      <span className="tracking-tighter">{new Date(selectedComplaint.createdAt).toLocaleString()}</span>
                      <Calendar size={16} className="text-slate-200" />
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Operational Log Details</p>
                  <div className="p-6 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800 italic text-slate-700 dark:text-slate-300 leading-relaxed text-lg shadow-inner">
                    "{selectedComplaint.description}"
                  </div>
                </div>

                {isAdmin && onStatusChange && (
                  <div className="pt-8 border-t border-slate-100 dark:border-slate-800 space-y-4">
                    <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest text-center">Executive Registry Management</p>
                    <div className="flex flex-wrap justify-center gap-3">
                      {appConfig.statuses.map((s) => (
                        <button
                          key={s}
                          onClick={() => {
                            onStatusChange(selectedComplaint.id, s);
                            setSelectedComplaint({ ...selectedComplaint, status: s });
                          }}
                          className={cn(
                            "px-4 py-2.5 rounded-lg text-xs font-black uppercase tracking-widest transition-all border",
                            selectedComplaint.status === s 
                              ? "bg-slate-900 dark:bg-brand-accent text-white border-slate-900 dark:border-brand-accent shadow-xl" 
                              : "bg-white dark:bg-slate-900 text-slate-500 border-slate-100 dark:border-slate-800 hover:border-slate-300"
                          )}
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                    
                    <div className="flex justify-center pt-4">
                       {onDelete && (
                         <button
                           onClick={async () => {
                             setComplaintToDelete(selectedComplaint.id);
                           }}
                           className="flex items-center gap-2 px-6 py-2.5 text-xs font-black text-rose-600 dark:text-rose-400 uppercase tracking-widest border border-rose-100 dark:border-rose-900/30 hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded-lg transition-all"
                         >
                           <Trash2 size={14} />
                           Revoke Entry
                         </button>
                       )}
                    </div>
                  </div>
                )}
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
  onClose, 
  onSave 
}: { 
  complaint: Partial<Complaint>, 
  appConfig: AppConfig,
  onClose: () => void, 
  onSave: (data: Partial<Complaint>) => Promise<void> 
}) {
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

  const inputClasses = "w-full px-4 py-2.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-accent/30 transition-all font-medium placeholder:text-slate-400";
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
              <label className={labelClasses}>Client Name</label>
              <input
                type="text"
                value={data.customerName || ''}
                onChange={(e) => setData({ ...data, customerName: e.target.value })}
                className={inputClasses}
                required
              />
            </div>
            <div className="space-y-1.5">
              <label className={labelClasses}>Client Username</label>
              <input
                type="text"
                value={data.customerUsername || ''}
                onChange={(e) => setData({ ...data, customerUsername: e.target.value })}
                className={inputClasses}
                required
              />
            </div>
            <div className="space-y-1.5">
              <label className={labelClasses}>Tactical Sector (Area)</label>
              <select
                value={data.area || (appConfig.zones?.[0] || '')}
                onChange={(e) => setData({ ...data, area: e.target.value })}
                className={cn(inputClasses, "appearance-none")}
              >
                {appConfig.zones?.map(zone => (
                  <option key={zone} value={zone}>{zone}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className={labelClasses}>Communication No.</label>
              <input
                type="text"
                value={data.number || ''}
                onChange={(e) => setData({ ...data, number: e.target.value })}
                className={inputClasses}
                required
              />
            </div>
            <div className="space-y-1.5">
              <label className={labelClasses}>Package Details</label>
              <input
                type="text"
                value={data.pkgDetails || ''}
                onChange={(e) => setData({ ...data, pkgDetails: e.target.value })}
                className={inputClasses}
              />
            </div>
            <div className="space-y-1.5">
              <label className={labelClasses}>User Nearby</label>
              <input
                type="text"
                value={data.userNearby || ''}
                onChange={(e) => setData({ ...data, userNearby: e.target.value })}
                className={inputClasses}
              />
            </div>
            <div className="space-y-1.5">
              <label className={labelClasses}>Service Category</label>
              <select
                value={data.category || (appConfig.categories[0])}
                onChange={(e) => setData({ ...data, category: e.target.value as ComplaintCategory })}
                className={cn(inputClasses, "appearance-none")}
              >
                {appConfig.categories.map(cat => (
                  <option key={cat} value={cat}>{cat.toUpperCase()}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className={labelClasses}>Urgency Rating</label>
            <div className="grid grid-cols-4 gap-2">
              {appConfig.priorities.map((p) => (
                <button
                  key={p}
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
            <label className={labelClasses}>Log Dispatch Details</label>
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

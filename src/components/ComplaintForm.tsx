import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Send, User, MapPin, FileText, Phone, Info, Package, MapPinned, Layers, CloudOff, WifiOff, RefreshCw } from 'lucide-react';
import { ComplaintStatus, ComplaintCategory, ComplaintPriority, Client, UserProfile, BrandingConfig } from '../types';
import { cn, safeStringify } from '../lib/utils';
import { safeLocalStorage } from '../lib/safeLocalStorage';
import { Network, Wifi, ShieldAlert, Zap, Search, ChevronDown } from 'lucide-react';
import { Toaster, toast } from 'sonner';
import { AppConfig } from '../constants';
import { firebaseService } from '../lib/firebaseService';

interface ComplaintFormProps {
  onSubmit: (data: {
    customerName: string;
    customerUsername: string;
    area: string;
    description: string;
    number: string;
    pkgDetails?: string;
    userNearby?: string;
    panelDetails?: string;
    status: ComplaintStatus;
    category: ComplaintCategory;
    priority: ComplaintPriority;
  }) => Promise<void>;
  isLoading: boolean;
  appConfig: AppConfig;
  currentUser: UserProfile;
  branding: BrandingConfig;
  compact?: boolean;
}

export default function ComplaintForm({ onSubmit, isLoading, appConfig, currentUser, branding, compact = false }: ComplaintFormProps) {
  const customNames = branding.customNames || {};
  const [customerName, setCustomerName] = useState('');
  const [customerUsername, setCustomerUsername] = useState('');
  const [area, setArea] = useState('');
  const [description, setDescription] = useState('');
  const [number, setNumber] = useState('');
  const [pkgDetails, setPkgDetails] = useState('');
  const [userNearby, setUserNearby] = useState('');
  const [panelDetails, setPanelDetails] = useState('');
  const [status, setStatus] = useState<ComplaintStatus>('');
  const [category, setCategory] = useState<ComplaintCategory>('');
  const [priority, setPriority] = useState<ComplaintPriority>('');
  const [isScheduled, setIsScheduled] = useState(false);
  const [scheduleDate, setScheduleDate] = useState('');
  
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [pendingCount, setPendingCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  
  const [clients, setClients] = useState<Client[]>([]);
  const [showClientList, setShowClientList] = useState(false);
  const clientListRef = React.useRef<HTMLDivElement>(null);

  // Check pending count on load
  useEffect(() => {
    const queue = JSON.parse(safeLocalStorage.getItem('offline_complaints') || '[]');
    setPendingCount(queue.length);
  }, []);

  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Removed sync logic from here - moved to App.tsx for global reliability

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (clientListRef.current && !clientListRef.current.contains(event.target as Node)) {
        setShowClientList(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const tenantId = firebaseService.getReadTenantId(currentUser);
    const unsubscribe = firebaseService.subscribeClients((data) => {
      setClients(data);
    }, tenantId);
    return () => unsubscribe();
  }, [currentUser]);

  useEffect(() => {
    if (appConfig.categories.length > 0 && !category) setCategory(appConfig.categories[0]);
    if (appConfig.statuses.length > 0 && !status) setStatus(appConfig.statuses[0]);
    if (appConfig.priorities.length > 0 && !priority) setPriority(appConfig.priorities[0]);
    if (appConfig.zones && appConfig.zones.length > 0 && !area) setArea(appConfig.zones[0]);
  }, [appConfig]);

  // Manual selection area based on username keywords (called only during typing)
  const autoSelectArea = (username: string) => {
    if (!username || !appConfig.zones) return;
    
    const lowerUsername = username.toLowerCase();
    const matchedZone = appConfig.zones.find(zone => 
      lowerUsername.includes(zone.toLowerCase())
    );

    if (matchedZone) {
      setArea(matchedZone);
    }
  };

  const handleSelectClient = (client: Client) => {
    setCustomerName(client.name);
    setCustomerUsername(client.username);
    setArea(client.area);
    setNumber(client.mobileNumber || client.number || '');
    setPkgDetails(client.pkgDetails || '');
    setUserNearby(client.userNearby || '');
    setPanelDetails(client.panelDetails || '');
    setShowClientList(false);
  };

  const filteredClients = clients.filter(c => 
    c.username.toLowerCase().includes(customerUsername.toLowerCase()) ||
    c.name.toLowerCase().includes(customerUsername.toLowerCase())
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const formData = { 
      customerName: customerName.toUpperCase(), 
      customerUsername: customerUsername.toUpperCase(),
      area: area || (appConfig.zones?.[0] || ''), 
      description: description.toUpperCase(), 
      number: number.toUpperCase(),
      pkgDetails: pkgDetails.toUpperCase(),
      userNearby: userNearby.toUpperCase(),
      panelDetails: panelDetails.toUpperCase(),
      status: status || appConfig.statuses[0],
      category: category || appConfig.categories[0],
      priority: priority || appConfig.priorities[0],
      scheduledAt: isScheduled && scheduleDate ? new Date(scheduleDate).getTime() : undefined
    };

    if (isOffline) {
      // Offline mode: cache to localStorage
      const queue = JSON.parse(safeLocalStorage.getItem('offline_complaints') || '[]');
      queue.push(formData);
      safeLocalStorage.setItem('offline_complaints', safeStringify(queue));
      setPendingCount(queue.length);
      
      // Still show success feel but note it's local
      toast.info('Offline Cache Entry: Data stored locally. System will synchronize once communication link is re-established.', {
        duration: 5000,
        icon: '📦'
      });
    } else {
      await onSubmit(formData);
    }

    // Reset form
    setCustomerName('');
    setCustomerUsername('');
    setArea(appConfig.zones?.[0] || '');
    setDescription('');
    setNumber('');
    setPkgDetails('');
    setUserNearby('');
    setPanelDetails('');
    setStatus(appConfig.statuses[0]);
    setCategory(appConfig.categories[0]);
    setPriority(appConfig.priorities[0]);
    setIsScheduled(false);
    setScheduleDate('');
  };

  const inputClasses = "w-full px-4 py-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 text-slate-950 dark:text-slate-100 focus:outline-none focus:ring-4 focus:ring-brand-accent/10 focus:border-brand-accent/50 focus:bg-white dark:focus:bg-slate-900 transition-all duration-300 font-bold placeholder:text-slate-400 dark:placeholder:text-slate-600 shadow-sm text-center [text-align-last:center] uppercase placeholder:normal-case";
  const labelClasses = "block text-[11px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] mb-2 text-center group-focus-within/field:text-brand-accent transition-colors duration-300";

  const compactInputClasses = "w-full pl-10 pr-4 py-3 text-sm font-black rounded-xl border-2 border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-950 dark:text-white placeholder:text-slate-500 dark:placeholder:text-slate-400 focus:outline-none focus:ring-4 focus:ring-emerald-500/15 focus:border-emerald-600 dark:focus:border-emerald-500 hover:border-slate-400 dark:hover:border-slate-700 transition-all duration-300 uppercase placeholder:normal-case shadow-sm h-12";
  const compactLabelContainerClasses = "absolute left-3.5 -top-2 px-1.5 bg-white dark:bg-slate-950 text-[10px] font-black uppercase tracking-widest text-slate-800 dark:text-slate-200 group-focus-within/field:text-emerald-600 dark:group-focus-within/field:text-emerald-400 transition-all duration-200 z-10 flex items-center gap-1.5";

  if (compact) {
    return (
      <div className="w-full">
        {/* Offline / Online Status Indicator - Only show if offline or has pending syncs */}
        {(isOffline || pendingCount > 0) && (
          <div className="flex items-center justify-between px-3 py-1.5 mb-4 rounded-xl bg-slate-50/50 dark:bg-slate-900/20 border border-slate-100 dark:border-slate-900 text-[9px] font-black uppercase tracking-wider">
            {isOffline ? (
              <div className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
                <WifiOff size={11} className="animate-pulse" />
                Offline: Local Cache Active
              </div>
            ) : (
              <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Secure Link Active
              </div>
            )}

            {pendingCount > 0 && (
              <div className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400">
                <RefreshCw size={10} className={cn(isSyncing && "animate-spin")} />
                {pendingCount} Pending Sync{pendingCount > 1 ? 's' : ''}
              </div>
            )}
          </div>
        )}

        <form onSubmit={handleSubmit} className="grid grid-cols-12 gap-x-4 gap-y-4">
          {/* Identity Fields */}
          <div className="col-span-12 sm:col-span-6 group/field relative mt-1">
            <div className={compactLabelContainerClasses}>
              <Search size={11} />
              {customNames.username || 'System Username'}
            </div>
            <div className="relative" ref={clientListRef}>
              <input
                type="text"
                value={customerUsername}
                onChange={(e) => {
                  const val = e.target.value.toUpperCase();
                  setCustomerUsername(val);
                  autoSelectArea(val);
                  setShowClientList(true);
                }}
                onFocus={() => setShowClientList(true)}
                placeholder="ENTER USERNAME"
                className={compactInputClasses}
                required
              />
              <User size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-400 group-focus-within/field:text-emerald-600 dark:group-focus-within/field:text-emerald-400 transition-colors duration-300 pointer-events-none" />
              
              {showClientList && customerUsername && filteredClients.length > 0 && (
                <div className="absolute left-0 right-0 z-50 mt-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl overflow-hidden max-h-48 overflow-y-auto animate-in fade-in slide-in-from-top-1 duration-200">
                  <div className="px-3 py-1.5 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50 text-center">
                    <span className="text-[8px] font-black uppercase tracking-widest text-slate-400">
                      Matches Found
                    </span>
                  </div>
                  {filteredClients.map(client => (
                    <button
                      key={client.id}
                      type="button"
                      onClick={() => handleSelectClient(client)}
                      className="w-full px-4 py-2 flex flex-col items-center hover:bg-emerald-500 text-center group/item transition-all border-b border-slate-100 dark:border-slate-800/40 last:border-0 cursor-pointer"
                    >
                      <span className="text-[11px] font-black text-slate-900 dark:text-white uppercase tracking-tight group-hover/item:text-white">{client.name}</span>
                      <div className="flex items-center gap-1.5 mt-0.5 justify-center">
                        <span className="text-[9px] font-bold text-emerald-500 group-hover/item:text-white/90 uppercase">@{client.username}</span>
                        <span className="text-[8px] font-medium text-slate-400 group-hover/item:text-white/75 uppercase tracking-widest border-l border-slate-200 dark:border-slate-800 pl-1.5">{client.area}</span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="col-span-12 sm:col-span-6 group/field relative mt-1">
            <div className={compactLabelContainerClasses}>
              <User size={11} />
              {customNames.client || 'Full Legal Name'}
            </div>
            <div className="relative">
              <input
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value.toUpperCase())}
                placeholder="ENTER FULL NAME"
                className={compactInputClasses}
                required
              />
              <User size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-400 group-focus-within/field:text-emerald-600 dark:group-focus-within/field:text-emerald-400 transition-colors duration-300 pointer-events-none" />
            </div>
          </div>

          <div className="col-span-12 sm:col-span-6 group/field relative mt-1">
            <div className={compactLabelContainerClasses}>
              <Phone size={11} />
              {customNames.number || 'Contact Number'}
            </div>
            <div className="relative">
              <input
                type="tel"
                value={number}
                onChange={(e) => setNumber(e.target.value.toUpperCase())}
                placeholder="+92 XXX XXXXXXX"
                className={compactInputClasses}
                required
              />
              <Phone size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-400 group-focus-within/field:text-emerald-600 dark:group-focus-within/field:text-emerald-400 transition-colors duration-300 pointer-events-none" />
            </div>
          </div>

          <div className="col-span-12 sm:col-span-6 group/field relative mt-1">
            <div className={compactLabelContainerClasses}>
              <MapPin size={11} />
              {customNames.zone || 'Deployment Zone'}
            </div>
            <div className="relative">
              <select
                value={area}
                onChange={(e) => setArea(e.target.value)}
                className={cn(compactInputClasses, "appearance-none pr-8 cursor-pointer")}
                required
              >
                {appConfig.zones?.map((zone, i) => (
                  <option key={`zone-${i}`} value={zone}>{zone.toUpperCase()}</option>
                ))}
              </select>
              <MapPin size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-400 group-focus-within/field:text-emerald-600 dark:group-focus-within/field:text-emerald-400 transition-colors duration-300 pointer-events-none" />
              <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-400 pointer-events-none transition-transform duration-300 group-focus-within/field:rotate-180" />
            </div>
          </div>

          {/* Technical Info Row */}
          <div className="col-span-12 sm:col-span-4 group/field relative mt-1">
            <div className={compactLabelContainerClasses}>
              <Package size={11} />
              {customNames.pkg || 'Profile (Package)'}
            </div>
            <div className="relative">
              <input
                type="text"
                value={pkgDetails}
                onChange={(e) => setPkgDetails(e.target.value.toUpperCase())}
                placeholder="EX: 50MB FIBER"
                className={compactInputClasses}
              />
              <Package size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-400 group-focus-within/field:text-emerald-600 dark:group-focus-within/field:text-emerald-400 transition-colors duration-300 pointer-events-none" />
            </div>
          </div>

          <div className="col-span-12 sm:col-span-4 group/field relative mt-1">
            <div className={compactLabelContainerClasses}>
              <Layers size={11} />
              {customNames.panel || 'Distribution Node'}
            </div>
            <div className="relative">
              <input
                type="text"
                value={panelDetails}
                onChange={(e) => setPanelDetails(e.target.value.toUpperCase())}
                placeholder="BOX / PORT DETAILS"
                className={compactInputClasses}
              />
              <Layers size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-400 group-focus-within/field:text-emerald-600 dark:group-focus-within/field:text-emerald-400 transition-colors duration-300 pointer-events-none" />
            </div>
          </div>

          <div className="col-span-12 sm:col-span-4 group/field relative mt-1">
            <div className={compactLabelContainerClasses}>
              <MapPinned size={11} />
              {customNames.nearby || 'Locality Landmark'}
            </div>
            <div className="relative">
              <input
                type="text"
                value={userNearby}
                onChange={(e) => setUserNearby(e.target.value.toUpperCase())}
                placeholder="NEARBY REFERENCE"
                className={compactInputClasses}
              />
              <MapPinned size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-400 group-focus-within/field:text-emerald-600 dark:group-focus-within/field:text-emerald-400 transition-colors duration-300 pointer-events-none" />
            </div>
          </div>

          {/* Settings Row */}
          <div className="col-span-12 sm:col-span-4 group/field relative mt-1">
            <div className={compactLabelContainerClasses}>
              <Info size={11} />
              {customNames.category || 'Category'}
            </div>
            <div className="relative">
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as ComplaintCategory)}
                className={cn(compactInputClasses, "appearance-none pr-8 cursor-pointer")}
              >
                {appConfig.categories.map((cat, i) => (
                  <option key={`cat-${i}`} value={cat}>{cat.toUpperCase()}</option>
                ))}
              </select>
              <Info size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-400 group-focus-within/field:text-emerald-600 dark:group-focus-within/field:text-emerald-400 transition-colors duration-300 pointer-events-none" />
              <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-400 pointer-events-none transition-transform duration-300 group-focus-within/field:rotate-180" />
            </div>
          </div>

          <div className="col-span-12 sm:col-span-4 group/field relative mt-1">
            <div className={compactLabelContainerClasses}>
              <ShieldAlert size={11} />
              {customNames.priority || 'Security Priority'}
            </div>
            <div className="relative">
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as ComplaintPriority)}
                className={cn(compactInputClasses, "appearance-none pr-8 cursor-pointer")}
              >
                {appConfig.priorities.map((pri, i) => (
                  <option key={`pri-${i}`} value={pri}>{pri.toUpperCase()}</option>
                ))}
              </select>
              <ShieldAlert size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-400 group-focus-within/field:text-emerald-600 dark:group-focus-within/field:text-emerald-400 transition-colors duration-300 pointer-events-none" />
              <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-400 pointer-events-none transition-transform duration-300 group-focus-within/field:rotate-180" />
            </div>
          </div>

          <div className="col-span-12 sm:col-span-4 group/field relative mt-1">
            <div className={compactLabelContainerClasses}>
              <Wifi size={11} />
              {customNames.status || 'Current Status'}
            </div>
            <div className="relative">
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as ComplaintStatus)}
                className={cn(compactInputClasses, "appearance-none pr-8 cursor-pointer")}
              >
                {appConfig.statuses.map((stat, i) => (
                  <option key={`stat-${i}`} value={stat}>{stat.toUpperCase()}</option>
                ))}
              </select>
              <Wifi size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-400 group-focus-within/field:text-emerald-600 dark:group-focus-within/field:text-emerald-400 transition-colors duration-300 pointer-events-none" />
              <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-400 pointer-events-none transition-transform duration-300 group-focus-within/field:rotate-180" />
            </div>
          </div>

          {/* Schedule Ticket inline block */}
          <div className="col-span-12 p-2.5 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 bg-slate-50/10 dark:bg-slate-900/5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="compact-schedule-toggle"
                checked={isScheduled}
                onChange={(e) => setIsScheduled(e.target.checked)}
                className="rounded border-slate-300 text-emerald-500 focus:ring-emerald-500 cursor-pointer h-4 w-4"
              />
              <label htmlFor="compact-schedule-toggle" className="text-[10px] font-black uppercase text-slate-800 dark:text-slate-200 tracking-wider cursor-pointer select-none">
                Schedule Operations Ticket
              </label>
            </div>

            {isScheduled && (
              <div className="flex-1 max-w-xs group/field">
                <input
                  type="datetime-local"
                  value={scheduleDate}
                  onChange={(e) => setScheduleDate(e.target.value)}
                  required={isScheduled}
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-950 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-[10px] font-mono"
                />
              </div>
            )}
          </div>

          {/* Description Textarea */}
          <div className="col-span-12 group/field relative mt-1">
            <div className={compactLabelContainerClasses}>
              <FileText size={11} />
              {customNames.description || 'Mission Objectives / Details'}
            </div>
            <div className="relative">
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value.toUpperCase())}
                placeholder="DESCRIBE THE TECHNICAL ISSUE IN DETAIL..."
                rows={1}
                className={cn(compactInputClasses, "resize-none h-16 py-3 rounded-xl pl-10")}
                required
              />
              <FileText size={15} className="absolute left-3.5 top-3.5 text-slate-500 dark:text-slate-400 group-focus-within/field:text-emerald-600 dark:group-focus-within/field:text-emerald-400 transition-colors duration-300 pointer-events-none" />
            </div>
          </div>

          {/* Submit Button */}
          <div className="col-span-12 pt-0.5">
            <button
              type="submit"
              disabled={isLoading || isSyncing}
              className={cn(
                "group relative w-full overflow-hidden rounded-xl p-px font-bold transition-all hover:scale-[1.005] active:scale-[0.995] disabled:opacity-50 disabled:hover:scale-100 shadow-sm",
                isOffline ? "bg-amber-600" : "bg-gradient-to-r from-emerald-600 to-teal-500"
              )}
            >
              <div className={cn(
                "relative flex items-center justify-center gap-2 rounded-[11px] px-5 py-3 text-white transition-all",
                isOffline ? "bg-amber-600 hover:bg-amber-500" : "bg-slate-950/10 group-hover:bg-slate-950/0 dark:bg-slate-950/30"
              )}>
                {isLoading || isSyncing ? (
                  <>
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/20 border-t-white" />
                    <span className="text-xs sm:text-sm uppercase tracking-wider font-bold">{isSyncing ? "Syncing..." : "Processing..."}</span>
                  </>
                ) : (
                  <>
                    <span className="text-xs sm:text-sm uppercase tracking-wider font-black">
                      {isOffline ? "Store Locally (Offline)" : "Register Operations Log"}
                    </span>
                    {isOffline ? (
                      <CloudOff size={15} />
                    ) : (
                      <Send size={15} className="transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                    )}
                  </>
                )}
              </div>
            </button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <motion.div layout className="relative group max-w-5xl mx-auto w-full">
      {/* Decorative background element */}
      <div className="absolute -inset-2 bg-gradient-to-r from-brand-accent/10 via-blue-500/10 to-brand-accent/10 rounded-[2.5rem] blur-2xl opacity-20 group-hover:opacity-30 transition duration-1000 group-hover:duration-500"></div>
      
      <motion.div layout className="relative p-7 sm:p-9 md:p-11 bg-white dark:bg-slate-950 rounded-[2rem] border border-slate-200/60 dark:border-slate-800/80 shadow-[0_20px_50px_rgba(0,0,0,0.1)] dark:shadow-[0_20px_50px_rgba(0,0,0,0.3)] overflow-hidden">
        <motion.div layout className="flex flex-col items-center justify-center text-center mb-10">
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="p-3.5 rounded-3xl bg-brand-accent/10 text-brand-accent ring-1 ring-brand-accent/20 mb-5"
          >
            <Send size={28} strokeWidth={2.5} />
          </motion.div>
          
          <h3 className="text-2xl sm:text-3xl font-black uppercase tracking-tighter text-slate-900 dark:text-white mb-2">
            {customNames.complaint || 'Service Request'}
          </h3>
          <div className="flex flex-col items-center gap-2">
            <p className="text-[9px] font-black text-brand-accent uppercase tracking-[0.3em]">
              Operational Terminal Portal
            </p>
            {isOffline ? (
              <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-amber-50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/30 text-[8px] font-black text-amber-600 dark:text-amber-400 uppercase tracking-widest mt-1">
                <WifiOff size={10} className="animate-pulse" />
                Offline Mode: Local Caching Active
              </div>
            ) : (
              <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/30 text-[8px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest mt-1">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Secure Network Link: Active
              </div>
            )}

            {pendingCount > 0 && (
              <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/30 text-[8px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest">
                <RefreshCw size={10} className={cn(isSyncing && "animate-spin")} />
                {pendingCount} Pending Sync{pendingCount > 1 ? 's' : ''}
              </div>
            )}
          </div>
        </motion.div>

        <form onSubmit={handleSubmit} className="flex flex-col lg:flex-row gap-10 lg:items-start">
          {/* Section 1: Client Information */}
          <motion.div layout className="space-y-6 lg:w-1/2">
            <div className="flex items-center gap-4 justify-center">
              <div className="h-px w-8 bg-gradient-to-r from-transparent to-slate-200 dark:to-slate-800" />
              <span className="text-[9px] font-black text-slate-300 dark:text-slate-600 uppercase tracking-[0.4em]">Col 01 / Identity</span>
              <div className="h-px w-8 bg-gradient-to-l from-transparent to-slate-200 dark:to-slate-800" />
            </div>

            <motion.div layout className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <motion.div layout className="space-y-1 group/field">
                <label className={labelClasses}>{customNames.client || 'Full Legal Name'}</label>
                <div className="relative">
                  <input
                    type="text"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value.toUpperCase())}
                    placeholder="ENTER FULL NAME"
                    className={inputClasses}
                    required
                  />
                </div>
              </motion.div>

              <motion.div layout className="space-y-1 group/field">
                <label className={labelClasses}>{customNames.username || 'System Username'}</label>
                <div className="relative" ref={clientListRef}>
                  <input
                    type="text"
                    value={customerUsername}
                    onChange={(e) => {
                      const val = e.target.value.toUpperCase();
                      setCustomerUsername(val);
                      autoSelectArea(val);
                      setShowClientList(true);
                    }}
                    onFocus={() => setShowClientList(true)}
                    placeholder="ENTER USERNAME"
                    className={inputClasses}
                    required
                  />
                  
                  {showClientList && customerUsername && filteredClients.length > 0 && (
                    <div className="absolute z-50 w-full mt-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden max-h-72 overflow-y-auto animate-in fade-in slide-in-from-top-2 duration-300">
                      <div className="p-3 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50 text-center">
                        <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">
                          Database Matches Found
                        </span>
                      </div>
                      {filteredClients.map(client => (
                        <button
                          key={client.id}
                          type="button"
                          onClick={() => handleSelectClient(client)}
                          className="w-full px-6 py-4 flex flex-col items-center hover:bg-brand-accent text-center group/item transition-all border-b border-slate-100 dark:border-slate-800/40 last:border-0"
                        >
                          <span className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-tight group-hover/item:text-white">{client.name}</span>
                          <div className="flex flex-wrap items-center gap-2 mt-2 justify-center">
                            <span className="text-[10px] font-bold text-brand-accent group-hover/item:text-white/80 uppercase">@{client.username}</span>
                            <span className="text-[9px] font-medium text-slate-400 group-hover/item:text-white/60 uppercase tracking-widest border-l border-slate-200 dark:border-slate-800 group-hover/item:border-white/20 pl-2">{client.area}</span>
                            {client.pkgDetails && (
                              <span className="text-[9px] font-black text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200/50 dark:border-emerald-900/40 px-2 py-0.5 rounded-md group-hover/item:text-white group-hover/item:bg-white/20 group-hover/item:border-transparent uppercase">
                                {client.pkgDetails}
                              </span>
                            )}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </motion.div>
              
              <motion.div layout className="space-y-1 group/field">
                <label className={labelClasses}>{customNames.number || 'Contact Number'}</label>
                <div className="relative">
                  <input
                    type="tel"
                    value={number}
                    onChange={(e) => setNumber(e.target.value.toUpperCase())}
                    placeholder="+92 XXX XXXXXXX"
                    className={inputClasses}
                    required
                  />
                </div>
              </motion.div>

              <motion.div layout className="space-y-1 group/field">
                <label className={labelClasses}>{customNames.zone || 'Deployment Zone'}</label>
                <div className="relative">
                  <select
                    value={area}
                    onChange={(e) => setArea(e.target.value)}
                    className={cn(inputClasses, "appearance-none cursor-pointer")}
                    required
                  >
                    {appConfig.zones?.map((zone, i) => (
                      <option key={`zone-${i}`} value={zone}>{zone.toUpperCase()}</option>
                    ))}
                  </select>
                </div>
              </motion.div>

              <motion.div layout className="space-y-1 group/field sm:col-span-2">
                <label className={labelClasses}>{customNames.panel || 'Distribution Node / Panel'}</label>
                <div className="relative">
                  <input
                    type="text"
                    value={panelDetails}
                    onChange={(e) => setPanelDetails(e.target.value.toUpperCase())}
                    placeholder="BOX / PORT DETAILS"
                    className={inputClasses}
                  />
                </div>
              </motion.div>
              
              <motion.div layout className="space-y-1 group/field">
                <label className={labelClasses}>{customNames.pkg || 'Profile (Package)'}</label>
                <div className="relative">
                  <input
                    type="text"
                    value={pkgDetails}
                    onChange={(e) => setPkgDetails(e.target.value.toUpperCase())}
                    placeholder="EX: 50MB FIBER"
                    className={inputClasses}
                  />
                </div>
              </motion.div>

              <motion.div layout className="space-y-1 group/field">
                <label className={labelClasses}>{customNames.nearby || 'Locality Landmark'}</label>
                <div className="relative">
                  <input
                    type="text"
                    value={userNearby}
                    onChange={(e) => setUserNearby(e.target.value.toUpperCase())}
                    placeholder="NEARBY REFERENCE"
                    className={inputClasses}
                  />
                </div>
              </motion.div>
            </motion.div>
          </motion.div>

          <motion.div layout className="space-y-6 lg:w-1/2 lg:border-l lg:border-slate-100 dark:lg:border-slate-800 lg:pl-10">
            <div className="flex items-center gap-4 justify-center">
              <div className="h-px w-8 bg-gradient-to-r from-transparent to-slate-200 dark:to-slate-800" />
              <span className="text-[9px] font-black text-slate-300 dark:text-slate-600 uppercase tracking-[0.4em]">Col 02 / Operations</span>
              <div className="h-px w-8 bg-gradient-to-l from-transparent to-slate-200 dark:to-slate-800" />
            </div>

            <motion.div layout className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <motion.div layout className="space-y-1 group/field">
                <label className={labelClasses}>{customNames.category || 'Category'}</label>
                <div className="relative">
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as ComplaintCategory)}
                    className={cn(inputClasses, "appearance-none cursor-pointer")}
                  >
                    {appConfig.categories.map((cat, i) => (
                      <option key={`cat-${i}`} value={cat}>{cat.toUpperCase()}</option>
                    ))}
                  </select>
                </div>
              </motion.div>

              <motion.div layout className="space-y-1 group/field">
                <label className={labelClasses}>{customNames.priority || 'Security Priority'}</label>
                <div className="relative">
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value as ComplaintPriority)}
                    className={cn(inputClasses, "appearance-none cursor-pointer")}
                  >
                    {appConfig.priorities.map((pri, i) => (
                      <option key={`pri-${i}`} value={pri}>{pri.toUpperCase()}</option>
                    ))}
                  </select>
                </div>
              </motion.div>

              <motion.div layout className="space-y-1 sm:col-span-2 group/field">
                <label className={labelClasses}>{customNames.status || 'Current Status'}</label>
                <div className="relative">
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as ComplaintStatus)}
                    className={cn(inputClasses, "appearance-none cursor-pointer")}
                  >
                    {appConfig.statuses.map((stat, i) => (
                      <option key={`stat-${i}`} value={stat}>{stat.toUpperCase()}</option>
                    ))}
                  </select>
                </div>
              </motion.div>
            </motion.div>

            {/* Premium, interactive schedule settings block */}
            <motion.div layout className="p-5 mt-2 rounded-[1.25rem] border border-dashed border-slate-205 dark:border-slate-800 bg-slate-50/20 dark:bg-slate-900/10 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex flex-col text-left">
                  <span className="text-xs font-black uppercase text-slate-800 dark:text-slate-200 tracking-wider">(Schedule ur Operations)</span>
                </div>
                <label className="relative inline-flex items-center cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={isScheduled}
                    onChange={(e) => setIsScheduled(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-10 h-5.5 bg-slate-200 dark:bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4.5 after:w-4.5 after:transition-all peer-checked:bg-brand-accent"></div>
                </label>
              </div>

              {isScheduled && (
                <div className="space-y-1.5 animate-in fade-in slide-in-from-top-1 duration-200 group/field">
                  <label className={labelClasses}>Scheduled At (12-Hour Early Window Trigger)</label>
                  <div className="relative">
                    <input
                      type="datetime-local"
                      value={scheduleDate}
                      onChange={(e) => setScheduleDate(e.target.value)}
                      required={isScheduled}
                      className={cn(inputClasses, "cursor-text text-center font-mono py-2.5")}
                    />
                  </div>
                </div>
              )}
            </motion.div>

            <motion.div layout className="space-y-1 group/field">
              <label className={labelClasses}>{customNames.description || 'Mission Objectives / Details'}</label>
              <div className="relative">
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value.toUpperCase())}
                  placeholder="DESCRIBE THE TECHNICAL ISSUE IN DETAIL..."
                  rows={4}
                  className={cn(inputClasses, "resize-none h-[11.5rem] py-4 rounded-3xl")}
                  required
                />
              </div>
            </motion.div>

            <motion.div layout className="pt-2">
              <button
                type="submit"
                disabled={isLoading || isSyncing}
                className={cn(
                  "group relative w-full overflow-hidden rounded-[1.5rem] p-px font-bold transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:hover:scale-100 shadow-lg",
                  isOffline ? "bg-amber-600" : "bg-slate-950 dark:bg-brand-accent"
                )}
              >
                <div className={cn(
                  "relative flex items-center justify-center gap-3 rounded-[1.4375rem] px-6 py-4.5 text-white transition-all group-hover:bg-transparent",
                  isOffline ? "bg-amber-600 dark:bg-amber-700 hover:bg-amber-500" : "bg-slate-950 dark:bg-brand-accent dark:group-hover:bg-blue-700"
                )}>
                  {isLoading || isSyncing ? (
                    <>
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/20 border-t-white" />
                      <span className="text-[10px] uppercase tracking-[0.4em]">{isSyncing ? "Syncing Logic..." : "Syncing..."}</span>
                    </>
                  ) : (
                    <>
                      <span className="text-[10px] uppercase tracking-[0.4em] font-black">
                        {isOffline ? "Store Locally (Offline)" : "Register Operations Log"}
                      </span>
                      {isOffline ? (
                        <CloudOff size={15} />
                      ) : (
                        <Send size={15} className="transition-transform group-hover:translate-x-1 group-hover:-translate-y-1" />
                      )}
                    </>
                  )}
                </div>
              </button>
            </motion.div>
          </motion.div>
        </form>
      </motion.div>
    </motion.div>

  );
}

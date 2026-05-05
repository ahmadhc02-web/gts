import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Send, User, MapPin, FileText, Phone, Info, Package, MapPinned, Layers } from 'lucide-react';
import { ComplaintStatus, ComplaintCategory, ComplaintPriority, Client } from '../types';
import { cn } from '../lib/utils';
import { Network, Wifi, ShieldAlert, Zap, Search } from 'lucide-react';
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
}

export default function ComplaintForm({ onSubmit, isLoading, appConfig }: ComplaintFormProps) {
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
  
  const [clients, setClients] = useState<Client[]>([]);
  const [showClientList, setShowClientList] = useState(false);
  const clientListRef = React.useRef<HTMLDivElement>(null);

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
    const unsubscribe = firebaseService.subscribeClients((data) => {
      setClients(data);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (appConfig.categories.length > 0 && !category) setCategory(appConfig.categories[0]);
    if (appConfig.statuses.length > 0 && !status) setStatus(appConfig.statuses[0]);
    if (appConfig.priorities.length > 0 && !priority) setPriority(appConfig.priorities[0]);
    if (appConfig.zones && appConfig.zones.length > 0 && !area) setArea(appConfig.zones[0]);
  }, [appConfig]);

  // Auto-select area based on username keywords
  useEffect(() => {
    if (!customerUsername || !appConfig.zones) return;
    
    const lowerUsername = customerUsername.toLowerCase();
    const matchedZone = appConfig.zones.find(zone => 
      lowerUsername.includes(zone.toLowerCase())
    );

    if (matchedZone) {
      setArea(matchedZone);
    }
  }, [customerUsername, appConfig.zones]);

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
    await onSubmit({ 
      customerName, 
      customerUsername,
      area: area || (appConfig.zones?.[0] || ''), 
      description, 
      number,
      pkgDetails,
      userNearby,
      panelDetails,
      status: status || appConfig.statuses[0],
      category: category || appConfig.categories[0],
      priority: priority || appConfig.priorities[0]
    });
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
  };

  const inputClasses = "w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 text-slate-950 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-accent/30 focus:border-brand-accent/50 focus:bg-white dark:focus:bg-slate-900 transition-all duration-200 font-medium placeholder:text-slate-400 dark:placeholder:text-slate-600 shadow-sm";
  const labelClasses = "block text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-[0.15em] ml-1 mb-2";

  return (
    <motion.div layout className="relative group max-w-5xl mx-auto w-full">
      {/* Decorative background element */}
      <div className="absolute -inset-1 bg-gradient-to-r from-brand-accent/20 to-blue-600/20 rounded-[2rem] blur-xl opacity-25 group-hover:opacity-40 transition duration-1000 group-hover:duration-200"></div>
      
      <motion.div layout className="relative p-6 sm:p-8 md:p-10 bg-white dark:bg-slate-950 rounded-[1.5rem] border border-slate-200/60 dark:border-slate-800 shadow-2xl overflow-hidden">
        <motion.div layout className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8 gap-4">
          <div>
            <h3 className="text-2xl sm:text-3xl font-black uppercase tracking-tight flex items-center gap-4 text-slate-900 dark:text-white">
              <div className="p-3 rounded-2xl bg-brand-accent/10 text-brand-accent ring-1 ring-brand-accent/20">
                <Send size={24} strokeWidth={2.5} />
              </div>
              Service Request
            </h3>
            <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mt-2 ml-1">
              Terminal: Operational Log Entry
            </p>
          </div>
          <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800 text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-[.2em] shadow-sm">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Live Sync: Active
          </div>
        </motion.div>

        <form onSubmit={handleSubmit} className="flex flex-col xl:flex-row gap-8">
          {/* Section 1: Client Information */}
          <motion.div layout className="space-y-5 xl:w-[60%] flex-shrink-0">
            <motion.div layout className="flex items-center gap-3 mb-2">
              <div className="h-px flex-1 bg-slate-100 dark:bg-slate-800" />
              <span className="text-[10px] font-black text-slate-300 dark:text-slate-600 uppercase tracking-[.3em]">Client Identity</span>
              <div className="h-px flex-1 bg-slate-100 dark:bg-slate-800" />
            </motion.div>

            <motion.div layout className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <motion.div layout className="space-y-1">
                <label className={labelClasses}>Full Name</label>
                <div className="relative">
                  <User className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" size={18} />
                  <input
                    type="text"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="Ex: John Doe"
                    className={inputClasses}
                    required
                  />
                </div>
              </motion.div>

              <motion.div layout className="space-y-1">
                <label className={labelClasses}>Log Username</label>
                <div className="relative" ref={clientListRef}>
                  <User className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" size={18} />
                  <input
                    type="text"
                    value={customerUsername}
                    onChange={(e) => {
                      setCustomerUsername(e.target.value);
                      setShowClientList(true);
                    }}
                    onFocus={() => setShowClientList(true)}
                    placeholder="johndoe_hq"
                    className={inputClasses}
                    required
                  />
                  
                  {showClientList && customerUsername && filteredClients.length > 0 && (
                    <div className="absolute z-50 w-full mt-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl overflow-hidden max-h-64 overflow-y-auto animate-in fade-in zoom-in-95 duration-200">
                      <div className="p-2 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50">
                        <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                          <Search size={10} />
                          Matching Client Identity
                        </span>
                      </div>
                      {filteredClients.map(client => (
                        <button
                          key={client.id}
                          type="button"
                          onClick={() => handleSelectClient(client)}
                          className="w-full px-4 py-3 flex flex-col items-start hover:bg-brand-accent/5 dark:hover:bg-brand-accent/10 border-b border-slate-50 dark:border-slate-800/50 last:border-0 transition-colors"
                        >
                          <span className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-tight">{client.name}</span>
                          <div className="flex items-center gap-3 mt-1">
                            <span className="text-[10px] font-bold text-brand-accent uppercase">@{client.username}</span>
                            <span className="text-[9px] font-medium text-slate-400 uppercase tracking-widest border-l border-slate-200 dark:border-slate-800 pl-3">{client.area}</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                  {showClientList && customerUsername && filteredClients.length === 0 && (
                    <div className="absolute z-50 w-full mt-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl p-4 text-center animate-in fade-in zoom-in-95 duration-200">
                       <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">No matching profile in database</p>
                       <button 
                         type="button"
                         onClick={() => setShowClientList(false)}
                         className="mt-2 text-[9px] font-black text-brand-accent uppercase tracking-widest hover:underline"
                       >
                         Dismiss
                       </button>
                    </div>
                  )}
                </div>
              </motion.div>
              
              <motion.div layout className="space-y-1">
                <label className={labelClasses}>Primary Contact</label>
                <div className="relative">
                  <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" size={18} />
                  <input
                    type="tel"
                    value={number}
                    onChange={(e) => setNumber(e.target.value)}
                    placeholder="+92 XXX XXXXXXX"
                    className={inputClasses}
                    required
                  />
                </div>
              </motion.div>

              <motion.div layout className="space-y-1">
                <label className={labelClasses}>Deployment Zone</label>
                <div className="relative">
                  <MapPin className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" size={18} />
                  <select
                    value={area}
                    onChange={(e) => setArea(e.target.value)}
                    className={cn(inputClasses, "appearance-none bg-no-repeat")}
                    style={{ 
                      backgroundPosition: 'right 1rem center', 
                      backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' fill=\'none\' viewBox=\'0 0 24 24\' stroke=\'%2364748b\'%3E%3Cpath stroke-linecap=\'round\' stroke-linejoin=\'round\' stroke-width=\'2\' d=\'M19 9l-7 7-7-7\'/%3E%3C/svg%3E")', 
                      backgroundSize: '1rem' 
                    }}
                    required
                  >
                    {appConfig.zones?.map(zone => (
                      <option key={zone} value={zone}>{zone}</option>
                    ))}
                  </select>
                </div>
              </motion.div>

              <motion.div layout className="space-y-1">
                <label className={labelClasses}>Package Details</label>
                <div className="relative">
                  <Package className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" size={18} />
                  <input
                    type="text"
                    value={pkgDetails}
                    onChange={(e) => setPkgDetails(e.target.value)}
                    placeholder="Ex: 50Mbps Fiber"
                    className={inputClasses}
                  />
                </div>
              </motion.div>

              <motion.div layout className="space-y-1">
                <label className={labelClasses}>User Nearby / Landmark</label>
                <div className="relative">
                  <MapPinned className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" size={18} />
                  <input
                    type="text"
                    value={userNearby}
                    onChange={(e) => setUserNearby(e.target.value)}
                    placeholder="Ex: Near City Garden Gate"
                    className={inputClasses}
                  />
                </div>
              </motion.div>

              <motion.div layout className="space-y-1 sm:col-span-2">
                <label className={labelClasses}>Pannal Details</label>
                <div className="relative">
                  <Layers className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" size={18} />
                  <input
                    type="text"
                    value={panelDetails}
                    onChange={(e) => setPanelDetails(e.target.value)}
                    placeholder="Ex: DP-04 / Box-02 / Port-08"
                    className={inputClasses}
                  />
                </div>
              </motion.div>
            </motion.div>
          </motion.div>

          <div className="flex flex-col gap-6 xl:w-[40%] flex-shrink-0 xl:border-l xl:border-slate-100 dark:xl:border-slate-800/50 xl:pl-8">
            {/* Section 2: Service Classification */}
            <motion.div layout className="space-y-5">
              <motion.div layout className="flex items-center gap-3 mb-2">
                <div className="h-px flex-1 bg-slate-100 dark:bg-slate-800 xl:hidden" />
                <span className="text-[10px] font-black text-slate-300 dark:text-slate-600 uppercase tracking-[.3em]">Operational Metrics</span>
                <div className="h-px flex-1 bg-slate-100 dark:bg-slate-800" />
              </motion.div>

              <motion.div layout className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <motion.div layout className="space-y-1">
                  <label className={labelClasses}>Category</label>
                  <div className="relative">
                    <Network className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" size={18} />
                    <select
                      value={category}
                      onChange={(e) => setCategory(e.target.value as ComplaintCategory)}
                      className={cn(inputClasses, "appearance-none bg-no-repeat")}
                      style={{ 
                        backgroundPosition: 'right 1rem center', 
                        backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' fill=\'none\' viewBox=\'0 0 24 24\' stroke=\'%2364748b\'%3E%3Cpath stroke-linecap=\'round\' stroke-linejoin=\'round\' stroke-width=\'2\' d=\'M19 9l-7 7-7-7\'/%3E%3C/svg%3E")', 
                        backgroundSize: '1rem' 
                      }}
                    >
                      {appConfig.categories.map(cat => (
                        <option key={cat} value={cat}>{cat.toUpperCase()}</option>
                      ))}
                    </select>
                  </div>
                </motion.div>

                <motion.div layout className="space-y-1">
                  <label className={labelClasses}>Priority</label>
                  <div className="relative">
                    <ShieldAlert className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" size={18} />
                    <select
                      value={priority}
                      onChange={(e) => setPriority(e.target.value as ComplaintPriority)}
                      className={cn(inputClasses, "appearance-none bg-no-repeat")}
                      style={{ 
                        backgroundPosition: 'right 1rem center', 
                        backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' fill=\'none\' viewBox=\'0 0 24 24\' stroke=\'%2364748b\'%3E%3Cpath stroke-linecap=\'round\' stroke-linejoin=\'round\' stroke-width=\'2\' d=\'M19 9l-7 7-7-7\'/%3E%3C/svg%3E")', 
                        backgroundSize: '1rem' 
                      }}
                    >
                      {appConfig.priorities.map(pri => (
                        <option key={pri} value={pri}>{pri}</option>
                      ))}
                    </select>
                  </div>
                </motion.div>

                <motion.div layout className="space-y-1 sm:col-span-2">
                  <label className={labelClasses}>Status</label>
                  <div className="relative">
                    <Zap className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" size={18} />
                    <select
                      value={status}
                      onChange={(e) => setStatus(e.target.value as ComplaintStatus)}
                      className={cn(inputClasses, "appearance-none bg-no-repeat")}
                      style={{ 
                        backgroundPosition: 'right 1rem center', 
                        backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' fill=\'none\' viewBox=\'0 0 24 24\' stroke=\'%2364748b\'%3E%3Cpath stroke-linecap=\'round\' stroke-linejoin=\'round\' stroke-width=\'2\' d=\'M19 9l-7 7-7-7\'/%3E%3C/svg%3E")', 
                        backgroundSize: '1rem' 
                      }}
                    >
                      {appConfig.statuses.map(stat => (
                        <option key={stat} value={stat}>{stat}</option>
                      ))}
                    </select>
                  </div>
                </motion.div>
              </motion.div>

              <motion.div layout className="space-y-1">
                <label className={labelClasses}>Technical Briefing</label>
                <div className="relative group/text">
                  <FileText className="absolute left-3.5 top-4 text-slate-400 dark:text-slate-500 group-focus-within/text:text-brand-accent transition-colors" size={18} />
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Comprehensive situation summary for technician guidance..."
                    rows={4}
                    className={cn(inputClasses, "resize-none h-32 xl:h-40 py-4")}
                    required
                  />
                </div>
              </motion.div>
            </motion.div>

            <motion.div layout className="mt-auto">
              <button
                type="submit"
                disabled={isLoading}
                className="group relative w-full overflow-hidden rounded-2xl bg-slate-950 dark:bg-brand-accent p-px font-bold transition-all hover:scale-[1.01] active:scale-[0.98] disabled:opacity-50 disabled:hover:scale-100"
              >
                <div className="relative flex items-center justify-center gap-3 rounded-[0.9375rem] bg-slate-950 dark:bg-brand-accent px-8 py-5 xl:py-4 text-white transition-all group-hover:bg-transparent dark:group-hover:bg-blue-700">
                  {isLoading ? (
                    <>
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/20 border-t-white" />
                      <span className="text-xs uppercase tracking-[.3em]">Processing Dispatch...</span>
                    </>
                  ) : (
                    <>
                      <span className="text-xs uppercase tracking-[.3em]">REG COMPLAIN</span>
                      <Send size={16} className="transition-transform group-hover:translate-x-1 group-hover:-translate-y-1" />
                    </>
                  )}
                </div>
              </button>
            </motion.div>
          </div>
        </form>
      </motion.div>
    </motion.div>

  );
}

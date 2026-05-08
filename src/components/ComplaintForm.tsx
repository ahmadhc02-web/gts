import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Send, User, MapPin, FileText, Phone, Info, Package, MapPinned, Layers } from 'lucide-react';
import { ComplaintStatus, ComplaintCategory, ComplaintPriority, Client, UserProfile } from '../types';
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
  currentUser: UserProfile;
}

export default function ComplaintForm({ onSubmit, isLoading, appConfig, currentUser }: ComplaintFormProps) {
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

  const inputClasses = "w-full px-4 py-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 text-slate-950 dark:text-slate-100 focus:outline-none focus:ring-4 focus:ring-brand-accent/10 focus:border-brand-accent/50 focus:bg-white dark:focus:bg-slate-900 transition-all duration-300 font-bold placeholder:text-slate-400 dark:placeholder:text-slate-600 shadow-sm text-center [text-align-last:center]";
  const labelClasses = "block text-[11px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] mb-2 text-center group-focus-within/field:text-brand-accent transition-colors duration-300";

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
            Service Request
          </h3>
          <div className="flex flex-col items-center gap-2">
            <p className="text-[9px] font-black text-brand-accent uppercase tracking-[0.3em]">
              Operational Terminal Portal
            </p>
            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/30 text-[8px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest mt-1">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Secure Network Link: Active
            </div>
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
                <label className={labelClasses}>Full Legal Name</label>
                <div className="relative">
                  <input
                    type="text"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="ENTER FULL NAME"
                    className={inputClasses}
                    required
                  />
                </div>
              </motion.div>

              <motion.div layout className="space-y-1 group/field">
                <label className={labelClasses}>System Username</label>
                <div className="relative" ref={clientListRef}>
                  <input
                    type="text"
                    value={customerUsername}
                    onChange={(e) => {
                      setCustomerUsername(e.target.value);
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
                          className="w-full px-6 py-4 flex flex-col items-center hover:bg-brand-accent text-center group/item transition-all"
                        >
                          <span className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-tight group-hover/item:text-white">{client.name}</span>
                          <div className="flex items-center gap-3 mt-1 justify-center">
                            <span className="text-[10px] font-bold text-brand-accent group-hover/item:text-white/80 uppercase">@{client.username}</span>
                            <span className="text-[9px] font-medium text-slate-400 group-hover/item:text-white/60 uppercase tracking-widest border-l border-slate-200 dark:border-slate-800 group-hover/item:border-white/20 pl-3">{client.area}</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </motion.div>
              
              <motion.div layout className="space-y-1 group/field">
                <label className={labelClasses}>Contact Number</label>
                <div className="relative">
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

              <motion.div layout className="space-y-1 group/field">
                <label className={labelClasses}>Deployment Zone</label>
                <div className="relative">
                  <select
                    value={area}
                    onChange={(e) => setArea(e.target.value)}
                    className={cn(inputClasses, "appearance-none cursor-pointer")}
                    required
                  >
                    {appConfig.zones?.map(zone => (
                      <option key={zone} value={zone}>{zone.toUpperCase()}</option>
                    ))}
                  </select>
                </div>
              </motion.div>

              <motion.div layout className="space-y-1 group/field sm:col-span-2">
                <label className={labelClasses}>Distribution Node / Panel</label>
                <div className="relative">
                  <input
                    type="text"
                    value={panelDetails}
                    onChange={(e) => setPanelDetails(e.target.value)}
                    placeholder="BOX / PORT DETAILS"
                    className={inputClasses}
                  />
                </div>
              </motion.div>
              
              <motion.div layout className="space-y-1 group/field">
                <label className={labelClasses}>Package Protocol</label>
                <div className="relative">
                  <input
                    type="text"
                    value={pkgDetails}
                    onChange={(e) => setPkgDetails(e.target.value)}
                    placeholder="EX: 50MB FIBER"
                    className={inputClasses}
                  />
                </div>
              </motion.div>

              <motion.div layout className="space-y-1 group/field">
                <label className={labelClasses}>Locality Landmark</label>
                <div className="relative">
                  <input
                    type="text"
                    value={userNearby}
                    onChange={(e) => setUserNearby(e.target.value)}
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
                <label className={labelClasses}>Category</label>
                <div className="relative">
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as ComplaintCategory)}
                    className={cn(inputClasses, "appearance-none cursor-pointer")}
                  >
                    {appConfig.categories.map(cat => (
                      <option key={cat} value={cat}>{cat.toUpperCase()}</option>
                    ))}
                  </select>
                </div>
              </motion.div>

              <motion.div layout className="space-y-1 group/field">
                <label className={labelClasses}>Security Priority</label>
                <div className="relative">
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value as ComplaintPriority)}
                    className={cn(inputClasses, "appearance-none cursor-pointer")}
                  >
                    {appConfig.priorities.map(pri => (
                      <option key={pri} value={pri}>{pri.toUpperCase()}</option>
                    ))}
                  </select>
                </div>
              </motion.div>

              <motion.div layout className="space-y-1 sm:col-span-2 group/field">
                <label className={labelClasses}>Current Status</label>
                <div className="relative">
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as ComplaintStatus)}
                    className={cn(inputClasses, "appearance-none cursor-pointer")}
                  >
                    {appConfig.statuses.map(stat => (
                      <option key={stat} value={stat}>{stat.toUpperCase()}</option>
                    ))}
                  </select>
                </div>
              </motion.div>
            </motion.div>

            <motion.div layout className="space-y-1 group/field">
              <label className={labelClasses}>Mission Objectives / Details</label>
              <div className="relative">
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
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
                disabled={isLoading}
                className="group relative w-full overflow-hidden rounded-[1.5rem] bg-slate-950 dark:bg-brand-accent p-px font-bold transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:hover:scale-100 shadow-lg"
              >
                <div className="relative flex items-center justify-center gap-3 rounded-[1.4375rem] bg-slate-950 dark:bg-brand-accent px-6 py-4.5 text-white transition-all group-hover:bg-transparent dark:group-hover:bg-blue-700">
                  {isLoading ? (
                    <>
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/20 border-t-white" />
                      <span className="text-[10px] uppercase tracking-[0.4em]">Syncing...</span>
                    </>
                  ) : (
                    <>
                      <span className="text-[10px] uppercase tracking-[0.4em] font-black">Register Operations Log</span>
                      <Send size={15} className="transition-transform group-hover:translate-x-1 group-hover:-translate-y-1" />
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

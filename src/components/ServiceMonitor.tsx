import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Activity, RefreshCw, Plus, Trash2, Wifi, TrendingUp } from 'lucide-react';
import { LineChart, Line, AreaChart, Area, ResponsiveContainer, YAxis, Tooltip } from 'recharts';
import { cn } from '../lib/utils';
import { firebaseService } from '../lib/firebaseService';
import { auth } from '../lib/firebase';
import { MonitorTarget, UserProfile } from '../types';
import { toast } from 'sonner';

interface ServiceMonitorProps {
  isOpen: boolean;
  onClose: () => void;
  user: UserProfile | null;
}

interface PingResult {
  domain: string;
  ms: number | 'Error';
  status: 'excellent' | 'good' | 'fair' | 'poor' | 'loading';
  history: { time: string; ms: number }[];
}

interface Target {
  key: string;
  url: string;
  domain: string;
}

interface ISPInfo {
  isp: string;
  ip: string;
  city: string;
  country: string;
  org: string;
}

const DEFAULT_TARGETS: Target[] = [
  { key: 'google.com', url: 'www.google.com', domain: 'Google' },
  { key: 'youtube.com', url: 'www.youtube.com', domain: 'YouTube' },
  { key: 'facebook.com', url: 'www.facebook.com', domain: 'Facebook' },
  { key: 'whatsapp.com', url: 'www.whatsapp.com', domain: 'WhatsApp' },
];

const ServiceMonitor: React.FC<ServiceMonitorProps> = ({ isOpen, onClose, user }) => {
  const [targets, setTargets] = useState<Target[]>(DEFAULT_TARGETS);
  const [dbTargets, setDbTargets] = useState<MonitorTarget[]>([]);
  
  const [results, setResults] = useState<Record<string, PingResult>>({});
  const [isMeasuring, setIsMeasuring] = useState(false);
  const [newDomain, setNewDomain] = useState('');
  const [ispInfo, setIspInfo] = useState<ISPInfo | null>(null);

  const measurePing = useCallback(async (url: string) => {
    const start = performance.now();
    try {
      await fetch(`https://${url}/favicon.ico?t=${Date.now()}`, { 
        mode: 'no-cors', 
        cache: 'no-store' 
      });
      const end = performance.now();
      // fetch over HTTPS includes DNS, TCP, and TLS handshakes (3 to 4 RTTs)
      // Dividing by 3 to estimate a closer ICMP ping latency
      const duration = Math.max(1, Math.round((end - start) / 3));
      
      let status: PingResult['status'] = 'excellent';
      if (duration > 80) status = 'good';
      if (duration > 150) status = 'fair';
      if (duration > 300) status = 'poor';

      return { ms: duration, status };
    } catch (e) {
      return { ms: 'Error' as const, status: 'poor' as const };
    }
  }, []);

  const runDiagnostics = useCallback(async () => {
    if (targets.length === 0) return;
    setIsMeasuring(true);
    
    // Fetch ISP Info if missing
    if (!ispInfo) {
      try {
        const res = await fetch('https://ipapi.co/json/');
        const data = await res.json();
        setIspInfo({
          isp: data.org || 'Local Network',
          ip: data.ip || 'Connected',
          city: data.city || 'Detected',
          country: data.country_name || 'Region',
          org: data.org || ''
        });
      } catch (e) {}
    }

    for (const target of targets) {
      setResults(prev => ({
        ...prev,
        [target.key]: { 
          domain: target.domain, 
          ms: prev[target.key]?.ms || 0, 
          status: 'loading',
          history: prev[target.key]?.history || []
        }
      }));
      
      const samples: number[] = [];
      for(let i = 0; i < 3; i++) {
        const res = await measurePing(target.url);
        if (typeof res.ms === 'number') samples.push(res.ms);
        if (i < 2) await new Promise(r => setTimeout(r, 20));
      }
      
      const bestMs = samples.length > 0 ? Math.min(...samples) : 'Err';
      const status = typeof bestMs === 'number' ? (bestMs < 80 ? 'excellent' : bestMs < 150 ? 'good' : bestMs < 300 ? 'fair' : 'poor') : 'poor';
      
      setResults(prev => {
        const currentHistory = prev[target.key]?.history || [];
        const newEntry = typeof bestMs === 'number' ? { 
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }), 
          ms: bestMs 
        } : null;
        
        const updatedHistory = newEntry ? [...currentHistory, newEntry].slice(-15) : currentHistory;

        return {
          ...prev,
          [target.key]: { domain: target.domain, ms: bestMs as any, status: status as any, history: updatedHistory }
        };
      });
    }
    setIsMeasuring(false);
  }, [measurePing, targets]);

  const addNewTarget = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDomain) return;
    
    let domain = newDomain.trim();
    if (!domain.includes('.')) return;
    
    // Basic normalization
    domain = domain.replace(/^https?:\/\//, '').replace(/\/$/, '');
    
    const key = domain.toLowerCase();
    if (targets.some(t => t.key === key)) {
      toast.error('Identity Protocol Error', { description: 'This target is already in the matrix.' });
      return;
    }

    // Extract clean name (remove www. and take part before first dot)
    const cleanName = domain.replace(/^www\./i, '').split('.')[0];
    const domainLabel = cleanName.charAt(0).toUpperCase() + cleanName.slice(1);

    try {
      if (!user) {
        toast.error('Security Protocol Error', { description: 'Authentication required for persistent monitoring.' });
        return;
      }
      
      await firebaseService.createMonitorTarget(domain, user);
      toast.success('Matrix Link Established', { description: `${domain} added to permanent monitor.` });
      setNewDomain('');
    } catch (error) {
      console.error("Monitor Write Failure:", error);
      toast.error('Infrastructure Link Failure');
    }
  };

  const removeTarget = async (key: string) => {
    if (DEFAULT_TARGETS.some(t => t.key === key)) return;
    
    const targetItem = dbTargets.find(t => t.domain.toLowerCase() === key || t.domain === key);
    if (targetItem) {
      try {
        await firebaseService.deleteMonitorTarget(targetItem.id);
        toast.success('Link Terminated', { description: 'Target removed from matrix.' });
      } catch (error) {
        toast.error('Termination Failure');
      }
    } else {
      // Fallback for local-only if somehow out of sync
      setTargets(prev => prev.filter(t => t.key !== key));
    }
  };

  useEffect(() => {
    if (!isOpen || !user) {
      if (!user) {
        // Even if no user, ensure default targets are shown
        setTargets(DEFAULT_TARGETS);
      }
      return;
    }

    const tenantId = firebaseService.getReadTenantId(user);

    const unsubscribe = firebaseService.subscribeMonitorTargets((data) => {
      setDbTargets(data);
      
      // Clean and normalize default keys for comparison
      const defaultKeys = DEFAULT_TARGETS.map(dt => dt.key.toLowerCase().replace(/^www\./i, ''));
      
      // Deduplicate DB targets by normalized domain
      const uniqueDbData = data.reduce((acc, current) => {
        const domain = current.domain.toLowerCase().replace(/^www\./i, '').replace(/\/$/, '');
        if (!acc.some(item => item.domain.toLowerCase().replace(/^www\./i, '').replace(/\/$/, '') === domain)) {
          acc.push(current);
        }
        return acc;
      }, [] as MonitorTarget[]);

      const dynamicTargets: Target[] = uniqueDbData
        .filter(t => {
          const normalizedDomain = t.domain.toLowerCase().replace(/^www\./i, '').replace(/\/$/, '');
          return !defaultKeys.includes(normalizedDomain);
        })
        .map(t => {
          const domain = t.domain;
          const cleanName = domain.replace(/^https?:\/\//, '').replace(/^www\./i, '').split('.')[0];
          const domainLabel = cleanName.charAt(0).toUpperCase() + cleanName.slice(1);
          return {
            key: domain.toLowerCase(),
            url: domain,
            domain: domainLabel
          };
        });

      // Ensure NO duplicate keys across the whole merged set
      const merged = [...DEFAULT_TARGETS];
      dynamicTargets.forEach(dt => {
        if (!merged.some(m => m.key === dt.key)) {
          merged.push(dt);
        }
      });

      setTargets(merged);
    }, tenantId);

    return () => unsubscribe();
  }, [isOpen, user]);

  useEffect(() => {
    if (isOpen) {
      runDiagnostics();
      document.body.style.overflow = 'hidden';
      const interval = setInterval(runDiagnostics, 5000); // 5 seconds is safer for non-stop diagnostics
      return () => {
        clearInterval(interval);
        document.body.style.overflow = 'unset';
      };
    } else {
      document.body.style.overflow = 'unset';
    }
  }, [isOpen, runDiagnostics]);

  const getStatusColor = (status: PingResult['status']) => {
    switch (status) {
      case 'excellent': return 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20';
      case 'good': return 'text-blue-500 bg-blue-500/10 border-blue-500/20';
      case 'fair': return 'text-amber-500 bg-amber-500/10 border-amber-500/20';
      case 'poor': return 'text-rose-500 bg-rose-500/10 border-rose-500/20';
      default: return 'text-slate-400 bg-slate-400/10 border-slate-400/20';
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-slate-950/60 backdrop-blur-md"
          />
          
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="relative w-full sm:max-w-md h-[85vh] sm:h-auto sm:max-h-[85vh] flex flex-col bg-white dark:bg-slate-900 rounded-t-[2.5rem] sm:rounded-[2.5rem] border-x border-t sm:border-b border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden mt-auto sm:mt-0"
          >
            <div className="p-4 sm:p-6 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 shrink-0">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-brand-accent/10 flex items-center justify-center text-brand-accent shadow-inner shrink-0 leading-none">
                    <Activity size={20} className={cn(isMeasuring && "animate-pulse")} />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-black text-slate-900 dark:text-white uppercase tracking-wider text-xs sm:text-sm truncate">Service Monitor</h3>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-tighter truncate">Real-time Diagnostics</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                   <div className="hidden xs:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-800 shadow-sm">
                      <div className="relative">
                        <motion.div 
                          animate={{ scale: [1, 2.5], opacity: [0.6, 0] }}
                          transition={{ duration: 1.5, repeat: Infinity, ease: "easeOut" }}
                          className="absolute inset-0 rounded-full bg-emerald-400" 
                        />
                        <div className="relative w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
                      </div>
                      <span className="text-[9px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest whitespace-nowrap">Active Link</span>
                  </div>
                  <button 
                    onClick={onClose}
                    className="w-10 h-10 rounded-2xl flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-800 transition-all active:scale-95 text-slate-400 hover:text-slate-900 dark:hover:text-white shrink-0"
                  >
                    <X size={20} />
                  </button>
                </div>
              </div>

              <div className="flex flex-col gap-3">
                <form onSubmit={addNewTarget} className="flex gap-2">
                  <div className="relative flex-1">
                    <input
                      type="text"
                      value={newDomain}
                      onChange={(e) => setNewDomain(e.target.value)}
                      placeholder="Add Website (ex: google.com)..."
                      className="w-full h-11 px-5 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-800 text-[11px] font-bold focus:ring-4 ring-brand-accent/10 focus:border-brand-accent transition-all outline-none shadow-sm placeholder:text-slate-400 dark:placeholder:text-slate-600"
                    />
                  </div>
                  <button
                    type="submit"
                    className="w-11 h-11 rounded-2xl bg-brand-accent text-white flex items-center justify-center hover:shadow-[0_8px_25px_-6px_rgba(var(--brand-accent-rgb),0.5)] transition-all active:scale-95 group shrink-0"
                  >
                    <Plus size={18} className="group-hover:rotate-90 transition-transform duration-300" />
                  </button>
                </form>
              </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 min-h-0 flex flex-col relative bg-white dark:bg-slate-900">
              <div className="absolute inset-0 opacity-[0.03] dark:opacity-[0.05] pointer-events-none" 
                style={{ backgroundImage: 'radial-gradient(circle, currentColor 1px, transparent 1px)', backgroundSize: '24px 24px' }} 
              />
              
              <div className="flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar-thick scroll-smooth p-4 space-y-4 overscroll-contain touch-pan-y">
                <AnimatePresence mode="popLayout">
                  {targets.map((target) => {
                  const data = results[target.key] || { domain: target.domain, ms: 0, status: 'loading', history: [] };
                  return (
                    <motion.div 
                      layout
                      initial={{ opacity: 0, scale: 0.95, y: 10 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      key={target.key}
                      className={cn(
                        "flex flex-col p-4 rounded-[1.75rem] border transition-all duration-300 group relative",
                        data.status === 'excellent' ? "border-emerald-500/20 bg-emerald-500/[0.01] sm:hover:border-emerald-500/40" :
                        data.status === 'good' ? "border-blue-500/20 bg-blue-500/[0.01] sm:hover:border-blue-500/40" :
                        data.status === 'fair' ? "border-amber-500/20 bg-amber-500/[0.01] sm:hover:border-amber-500/40" :
                        "border-rose-500/20 bg-rose-500/[0.01] sm:hover:border-rose-500/40"
                      )}
                    >
                      <div className="flex items-center justify-between gap-3 mb-4">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-10 h-10 rounded-xl bg-white dark:bg-slate-800 flex items-center justify-center p-2 shadow-sm border border-slate-100 dark:border-slate-700 shrink-0">
                            <img 
                              src={`https://www.google.com/s2/favicons?domain=${target.key}&sz=64`} 
                              alt={data.domain}
                              className="w-full h-full object-contain"
                              onError={(e) => {
                                (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${target.domain}&background=f1f5f9&color=64748b&bold=true`;
                              }}
                            />
                          </div>
                          <div className="min-w-0">
                             <div className="flex items-center gap-1.5">
                              <h4 className="font-black text-slate-900 dark:text-white text-sm tracking-tight truncate">{data.domain}</h4>
                              {(!DEFAULT_TARGETS.some(t => t.key === target.key)) && (
                                <button 
                                  onClick={() => removeTarget(target.key)}
                                  className="p-1 text-slate-400 hover:text-rose-500 transition-all opacity-40 hover:opacity-100"
                                >
                                  <Trash2 size={12} />
                                </button>
                              )}
                            </div>
                            <p className="text-[9px] text-slate-400 uppercase font-black tracking-widest truncate leading-none">{target.key}</p>
                          </div>
                        </div>

                        <div className="shrink-0">
                           <div className={cn(
                              "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-tight border flex items-center gap-1.5 shadow-sm min-w-[60px] justify-center",
                              getStatusColor(data.status)
                           )}>
                             {data.status === 'loading' && (typeof data.ms === 'number' && data.ms === 0) ? (
                               <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}>
                                 <RefreshCw size={10} />
                               </motion.div>
                             ) : (
                               <>
                                 <TrendingUp size={10} className="opacity-70" />
                                 <span className="tabular-nums">{data.ms}{typeof data.ms === 'number' ? 'ms' : ''}</span>
                               </>
                             )}
                           </div>
                        </div>
                      </div>

                      <div className="h-12 w-full mt-1">
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={data.history}>
                            <defs>
                              <linearGradient id={`grad-${target.key}`} x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor={data.status === 'excellent' ? '#10b981' : data.status === 'good' ? '#3b82f6' : '#f59e0b'} stopOpacity={0.2}/>
                                <stop offset="95%" stopColor={data.status === 'excellent' ? '#10b981' : data.status === 'good' ? '#3b82f6' : '#f59e0b'} stopOpacity={0}/>
                              </linearGradient>
                            </defs>
                            <Area 
                              type="monotone" 
                              dataKey="ms" 
                              stroke={data.status === 'excellent' ? '#10b981' : data.status === 'good' ? '#3b82f6' : '#f59e0b'} 
                              strokeWidth={2} 
                              fillOpacity={1}
                              fill={`url(#grad-${target.key})`}
                              isAnimationActive={false}
                            />
                            <YAxis hide domain={['dataMin - 10', 'dataMax + 10']} />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                    </motion.div>
                  );
                })}
                </AnimatePresence>
              </div>

              {/* Footer Section with ISP Info */}
              <div className="p-4 sm:p-6 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 shrink-0 mb-safe">
                {ispInfo && (
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-2xl bg-white dark:bg-slate-800 flex items-center justify-center text-brand-accent shadow-sm border border-slate-100 dark:border-slate-800 shrink-0">
                        <Wifi size={18} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[11px] font-black uppercase tracking-tight text-slate-900 dark:text-white truncate">
                          {ispInfo.isp}
                        </p>
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest truncate leading-none mt-1">{ispInfo.ip}</p>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1 opacity-60">Region</p>
                      <p className="text-[11px] font-black text-slate-900 dark:text-white uppercase tracking-tight">{ispInfo.city}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default ServiceMonitor;

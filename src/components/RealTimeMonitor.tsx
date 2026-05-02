import React, { useEffect, useRef, useState, useMemo } from 'react';
import { TrendingUp, BarChart3, Users, Flame, Calendar, Clock, X, Hash, MapPin, Tag, Info, User, Wifi, WifiOff } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Complaint } from '../types';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer 
} from 'recharts';

interface RealTimeMonitorProps {
  complaints?: Complaint[];
}

export default function RealTimeMonitor({ complaints = [] }: RealTimeMonitorProps) {
  const [reportType, setReportType] = useState<'monthly' | 'daily'>('monthly');
  const [highFreqRange, setHighFreqRange] = useState<'10days' | '30days' | 'all'>('all');
  const [expandedUser, setExpandedUser] = useState<string | null>(null);
  const [selectedComplaint, setSelectedComplaint] = useState<Complaint | null>(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);
  
  // Process data for Chart
  const { chartData, topUsers, highFreqTotal } = useMemo(() => {
    if (!complaints || complaints.length === 0) return { chartData: [], topUsers: [], highFreqTotal: 0 };
    
    // 1. Chart Data
    let data: { name: string; total: number }[] = [];
    const now = new Date();

    if (reportType === 'monthly') {
      const months: Record<string, number> = {};
      const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      
      for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const key = `${monthNames[d.getMonth()]} ${d.getFullYear().toString().slice(-2)}`;
        months[key] = 0;
      }

      complaints.forEach(c => {
        const date = new Date(c.createdAt);
        const key = `${monthNames[date.getMonth()]} ${date.getFullYear().toString().slice(-2)}`;
        if (months[key] !== undefined) months[key]++;
      });
      data = Object.entries(months).map(([name, total]) => ({ name, total }));
    } else {
      // Daily (Last 14 days)
      const days: Record<string, number> = {};
      for (let i = 13; i >= 0; i--) {
        const d = new Date();
        d.setDate(now.getDate() - i);
        const key = `${d.getDate()}/${d.getMonth() + 1}`;
        days[key] = 0;
      }

      complaints.forEach(c => {
        const date = new Date(c.createdAt);
        const key = `${date.getDate()}/${date.getMonth() + 1}`;
        if (days[key] !== undefined) days[key]++;
      });
      data = Object.entries(days).map(([name, total]) => ({ name, total }));
    }

    // 2. Top 10 Users with filtering based on highFreqRange
    const rangeLimit = highFreqRange === '10days' ? 10 * 24 * 60 * 60 * 1000 : 
                       highFreqRange === '30days' ? 30 * 24 * 60 * 60 * 1000 : 
                       Infinity;

    const filteredComplaints = highFreqRange === 'all' 
      ? complaints 
      : complaints.filter(c => {
          const timestamp = Number(c.createdAt);
          if (isNaN(timestamp)) return false;
          return Date.now() - timestamp <= rangeLimit;
        });

    const userCounts: Record<string, { count: number; area: string }> = {};
    filteredComplaints.forEach(c => {
      const name = c.customerName || 'Unknown User';
      if (!userCounts[name]) {
        userCounts[name] = { count: 0, area: c.area };
      }
      userCounts[name].count++;
    });

    const sortedUsers = Object.entries(userCounts)
      .map(([name, stats]) => ({ name, ...stats }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return { chartData: data, topUsers: sortedUsers, highFreqTotal: filteredComplaints.length };
  }, [complaints, reportType, highFreqRange]);

  const totalComplaints = complaints.length;
  const resolvedCount = complaints.filter(c => c.status === 'resolved' || c.status === 'closed').length;
  const resolutionRate = totalComplaints > 0 ? Math.round((resolvedCount / totalComplaints) * 100) : 0;

  useEffect(() => {
    return () => {
    };
  }, []);

  return (
    <div className="space-y-6 text-slate-900 dark:text-slate-100">
      {/* Report & Stats Section */}
      <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-md rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-brand-accent/10 flex items-center justify-center text-brand-accent">
              <BarChart3 size={20} />
            </div>
            <div>
              <h3 className="text-sm font-black uppercase tracking-widest text-slate-900 dark:text-white">
                {reportType === 'monthly' ? 'Monthly' : 'Daily'} Ops Report
              </h3>
              <p className="text-[10px] font-bold text-brand-accent uppercase tracking-tighter opacity-70">Volume & Trend Analysis</p>
            </div>
          </div>

          <div className="flex items-center gap-2 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
            <button
              onClick={() => setReportType('daily')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[10px] font-black uppercase tracking-widest transition-all ${
                reportType === 'daily' 
                  ? 'bg-white dark:bg-slate-700 text-blue-600 shadow-sm' 
                  : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              <Clock size={12} />
              Daily
            </button>
            <button
              onClick={() => setReportType('monthly')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[10px] font-black uppercase tracking-widest transition-all ${
                reportType === 'monthly' 
                  ? 'bg-white dark:bg-slate-700 text-blue-600 shadow-sm' 
                  : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              <Calendar size={12} />
              Monthly
            </button>
          </div>
          
          <div className="flex gap-4">
             <div className="hidden md:block text-right pr-4 border-r border-slate-100 dark:border-slate-800">
                <p className="text-[8px] font-black uppercase tracking-widest text-slate-400">Network</p>
                <div className="flex items-center gap-1.5 justify-end">
                  <div className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
                  <span className={`text-[10px] font-black uppercase ${isOnline ? 'text-emerald-600' : 'text-amber-600'}`}>
                    {isOnline ? 'Sync Active' : 'Cached Mode'}
                  </span>
                </div>
             </div>
             <div className="text-right">
                <p className="text-[8px] font-black uppercase tracking-widest text-slate-400">Resolution</p>
                <p className="text-sm font-black text-slate-900 dark:text-white">{resolutionRate}%</p>
             </div>
             <div className="text-right">
                <p className="text-[8px] font-black uppercase tracking-widest text-slate-400">Total Volume</p>
                <p className="text-sm font-black text-slate-900 dark:text-white">{totalComplaints}</p>
             </div>
          </div>
        </div>

        <div className="h-[240px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
              <XAxis 
                dataKey="name" 
                axisLine={false} 
                tickLine={false} 
                tick={{ fontSize: 10, fontWeight: 700, fill: '#64748b' }}
                dy={10}
              />
              <YAxis 
                axisLine={false} 
                tickLine={false} 
                tick={{ fontSize: 10, fontWeight: 700, fill: '#64748b' }}
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: '#0f172a', 
                  border: 'none', 
                  borderRadius: '12px',
                  boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
                  fontSize: '12px',
                  fontWeight: 'bold',
                  color: '#fff'
                }}
                itemStyle={{ color: '#60a5fa' }}
                cursor={{ stroke: '#3b82f6', strokeWidth: 2 }}
              />
              <Area 
                type="monotone" 
                dataKey="total" 
                stroke="#3b82f6" 
                strokeWidth={3}
                fillOpacity={1} 
                fill="url(#colorTotal)" 
                animationDuration={1500}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="mt-8 flex items-center gap-2 px-3 py-2 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-100 dark:border-slate-800/50">
           <TrendingUp size={14} className="text-green-500" />
           <span className="text-[9px] font-black uppercase text-slate-500 tracking-widest">
             Operations Trend: {chartData.length > 1 ? (chartData[chartData.length - 1].total >= chartData[chartData.length - 2].total ? 'Rising' : 'Stabilizing') : 'Baseline Established'}
           </span>
        </div>
      </div>

      {/* Top High-Frequency Users */}
      <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-md rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-500">
              <Flame size={20} />
            </div>
            <div>
              <h3 className="text-sm font-black uppercase tracking-widest text-slate-900 dark:text-white">High-Frequency Nodes</h3>
              <p className="text-[10px] font-bold text-amber-500 uppercase tracking-tighter opacity-70">
                Top 10 Active Nodes ({highFreqRange === 'all' ? 'All Time' : highFreqRange.replace('days', ' Days')})
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
            {[
              { id: '10days', label: '10D' },
              { id: '30days', label: '30D' },
              { id: 'all', label: 'ALL' }
            ].map((range) => (
              <button
                key={range.id}
                onClick={() => setHighFreqRange(range.id as any)}
                className={`px-3 py-1.5 rounded-md text-[9px] font-black uppercase tracking-widest transition-all ${
                  highFreqRange === range.id 
                    ? 'bg-white dark:bg-slate-700 text-amber-600 shadow-sm' 
                    : 'text-slate-400 hover:text-slate-600'
                }`}
              >
                {range.label}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          {topUsers.length > 0 ? (
            topUsers.map((user, idx) => (
              <div key={user.name} className="space-y-2">
                <motion.button 
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  onClick={() => setExpandedUser(expandedUser === user.name ? null : user.name)}
                  className={`w-full flex items-center justify-between p-3 rounded-xl border transition-all ${
                    expandedUser === user.name 
                      ? 'bg-amber-500/5 border-amber-500/30' 
                      : 'bg-slate-50 dark:bg-slate-800/40 border-slate-100 dark:border-slate-800/50 hover:border-amber-500/30'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-6 h-6 rounded-md flex items-center justify-center text-[10px] font-black ${
                      idx < 3 ? 'bg-amber-500 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-500'
                    }`}>
                      #{idx + 1}
                    </div>
                    <div className="text-left">
                      <p className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-tight">{user.name}</p>
                      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{user.area}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex flex-col items-end">
                      <span className="text-xs font-black text-slate-900 dark:text-white">{user.count}</span>
                      <span className="text-[7px] font-black uppercase text-amber-500 tracking-widest">{highFreqTotal > 0 ? Math.round((user.count / highFreqTotal) * 100) : 0}% Share</span>
                    </div>
                    <span className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Entry</span>
                  </div>
                </motion.button>

                <AnimatePresence>
                  {expandedUser === user.name && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="pl-9 pr-3 pb-2 space-y-1.5 border-l-2 border-amber-500/20 ml-3">
                        {complaints
                          .filter(c => (c.customerName || 'Unknown User') === user.name)
                          .sort((a, b) => b.createdAt - a.createdAt)
                          .map((complaint) => (
                            <button 
                              key={complaint.id} 
                              onClick={() => setSelectedComplaint(complaint)}
                              className="w-full text-left p-2.5 bg-white dark:bg-slate-900 rounded-lg border border-slate-100 dark:border-slate-800 shadow-sm flex items-center justify-between gap-3 hover:border-amber-500/30 transition-all active:scale-[0.98]"
                            >
                               <div className="flex-1 min-w-0">
                                  <p className="text-[10px] font-bold text-slate-900 dark:text-white truncate uppercase">{complaint.category}</p>
                                  <p className="text-[8px] font-medium text-slate-400 uppercase">{new Date(complaint.createdAt).toLocaleDateString()} {new Date(complaint.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                               </div>
                               <div className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest ${
                                 complaint.status === 'resolved' ? 'bg-green-500/10 text-green-600' :
                                 complaint.status === 'pending' ? 'bg-amber-500/10 text-amber-600' :
                                 'bg-blue-500/10 text-blue-600'
                               }`}>
                                 {complaint.status}
                               </div>
                            </button>
                          ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ))
          ) : (
            <div className="p-12 text-center">
              <Users size={32} className="mx-auto text-slate-200 mb-3" />
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">No node data available for analysis</p>
            </div>
          )}
        </div>
      </div>

      {/* Full Details Modal */}
      <AnimatePresence>
        {selectedComplaint && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedComplaint(null)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden"
            >
              {/* Modal Header */}
              <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-500">
                    <Info size={20} />
                  </div>
                  <div>
                    <h3 className="text-sm font-black uppercase tracking-widest text-slate-900 dark:text-white">Node Report Details</h3>
                    <p className="text-[10px] font-bold text-amber-500 uppercase tracking-tighter opacity-70">Registry Entry: {selectedComplaint.id.toUpperCase()}</p>
                  </div>
                </div>
                <button 
                  onClick={() => setSelectedComplaint(null)}
                  className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-6 space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <p className="text-[8px] font-black uppercase tracking-widest text-slate-400">Customer Node</p>
                    <div className="flex items-center gap-2 text-slate-900 dark:text-white">
                      <User size={14} className="text-slate-400" />
                      <span className="text-xs font-black uppercase">{selectedComplaint.customerName}</span>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[8px] font-black uppercase tracking-widest text-slate-400">Deployment Area</p>
                    <div className="flex items-center gap-2 text-slate-900 dark:text-white">
                      <MapPin size={14} className="text-slate-400" />
                      <span className="text-xs font-black uppercase">{selectedComplaint.area}</span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <p className="text-[8px] font-black uppercase tracking-widest text-slate-400">Class Type</p>
                    <div className="flex items-center gap-2 text-slate-900 dark:text-white">
                      <Tag size={14} className="text-slate-400" />
                      <span className="text-xs font-black uppercase">{selectedComplaint.category}</span>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[8px] font-black uppercase tracking-widest text-slate-400">Current Status</p>
                    <div className={`w-fit px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest ${
                      selectedComplaint.status === 'resolved' ? 'bg-green-500/10 text-green-600' :
                      selectedComplaint.status === 'pending' ? 'bg-amber-500/10 text-amber-600' :
                      'bg-blue-500/10 text-blue-600'
                    }`}>
                      {selectedComplaint.status}
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-[8px] font-black uppercase tracking-widest text-slate-400">Data Logs / Details</p>
                  <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-800">
                    <p className="text-xs text-slate-600 dark:text-slate-300 font-medium leading-relaxed uppercase">
                      {selectedComplaint.pkgDetails || "No additional parameters broadcasted for this node registry entry."}
                    </p>
                    {selectedComplaint.panelDetails && (
                      <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-700">
                        <p className="text-[8px] font-black uppercase tracking-widest text-slate-400 mb-1">Hardware Interface</p>
                        <p className="text-xs text-slate-600 dark:text-slate-300 font-bold uppercase">{selectedComplaint.panelDetails}</p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-2 text-slate-400">
                    <Calendar size={12} />
                    <span className="text-[9px] font-black uppercase tracking-widest">
                      {new Date(selectedComplaint.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-400">
                    <Clock size={12} />
                    <span className="text-[9px] font-black uppercase tracking-widest">
                      {new Date(selectedComplaint.createdAt).toLocaleTimeString()}
                    </span>
                  </div>
                </div>
              </div>

              <div className="p-6 bg-slate-50 dark:bg-slate-800/50 flex justify-end">
                <button 
                  onClick={() => setSelectedComplaint(null)}
                  className="px-6 py-2 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-xl text-[10px] font-black uppercase tracking-widest hover:scale-105 transition-transform"
                >
                  Terminate View
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}


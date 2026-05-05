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
  const { chartData } = useMemo(() => {
    if (!complaints || complaints.length === 0) return { chartData: [] };
    
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

    return { chartData: data };
  }, [complaints, reportType]);

  const totalComplaints = complaints.length;
  const resolvedCount = complaints.filter(c => c.status === 'resolved' || c.status === 'closed').length;
  const resolutionRate = totalComplaints > 0 ? Math.round((resolvedCount / totalComplaints) * 100) : 0;

  useEffect(() => {
    return () => {
    };
  }, []);

  return (
    <div className="h-full flex flex-col text-slate-900 dark:text-slate-100">
      {/* Report & Stats Section */}
      <div className="flex-1 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm flex flex-col relative overflow-hidden">
         {/* Decorative background elements */}
        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-blue-500/5 blur-[80px] rounded-full pointer-events-none" />
        <div className="absolute bottom-0 left-0 -ml-16 -mb-16 w-64 h-64 bg-emerald-500/5 blur-[80px] rounded-full pointer-events-none" />
        
        <div className="flex flex-col xl:flex-row xl:items-start justify-between gap-4 mb-2 relative z-10">
          <div className="flex items-center">
            <h3 className="text-sm font-black uppercase tracking-widest text-slate-900 dark:text-white">
              {reportType === 'monthly' ? 'Monthly' : 'Daily'} Ops Report
            </h3>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2 p-1 bg-slate-100/80 dark:bg-slate-800/80 rounded-xl">
              <button
                onClick={() => setReportType('daily')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${
                  reportType === 'daily' 
                    ? 'bg-white dark:bg-slate-700 text-blue-600 shadow-sm' 
                    : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300'
                }`}
              >
                <Clock size={14} />
                Daily
              </button>
              <button
                onClick={() => setReportType('monthly')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${
                  reportType === 'monthly' 
                    ? 'bg-white dark:bg-slate-700 text-blue-600 shadow-sm' 
                    : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300'
                }`}
              >
                <Calendar size={14} />
                Monthly
              </button>
            </div>
          </div>
        </div>

        <div className="flex-1 min-h-[260px] w-full mt-2 relative z-10 -ml-4">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4}/>
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="rgba(148, 163, 184, 0.15)" />
              <XAxis 
                dataKey="name" 
                axisLine={false} 
                tickLine={false} 
                tick={{ fontSize: 11, fontWeight: 800, fill: '#94a3b8' }}
                dy={15}
              />
              <YAxis 
                axisLine={false} 
                tickLine={false} 
                tick={{ fontSize: 11, fontWeight: 800, fill: '#94a3b8' }}
                dx={-10}
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'rgba(15, 23, 42, 0.95)', 
                  backdropFilter: 'blur(8px)',
                  border: '1px solid rgba(51, 65, 85, 0.5)', 
                  borderRadius: '16px',
                  boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
                  fontSize: '13px',
                  fontWeight: '900',
                  color: '#fff',
                  padding: '12px 16px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em'
                }}
                itemStyle={{ color: '#60a5fa', fontWeight: '900' }}
                cursor={{ stroke: '#3b82f6', strokeWidth: 2, strokeDasharray: '4 4' }}
              />
              <Area 
                type="monotone" 
                dataKey="total" 
                stroke="#3b82f6" 
                strokeWidth={4}
                fillOpacity={1} 
                fill="url(#colorTotal)" 
                animationDuration={1500}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="mt-6 flex items-center justify-between px-5 py-3 bg-slate-50/80 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-700/50 relative z-10">
           <div className="flex items-center gap-3">
             <div className="w-8 h-8 rounded-full bg-emerald-500/10 flex items-center justify-center">
               <TrendingUp size={16} className="text-emerald-500" />
             </div>
             <span className="text-[10px] font-black uppercase text-slate-600 dark:text-slate-300 tracking-widest">
               Operations Trend
             </span>
           </div>
           <span className={`text-[11px] font-black uppercase tracking-widest px-3 py-1 rounded-full ${
             chartData.length > 1 && chartData[chartData.length - 1].total > chartData[chartData.length - 2].total 
               ? 'bg-blue-500/10 text-blue-600' 
               : 'bg-emerald-500/10 text-emerald-600'
           }`}>
             {chartData.length > 1 ? (chartData[chartData.length - 1].total > chartData[chartData.length - 2].total ? '+ Rising Volume' : '≈ Stabilizing') : 'Baseline Established'}
           </span>
        </div>
      </div>
    </div>
  );
}


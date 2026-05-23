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
  const [reportType, setReportType] = useState<'monthly' | 'daily'>('daily');
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
      <div className="flex-1 bg-gradient-to-br from-slate-50/50 to-slate-100/30 dark:from-slate-800/30 dark:to-slate-800/10 rounded-2xl border border-slate-200/50 dark:border-slate-700/50 p-6 shadow-sm flex flex-col relative overflow-hidden transition-colors">
         {/* Decorative background elements */}
        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-blue-500/5 blur-[80px] rounded-full pointer-events-none" />
        <div className="absolute bottom-0 left-0 -ml-16 -mb-16 w-64 h-64 bg-emerald-500/5 blur-[80px] rounded-full pointer-events-none" />
        
        <div className="flex flex-col xl:flex-row xl:items-start justify-between gap-4 mb-2 relative z-10">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-6 bg-blue-600 rounded-full" />
            <h3 className="text-sm font-black uppercase tracking-tight text-slate-900 dark:text-white">
              Analysis <span className="text-slate-400 dark:text-slate-500 font-normal">/</span> <span className="text-blue-600">{reportType === 'monthly' ? 'Monthly' : 'Daily'}</span>
            </h3>
          </div>

          <div className="flex items-center">
            <div className="flex items-center p-1 bg-slate-200/50 dark:bg-slate-900/50 rounded-xl border border-slate-200 dark:border-slate-800 backdrop-blur-md">
              <button
                onClick={() => setReportType('daily')}
                className={`px-4 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-[0.2em] transition-all duration-300 ${
                  reportType === 'daily' 
                    ? 'bg-white dark:bg-blue-600 text-blue-600 dark:text-white shadow-lg shadow-blue-500/10' 
                    : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                }`}
              >
                Daily
              </button>
              <button
                onClick={() => setReportType('monthly')}
                className={`px-4 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-[0.2em] transition-all duration-300 ${
                  reportType === 'monthly' 
                    ? 'bg-white dark:bg-blue-600 text-blue-600 dark:text-white shadow-lg shadow-blue-500/10' 
                    : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                }`}
              >
                Monthly
              </button>
            </div>
          </div>
        </div>

        <div className="flex-1 w-full mt-4 h-full relative z-10 -ml-4 group">
          {/* Enhanced Chart Frame Decoration - Pointer Line */}
          <div className="absolute inset-x-8 bottom-0 h-[2px] bg-gradient-to-r from-transparent via-blue-500 to-transparent z-20 opacity-50" />
          <div className="absolute bottom-[-4px] left-1/2 -translate-x-1/2 w-32 h-[8px] bg-blue-600/30 rounded-full blur-md z-10 animate-pulse" />
          <div className="absolute bottom-[-1px] left-1/2 -translate-x-1/2 w-1 h-1 bg-blue-500 rounded-full z-30" />
          
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.25}/>
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="rgba(148, 163, 184, 0.1)" />
              <XAxis 
                dataKey="name" 
                axisLine={false} 
                tickLine={false} 
                tick={{ fontSize: 9, fontWeight: 800, fill: '#64748b' }}
                dy={12}
              />
              <YAxis 
                axisLine={false} 
                tickLine={false} 
                tick={{ fontSize: 9, fontWeight: 800, fill: '#64748b' }}
                dx={-8}
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'rgba(15, 23, 42, 0.95)', 
                  backdropFilter: 'blur(8px)',
                  border: '1px solid rgba(51, 65, 85, 0.4)', 
                  borderRadius: '12px',
                  boxShadow: '0 15px 30px -10px rgba(0, 0, 0, 0.3)',
                  fontSize: '11px',
                  fontWeight: '900',
                  color: '#fff',
                  padding: '10px 14px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em'
                }}
                itemStyle={{ color: '#60a5fa', fontWeight: '900', padding: 0 }}
                cursor={{ stroke: '#3b82f6', strokeWidth: 1.5, strokeDasharray: '4 4' }}
              />
              <Area 
                type="monotone" 
                dataKey="total" 
                stroke="#3b82f6" 
                strokeWidth={3}
                fillOpacity={1} 
                fill="url(#colorTotal)" 
                animationDuration={1200}
                activeDot={{ r: 5, strokeWidth: 0, fill: '#3b82f6', shadow: '0 0 10px rgba(59, 130, 246, 0.5)' }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}


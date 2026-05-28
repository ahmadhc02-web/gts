import React, { useEffect, useState, useMemo } from 'react';
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
  
  // Process data for Chart precisely
  const { chartData } = useMemo(() => {
    if (!complaints || complaints.length === 0) return { chartData: [] };
    
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

  return (
    <div className="h-full flex flex-col text-slate-900 dark:text-slate-100">
      {/* Container Card utilizing same deep shadow and white design */}
      <div className="flex-1 bg-white dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 flex flex-col relative overflow-hidden shadow-[0_12px_45px_-8px_rgba(30,41,59,0.04),0_4px_16px_-4px_rgba(30,41,59,0.02)] transition-colors">
         {/* Dual ambient blobs: left: mint green, right: bluish lavender precisely like image */}
         <div className="absolute bottom-4 left-4 w-44 h-44 bg-teal-400/8 blur-[48px] rounded-full pointer-events-none z-0" />
         <div className="absolute top-4 right-4 w-48 h-48 bg-indigo-400/8 blur-[48px] rounded-full pointer-events-none z-0" />
         
        <div className="flex items-center justify-between gap-4 mb-2 relative z-10 w-full">
          {/* Header Title with vertical accent line matching template precisely */}
          <div className="flex items-center gap-2.5">
            <div className="w-[3px] h-4 bg-blue-600 rounded-full shrink-0" />
            <h3 className="text-xs font-black uppercase tracking-widest text-slate-900 dark:text-white">
              ANALYSIS <span className="text-blue-600">/ {reportType}</span>
            </h3>
          </div>

          <div className="flex items-center">
            {/* Elegant Daily/Monthly switch pill styling matching mockup */}
            <div className="flex items-center p-1 bg-slate-100/80 dark:bg-slate-900/80 rounded-xl border border-slate-200/50 dark:border-slate-800/80 backdrop-blur-md">
              <button
                onClick={() => setReportType('daily')}
                className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-[0.15em] transition-all duration-300 ${
                  reportType === 'daily' 
                    ? 'bg-white dark:bg-blue-600 text-blue-600 dark:text-white shadow-sm' 
                    : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                }`}
              >
                Daily
              </button>
              <button
                onClick={() => setReportType('monthly')}
                className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-[0.15em] transition-all duration-300 ${
                  reportType === 'monthly' 
                    ? 'bg-white dark:bg-blue-600 text-blue-600 dark:text-white shadow-sm' 
                    : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                }`}
              >
                Monthly
              </button>
            </div>
          </div>
        </div>

        {/* Chart Frame */}
        <div className="flex-1 w-full mt-4 h-full relative z-10 -ml-4">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.25}/>
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(148, 163, 184, 0.15)" />
              <XAxis 
                dataKey="name" 
                axisLine={false} 
                tickLine={false} 
                tick={{ fontSize: 9, fontWeight: 900, fill: '#475569' }}
                dy={12}
              />
              <YAxis 
                axisLine={false} 
                tickLine={false} 
                tick={{ fontSize: 9, fontWeight: 900, fill: '#475569' }}
                dx={-8}
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'rgba(15, 23, 42, 0.98)', 
                  backdropFilter: 'blur(8px)',
                  border: '1px solid rgba(51, 65, 85, 0.6)', 
                  borderRadius: '12px',
                  boxShadow: '0 15px 30px -10px rgba(0, 0, 0, 0.35)',
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
                activeDot={{ r: 5, strokeWidth: 0, fill: '#3b82f6' }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

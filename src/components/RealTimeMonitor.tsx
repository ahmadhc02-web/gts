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
import { TrendingUp, Activity, CheckCircle, Clock } from 'lucide-react';

interface RealTimeMonitorProps {
  complaints?: Complaint[];
}

export default function RealTimeMonitor({ complaints = [] }: RealTimeMonitorProps) {
  const [reportType, setReportType] = useState<'weekly' | 'monthly' | 'yearly'>('weekly');
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

  // Compute live database statistics to directly match compliance details
  const metrics = useMemo(() => {
    const total = complaints.length;
    let pending = 0;
    let resolved = 0;
    let todayCount = 0;
    
    const todayStr = new Date().toDateString();
    
    complaints.forEach(c => {
      const status = c.status?.toUpperCase() || '';
      const isResolved = status === 'RESOLVED' || status === 'CLOSED' || status === 'COMPLETE' || status === 'COMPLETED';
      if (isResolved) {
        resolved++;
      } else {
        pending++;
      }
      
      if (c.createdAt) {
        const d = new Date(c.createdAt);
        if (d.toDateString() === todayStr) {
          todayCount++;
        }
      }
    });
    
    const resolutionRate = total > 0 ? Math.round((resolved / total) * 100) : 100;
    
    return {
      total,
      pending,
      resolved,
      todayCount,
      resolutionRate
    };
  }, [complaints]);

  // Process data for Chart precisely, matching dates and details dynamically
  const chartData = useMemo(() => {
    const now = new Date();
    
    if (reportType === 'weekly') {
      const data = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(now.getDate() - i);
        
        const dayName = d.toLocaleDateString('en-US', { weekday: 'short' });
        const dayOfMonth = String(d.getDate()).padStart(2, '0');
        const monthStr = String(d.getMonth() + 1).padStart(2, '0');
        const label = `${dayName} ${dayOfMonth}/${monthStr}`;
        
        const startOfDay = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0).getTime();
        const endOfDay = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999).getTime();
        
        const totalCount = complaints.filter(c => {
          if (!c.createdAt) return false;
          return c.createdAt >= startOfDay && c.createdAt <= endOfDay;
        }).length;

        const resolvedCount = complaints.filter(c => {
          const timestamp = c.updatedAt || c.createdAt;
          if (!timestamp) return false;
          const status = c.status?.toUpperCase() || '';
          const isResolved = status === 'RESOLVED' || status === 'CLOSED' || status === 'COMPLETE' || status === 'COMPLETED';
          return isResolved && timestamp >= startOfDay && timestamp <= endOfDay;
        }).length;

        data.push({
          name: label,
          total: totalCount,
          resolved: resolvedCount
        });
      }
      return data;
    } else if (reportType === 'monthly') {
      const data = [];
      for (let i = 29; i >= 0; i--) {
        const d = new Date();
        d.setDate(now.getDate() - i);
        
        const dayOfMonth = String(d.getDate()).padStart(2, '0');
        const monthStr = String(d.getMonth() + 1).padStart(2, '0');
        const label = `${dayOfMonth}/${monthStr}`;
        
        const startOfDay = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0).getTime();
        const endOfDay = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999).getTime();
        
        const totalCount = complaints.filter(c => {
          if (!c.createdAt) return false;
          return c.createdAt >= startOfDay && c.createdAt <= endOfDay;
        }).length;

        const resolvedCount = complaints.filter(c => {
          const timestamp = c.updatedAt || c.createdAt;
          if (!timestamp) return false;
          const status = c.status?.toUpperCase() || '';
          const isResolved = status === 'RESOLVED' || status === 'CLOSED' || status === 'COMPLETE' || status === 'COMPLETED';
          return isResolved && timestamp >= startOfDay && timestamp <= endOfDay;
        }).length;
        
        data.push({
          name: label,
          total: totalCount,
          resolved: resolvedCount
        });
      }
      return data;
    } else {
      const data = [];
      for (let i = 11; i >= 0; i--) {
        const d = new Date();
        d.setMonth(now.getMonth() - i);
        
        const monthName = d.toLocaleDateString('en-US', { month: 'short' }).toUpperCase();
        const yearStr = d.getFullYear().toString().slice(-2);
        const label = `${monthName} '${yearStr}`;
        
        const startOfM = new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0).getTime();
        const endOfM = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999).getTime();
        
        const totalCount = complaints.filter(c => {
          if (!c.createdAt) return false;
          return c.createdAt >= startOfM && c.createdAt <= endOfM;
        }).length;
        
        const resolvedCount = complaints.filter(c => {
          const timestamp = c.updatedAt || c.createdAt;
          if (!timestamp) return false;
          const status = c.status?.toUpperCase() || '';
          const isResolved = status === 'RESOLVED' || status === 'CLOSED' || status === 'COMPLETE' || status === 'COMPLETED';
          return isResolved && timestamp >= startOfM && timestamp <= endOfM;
        }).length;
        
        data.push({
          name: label,
          total: totalCount,
          resolved: resolvedCount
        });
      }
      return data;
    }
  }, [complaints, reportType]);

  // Custom dots rendering
  const renderCustomDot = (colorStr: string, activeColorStr: string) => (props: any) => {
    const { cx, cy, index, payload, dataKey } = props;
    if (payload[dataKey] === 0) return null;
    return (
      <g key={`dot-${dataKey}-${index}`}>
        <circle 
          cx={cx} 
          cy={cy} 
          r={6} 
          fill={activeColorStr} 
          className="animate-pulse"
        />
        <circle 
          cx={cx} 
          cy={cy} 
          r={3} 
          fill={colorStr} 
          stroke="#ffffff" 
          strokeWidth={1} 
        />
      </g>
    );
  };

  const renderCustomActiveDot = (colorStr: string, activeColorStr: string) => (props: any) => {
    const { cx, cy, dataKey } = props;
    return (
      <g>
        <circle 
          cx={cx} 
          cy={cy} 
          r={10} 
          fill={activeColorStr} 
        />
        <circle 
          cx={cx} 
          cy={cy} 
          r={5} 
          fill={colorStr} 
          stroke="#ffffff" 
          strokeWidth={1.5} 
        />
      </g>
    );
  };

  // Find peak day in current dataset for highlight
  const peakDay = useMemo(() => {
    if (chartData.length === 0) return null;
    let max = -1;
    let maxDay = '';
    chartData.forEach(d => {
      if (d.total > max) {
        max = d.total;
        maxDay = d.name;
      }
    });
    return max > 0 ? { name: maxDay, count: max } : null;
  }, [chartData]);

  return (
    <div className="h-full flex flex-col text-slate-900 dark:text-slate-100 font-lexend animate-fade-in relative z-10">
      {/* Container Card with clean-edge dashboard feel on soft light-grey textured background */}
      <div 
        className="flex-1 bg-white dark:bg-slate-950 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 p-5 flex flex-col relative overflow-hidden shadow-xl shadow-black/10 dark:shadow-black/50 hover:shadow-2xl hover:shadow-black/20 dark:hover:shadow-black/60 transition-all duration-300"
        style={{
          backgroundImage: 'radial-gradient(rgba(148, 163, 184, 0.08) 1.2px, transparent 1.2px)',
          backgroundSize: '24px 24px'
        }}
      >
        {/* Subtle ambient light gradient overlays */}
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-[#2563eb]/5 blur-[48px] rounded-full pointer-events-none z-0" />
        <div className="absolute top-0 right-0 w-48 h-48 bg-indigo-500/5 blur-[48px] rounded-full pointer-events-none z-0" />

        {/* Top Header: Controls & Action Details */}
        <div className="flex items-center justify-between gap-2 mb-4 relative z-10 w-full border-b border-slate-100 dark:border-slate-800/40 pb-3">
          <div className="flex items-center gap-1 shrink-0">
            <span className="text-[10px] font-black tracking-widest text-[#2563eb] bg-[#2563eb]/10 px-2.5 py-1 rounded-lg uppercase">
              MONITOR
            </span>
          </div>

          <div className="flex items-center shrink-0">
            <div className="flex items-center bg-slate-100/80 dark:bg-slate-900/80 p-0.5 rounded-lg border border-slate-200/60 dark:border-slate-800">
              {(['weekly', 'monthly', 'yearly'] as const).map((type) => (
                <button
                  key={type}
                  onClick={() => setReportType(type)}
                  className={`px-2.5 sm:px-3 py-1 text-[9px] font-black tracking-wider rounded-md uppercase transition-all duration-200 ${
                    reportType === type 
                      ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm' 
                      : 'text-slate-400 hover:text-slate-600 dark:text-slate-500 font-bold'
                  }`}
                >
                  {type === 'weekly' ? 'Week' : type === 'monthly' ? 'Month' : 'Year'}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Chart Frame */}
        <div className="flex-1 w-full h-full min-h-[220px] relative z-10 -ml-4 mt-1">
          <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={200}>
            <AreaChart data={chartData} margin={{ top: 20, right: 20, left: -20, bottom: 5 }}>
              <defs>
                <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#2563eb" stopOpacity={0.25}/>
                  <stop offset="95%" stopColor="#2563eb" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="chartGradientGreen" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.25}/>
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                </linearGradient>
                {/* Subtle drop shadow for line */}
                <filter id="softLineShadow" x="-10%" y="-10%" width="120%" height="130%">
                  <feDropShadow dx="0" dy="4" stdDeviation="4" floodColor="#2563eb" floodOpacity="0.12" />
                </filter>
                <filter id="softLineShadowGreen" x="-10%" y="-10%" width="120%" height="130%">
                  <feDropShadow dx="0" dy="4" stdDeviation="4" floodColor="#10b981" floodOpacity="0.12" />
                </filter>
              </defs>

              {/* Faint horizontal grid lines */}
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(148, 163, 184, 0.08)" />
              
              {/* Date labels on x-axis */}
              <XAxis 
                dataKey="name" 
                axisLine={false} 
                tickLine={false} 
                tick={{ fontSize: 8, fontWeight: 900, fill: '#64748b' }}
                dy={8}
                interval={reportType === 'monthly' ? 5 : 0}
              />

              {/* Hidden YAxis to support clean metrics-based scaling */}
              <YAxis 
                axisLine={false} 
                tickLine={false} 
                tick={{ fontSize: 8, fontWeight: 900, fill: '#64748b' }}
                dx={-8}
                allowDecimals={false}
              />

              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'rgba(255, 255, 255, 0.98)', 
                  backdropFilter: 'blur(8px)',
                  border: '1px solid rgba(226, 232, 240, 0.8)', 
                  borderRadius: '12px',
                  boxShadow: '0 8px 24px -6px rgba(0, 0, 0, 0.1)',
                  fontSize: '9px',
                  fontWeight: '900',
                  color: '#0f172a',
                  padding: '6px 10px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em'
                }}
                itemStyle={{ fontWeight: '900', padding: 0 }}
                cursor={{ stroke: 'rgba(59, 130, 246, 0.08)', strokeWidth: 1.5 }}
              />

              <Area
                type="monotone"
                dataKey="total"
                name="Total Complaints"
                stroke="#2563eb"
                strokeWidth={2.5}
                fillOpacity={1}
                fill="url(#chartGradient)"
                dot={renderCustomDot("#2563eb", "rgba(37, 99, 235, 0.15)")}
                activeDot={renderCustomActiveDot("#2563eb", "rgba(37, 99, 235, 0.3)")}
                filter="url(#softLineShadow)"
                animationDuration={1000}
              />

              <Area
                type="monotone"
                dataKey="resolved"
                name="Resolved (Complete)"
                stroke="#10b981"
                strokeWidth={2.5}
                fillOpacity={1}
                fill="url(#chartGradientGreen)"
                dot={renderCustomDot("#10b981", "rgba(16, 185, 129, 0.15)")}
                activeDot={renderCustomActiveDot("#10b981", "rgba(16, 185, 129, 0.3)")}
                filter="url(#softLineShadowGreen)"
                animationDuration={1000}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Small Peak Day status line to enrich interface with context-rich facts */}
        {peakDay && (
          <div className="absolute bottom-4 right-5 text-[8.5px] font-black uppercase tracking-widest text-[#2563eb] dark:text-[#38bdf8] z-10 flex items-center gap-1 select-none pointer-events-none bg-[#2563eb]/10 dark:bg-[#38bdf8]/10 px-2 py-0.5 rounded">
            <span className="w-1.5 h-1.5 rounded-full bg-[#2563eb] dark:bg-[#38bdf8] inline-block animate-pulse" />
            Peak: {peakDay.count} complains on {peakDay.name}
          </div>
        )}
      </div>
    </div>
  );
}

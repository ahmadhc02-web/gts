import { useTheme } from "../hooks/useTheme";
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

const RealTimeMonitor = React.memo(function RealTimeMonitor({ complaints = [] }: RealTimeMonitorProps) {
  const { theme } = useTheme();
  const isDark = theme === "dark";
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

  // Process data for Chart in a single O(N) bucket pass
  const chartData = useMemo(() => {
    const now = new Date();

    const isResolvedStatus = (s?: string) => {
      const upper = (s || '').toUpperCase();
      return upper === 'RESOLVED' || upper === 'CLOSED' || upper === 'COMPLETE' || upper === 'COMPLETED';
    };

    if (reportType === 'weekly' || reportType === 'monthly') {
      const days = reportType === 'weekly' ? 7 : 30;
      const buckets: { name: string; total: number; resolved: number }[] = [];
      const keyToIndex = new Map<string, number>();

      for (let i = days - 1; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
        const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
        const dayOfMonth = String(d.getDate()).padStart(2, '0');
        const monthStr = String(d.getMonth() + 1).padStart(2, '0');
        const label =
          reportType === 'weekly'
            ? d.toLocaleDateString('en-US', { weekday: 'short' })
            : `${dayOfMonth}/${monthStr}`;
        keyToIndex.set(key, buckets.length);
        buckets.push({ name: label, total: 0, resolved: 0 });
      }

      for (let i = 0; i < complaints.length; i++) {
        const c = complaints[i];
        if (c.createdAt) {
          const cd = new Date(c.createdAt);
          const idx = keyToIndex.get(`${cd.getFullYear()}-${cd.getMonth()}-${cd.getDate()}`);
          if (idx !== undefined) buckets[idx].total++;
        }
        const resTs = c.updatedAt || c.createdAt;
        if (resTs && isResolvedStatus(c.status)) {
          const rd = new Date(resTs);
          const idx = keyToIndex.get(`${rd.getFullYear()}-${rd.getMonth()}-${rd.getDate()}`);
          if (idx !== undefined) buckets[idx].resolved++;
        }
      }
      return buckets;
    } else {
      const buckets: { name: string; total: number; resolved: number }[] = [];
      const keyToIndex = new Map<string, number>();

      for (let i = 11; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const key = `${d.getFullYear()}-${d.getMonth()}`;
        const monthName = d.toLocaleDateString('en-US', { month: 'short' });
        keyToIndex.set(key, buckets.length);
        buckets.push({ name: monthName, total: 0, resolved: 0 });
      }

      for (let i = 0; i < complaints.length; i++) {
        const c = complaints[i];
        if (c.createdAt) {
          const cd = new Date(c.createdAt);
          const idx = keyToIndex.get(`${cd.getFullYear()}-${cd.getMonth()}`);
          if (idx !== undefined) buckets[idx].total++;
        }
        const resTs = c.updatedAt || c.createdAt;
        if (resTs && isResolvedStatus(c.status)) {
          const rd = new Date(resTs);
          const idx = keyToIndex.get(`${rd.getFullYear()}-${rd.getMonth()}`);
          if (idx !== undefined) buckets[idx].resolved++;
        }
      }
      return buckets;
    }
  }, [complaints, reportType]);

  // Custom dots rendering (no continuous pulse animation per SVG dot)
  const renderCustomDot = (colorStr: string, activeColorStr: string) => (props: any) => {
    const { cx, cy, index, payload, dataKey } = props;
    if (payload[dataKey] === 0) return null;
    return (
      <g key={`dot-${dataKey}-${index}`}>
        <circle 
          cx={cx} 
          cy={cy} 
          r={5.5} 
          fill={activeColorStr} 
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

  return (
    <div className="h-full flex flex-col text-slate-900 dark:text-slate-100 font-lexend relative z-10">
      {/* Top Corners Above Chart Frame: Label & Week / Month / Year selector with no frame background */}
      <div className="px-1 pb-2 flex items-center justify-between gap-2 shrink-0 relative z-10 w-full">
        <div className="flex items-center gap-1.5 shrink-0 bg-transparent">
          <Activity size={12} className="stroke-[2.5] text-blue-600 dark:text-blue-400" />
          <span className="text-[11px] font-black tracking-widest uppercase text-slate-900 dark:text-slate-100">
            ACTIVITY MONITOR
          </span>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2 bg-transparent shrink-0">
          {(['weekly', 'monthly', 'yearly'] as const).map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => setReportType(type)}
              className={`px-1.5 py-0.5 text-[10px] font-black tracking-wider uppercase transition-all duration-100 cursor-pointer bg-transparent border-b-2 ${
                reportType === type
                  ? 'text-blue-600 dark:text-blue-400 border-blue-600 dark:border-blue-400'
                  : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white border-transparent font-extrabold'
              }`}
            >
              {type === 'weekly' ? 'Week' : type === 'monthly' ? 'Month' : 'Year'}
            </button>
          ))}
        </div>
      </div>

      {/* Container Card with clean-edge dashboard feel on soft light-grey textured background */}
      <div 
        className="flex-1 min-h-0 neu-card !bg-[#f5f5f5] dark:!bg-[#2c3038] rounded-2xl border border-slate-200/50 dark:border-white/10 p-2.5 sm:p-3 flex flex-col relative overflow-hidden transition-all duration-150 !shadow-[0_6px_20px_rgba(15,23,42,0.11),6px_0_16px_-3px_rgba(15,23,42,0.11),-6px_0_16px_-3px_rgba(15,23,42,0.11)] hover:!shadow-[0_10px_26px_rgba(15,23,42,0.15),8px_0_20px_-3px_rgba(15,23,42,0.13),-8px_0_20px_-3px_rgba(15,23,42,0.13)] dark:!shadow-[0_8px_22px_rgba(0,0,0,0.48),6px_0_18px_-2px_rgba(0,0,0,0.42),-6px_0_18px_-2px_rgba(0,0,0,0.42)] dark:hover:!shadow-[0_12px_28px_rgba(0,0,0,0.58),8px_0_22px_-2px_rgba(0,0,0,0.5),-8px_0_22px_-2px_rgba(0,0,0,0.5)]"
      >
        {/* Subtle ambient light gradient overlays */}
        <div
          className="absolute bottom-0 left-0 w-48 h-48 rounded-full pointer-events-none z-0"
          style={{ background: 'radial-gradient(circle, rgba(37,99,235,0.08) 0%, transparent 70%)' }}
        />
        <div
          className="absolute top-0 right-0 w-48 h-48 rounded-full pointer-events-none z-0"
          style={{ background: 'radial-gradient(circle, rgba(99,102,241,0.08) 0%, transparent 70%)' }}
        />

        {/* Chart Frame */}
        <div style={{ width: '100%', height: '100%' }} className="flex-1 w-full h-full min-h-[220px] min-w-0 relative z-10 flex items-center justify-center">
          <ResponsiveContainer width="100%" height="100%" minWidth={100} minHeight={150} initialDimension={{ width: 500, height: 300 }} debounce={0}>
            <AreaChart 
              data={chartData} 
              margin={{ top: 14, right: 14, left: 0, bottom: 4 }}
            >
              <defs>
                <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#2563eb" stopOpacity={0.42}/>
                  <stop offset="95%" stopColor="#2563eb" stopOpacity={0.02}/>
                </linearGradient>
                <linearGradient id="chartGradientGreen" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.42}/>
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0.02}/>
                </linearGradient>
                {/* High contrast drop shadow for line */}
                <filter id="softLineShadow" x="-10%" y="-10%" width="120%" height="130%">
                  <feDropShadow dx="0" dy="4" stdDeviation="3.5" floodColor="#1d4ed8" floodOpacity="0.4" />
                </filter>
                <filter id="softLineShadowGreen" x="-10%" y="-10%" width="120%" height="130%">
                  <feDropShadow dx="0" dy="4" stdDeviation="3.5" floodColor="#059669" floodOpacity="0.4" />
                </filter>
              </defs>

              {/* Crisp horizontal grid lines */}
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(148, 163, 184, 0.22)" />
              
              {/* Date labels on x-axis */}
              <XAxis 
                dataKey="name" 
                axisLine={false} 
                tickLine={false} 
                tick={{ fontSize: 8.5, fontWeight: 900, fill: '#475569' }}
                dy={6}
                interval={reportType === 'monthly' ? 5 : 0}
              />

              {/* Hidden YAxis to support clean metrics-based scaling */}
              <YAxis 
                width={28}
                axisLine={false} 
                tickLine={false} 
                tick={{ fontSize: 8.5, fontWeight: 900, fill: '#475569' }}
                dx={-2}
                allowDecimals={false}
              />

              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'rgba(15, 23, 42, 0.98)', 
                  backdropFilter: 'blur(10px)',
                  border: '2px solid rgba(255, 255, 255, 0.15)', 
                  borderRadius: '14px',
                  boxShadow: '0 15px 35px -5px rgba(0, 0, 0, 0.4)',
                  fontSize: '10px',
                  fontWeight: '950',
                  color: '#ffffff',
                  padding: '8px 12px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em'
                }}
                itemStyle={{ fontWeight: '950', padding: 0, color: '#ffffff' }}
                cursor={{ stroke: 'rgba(37, 99, 235, 0.25)', strokeWidth: 2, strokeDasharray: '4 4' }}
              />

              <Area
                type="monotone"
                dataKey="total"
                name="Total Complaints"
                stroke="#2563eb"
                strokeWidth={2.75}
                fillOpacity={1}
                fill="url(#chartGradient)"
                dot={renderCustomDot("#2563eb", "rgba(37, 99, 235, 0.25)")}
                activeDot={renderCustomActiveDot("#2563eb", "rgba(37, 99, 235, 0.45)")}
                animationBegin={0}
                animationDuration={110}
                animationEasing="ease-out"
              />

              <Area
                type="monotone"
                dataKey="resolved"
                name="Resolved (Complete)"
                stroke="#10b981"
                strokeWidth={2.75}
                fillOpacity={1}
                fill="url(#chartGradientGreen)"
                dot={renderCustomDot("#10b981", "rgba(16, 185, 129, 0.25)")}
                activeDot={renderCustomActiveDot("#10b981", "rgba(16, 185, 129, 0.45)")}
                animationBegin={0}
                animationDuration={110}
                animationEasing="ease-out"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
});

export default RealTimeMonitor;

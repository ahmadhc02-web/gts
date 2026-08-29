import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { MapPin, Tag, ChevronDown, BarChart2, X, Info, User, Calendar, Clock, PieChart as PieChartIcon, Activity, WifiOff, Users, Settings, Wifi, HelpCircle, Phone } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip } from 'recharts';
import { Complaint } from '../types';
import { cn } from '../lib/utils';
import { calculateProtocolProgress } from '../utils/protocolProgress';
import { useTheme } from '../hooks/useTheme';

interface DistributionListProps {
  complaints: Complaint[];
  chartType?: 'area' | 'category';
}

const HIGH_CONTRAST_COLORS = [
  '#2563eb', // Vivid Royal Blue
  '#059669', // Vivid Emerald Green
  '#d97706', // Vivid Amber/Gold
  '#7c3aed', // Vivid Violet
  '#0284c7', // Vivid Sky Cyan
  '#c026d3', // Vivid Fuchsia/Magenta
  '#0d9488', // Vivid Deep Teal
  '#ea580c', // Vivid Coral Orange
  '#9333ea', // Vivid Purple
  '#0891b2', // Vivid Ocean Cyan
  '#475569', // Rich Slate
  '#65a30d', // Vivid Lime
];

const DARK_CONTRAST_COLORS = [
  '#3b82f6', // Bright Electric Blue
  '#10b981', // Bright Mint Emerald
  '#fbbf24', // Bright Gold Amber
  '#a855f7', // Bright Neon Purple
  '#38bdf8', // Bright Cyan Sky
  '#f472b6', // Bright Neon Pink
  '#2dd4bf', // Bright Turquoise
  '#fb923c', // Bright Orange
  '#c084fc', // Bright Lilac
  '#22d3ee', // Bright Cyan
  '#94a3b8', // Bright Silver Slate
  '#a3e635', // Bright Neon Lime
];

export const getNormalizedCategory = (rawCategory: string): string => {
  if (!rawCategory) return 'Unknown Category';
  const lower = rawCategory.trim().toLowerCase();
  if (lower.includes('redlight') || lower.includes('red light') || lower.includes('red-light') || lower.includes('los light') || lower.includes('pon light')) {
    return 'Red Light';
  }
  if (lower.includes('slow') || lower.includes('speed') || lower.includes('ping') || lower.includes('latency') || lower.includes('buffering')) {
    return 'Slow Speed';
  }
  if (lower.includes('disconnect') || lower.includes('disconn')) {
    return 'Disconnect';
  }
  if ((lower.includes('new') || lower.includes('conn')) && !lower.includes('disconnect') && !lower.includes('disconn')) {
    return 'New Connection';
  }
  if (lower.includes('router') || lower.includes('config') || lower.includes('modem') || lower.includes('wifi')) {
    return 'Router Config';
  }
  if (lower.includes('wire') || lower.includes('fiber') || lower.includes('cable') || lower.includes('break') || lower.includes('drop')) {
    return 'Wire Issue';
  }
  return rawCategory
    .trim()
    .split(/\s+/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
};

const getItemColor = (name: string, index: number, isCategory: boolean, isDark: boolean) => {
  const n = name.trim().toLowerCase();
  
  if (isCategory) {
    // Specifically map distinct, high-contrast, premium colors for categories
    if (n.includes('new') || n.includes('connection')) {
      return isDark ? '#3b82f6' : '#2563eb'; // Royal Blue
    }
    if (n.includes('slow') || n.includes('speed') || n.includes('ping') || n.includes('latency') || n.includes('buffering')) {
      return isDark ? '#10b981' : '#059669'; // Emerald Green
    }
    if (n.includes('disconnect') || n.includes('offline') || n.includes('disconn')) {
      return isDark ? '#fb7185' : '#e11d48'; // Rose/Cherry Red
    }
    if (n.includes('redlight') || n.includes('red light') || n.includes('red-light') || n.includes('los light') || n.includes('pon light')) {
      return isDark ? '#f87171' : '#dc2626'; // Red
    }
    if (n.includes('router') || n.includes('config') || n.includes('modem') || n.includes('wifi')) {
      return isDark ? '#a855f7' : '#7c3aed'; // Violet
    }
    if (n.includes('wire') || n.includes('fiber') || n.includes('cable') || n.includes('break') || n.includes('drop') || n.includes('joint')) {
      return isDark ? '#38bdf8' : '#0284c7'; // Sky/Cyan Blue
    }
    if (n === 'others' || n === 'other') {
      return isDark ? '#64748b' : '#94a3b8'; // Slate/Gray for aggregated 'Others'
    }
  } else {
    // For zones/areas: sequential high-contrast colors to guarantee ZERO duplicates in the top 5
    if (n === 'others' || n === 'other') {
      return isDark ? '#64748b' : '#94a3b8'; // Slate/Gray for aggregated 'Others'
    }
    const areaColors = isDark
      ? ['#3b82f6', '#10b981', '#fbbf24', '#a855f7', '#38bdf8']
      : ['#2563eb', '#059669', '#d97706', '#7c3aed', '#0284c7'];
    return areaColors[index % areaColors.length];
  }

  // Fallback for custom categories: use a stable hash-based color select to avoid clashes
  const themeColors = isDark ? DARK_CONTRAST_COLORS : HIGH_CONTRAST_COLORS;
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const colorIndex = Math.abs(hash) % themeColors.length;
  let color = themeColors[colorIndex];
  
  // Guard against returning reserved grays/reds/roses as custom fallbacks
  if (color === '#64748b' || color === '#94a3b8' || color === '#dc2626' || color === '#f87171' || color === '#fb7185' || color === '#e11d48') {
    const altColors = isDark 
      ? ['#3b82f6', '#10b981', '#fbbf24', '#a855f7', '#38bdf8', '#2dd4bf', '#fb923c', '#a3e635']
      : ['#2563eb', '#059669', '#d97706', '#7c3aed', '#0284c7', '#c026d3', '#0d9488', '#ea580c'];
    color = altColors[Math.abs(hash) % altColors.length];
  }

  return color;
};

const getCategoryIcon = (categoryName: string, color: string) => {
  const name = categoryName.toLowerCase();
  if (name.includes('speed') || name.includes('slow')) {
    return <Activity size={12} style={{ color }} className="shrink-0" />;
  }
  if (name.includes('offline') || name.includes('break') || name.includes('disconnect')) {
    return <WifiOff size={11} style={{ color }} className="shrink-0" />;
  }
  if (name.includes('new') || name.includes('connection')) {
    return <Users size={12} style={{ color }} className="shrink-0" />;
  }
  if (name.includes('router') || name.includes('config')) {
    return <Settings size={12} style={{ color }} className="shrink-0" />;
  }
  if (name.includes('wifi') || name.includes('wireless') || name.includes('issue')) {
    return <Wifi size={12} style={{ color }} className="shrink-0" />;
  }
  return <HelpCircle size={12} style={{ color }} className="shrink-0" />;
};

export default function DistributionList({ complaints, chartType = 'area' }: DistributionListProps) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const [reportType, setReportType] = useState<'weekly' | 'monthly' | 'yearly'>('weekly');
  const [viewBy, setViewBy] = useState<'area' | 'category'>('area');
  const [selectedItem, setSelectedItem] = useState<string | null>(null);

  // Filter complaints based on chosen timeframe and complete status
  const filteredComplaints = useMemo(() => {
    const now = new Date();
    let startTime = 0;

    if (reportType === 'weekly') {
      startTime = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6, 0, 0, 0, 0).getTime();
    } else if (reportType === 'monthly') {
      startTime = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 29, 0, 0, 0, 0).getTime();
    } else {
      // Yearly (last 12 months)
      startTime = new Date(now.getFullYear(), now.getMonth() - 11, 1, 0, 0, 0, 0).getTime();
    }

    return complaints.filter(c => {
      // Show only finalized or complete complaints/connections
      const statusLower = (c.status || '').toLowerCase();
      if (statusLower !== 'complete' && statusLower !== 'finalized') {
        return false;
      }

      if (!c.createdAt) return true; // Include records without timestamp fallback
      const time = typeof c.createdAt === 'number' ? c.createdAt : new Date(c.createdAt).getTime();
      if (isNaN(time)) return true;
      return time >= startTime;
    });
  }, [complaints, reportType]);

  const data = useMemo(() => {
    const counts: Record<string, number> = {};
    filteredComplaints.forEach(c => {
      let key = chartType === 'area' ? (c.area || 'Unknown Area') : (c.category || 'Unknown Category');
      if (chartType === 'category') {
        key = getNormalizedCategory(key);
      } else {
        key = key.trim().split(/\s+/).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
      }
      if (!counts[key]) counts[key] = 0;
      counts[key]++;
    });
    return Object.entries(counts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  }, [filteredComplaints, chartType]);

  const chartData = useMemo(() => {
    // Separate 'Other' or 'Others' from the list
    const nonOthers = data.filter(item => item.name.toLowerCase() !== 'others' && item.name.toLowerCase() !== 'other');
    const existingOthers = data.find(item => item.name.toLowerCase() === 'others' || item.name.toLowerCase() === 'other');

    // Take top 5 non-Others categories/zones
    const top5 = nonOthers.slice(0, 5);
    const result = [...top5];

    // Show 'Other' ONLY if actual 'Other' complaints exist, with exactly their own count (do not group disconnecting or anything else into it!)
    if (existingOthers && existingOthers.count > 0) {
      result.push({ name: 'Other', count: existingOthers.count });
    }

    return result;
  }, [data]);

  const topNames = useMemo(() => {
    return new Set(chartData.filter(item => item.name !== 'Other' && item.name !== 'Others').map(item => item.name));
  }, [chartData]);

  const total = filteredComplaints.length;
  
  return (
    <div className="h-full flex flex-col text-slate-900 dark:text-slate-100 pb-0">
      <div className="flex-1 neu-card rounded-2xl border-2 border-slate-300/80 dark:border-white/10 flex flex-col relative overflow-hidden transition-all duration-300 shadow-[var(--neu-shadow-raised)]">
        {/* Soft decorative ambient glow */}
        {chartType === 'area' ? (
          <div className="absolute top-4 -right-16 w-48 h-48 bg-blue-500/10 dark:bg-blue-400/15 blur-[48px] rounded-full pointer-events-none z-0" />
        ) : (
          <div className="absolute top-4 -right-16 w-48 h-48 bg-purple-500/10 dark:bg-purple-400/15 blur-[48px] rounded-full pointer-events-none z-0" />
        )}

        {/* Top Header: Controls & High-Contrast Badge with Week / Month / Year selector */}
        <div className="px-5 pt-4 pb-3 flex items-center justify-between gap-2 border-b border-slate-200/80 dark:border-white/10 relative z-10">
          <div className="flex items-center gap-2 shrink-0">
            <span 
              className={cn(
                "text-[10px] font-black tracking-widest px-2.5 py-1 rounded-lg uppercase flex items-center gap-1.5 shadow-sm border",
                chartType === 'area'
                  ? "text-blue-700 dark:text-white bg-blue-500/15 dark:bg-[#101010] border-blue-500/30 dark:border-[#898989]"
                  : "text-purple-700 dark:text-white bg-purple-500/15 dark:bg-[#1d1d1d] border-purple-500/30 dark:border-[#727070]"
              )}
              style={
                chartType === 'area'
                  ? (isDark ? { backgroundColor: '#3e4149', color: '#ffffff', borderColor: '#757575' } : { backgroundColor: '#f2f4f7', color: '#000000', borderColor: '#f2f4f7' })
                  : (isDark ? { backgroundColor: '#3e4149', borderColor: '#757575', color: '#ffffff' } : { backgroundColor: '#f2f4f7', borderColor: '#f2f4f7', color: '#000000' })
              }
            >
              {chartType === 'area' ? <MapPin size={11} className="stroke-[2.5]" /> : <Tag size={11} className="stroke-[2.5]" />}
              {chartType === 'area' ? 'ZONES' : 'CATEGORIES'}
            </span>
          </div>

          {/* Timeframe selection: Week, Month, Year matching RealTimeMonitor */}
          <div className="flex items-center bg-slate-200/70 dark:bg-slate-900/90 p-0.5 rounded-lg border border-slate-300 dark:border-white/10 shadow-xs">
            {(['weekly', 'monthly', 'yearly'] as const).map((type) => (
              <button
                key={type}
                onClick={() => setReportType(type)}
                className={`px-2.5 sm:px-3 py-1 text-[9px] font-black tracking-wider rounded-md uppercase transition-all duration-200 ${
                  reportType === type 
                    ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-[var(--neu-shadow-raised-sm)] border border-slate-200/80 dark:border-white/10' 
                    : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white font-extrabold'
                }`}
              >
                {type === 'weekly' ? 'Week' : type === 'monthly' ? 'Month' : 'Year'}
              </button>
            ))}
          </div>
        </div>
        
        <div className="flex-1 flex w-full h-full relative z-10">
           <div className="w-full flex items-center relative h-full rounded-2xl overflow-hidden px-4 py-2">
                {data.length > 0 ? (
                  <div className="flex flex-col w-full h-full justify-between">
                    <div key={`piechart-wrapper-${isDark ? 'dark' : 'light'}`} className="flex-1 w-full min-h-[210px] min-w-0 relative flex items-center justify-center">
                      
                      {/* Realistic 3D Raised Neumorphic Center Dial (Outward Embossed Button) */}
                      <div className={cn(
                        "absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[86px] h-[86px] rounded-full flex flex-col items-center justify-center pointer-events-none z-20 transition-all duration-300",
                        isDark
                          ? "bg-[#33363d] border border-[#757575]/40"
                          : "bg-gradient-to-br from-[#ffffff] to-[#e6e8ee] shadow-[5px_5px_12px_rgba(0,0,0,0.18),-5px_-5px_12px_rgba(255,255,255,0.95),inset_1px_1px_3px_rgba(255,255,255,0.9),inset_-1px_-1px_3px_rgba(0,0,0,0.08)] border border-slate-200/80"
                      )}>
                        <div className={cn(
                          "w-[70px] h-[70px] rounded-full flex flex-col items-center justify-center text-center transition-all",
                          isDark
                            ? "bg-[#282a2e] border border-[#757575]/30"
                            : "bg-[#f1f3f7] shadow-[inset_2px_2px_5px_rgba(0,0,0,0.1),inset_-2px_-2px_5px_rgba(255,255,255,0.9)] border border-slate-200/60"
                        )}>
                          <span className="text-[10.5px] font-black uppercase tracking-[0.12em] leading-tight drop-shadow-sm text-blue-600 dark:text-blue-400">
                            {chartType === 'area' ? 'ZONES' : 'CATG.'}
                          </span>
                          <span className="text-[8.5px] font-extrabold text-slate-600 dark:text-slate-300 tracking-wider">
                            {total} {total === 1 ? 'LOG' : 'LOGS'}
                          </span>
                        </div>
                      </div>
  
                      <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                        <PieChart margin={{ top: 0, right: 32, left: 32, bottom: 0 }}>
                          <defs>
                            {/* Neumorphic 3D Raised Extrusion Filter for Light Mode */}
                            <filter id="neuDonutRaisedLight" x="-20%" y="-20%" width="140%" height="140%">
                              {/* Deep ambient drop shadow for outward elevation */}
                              <feDropShadow dx="3" dy="5" stdDeviation="4" floodColor="#0f172a" floodOpacity="0.28" />
                              {/* Secondary soft shadow */}
                              <feDropShadow dx="1" dy="2" stdDeviation="1.5" floodColor="#0f172a" floodOpacity="0.18" />
                              {/* Top-Left Light Highlight (Specular bevel pop) */}
                              <feDropShadow dx="-2" dy="-2" stdDeviation="2.5" floodColor="#ffffff" floodOpacity="0.85" />
                            </filter>

                            {/* Recessed trench shadow for inner bed (Light Mode) */}
                            <filter id="recessedTrench" x="-20%" y="-20%" width="140%" height="140%">
                              <feDropShadow dx="1" dy="2" stdDeviation="2" floodColor="#000000" floodOpacity={0.15} />
                            </filter>
                          </defs>

                          {/* Neumorphic Recessed Base Track (Trench ring under the extruded slices) - Light mode only */}
                          {!isDark && (
                            <Pie
                              key="trench-light"
                              data={[{ value: 1 }]}
                              cx="50%" cy="50%"
                              innerRadius={50} outerRadius={96}
                              dataKey="value"
                              isAnimationActive={false}
                              fill="#e2e6ee"
                              stroke="rgba(0,0,0,0.06)"
                              strokeWidth={1}
                              style={{ filter: 'url(#recessedTrench)' }}
                            />
                          )}

                          {/* 3D Raised Donut Slices */}
                          <Pie 
                            key={`pie-${chartType}-${isDark ? 'dark' : 'light'}`}
                            data={chartData} 
                            cx="50%" cy="50%" 
                            innerRadius={54} outerRadius={94} 
                            paddingAngle={6}
                            cornerRadius={7}
                            dataKey="count"
                            nameKey="name"
                            stroke={isDark ? '#282a2e' : '#ffffff'}
                            strokeWidth={isDark ? 1.5 : 1.5}
                            labelLine={false}
                            label={(props) => {
                              const { cx, cy, midAngle, outerRadius, name, percent, index } = props;
                              const RADIAN = Math.PI / 180;
                              const radiusMid = outerRadius * 1.25;
                              
                              const x = cx + radiusMid * Math.cos(-midAngle * RADIAN);
                              const y = cy + radiusMid * Math.sin(-midAngle * RADIAN);
                              
                              const p1x = cx + outerRadius * Math.cos(-midAngle * RADIAN);
                              const p1y = cy + outerRadius * Math.sin(-midAngle * RADIAN);
 
                              const itemColor = getItemColor(name, index, chartType === 'category', isDark);
                              
                              const xDir = Math.cos(-midAngle * RADIAN) >= 0 ? 1 : -1;
                              const ex = x + (xDir * 14);
                              const textX = xDir > 0 ? ex + 4 : ex - 4;
 
                              if (percent === 0) return null;
                              
                              let displayName = name;
                              if (displayName.toLowerCase() === 'new connection') {
                                displayName = 'NEW CONN.';
                              }
 
                              return (
                                <g>
                                  <polyline 
                                    points={`${p1x},${p1y} ${x},${y} ${ex},${y}`} 
                                    stroke={itemColor} 
                                    fill="none" 
                                    strokeWidth={2.2} 
                                    strokeLinecap="round"
                                    opacity={0.95} 
                                  />
                                  <circle cx={ex} cy={y} r={3.5} fill={itemColor} stroke={isDark ? '#1c1f26' : '#ffffff'} strokeWidth={1} />
                                  <text 
                                    x={textX} 
                                    y={y - 5} 
                                    fill={itemColor} 
                                    textAnchor={xDir > 0 ? 'start' : 'end'} 
                                    dominantBaseline="baseline" 
                                    fontSize="10.5" 
                                    fontWeight="950" 
                                    style={{
                                      textTransform: 'uppercase', 
                                      letterSpacing: '0.04em', 
                                      filter: isDark ? 'drop-shadow(0px 1px 3px rgba(0,0,0,0.8))' : 'drop-shadow(0px 1px 2px rgba(255,255,255,0.9))'
                                    }}
                                  >
                                    {displayName} <tspan fill={isDark ? '#f8fafc' : '#0f172a'} fontWeight="900" fontSize="10">{(percent * 100).toFixed(0)}%</tspan>
                                  </text>
                                </g>
                              );
                            }}
                            onClick={(entry) => {
                              setViewBy(chartType);
                              setSelectedItem(entry.name);
                            }}
                            className="cursor-pointer focus:outline-none"
                            animationBegin={chartType === 'category' ? 150 : 0}
                            animationDuration={1100}
                            animationEasing="ease-out"
                          >
                            {chartData.map((entry, index) => {
                              const itemColor = getItemColor(entry.name, index, chartType === 'category', isDark);
                              return (
                                <Cell 
                                  key={`cell-${chartType}-${isDark ? 'dark' : 'light'}-${index}`} 
                                  fill={itemColor} 
                                  className="hover:opacity-100 hover:scale-[1.05] transition-all duration-300 origin-center cursor-pointer" 
                                  style={{ 
                                    filter: isDark ? undefined : 'url(#neuDonutRaisedLight)'
                                  }}
                                />
                              );
                            })}
                          </Pie>
                          <RechartsTooltip wrapperStyle={{ zIndex: 100 }} 
                            contentStyle={{
                                backgroundColor: isDark ? 'rgba(28, 31, 38, 0.98)' : 'rgba(255, 255, 255, 0.98)', 
                                backdropFilter: 'blur(10px)',
                                border: isDark ? '1px solid rgba(255, 255, 255, 0.12)' : '1px solid rgba(15, 23, 42, 0.15)', 
                                borderRadius: '14px',
                                boxShadow: isDark ? '0 15px 35px -5px rgba(0, 0, 0, 0.7)' : '0 15px 30px -5px rgba(0, 0, 0, 0.15)',
                                fontSize: '11.5px',
                                fontWeight: '950',
                                color: isDark ? '#ffffff' : '#0f172a',
                                textTransform: 'uppercase',
                                padding: '9px 14px'
                            }}
                            itemStyle={{ color: isDark ? '#ffffff' : '#0f172a', fontWeight: '950' }}
                            cursor={false}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                ) : (
                 <div className="flex-1 flex items-center justify-center">
                   <p className="text-[11px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">No Active Records</p>
                 </div>
               )}
            </div>
         </div>
       </div>

       {/* Full Details Modal for Distribution Analysis */}
       <AnimatePresence>
         {selectedItem && (
           <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
             <motion.div
               initial={{ opacity: 0 }}
               animate={{ opacity: 1 }}
               exit={{ opacity: 0 }}
               onClick={() => setSelectedItem(null)}
               className="absolute inset-0 bg-slate-950/70 backdrop-blur-md"
             />
             <motion.div
               initial={{ opacity: 0, scale: 0.95, y: 20 }}
               animate={{ opacity: 1, scale: 1, y: 0 }}
               exit={{ opacity: 0, scale: 0.95, y: 20 }}
               className="relative w-full max-w-2xl max-h-[85vh] flex flex-col bg-[var(--neu-surface)] rounded-3xl border-2 border-slate-300 dark:border-white/15 shadow-[var(--neu-shadow-raised-lg)] overflow-hidden z-10"
             >
               <div className="p-6 border-b border-slate-200 dark:border-white/10 flex items-center justify-between shrink-0">
                 <div className="flex items-center gap-3">
                   <div className="w-10 h-10 rounded-xl bg-blue-500/15 flex items-center justify-center text-blue-600 dark:text-blue-400 shadow-sm border border-blue-500/20">
                     <Info size={20} />
                   </div>
                   <div>
                     <h3 className="text-sm font-black uppercase tracking-widest text-slate-900 dark:text-white">Complaints Detail</h3>
                     <p className="text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-tighter">
                       {viewBy === 'area' ? 'Deployment Zone' : 'Category'}: {selectedItem}
                     </p>
                   </div>
                 </div>
                 <button 
                   onClick={() => setSelectedItem(null)}
                   className="w-8 h-8 rounded-full bg-[var(--neu-surface)] shadow-[var(--neu-shadow-inset)] flex items-center justify-center text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors"
                 >
                   <X size={16} />
                 </button>
               </div>

               <div className="p-6 overflow-y-auto space-y-3 custom-scrollbar flex-1 bg-slate-50/50 dark:bg-slate-900/50">
                 {filteredComplaints
                   .filter(c => {
                     const itemKey = viewBy === 'area'
                       ? (c.area || 'Unknown Area').trim().split(/\s+/).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ')
                       : getNormalizedCategory(c.category || 'Unknown Category');
                     if (selectedItem === 'Other' || selectedItem === 'Others') {
                       return itemKey === 'Other' || itemKey === 'Others';
                     }
                     return itemKey === selectedItem;
                   })
                   .sort((a, b) => b.createdAt - a.createdAt)
                   .map((complaint, idx) => (
                     <div key={`${complaint.id}-${idx}`} className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-[var(--neu-shadow-raised-sm)] border border-slate-100 dark:border-slate-700">
                         <div className="flex items-start justify-between gap-4 mb-3">
                           <div className="flex-1">
                              <p className="text-xs font-black uppercase text-slate-900 dark:text-white mb-0.5">{complaint.category}</p>
                              <div className="flex flex-col gap-1.5">
                                <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[10px] font-bold">
                                   <span className="flex items-center gap-1 text-slate-700 dark:text-slate-300 uppercase">
                                     <User size={12} className="text-slate-400" /> {complaint.customerName || 'Unknown User'}
                                   </span>
                                   {complaint.customerUsername && (
                                     <span className="text-blue-600 dark:text-blue-400 font-extrabold bg-blue-500/10 dark:bg-blue-500/20 px-1.5 py-0.5 rounded text-[9px]">
                                       ID: {complaint.customerUsername}
                                     </span>
                                   )}
                                   {complaint.number && (
                                     <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-extrabold bg-emerald-500/10 dark:bg-emerald-500/20 px-1.5 py-0.5 rounded text-[9px]">
                                       <Phone size={10} /> {complaint.number}
                                     </span>
                                   )}
                                </div>
                                <div className="flex items-center gap-3 text-[10px] font-bold text-slate-400">
                                  <span className="flex items-center gap-1 uppercase">
                                    {viewBy === 'area' ? <Tag size={12} /> : <MapPin size={12} />}
                                    {viewBy === 'area' ? complaint.category : complaint.area}
                                  </span>
                                </div>
                              </div>
                           </div>
                           
                           <div className="flex flex-col items-end gap-1 shrink-0">
                             <div className={`px-2.5 py-1 rounded-md text-[9px] font-black uppercase tracking-widest ${
                               complaint.status === 'resolved' || complaint.status === 'complete' ? 'bg-green-500/10 text-green-600' :
                               complaint.status === 'pending' ? 'bg-amber-500/10 text-amber-600' :
                               'bg-blue-500/10 text-blue-600'
                             }`}>
                               {complaint.status}
                             </div>
                             {complaint.status === 'in process' && (() => {
                               const prog = calculateProtocolProgress(complaint.remarks);
                               if (prog.percentage <= 0) return null;
                               return (
                                 <div className="w-16 flex flex-col items-end gap-0.5" title={prog.stepText}>
                                   <div className="w-full bg-[var(--neu-surface)] shadow-[var(--neu-shadow-inset)] h-1 rounded-full overflow-hidden border border-slate-200/40 dark:border-slate-700/40">
                                     <div 
                                       className="bg-blue-500 h-full rounded-full"
                                       style={{ width: `${prog.percentage}%` }}
                                     />
                                   </div>
                                   <span className="text-[7px] font-mono font-black text-blue-500 dark:text-blue-400">
                                     {prog.percentage}%
                                   </span>
                                 </div>
                               );
                             })()}
                           </div>
                         </div>

                         {complaint.description && (
                           <div className="p-3 bg-[var(--neu-surface)] rounded-lg border border-slate-100 dark:border-white/10 mt-3">
                             <p className="text-xs font-medium text-slate-600 dark:text-slate-300 line-clamp-2">{complaint.description}</p>
                           </div>
                         )}

                         <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-100 dark:border-slate-700">
                           <div className="flex items-center gap-4 text-slate-400">
                             <div className="flex items-center gap-1.5">
                               <Calendar size={12} />
                               <span className="text-[9px] font-black uppercase tracking-widest">
                                 {new Date(complaint.createdAt).toLocaleDateString()}
                               </span>
                             </div>
                             <div className="flex items-center gap-1.5">
                               <Clock size={12} />
                               <span className="text-[9px] font-black uppercase tracking-widest">
                                 {new Date(complaint.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                               </span>
                             </div>
                           </div>
                           <span className="text-[9px] font-black uppercase tracking-widest text-slate-300 dark:text-slate-600">
                             ID: {complaint.id.substring(0, 8)}
                           </span>
                         </div>
                     </div>
                 ))}
               </div>
             </motion.div>
           </div>
         )}
       </AnimatePresence>
    </div>
  );
}

import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { MapPin, Tag, ChevronDown, BarChart2, X, Info, User, Calendar, Clock, PieChart as PieChartIcon, Activity, WifiOff, Users, Settings, Wifi, HelpCircle } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip } from 'recharts';
import { Complaint } from '../types';
import { cn } from '../lib/utils';
import { calculateProtocolProgress } from '../utils/protocolProgress';

interface DistributionListProps {
  complaints: Complaint[];
  chartType?: 'area' | 'category';
}

const COLORS = ['#0f172a', '#334155', '#2563eb', '#1d4ed8', '#10b981', '#059669', '#f59e0b', '#d97706', '#6366f1'];

const getItemColor = (name: string, index: number, isCategory: boolean) => {
  const n = name.trim().toLowerCase();
  if (isCategory) {
    if (n.includes('speed') || n.includes('slow')) return '#dc2626'; // Red
    if (n.includes('offline') || n.includes('break')) return '#ea580c'; // Orange
    if (n.includes('router') || n.includes('config')) return '#475569'; // Slate
    if (n.includes('new') || n.includes('connection')) return '#2563eb'; // Blue
    if (n.includes('wifi') || n.includes('wireless') || n.includes('issue')) return '#059669'; // Emerald
  } else {
    // Zones mapping mockups
    if (n.includes('tsipp')) return '#ea580c'; 
    if (n.includes('ts')) return '#059669'; 
    if (n.includes('chirr')) return '#2563eb'; 
    if (n.includes('hc')) return '#dc2626'; 
    if (n.includes('sdk')) return '#4f46e5'; 
    if (n.includes('model')) return '#059669';
    if (n.includes('gulberg')) return '#2563eb';
    if (n.includes('satellite')) return '#4f46e5';
  }
  return COLORS[index % COLORS.length];
};

const getCategoryIcon = (categoryName: string, color: string) => {
  const name = categoryName.toLowerCase();
  if (name.includes('speed') || name.includes('slow')) {
    return <Activity size={12} style={{ color }} className="shrink-0" />;
  }
  if (name.includes('offline') || name.includes('break')) {
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
  const [viewBy, setViewBy] = useState<'area' | 'category'>('area');
  const [selectedItem, setSelectedItem] = useState<string | null>(null);

  const data = useMemo(() => {
    const counts: Record<string, number> = {};
    complaints.forEach(c => {
      const key = chartType === 'area' ? (c.area || 'Unknown Area') : (c.category || 'Unknown Category');
      if (!counts[key]) counts[key] = 0;
      counts[key]++;
    });
    return Object.entries(counts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  }, [complaints, chartType]);

  const total = complaints.length;
  
  return (
    <div className="h-full flex flex-col text-slate-900 dark:text-slate-100 pb-0">
      <div className="flex-1 bg-white dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800 flex flex-col relative overflow-hidden shadow-[0_20px_45px_-12px_rgba(0,0,0,0.12),0_8px_20px_-8px_rgba(0,0,0,0.08)] dark:shadow-[0_25px_50px_-12px_rgba(0,0,0,0.6),0_10px_22px_-8px_rgba(0,0,0,0.4)]">
        {/* Soft pastel decorative ambient blobs exactly like mockup photo */}
        {chartType === 'area' ? (
          <div className="absolute top-4 -right-16 w-48 h-48 bg-emerald-400/8 blur-[48px] rounded-full pointer-events-none z-0" />
        ) : (
          <div className="absolute top-4 -right-16 w-48 h-48 bg-indigo-400/8 blur-[48px] rounded-full pointer-events-none z-0" />
        )}
        
        <div className="flex-1 flex w-full h-full relative z-10">
           <div className="w-full flex items-center relative h-full rounded-2xl overflow-hidden p-5">
                {data.length > 0 ? (
                  <div className="flex flex-col w-full h-full justify-between">
                     {/* Chart Container - Top Portion - Height adjusted for visual balance */}
                      <div className="w-full h-[285px] relative flex items-center justify-center">
                      {/* Centered Label with elegant concentric double border layout matching photo */}
                      <div className="absolute w-[92px] h-[92px] rounded-full bg-white dark:bg-slate-900 flex flex-col items-center justify-center pointer-events-none z-10 shadow-[inner_0_2px_4px_rgba(0,0,0,0.06),0_12px_24px_-6px_rgba(0,0,0,0.08)] border border-slate-200 dark:border-slate-800 transition-colors">
                        <div className="w-[80px] h-[80px] rounded-full border border-dashed border-slate-200 dark:border-slate-700/60 flex items-center justify-center text-center">
                          <span className="text-[10px] font-black uppercase tracking-[0.1em] text-slate-900 dark:text-white leading-tight">
                            {chartType === 'area' ? 'ZONE' : 'CATG.'}
                          </span>
                        </div>
                      </div>
  
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart margin={{ top: 15, right: 55, left: 55, bottom: 15 }}>
                          <defs>
                             <filter id="pieShadow" x="-10%" y="-10%" width="120%" height="120%">
                               <feDropShadow dx="1" dy="3" stdDeviation="2" floodOpacity="0.15" />
                             </filter>
                          </defs>
                          <Pie 
                            data={chartType === 'area' ? data.slice(0, 6) : data.slice(0, 4)} 
                            cx="50%" cy="50%" 
                            innerRadius="44%" outerRadius="75%" 
                            paddingAngle={5}
                            cornerRadius={8}
                            dataKey="count"
                            nameKey="name"
                            stroke="none"
                            labelLine={false}
                            label={(props) => {
                              const { cx, cy, midAngle, outerRadius, name, percent, index } = props;
                              const RADIAN = Math.PI / 180;
                              const radiusMid = outerRadius * 1.35;
                              
                              const x = cx + radiusMid * Math.cos(-midAngle * RADIAN);
                              const y = cy + radiusMid * Math.sin(-midAngle * RADIAN);
                              
                              const p1x = cx + outerRadius * Math.cos(-midAngle * RADIAN);
                              const p1y = cy + outerRadius * Math.sin(-midAngle * RADIAN);
 
                              const itemColor = getItemColor(name, index, chartType === 'category');
                              
                              const xDir = Math.cos(-midAngle * RADIAN) >= 0 ? 1 : -1;
                              const ex = x + (xDir * 28);
                              const textX = xDir > 0 ? x + 4 : x - 4;
 
                              if (percent === 0) return null;
 
                              return (
                                <g>
                                  <polyline points={`${p1x},${p1y} ${x},${y} ${ex},${y}`} stroke={itemColor} fill="none" strokeWidth={2} opacity={0.8} />
                                  <circle cx={ex} cy={y} r={3} fill={itemColor} />
                                  <text x={textX} y={y - 7} fill={itemColor} textAnchor={xDir > 0 ? 'start' : 'end'} dominantBaseline="baseline" fontSize="10.5" fontWeight="900" style={{textTransform: 'uppercase', letterSpacing: '0.05em', filter: 'drop-shadow(0px 1px 2px rgba(0,0,0,0.3))'}}>
                                    {name} <tspan fillOpacity={0.8} fontWeight="800">{(percent * 100).toFixed(0)}%</tspan>
                                  </text>
                                </g>
                              );
                            }}
                            onClick={(entry) => {
                              setViewBy(chartType);
                              setSelectedItem(entry.name);
                            }}
                            className="cursor-pointer focus:outline-none"
                            animationBegin={chartType === 'category' ? 200 : 0}
                            animationDuration={1200}
                            animationEasing="ease-out"
                          >
                            {(chartType === 'area' ? data.slice(0, 6) : data.slice(0, 4)).map((entry, index) => {
                              const itemColor = getItemColor(entry.name, index, chartType === 'category');
                              return (
                                <Cell 
                                  key={`cell-${index}`} 
                                  fill={itemColor} 
                                  className="hover:opacity-95 hover:scale-[1.04] transition-all duration-300 origin-center cursor-pointer" 
                                  style={{ filter: 'url(#pieShadow)' }}
                                />
                              );
                            })}
                          </Pie>
                          <RechartsTooltip wrapperStyle={{ zIndex: 100 }} 
                            contentStyle={{
                                backgroundColor: 'rgba(15, 23, 42, 0.98)', 
                                backdropFilter: 'blur(8px)',
                                border: '1px solid rgba(51, 65, 85, 0.7)', 
                                borderRadius: '12px',
                                boxShadow: '0 15px 30px -5px rgba(0, 0, 0, 0.35)',
                                fontSize: '11px',
                                fontWeight: '950',
                                color: '#fff',
                                textTransform: 'uppercase',
                                padding: '8px 12px'
                            }}
                            itemStyle={{ color: '#fff', fontWeight: '950' }}
                            cursor={false}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                ) : (
                 <div className="flex-1 flex items-center justify-center">
                   <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">No Data</p>
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
               className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
             />
             <motion.div
               initial={{ opacity: 0, scale: 0.95, y: 20 }}
               animate={{ opacity: 1, scale: 1, y: 0 }}
               exit={{ opacity: 0, scale: 0.95, y: 20 }}
               className="relative w-full max-w-2xl max-h-[85vh] flex flex-col bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden"
             >
               <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0">
                 <div className="flex items-center gap-3">
                   <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-500">
                     <Info size={20} />
                   </div>
                   <div>
                     <h3 className="text-sm font-black uppercase tracking-widest text-slate-900 dark:text-white">Complaints Detail</h3>
                     <p className="text-[10px] font-bold text-emerald-500 uppercase tracking-tighter opacity-70">
                       {viewBy === 'area' ? 'Deployment Zone' : 'Category'}: {selectedItem}
                     </p>
                   </div>
                 </div>
                 <button 
                   onClick={() => setSelectedItem(null)}
                   className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors"
                 >
                   <X size={16} />
                 </button>
               </div>

               <div className="p-6 overflow-y-auto space-y-3 custom-scrollbar flex-1 bg-slate-50/50 dark:bg-slate-900/50">
                 {complaints
                   .filter(c => (viewBy === 'area' ? c.area || 'Unknown Area' : c.category || 'Unknown Category') === selectedItem)
                   .sort((a, b) => b.createdAt - a.createdAt)
                   .map((complaint, idx) => (
                     <div key={`${complaint.id}-${idx}`} className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700">
                         <div className="flex items-start justify-between gap-4 mb-3">
                           <div className="flex-1">
                              <p className="text-xs font-black uppercase text-slate-900 dark:text-white mb-0.5">{complaint.category}</p>
                              <div className="flex items-center gap-3 text-[10px] font-bold text-slate-400">
                                 <span className="flex items-center gap-1 uppercase">
                                   <User size={12} /> {complaint.customerName || 'Unknown User'}
                                 </span>
                                 <span className="flex items-center gap-1 uppercase">
                                   {viewBy === 'area' ? <Tag size={12} /> : <MapPin size={12} />}
                                   {viewBy === 'area' ? complaint.category : complaint.area}
                                 </span>
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
                                   <div className="w-full bg-slate-100 dark:bg-slate-800 h-1 rounded-full overflow-hidden border border-slate-200/40 dark:border-slate-700/40">
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
                           <div className="p-3 bg-slate-50 dark:bg-slate-900/50 rounded-lg border border-slate-100 dark:border-slate-800 mt-3">
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

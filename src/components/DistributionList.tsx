import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { MapPin, Tag, ChevronDown, BarChart2, X, Info, User, Calendar, Clock, PieChart as PieChartIcon } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip } from 'recharts';
import { Complaint } from '../types';

interface DistributionListProps {
  complaints: Complaint[];
  chartType?: 'area' | 'category';
}

const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#14b8a6', '#f97316'];

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
  
  const iconColor = chartType === 'area' ? 'emerald' : 'blue';
  
  return (
    <div className="h-full flex flex-col text-slate-900 dark:text-slate-100">
      <div className="flex-1 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm flex flex-col relative overflow-hidden">
        {/* Decorative background elements */}
        <div className={`absolute -top-16 -right-16 w-64 h-64 bg-${iconColor}-500/5 blur-[80px] rounded-full pointer-events-none`} />
        
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-2 relative z-20">
          <div className="flex items-center">
            <h3 className="text-sm font-black uppercase tracking-widest text-slate-900 dark:text-white">
              {chartType === 'area' ? 'Zone Analysis' : 'Category Analysis'}
            </h3>
          </div>
        </div>

        <div className="flex-1 flex gap-2 w-full mt-2 h-full min-h-[160px] pb-2 relative z-10">
           {/* Dynamic Pie */}
           <div className={`w-full flex items-center relative h-full bg-gradient-to-br from-slate-50/50 to-slate-100/30 dark:from-slate-800/30 dark:to-slate-800/10 rounded-2xl border border-slate-200/50 dark:border-slate-700/50 hover:border-${iconColor}-500/30 transition-colors shadow-sm overflow-hidden p-2`}>
              {data.length > 0 ? (
                <div className="flex w-full h-full items-center">
                  <div className="w-[60%] h-[240px] relative -left-3">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                         <defs>
                            <filter id="pieShadow" x="-20%" y="-20%" width="140%" height="140%">
                              <feDropShadow dx="-2" dy="4" stdDeviation="3" floodOpacity="0.25" />
                            </filter>
                         </defs>
                         <Pie 
                           data={data.slice(0, 5)} 
                           cx="50%" cy="50%" 
                           innerRadius="40%" outerRadius="95%" 
                           paddingAngle={4}
                           cornerRadius={6}
                           dataKey="count"
                           nameKey="name"
                           stroke="none"
                           onClick={(entry) => {
                             setViewBy(chartType);
                             setSelectedItem(entry.name);
                           }}
                           className="cursor-pointer focus:outline-none"
                           animationBegin={chartType === 'category' ? 200 : 0}
                           animationDuration={1500}
                           animationEasing="ease-out"
                         >
                           {data.slice(0, 5).map((entry, index) => {
                             const colorIndex = chartType === 'category' ? (index + 3) : index;
                             return (
                               <Cell 
                                 key={`cell-${index}`} 
                                 fill={COLORS[colorIndex % COLORS.length]} 
                                 className="hover:opacity-90 hover:scale-[1.08] transition-all duration-300 origin-center cursor-pointer" 
                                 style={{ filter: 'url(#pieShadow)' }}
                               />
                             );
                           })}
                         </Pie>
                         <RechartsTooltip 
                           contentStyle={{
                              backgroundColor: 'rgba(15, 23, 42, 0.95)', 
                              backdropFilter: 'blur(8px)',
                              border: '1px solid rgba(51, 65, 85, 0.5)', 
                              borderRadius: '12px',
                              boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.2)',
                              fontSize: '11px',
                              fontWeight: '900',
                              color: '#fff',
                              textTransform: 'uppercase',
                              padding: '8px 12px'
                           }}
                           itemStyle={{ color: '#fff', fontWeight: '900' }}
                           cursor={false}
                         />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  
                  {/* Right side list */}
                  <div className="w-[40%] flex flex-col justify-center gap-2 pr-2">
                    {data.slice(0, 5).map((item, idx) => {
                       const percentage = total > 0 ? Math.round((item.count / total) * 100) : 0;
                       const colorIndex = chartType === 'category' ? (idx + 3) : idx;
                       return (
                         <div key={item.name} className="flex flex-col">
                            <div className="flex items-center justify-between text-[10px] sm:text-xs font-black leading-tight mb-1">
                               <span className="truncate pr-1 text-slate-700 dark:text-slate-300 saturate-150" style={{ color: COLORS[colorIndex % COLORS.length] }}>
                                 {item.name}
                               </span>
                               <span className="text-slate-900 dark:text-white shrink-0">
                                 {percentage}%
                               </span>
                            </div>
                            <div className="w-full h-1.5 bg-slate-200/50 dark:bg-slate-700/50 rounded-full overflow-hidden">
                               <div className="h-full rounded-full transition-all duration-1000 ease-out" style={{ width: `${percentage}%`, backgroundColor: COLORS[colorIndex % COLORS.length] }} />
                            </div>
                         </div>
                       );
                    })}
                  </div>
                </div>
              ) : (
                <div className="flex-1 flex items-center justify-center">
                  <p className="text-[9px] font-black text-slate-400 uppercase">No Data</p>
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
                  .map((complaint) => (
                    <div key={complaint.id} className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700">
                        <div className="flex items-start justify-between gap-4 mb-3">
                          <div className="flex-1">
                             <p className="text-xs font-black uppercase text-slate-900 dark:text-white mb-0.5">{complaint.subject}</p>
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
                          
                          <div className={`px-2.5 py-1 rounded-md text-[9px] font-black uppercase tracking-widest ${
                            complaint.status === 'resolved' ? 'bg-green-500/10 text-green-600' :
                            complaint.status === 'pending' ? 'bg-amber-500/10 text-amber-600' :
                            'bg-blue-500/10 text-blue-600'
                          }`}>
                            {complaint.status}
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


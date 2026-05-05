import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { MapPin, Tag, ChevronDown, BarChart2, X, Info, User, Calendar, Clock } from 'lucide-react';
import { Complaint } from '../types';

interface DistributionListProps {
  complaints: Complaint[];
}

export default function DistributionList({ complaints }: DistributionListProps) {
  const [viewBy, setViewBy] = useState<'area' | 'category'>('area');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<string | null>(null);

  const data = useMemo(() => {
    const counts: Record<string, number> = {};
    complaints.forEach(c => {
      const key = viewBy === 'area' ? (c.area || 'Unknown Area') : (c.category || 'Unknown Category');
      if (!counts[key]) counts[key] = 0;
      counts[key]++;
    });

    return Object.entries(counts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count); // sort descending by count
  }, [complaints, viewBy]);

  const total = complaints.length;

  return (
    <div className="h-full flex flex-col text-slate-900 dark:text-slate-100">
      <div className="flex-1 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm flex flex-col relative overflow-hidden">
        {/* Decorative background elements */}
        <div className="absolute -top-16 -right-16 w-64 h-64 bg-emerald-500/5 blur-[80px] rounded-full pointer-events-none" />
        <div className="absolute -bottom-16 -left-16 w-64 h-64 bg-blue-500/5 blur-[80px] rounded-full pointer-events-none" />

        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-4 relative z-20">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 shadow-lg shadow-emerald-500/20 flex items-center justify-center text-white">
              <BarChart2 size={20} />
            </div>
            <div>
              <h3 className="text-sm font-black uppercase tracking-widest text-slate-900 dark:text-white">Distribution Analysis</h3>
              <p className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest opacity-80">
                Breakdown by {viewBy === 'area' ? 'Deployment Zones' : 'Category'}
              </p>
            </div>
          </div>

          <div className="relative z-50">
            <button 
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              className="flex items-center gap-2 px-5 py-2.5 bg-slate-100/80 dark:bg-slate-800/80 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors shadow-sm"
            >
              {viewBy === 'area' ? 'Deployment Zones' : 'Category'}
              <ChevronDown size={14} className={`transition-transform duration-200 ${isDropdownOpen ? 'rotate-180' : ''}`} />
            </button>

            <AnimatePresence>
              {isDropdownOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="absolute right-0 top-full mt-2 w-48 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xl overflow-hidden backdrop-blur-xl"
                >
                  <button
                    onClick={() => { setViewBy('area'); setIsDropdownOpen(false); }}
                    className={`w-full flex items-center gap-3 px-4 py-3 text-[10px] font-black uppercase tracking-widest transition-colors ${viewBy === 'area' ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700'}`}
                  >
                    <MapPin size={14} />
                    Deployment Zones
                  </button>
                  <button
                    onClick={() => { setViewBy('category'); setIsDropdownOpen(false); }}
                    className={`w-full flex items-center gap-3 px-4 py-3 text-[10px] font-black uppercase tracking-widest transition-colors ${viewBy === 'category' ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700'}`}
                  >
                    <Tag size={14} />
                    Category
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto pr-2 space-y-3 relative z-10 custom-scrollbar">
          {data.length > 0 ? (
            data.map((item, idx) => (
              <motion.button 
                key={item.name}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.05 }}
                onClick={() => setSelectedItem(item.name)}
                className="w-full flex items-center justify-between p-4 rounded-xl bg-slate-50/80 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-700/50 hover:border-emerald-500/30 transition-colors group cursor-pointer"
              >
                <div className="flex items-center gap-4">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-[11px] font-black tracking-widest transition-transform group-hover:scale-105 ${
                    idx < 3 ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/20' : 'bg-slate-200 dark:bg-slate-700 text-slate-500'
                  }`}>
                    #{idx + 1}
                  </div>
                  <p className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-tight truncate max-w-[200px]">{item.name}</p>
                </div>
                <div className="flex items-center gap-6">
                  <div className="flex flex-col items-end">
                    <span className="text-base font-black text-slate-900 dark:text-white leading-none">{item.count}</span>
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                      {total > 0 ? Math.round((item.count / total) * 100) : 0}% Share
                    </span>
                  </div>
                  <div className="hidden sm:block w-20 h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden shadow-inner">
                    <div 
                      className="h-full bg-emerald-500 rounded-full relative" 
                      style={{ width: `${total > 0 ? (item.count / total) * 100 : 0}%` }}
                    >
                      <div className="absolute inset-0 bg-white/20" />
                    </div>
                  </div>
                </div>
              </motion.button>
            ))
          ) : (
            <div className="p-8 text-center flex flex-col items-center justify-center h-full">
               <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-4">
                 <BarChart2 size={24} className="text-slate-400 dark:text-slate-500" />
               </div>
               <p className="text-xs font-black text-slate-500 uppercase tracking-widest mb-1">No Data Available</p>
               <p className="text-[10px] text-slate-400 uppercase tracking-widest">Awaiting registry entries</p>
            </div>
          )}
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

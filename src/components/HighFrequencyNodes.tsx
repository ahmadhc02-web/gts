import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Flame, Users, Info, X, MapPin, Tag, Calendar, Clock, User } from 'lucide-react';
import { Complaint } from '../types';
import { calculateProtocolProgress } from '../utils/protocolProgress';

interface HighFrequencyNodesProps {
  complaints: Complaint[];
}

export default function HighFrequencyNodes({ complaints = [] }: HighFrequencyNodesProps) {
  const [highFreqRange, setHighFreqRange] = useState<'10days' | '30days' | 'all'>('all');
  const [expandedUser, setExpandedUser] = useState<string | null>(null);
  const [selectedComplaint, setSelectedComplaint] = useState<Complaint | null>(null);

  const { topUsers, highFreqTotal } = useMemo(() => {
    if (!complaints || complaints.length === 0) return { topUsers: [], highFreqTotal: 0 };
    
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

    const userCounts: Record<string, { count: number; area: string; username?: string }> = {};
    filteredComplaints.forEach(c => {
      const name = c.customerName || 'Unknown User';
      if (!userCounts[name]) {
        userCounts[name] = { count: 0, area: c.area, username: c.customerUsername };
      }
      userCounts[name].count++;
    });

    const sortedUsers = Object.entries(userCounts)
      .map(([name, stats]) => ({ name, ...stats }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return { topUsers: sortedUsers, highFreqTotal: filteredComplaints.length };
  }, [complaints, highFreqRange]);

  return (
    <div className="h-full flex flex-col space-y-6">
      <div className="flex-1 flex flex-col bg-white dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-[0_22px_48px_rgba(0,0,0,0.12),_0_8px_24px_rgba(245,158,11,0.08)] overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-500">
              <Flame size={20} />
            </div>
            <div>
              <h3 className="text-sm font-black uppercase tracking-widest text-slate-900 dark:text-white">Active Nodes</h3>
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

        <div className="flex-1 overflow-y-auto min-h-0 space-y-2 pr-2 custom-scrollbar">
          {topUsers.length > 0 ? (
            topUsers.map((user, idx) => (
              <div key={user.name + '-' + idx} className="space-y-2">
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
                      <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                        <p className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-tight">{user.name}</p>
                        {user.username && (
                          <span className="text-[8px] px-1.5 py-0.5 rounded-md font-mono bg-amber-500/10 text-amber-600 dark:text-amber-400 font-extrabold uppercase tracking-widest leading-none">
                            ID: {user.username}
                          </span>
                        )}
                      </div>
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
                          .map((complaint, cIdx) => (
                            <button 
                              key={`${complaint.id}-${cIdx}`} 
                              onClick={() => setSelectedComplaint(complaint)}
                              className="w-full text-left p-2.5 bg-white dark:bg-slate-900 rounded-lg border border-slate-100 dark:border-slate-800 shadow-sm flex items-center justify-between gap-3 hover:border-amber-500/30 transition-all active:scale-[0.98]"
                            >
                               <div className="flex-1 min-w-0">
                                  <p className="text-[10px] font-bold text-slate-900 dark:text-white truncate uppercase">{complaint.category}</p>
                                  <p className="text-[8px] font-medium text-slate-400 uppercase">{new Date(complaint.createdAt).toLocaleDateString()} {new Date(complaint.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                               </div>
                               <div className="flex flex-col items-end gap-1 shrink-0">
                                 <div className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest ${
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
              className="relative w-full max-w-2xl md:max-w-3xl bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden max-h-[92vh] flex flex-col"
            >
              <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-500">
                    <Info size={20} />
                  </div>
                  <div>
                    <h3 className="text-sm font-black uppercase tracking-widest text-slate-900 dark:text-white">Active Node Registry Report</h3>
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

              <div className="p-6 space-y-6 overflow-y-auto custom-scrollbar flex-1">
                {/* User profile & coordinates */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 border-b border-slate-100 dark:border-slate-800 pb-5">
                  <div className="space-y-1">
                    <p className="text-[8px] font-black uppercase tracking-widest text-slate-400">Customer Node</p>
                    <div className="flex items-center gap-2 text-slate-900 dark:text-white">
                      <User size={14} className="text-amber-500" />
                      <div className="flex flex-col">
                        <span className="text-xs font-black uppercase">{selectedComplaint.customerName}</span>
                        {selectedComplaint.customerUsername && (
                          <span className="text-[8px] font-mono font-extrabold text-slate-400 uppercase">ID: {selectedComplaint.customerUsername}</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[8px] font-black uppercase tracking-widest text-slate-400">Deployment Area</p>
                    <div className="flex items-center gap-2 text-slate-900 dark:text-white">
                      <MapPin size={14} className="text-amber-500" />
                      <span className="text-xs font-black uppercase">{selectedComplaint.area}</span>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[8px] font-black uppercase tracking-widest text-slate-400">Class Type & Urgency</p>
                    <div className="flex items-center gap-2 text-slate-900 dark:text-white">
                      <Tag size={14} className="text-amber-500" />
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-black uppercase">{selectedComplaint.category}</span>
                        <span className="text-[8px] font-extrabold px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 uppercase">{selectedComplaint.priority || 'Medium'}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Main operational sections including Operational Log, Team Resolution, and Customer Review */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  
                  {/* Core 1: Operational Log */}
                  <div className="flex flex-col bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800/80 p-4">
                    <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800/50 pb-2 mb-3">
                      <span className="text-[9px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">OPERATIONAL LOG</span>
                      <span className="text-[8px] font-mono bg-blue-500/10 text-blue-600 dark:text-blue-400 px-1 rounded uppercase font-bold">Issue Details</span>
                    </div>
                    <p className="text-xs text-slate-705 dark:text-slate-300 font-medium leading-relaxed italic min-h-[80px]">
                      "{selectedComplaint.description}"
                    </p>
                    <div className="mt-auto pt-3 border-t border-slate-100 dark:border-slate-800/50 flex flex-col gap-1">
                      <div className="flex justify-between text-[8px] font-bold text-slate-400">
                        <span>LOG CAPTAIN:</span>
                        <span className="text-slate-600 dark:text-slate-300">{selectedComplaint.memberName || 'SYSTEM'}</span>
                      </div>
                    </div>
                  </div>

                  {/* Core 2: Team Resolution Protocol */}
                  <div className="flex flex-col bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800/80 p-4">
                    <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800/50 pb-2 mb-3">
                      <span className="text-[9px] font-black uppercase tracking-widest text-emerald-500 dark:text-emerald-400">RESOLUTION PROTOCOL</span>
                      <span className="text-[8px] font-mono bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-1 rounded uppercase font-bold">Action Taken</span>
                    </div>
                    {selectedComplaint.status === 'in process' && (() => {
                      const prog = calculateProtocolProgress(selectedComplaint.remarks);
                      if (prog.percentage <= 0) return null;
                      return (
                        <div className="mb-3 p-2.5 bg-blue-500/5 border border-blue-500/10 rounded-xl space-y-1.5">
                          <div className="flex justify-between items-center text-[8px] font-black text-blue-500 dark:text-blue-400">
                            <span className="uppercase tracking-widest">RESOLUTION PROGRESS</span>
                            <span>{prog.percentage}%</span>
                          </div>
                          <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden border border-slate-200/40 dark:border-slate-700/40">
                            <div 
                              className="bg-blue-500 h-full rounded-full transition-all duration-300"
                              style={{ width: `${prog.percentage}%` }}
                            />
                          </div>
                          <p className="text-[7px] font-bold text-slate-500 uppercase">{prog.stepText}</p>
                        </div>
                      );
                    })()}
                    {selectedComplaint.remarks ? (
                      <p className="text-xs text-emerald-705 dark:text-emerald-400 font-semibold leading-relaxed italic min-h-[80px]">
                        "{selectedComplaint.remarks}"
                      </p>
                    ) : (
                      <div className="flex flex-col items-center justify-center min-h-[80px] text-center p-2 border border-dashed border-amber-500/20 rounded-xl bg-amber-500/[0.02]">
                        <p className="text-[9px] font-extrabold text-amber-500 dark:text-amber-400 uppercase">AWAITING TEAM PATCH</p>
                        <p className="text-[8px] font-bold text-slate-400 uppercase mt-1 leading-snug">No active technical resolution protocol registered yet.</p>
                      </div>
                    )}
                    <div className="mt-auto pt-3 border-t border-slate-100 dark:border-slate-800/50 flex flex-col gap-1">
                      <div className="flex justify-between text-[8px] font-bold text-slate-400">
                        <span>TEAM AUTHOR:</span>
                        <span className="text-slate-600 dark:text-slate-300">{selectedComplaint.remarkAuthorName || selectedComplaint.memberName || 'AWAITING DISPATCH'}</span>
                      </div>
                    </div>
                  </div>

                  {/* Core 3: Customer Review */}
                  <div className="flex flex-col bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800/80 p-4">
                    <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800/50 pb-2 mb-3">
                      <span className="text-[9px] font-black uppercase tracking-widest text-indigo-500 dark:text-indigo-400">CUSTOMER REVIEW</span>
                      <span className="text-[8px] font-mono bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 px-1 rounded uppercase font-bold">Feedback</span>
                    </div>
                    {selectedComplaint.customerReview ? (
                      <p className="text-xs text-indigo-705 dark:text-indigo-300 font-semibold leading-relaxed italic min-h-[80px]">
                        "{selectedComplaint.customerReview}"
                      </p>
                    ) : (
                      <div className="flex flex-col items-center justify-center min-h-[80px] text-center p-2 border border-dashed border-slate-300 dark:border-slate-700 rounded-xl">
                        <p className="text-[9px] font-extrabold text-slate-400 uppercase">NO FEEDBACK LOGGED</p>
                        <p className="text-[8px] font-bold text-slate-400 uppercase mt-1 leading-snug">Complete full dispatch protocol to trigger customer review telemetry.</p>
                      </div>
                    )}
                    <div className="mt-auto pt-3 border-t border-slate-100 dark:border-slate-800/50 flex flex-col gap-1">
                      <div className="flex justify-between text-[8px] font-bold text-slate-400">
                        <span>REVIEW TELEMETRY:</span>
                        <span className="text-slate-600 dark:text-slate-300">{selectedComplaint.customerReview ? 'SUCCESS' : 'PENDING'}</span>
                      </div>
                    </div>
                  </div>

                </div>

                {/* Technical diagnostics logs */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <p className="text-[8px] font-black uppercase tracking-widest text-slate-400">Hardware Interface / Panel Details</p>
                    <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800">
                      <p className="text-xs font-mono font-bold text-slate-700 dark:text-slate-300">
                        {selectedComplaint.panelDetails || "NO HARDWARE PANEL SPECIFIED FOR THIS ACTIVE NODE REGISTRY ENTRY."}
                      </p>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[8px] font-black uppercase tracking-widest text-slate-400">Broadband Subscription / Speed Details</p>
                    <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800">
                      <p className="text-xs font-mono font-bold text-slate-700 dark:text-slate-300">
                        {selectedComplaint.pkgDetails || "NO SPEED PROFILE SPECIFIED FOR THIS ACTIVE NODE REGISTRY ENTRY."}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Timestamps */}
                <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-slate-800 shrink-0">
                  <div className="flex items-center gap-2 text-slate-400">
                    <Calendar size={12} />
                    <span className="text-[9px] font-black uppercase tracking-widest">
                      LOG DATE: {new Date(selectedComplaint.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-400">
                    <Clock size={12} />
                    <span className="text-[9px] font-black uppercase tracking-widest">
                      LOG TIME: {new Date(selectedComplaint.createdAt).toLocaleTimeString()}
                    </span>
                  </div>
                </div>
              </div>

              <div className="p-6 bg-slate-50 dark:bg-slate-800/50 flex justify-end shrink-0 gap-3">
                <button 
                  onClick={() => setSelectedComplaint(null)}
                  className="px-6 py-2.5 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-xl text-[10px] font-black uppercase tracking-widest hover:scale-105 transition-transform"
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

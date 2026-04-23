import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Trash2, Clock, CheckCircle, AlertCircle, PlayCircle, Printer, FileDown, Calendar } from 'lucide-react';
import { Complaint, ComplaintStatus } from '../types';
import { cn } from '../lib/utils';

interface ComplaintListProps {
  complaints: Complaint[];
  onDelete?: (id: string) => Promise<void>;
  onStatusChange?: (id: string, status: ComplaintStatus) => Promise<void>;
  isAdmin?: boolean;
}

export default function ComplaintList({ complaints, onDelete, onStatusChange, isAdmin }: ComplaintListProps) {
  const [startDate, setStartDate] = React.useState('');
  const [endDate, setEndDate] = React.useState('');

  const getStatusColor = (status: ComplaintStatus) => {
    switch (status) {
      case 'complete': return 'bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 dark:border-emerald-500/30';
      case 'in process': return 'bg-amber-500/10 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 border-amber-500/20 dark:border-amber-500/30';
      case 'important': return 'bg-violet-500/10 dark:bg-violet-500/20 text-violet-600 dark:text-violet-400 border-violet-500/20 dark:border-violet-500/30';
      case 'pending': default: return 'bg-red-500/10 dark:bg-red-500/20 text-red-600 dark:text-red-400 border-red-500/20 dark:border-red-500/30';
    }
  };

  const getStatusIcon = (status: ComplaintStatus) => {
    switch (status) {
      case 'complete': return <CheckCircle size={14} />;
      case 'in process': return <PlayCircle size={14} />;
      case 'important': return <AlertCircle size={14} />;
      case 'pending': default: return <Clock size={14} />;
    }
  };

  const exportToPDF = () => {
    let filtered = [...complaints];
    
    if (startDate) {
      const start = new Date(startDate).setHours(0, 0, 0, 0);
      filtered = filtered.filter(c => c.createdAt >= start);
    }
    if (endDate) {
      const end = new Date(endDate).setHours(23, 59, 59, 999);
      filtered = filtered.filter(c => c.createdAt <= end);
    }

    if (filtered.length === 0) {
      alert('No complaints found for the selected date range.');
      return;
    }

    const doc = new jsPDF();
    
    // Add Brand Header
    doc.setFontSize(22);
    doc.setTextColor(37, 99, 235); // Blue-600
    doc.text('GTS ISP Management', 14, 22);
    
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text('Proprietor: Yaseen Tahir', 14, 30);
    doc.text(`Export Date: ${new Date().toLocaleString()}`, 14, 35);
    if (startDate || endDate) {
      doc.text(`Report Period: ${startDate || 'Beginning'} to ${endDate || 'Today'}`, 14, 40);
    }
    
    // Table content
    const tableRows = filtered.map(c => [
      c.customerName,
      c.area,
      c.number,
      c.status.toUpperCase(),
      c.description,
      new Date(c.createdAt).toLocaleDateString()
    ]);

    autoTable(doc, {
      startY: startDate || endDate ? 48 : 45,
      head: [['Customer', 'Area', 'Phone', 'Status', 'Description', 'Date']],
      body: tableRows,
      theme: 'grid',
      headStyles: { fillColor: [37, 99, 235] },
    });

    doc.save(`GTS_Complaints_${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <h3 className="text-xl font-bold flex items-center gap-2 text-slate-900 dark:text-white">
          Complaints Registry
          <span className="text-xs font-normal px-2 py-1 bg-slate-100 dark:bg-white/10 rounded-full border border-slate-200 dark:border-white/20 text-slate-500 dark:text-white/80">
            {complaints.length} Total
          </span>
        </h3>
        
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl glass border border-slate-200 dark:border-white/10">
            <Calendar size={14} className="text-slate-400 dark:text-white" />
            <input 
              type="date" 
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="bg-transparent border-none text-xs focus:outline-none text-slate-600 dark:text-white"
              placeholder="Start"
            />
            <span className="text-slate-300 dark:text-white/20">|</span>
            <input 
              type="date" 
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="bg-transparent border-none text-xs focus:outline-none text-slate-600 dark:text-white"
              placeholder="End"
            />
          </div>

          {complaints.length > 0 && (
            <button
              onClick={exportToPDF}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 transition-all text-sm font-bold text-white shadow-lg shadow-blue-500/20"
            >
              <FileDown size={16} />
              Export PDF
            </button>
          )}
        </div>
      </div>

      {complaints.length === 0 ? (
        <div className="text-center py-20 glass rounded-2xl border-2 border-dashed border-slate-200 dark:border-white/5">
          <Clock size={48} className="mx-auto text-slate-300 dark:text-white/20 mb-4" />
          <p className="text-slate-500 dark:text-white/60">No complaints found. Everything looks clean!</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <AnimatePresence mode="popLayout">
            {complaints.map((complaint) => (
              <motion.div
                key={complaint.id}
                layout
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="group relative glass rounded-2xl p-5 shadow-2xl border border-slate-200 dark:border-white/10 hover:border-slate-300 dark:hover:border-white/20 transition-all"
              >
                <div className="flex justify-between items-start mb-4">
                  <div className={cn(
                    "flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border",
                    getStatusColor(complaint.status)
                  )}>
                    {getStatusIcon(complaint.status)}
                    {complaint.status}
                  </div>
                  
                  {isAdmin && onDelete && (
                    <button
                      onClick={async (e) => {
                        e.stopPropagation();
                        try {
                          await onDelete(complaint.id);
                        } catch (err) {
                          alert('Failed to delete complaint');
                        }
                      }}
                      className="p-2.5 text-red-500 bg-red-500/10 dark:bg-red-500/20 rounded-xl transition-all shadow-lg shadow-red-500/10 hover:bg-red-500 hover:text-white"
                      title="Delete Complaint"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>

                <h4 className="font-bold text-lg leading-tight mb-1 text-slate-900 dark:text-white">{complaint.customerName}</h4>
                <p className="text-sm text-slate-500 dark:text-white/60 mb-4 flex items-center gap-1">
                  Area: <span className="text-blue-600 dark:text-blue-400 font-medium">{complaint.area}</span>
                </p>

                <div className="space-y-3 mb-4">
                  <div className="text-sm bg-slate-50 dark:bg-black/40 p-3 rounded-xl border border-slate-100 dark:border-white/10 min-h-[60px] text-slate-700 dark:text-white">
                    {complaint.description}
                  </div>
                  <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-white/70">
                    <Printer size={14} className="text-slate-400 dark:text-white/40" />
                    <span>Contact: {complaint.number}</span>
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-100 dark:border-white/10 flex justify-between items-center text-[10px] text-slate-400 dark:text-white/50 uppercase font-bold tracking-widest">
                  <span>By: {complaint.memberName || 'System'}</span>
                  <span>{new Date(complaint.createdAt).toLocaleDateString()}</span>
                </div>

                {isAdmin && onStatusChange && (
                  <div className="mt-4 pt-4 border-t border-slate-100 dark:border-white/5">
                    <p className="text-[10px] font-bold text-slate-400 dark:text-white/50 uppercase mb-2 tracking-tighter">Update Status</p>
                    <div className="flex flex-wrap gap-2">
                      {(['pending', 'in process', 'complete', 'important'] as ComplaintStatus[]).map((s) => (
                        <button
                          key={s}
                          onClick={() => onStatusChange(complaint.id, s)}
                          className={cn(
                            "px-2 py-1 rounded-md text-[10px] font-bold transition-all border",
                            complaint.status === s 
                              ? "bg-blue-600 dark:bg-blue-500 text-white border-blue-600 dark:border-blue-500" 
                              : "bg-slate-100 dark:bg-white/5 text-slate-500 dark:text-white/60 border-slate-200 dark:border-white/10 hover:border-slate-300 dark:hover:border-white/20 hover:text-slate-700 dark:hover:text-white"
                          )}
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}

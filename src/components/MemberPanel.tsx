import { motion } from 'motion/react';
import { Complaint, ComplaintStatus } from '../types';
import ComplaintForm from './ComplaintForm';
import ComplaintList from './ComplaintList';

interface MemberPanelProps {
  complaints: Complaint[];
  onRegisterComplaint: (data: {
    customerName: string;
    area: string;
    description: string;
    number: string;
    status: ComplaintStatus;
  }) => Promise<void>;
  isLoading: boolean;
}

export default function MemberPanel({
  complaints,
  onRegisterComplaint,
  isLoading
}: MemberPanelProps) {
  return (
    <div className="space-y-12">
      {/* Member Statistics Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="glass p-5 rounded-2xl border border-slate-200 dark:border-white/10 shadow-xl">
          <p className="text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-white/60 mb-1">My Total</p>
          <p className="text-3xl font-black text-blue-600 dark:text-blue-400">{complaints.length}</p>
        </div>
        <div className="glass p-5 rounded-2xl border border-slate-200 dark:border-white/10 shadow-xl">
          <p className="text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-white/60 mb-1">My Pending</p>
          <p className="text-3xl font-black text-red-500">{complaints.filter(c => c.status === 'pending').length}</p>
        </div>
        <div className="glass p-5 rounded-2xl border border-slate-200 dark:border-white/10 shadow-xl">
          <p className="text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-white/60 mb-1">In Process</p>
          <p className="text-3xl font-black text-amber-500">{complaints.filter(c => c.status === 'in process').length}</p>
        </div>
        <div className="glass p-5 rounded-2xl border border-slate-200 dark:border-white/10 shadow-xl">
          <p className="text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-white/60 mb-1">Completed</p>
          <p className="text-3xl font-black text-emerald-500">{complaints.filter(c => c.status === 'complete').length}</p>
        </div>
      </div>

      <section>
        <div className="mb-6">
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Active Operations</h2>
          <p className="text-slate-500 dark:text-white/60">Register and monitor customer complaints in real-time.</p>
        </div>
        
        <div className="max-w-4xl">
          <ComplaintForm onSubmit={onRegisterComplaint} isLoading={isLoading} />
        </div>
      </section>

      <section className="pt-8 border-t border-slate-200 dark:border-white/10">
        <ComplaintList 
          complaints={complaints}
          isAdmin={false}
        />
      </section>
    </div>
  );
}

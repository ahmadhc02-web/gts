import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Send, User, MapPin, FileText, Phone, Info } from 'lucide-react';
import { ComplaintStatus } from '../types';
import { cn } from '../lib/utils';

interface ComplaintFormProps {
  onSubmit: (data: {
    customerName: string;
    area: string;
    description: string;
    number: string;
    status: ComplaintStatus;
  }) => Promise<void>;
  isLoading: boolean;
}

export default function ComplaintForm({ onSubmit, isLoading }: ComplaintFormProps) {
  const [customerName, setCustomerName] = useState('');
  const [area, setArea] = useState('');
  const [description, setDescription] = useState('');
  const [number, setNumber] = useState('');
  const [status, setStatus] = useState<ComplaintStatus>('pending');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSubmit({ customerName, area, description, number, status });
    // Reset form
    setCustomerName('');
    setArea('');
    setDescription('');
    setNumber('');
    setStatus('pending');
  };

  const inputClasses = "w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-black/20 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all placeholder:text-slate-400 dark:placeholder:text-white/50";
  const labelClasses = "block text-sm font-bold mb-1.5 ml-1 text-slate-600 dark:text-white uppercase tracking-wide text-[11px]";

  return (
    <div className="glass rounded-2xl p-6 shadow-2xl border border-slate-200 dark:border-white/10">
      <h3 className="text-xl font-bold mb-6 flex items-center gap-2 text-slate-900 dark:text-white">
        <Send size={20} className="text-blue-500 dark:text-blue-400" />
        Register New Complaint
      </h3>

      <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-4">
          <div>
            <label className={labelClasses}>Customer Name</label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-white/40" size={18} />
              <input
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Name of user"
                className={inputClasses}
                required
              />
            </div>
          </div>

          <div>
            <label className={labelClasses}>Area / Location</label>
            <div className="relative">
              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-white/40" size={18} />
              <input
                type="text"
                value={area}
                onChange={(e) => setArea(e.target.value)}
                placeholder="Area name"
                className={inputClasses}
                required
              />
            </div>
          </div>

          <div>
            <label className={labelClasses}>Contact Number</label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-white/40" size={18} />
              <input
                type="tel"
                value={number}
                onChange={(e) => setNumber(e.target.value)}
                placeholder="Phone number"
                className={inputClasses}
                required
              />
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className={labelClasses}>Priority / Status</label>
            <div className="relative">
              <Info className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-white/40" size={18} />
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as ComplaintStatus)}
                className={cn(inputClasses, "appearance-none")}
              >
                <option value="pending" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">Pending</option>
                <option value="in process" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">In Process</option>
                <option value="complete" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">Complete</option>
                <option value="important" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">Important</option>
              </select>
            </div>
          </div>

          <div>
            <label className={labelClasses}>Description</label>
            <div className="relative">
              <FileText className="absolute left-3 top-3 text-slate-400 dark:text-white/40" size={18} />
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Details of the problem..."
                rows={4}
                className={cn(inputClasses, "resize-none h-30")}
                required
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold shadow-lg shadow-blue-500/25 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isLoading ? 'Registering...' : 'Submit Complaint'}
          </button>
        </div>
      </form>
    </div>
  );
}

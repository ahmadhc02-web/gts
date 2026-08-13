import React, { useState, useEffect } from 'react';
import { Save, CheckCircle, MessageSquare } from 'lucide-react';
import { getTemplate, saveTemplate } from './whatsappApi';
import { toast } from 'sonner';

export default function WhatsAppMessageTemplateBox() {
  const [template, setTemplate] = useState('');
  const [complaintRegisteredTemplate, setComplaintRegisteredTemplate] = useState('');
  const [complaintCompletedTemplate, setComplaintCompletedTemplate] = useState('');
  const [completedStatusValue, setCompletedStatusValue] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isSaved, setIsSaved] = useState(false);

  useEffect(() => {
    getTemplate()
      .then(data => {
        setTemplate(data.template);
        setComplaintRegisteredTemplate(data.complaintRegisteredTemplate || '');
        setComplaintCompletedTemplate(data.complaintCompletedTemplate || '');
        setCompletedStatusValue(data.completedStatusValue || '');
      })
      .catch(err => console.error('Error fetching template', err));
  }, []);

  const handleSave = async () => {
    setIsSaving(true);
    setIsSaved(false);
    try {
      await saveTemplate({ 
        template,
        complaintRegisteredTemplate,
        complaintCompletedTemplate,
        completedStatusValue
      });
      setIsSaved(true);
      toast.success('Template saved successfully!');
      setTimeout(() => setIsSaved(false), 3000);
    } catch (error: any) {
      toast.error(error.message || 'Failed to save template');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="relative w-full bg-white dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 overflow-hidden flex flex-col text-left">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-500 shrink-0">
          <MessageSquare size={20} className="fill-indigo-500/20" />
        </div>
        <div>
          <h2 className="text-sm font-black tracking-wider text-slate-900 dark:text-white uppercase">Message Template Designer</h2>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Configure dynamic placeholder substitutions</p>
        </div>
      </div>

      <div className="space-y-6">
        {/* Billing Reminder Template */}
        <div className="space-y-4">
          <h3 className="text-xs font-black uppercase text-slate-500 tracking-wider">Billing Reminder Message</h3>
          <textarea
            value={template}
            onChange={(e) => setTemplate(e.target.value)}
            className="w-full h-24 bg-slate-50/50 dark:bg-slate-950/20 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 text-xs font-semibold text-slate-700 dark:text-slate-200 focus:ring-2 focus:ring-emerald-500/30 outline-none resize-none transition-all"
            placeholder="Type your billing reminder template here..."
          />
          <div className="bg-slate-50/50 dark:bg-slate-950/20 rounded-2xl border border-slate-100 dark:border-slate-900 p-4 space-y-2">
            <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Dynamic Placeholders:</span>
            <div className="flex flex-wrap gap-1.5 pt-1">
              {['{{name}}', '{{amount}}', '{{username}}', '{{status}}', '{{area}}'].map(tag => (
                <span key={tag} className="px-2 py-1 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-lg text-[10px] font-mono tracking-tight font-black">
                  {tag}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Complaint Registered Template */}
        <div className="space-y-4 pt-4 border-t border-slate-100 dark:border-slate-800">
          <h3 className="text-xs font-black uppercase text-slate-500 tracking-wider">Complaint Registered Message</h3>
          <textarea
            value={complaintRegisteredTemplate}
            onChange={(e) => setComplaintRegisteredTemplate(e.target.value)}
            className="w-full h-24 bg-slate-50/50 dark:bg-slate-950/20 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 text-xs font-semibold text-slate-700 dark:text-slate-200 focus:ring-2 focus:ring-emerald-500/30 outline-none resize-none transition-all"
            placeholder="Type your complaint registered template here..."
          />
          <div className="bg-slate-50/50 dark:bg-slate-950/20 rounded-2xl border border-slate-100 dark:border-slate-900 p-4 space-y-2">
            <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Dynamic Placeholders:</span>
            <div className="flex flex-wrap gap-1.5 pt-1">
              {['{{name}}', '{{complaintId}}', '{{category}}', '{{area}}', '{{description}}'].map(tag => (
                <span key={tag} className="px-2 py-1 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-lg text-[10px] font-mono tracking-tight font-black">
                  {tag}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Complaint Completed Template */}
        <div className="space-y-4 pt-4 border-t border-slate-100 dark:border-slate-800">
          <h3 className="text-xs font-black uppercase text-slate-500 tracking-wider">Complaint Completed Message</h3>
          
          <div className="flex flex-col gap-2 pb-2">
            <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Status value that means 'Completed':</label>
            <input
              type="text"
              value={completedStatusValue}
              onChange={(e) => setCompletedStatusValue(e.target.value)}
              placeholder="e.g., Resolved (must match Complaint Status settings)"
              className="w-full bg-slate-50/50 dark:bg-slate-950/20 border border-slate-200 dark:border-slate-800 rounded-xl p-3 text-xs font-semibold text-slate-700 dark:text-slate-200 focus:ring-2 focus:ring-emerald-500/30 outline-none transition-all"
            />
          </div>

          <textarea
            value={complaintCompletedTemplate}
            onChange={(e) => setComplaintCompletedTemplate(e.target.value)}
            className="w-full h-24 bg-slate-50/50 dark:bg-slate-950/20 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 text-xs font-semibold text-slate-700 dark:text-slate-200 focus:ring-2 focus:ring-emerald-500/30 outline-none resize-none transition-all"
            placeholder="Type your complaint completed template here..."
          />
          <div className="bg-slate-50/50 dark:bg-slate-950/20 rounded-2xl border border-slate-100 dark:border-slate-900 p-4 space-y-2">
            <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Dynamic Placeholders:</span>
            <div className="flex flex-wrap gap-1.5 pt-1">
              {['{{name}}', '{{complaintId}}'].map(tag => (
                <span key={tag} className="px-2 py-1 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-lg text-[10px] font-mono tracking-tight font-black">
                  {tag}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-xs font-black uppercase tracking-widest transition-colors disabled:opacity-50 cursor-pointer shadow-md shadow-emerald-500/10"
          >
            {isSaved ? <CheckCircle size={14} /> : <Save size={14} />}
            {isSaving ? 'Saving...' : isSaved ? 'Saved' : 'Save Template'}
          </button>
        </div>
      </div>
    </div>
  );
}

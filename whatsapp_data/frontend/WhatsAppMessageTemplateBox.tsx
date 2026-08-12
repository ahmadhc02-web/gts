import React, { useState, useEffect } from 'react';
import { Save, CheckCircle } from 'lucide-react';
import { getTemplate, saveTemplate } from './whatsappApi';
import { toast } from 'sonner';

export default function WhatsAppMessageTemplateBox() {
  const [template, setTemplate] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isSaved, setIsSaved] = useState(false);

  useEffect(() => {
    getTemplate()
      .then(data => setTemplate(data.template))
      .catch(err => console.error('Error fetching template', err));
  }, []);

  const handleSave = async () => {
    setIsSaving(true);
    setIsSaved(false);
    try {
      await saveTemplate(template);
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
    <div className="mt-6 border-t border-slate-200 dark:border-slate-700/50 pt-6">
      <h3 className="text-sm font-black uppercase text-slate-800 dark:text-slate-200 tracking-wider mb-3">
        Message Template
      </h3>
      <textarea
        value={template}
        onChange={(e) => setTemplate(e.target.value)}
        className="w-full h-28 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-xl p-3 text-sm font-medium text-slate-700 dark:text-slate-300 focus:ring-2 focus:ring-emerald-500/50 outline-none resize-none transition-all"
        placeholder="Type your message template here..."
      />
      <div className="flex flex-wrap items-center gap-2 mt-3">
        <span className="text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400">Placeholders:</span>
        {['{{name}}', '{{amount}}', '{{username}}', '{{status}}', '{{area}}'].map(tag => (
          <span key={tag} className="px-2 py-1 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-md text-[10px] font-mono tracking-tight font-bold">
            {tag}
          </span>
        ))}
      </div>
      <div className="mt-4 flex justify-end">
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-xs font-black uppercase tracking-widest transition-colors disabled:opacity-50"
        >
          {isSaved ? <CheckCircle size={14} /> : <Save size={14} />}
          {isSaving ? 'Saving...' : isSaved ? 'Saved' : 'Save Template'}
        </button>
      </div>
    </div>
  );
}

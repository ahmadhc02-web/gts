import React, { useState, useEffect, useRef } from 'react';
import { 
  Save, 
  CheckCircle, 
  MessageSquare, 
  AlertTriangle, 
  Sparkles, 
  RotateCcw, 
  Copy, 
  Check, 
  CheckCheck,
  Send,
  HelpCircle,
  Eye,
  Settings2,
  FileText
} from 'lucide-react';
import { getTemplate, saveTemplate } from './whatsappApi';
import { supabaseService } from '../lib/supabaseService';
import { toast } from 'sonner';

interface WhatsAppMessageTemplateBoxProps {
  statuses?: string[];
}

type TemplateTab = 'billing' | 'registered' | 'completed';

const SAMPLE_CLIENT_DATA: Record<string, string> = {
  '{{name}}': 'Ali Khan',
  '{{amount}}': '2,500',
  '{{username}}': 'ali.gts01',
  '{{status}}': 'UNPAID',
  '{{area}}': 'Gulshan Block 4',
  '{{complaintId}}': 'CMP-8942',
  '{{category}}': 'Fiber Cut / Red Light',
  '{{description}}': 'No Internet connectivity since morning'
};

const DEFAULT_TEMPLATES = {
  billing: 'Dear {{name}}, this is a reminder that your internet bill of Rs. {{amount}} is due. Please clear it at your earliest convenience. Thank you.',
  registered: 'Dear {{name}}, your complaint (#{{complaintId}}) regarding "{{category}}" has been registered. Our team will contact you soon. Thank you for your patience.',
  completed: 'Dear {{name}}, your complaint (#{{complaintId}}) has been resolved. Thank you for choosing us. Please contact us if the issue persists.',
  statusValue: 'Resolved'
};

export default function WhatsAppMessageTemplateBox({ statuses: propsStatuses }: WhatsAppMessageTemplateBoxProps = {}) {
  const [activeTab, setActiveTab] = useState<TemplateTab>('billing');
  const [template, setTemplate] = useState(DEFAULT_TEMPLATES.billing);
  const [complaintRegisteredTemplate, setComplaintRegisteredTemplate] = useState(DEFAULT_TEMPLATES.registered);
  const [complaintCompletedTemplate, setComplaintCompletedTemplate] = useState(DEFAULT_TEMPLATES.completed);
  const [completedStatusValue, setCompletedStatusValue] = useState(DEFAULT_TEMPLATES.statusValue);
  
  const [configuredStatuses, setConfiguredStatuses] = useState<string[]>(propsStatuses || []);
  const [isStatusesLoading, setIsStatusesLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [copiedPreview, setCopiedPreview] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (propsStatuses && propsStatuses.length > 0) {
      setConfiguredStatuses(propsStatuses);
      setIsStatusesLoading(false);
      return;
    }

    supabaseService.getStatuses()
      .then(statuses => {
        if (statuses && statuses.length > 0) {
          setConfiguredStatuses(statuses);
        }
      })
      .catch(err => {
        console.warn('Failed to load statuses in WhatsAppMessageTemplateBox', err);
      })
      .finally(() => {
        setIsStatusesLoading(false);
      });
  }, [propsStatuses]);

  useEffect(() => {
    getTemplate()
      .then(data => {
        if (data) {
          setTemplate(data.template || DEFAULT_TEMPLATES.billing);
          setComplaintRegisteredTemplate(data.complaintRegisteredTemplate || DEFAULT_TEMPLATES.registered);
          setComplaintCompletedTemplate(data.complaintCompletedTemplate || DEFAULT_TEMPLATES.completed);
          setCompletedStatusValue(data.completedStatusValue || DEFAULT_TEMPLATES.statusValue);
        }
      })
      .catch((err) => {
        console.warn('Template load notice:', err);
      });
  }, []);

  const handleSave = async () => {
    setIsSaving(true);
    setIsSaved(false);
    try {
      const res = await saveTemplate({ 
        template,
        complaintRegisteredTemplate,
        complaintCompletedTemplate,
        completedStatusValue
      });
      setIsSaved(true);
      toast.success('Message templates saved successfully!');
      setTimeout(() => setIsSaved(false), 3000);
    } catch (error: any) {
      toast.error(error.message || 'Failed to save template');
    } finally {
      setIsSaving(false);
    }
  };

  const currentText = activeTab === 'billing' 
    ? template 
    : activeTab === 'registered' 
      ? complaintRegisteredTemplate 
      : complaintCompletedTemplate;

  const setCurrentText = (val: string) => {
    if (activeTab === 'billing') setTemplate(val);
    else if (activeTab === 'registered') setComplaintRegisteredTemplate(val);
    else setComplaintCompletedTemplate(val);
  };

  // Insert tag at cursor position inside the textarea
  const insertTag = (tag: string) => {
    if (!textareaRef.current) {
      setCurrentText(currentText + ' ' + tag);
      return;
    }
    const elem = textareaRef.current;
    const start = elem.selectionStart ?? currentText.length;
    const end = elem.selectionEnd ?? currentText.length;
    const newText = currentText.substring(0, start) + tag + currentText.substring(end);
    setCurrentText(newText);
    setTimeout(() => {
      elem.focus();
      elem.setSelectionRange(start + tag.length, start + tag.length);
    }, 50);
  };

  const handleResetToDefault = () => {
    if (activeTab === 'billing') {
      setTemplate(DEFAULT_TEMPLATES.billing);
    } else if (activeTab === 'registered') {
      setComplaintRegisteredTemplate(DEFAULT_TEMPLATES.registered);
    } else {
      setComplaintCompletedTemplate(DEFAULT_TEMPLATES.completed);
    }
    toast.info('Reset to default template copy');
  };

  // Generate simulated preview with sample data
  const generateSimulatedPreview = (raw: string) => {
    let text = raw || '';
    Object.entries(SAMPLE_CLIENT_DATA).forEach(([placeholder, sampleVal]) => {
      text = text.replaceAll(placeholder, sampleVal);
    });
    return text;
  };

  const copySimulatedPreview = () => {
    navigator.clipboard.writeText(generateSimulatedPreview(currentText));
    setCopiedPreview(true);
    toast.success('Sample preview copied to clipboard');
    setTimeout(() => setCopiedPreview(false), 2000);
  };

  const matchedStatus = configuredStatuses.find(
    s => s.toLowerCase() === (completedStatusValue || '').trim().toLowerCase()
  );
  const isValueInStatuses = Boolean(matchedStatus);
  const selectValue = matchedStatus ? matchedStatus : completedStatusValue;

  const currentPlaceholders = activeTab === 'billing'
    ? ['{{name}}', '{{amount}}', '{{username}}', '{{status}}', '{{area}}']
    : activeTab === 'registered'
      ? ['{{name}}', '{{complaintId}}', '{{category}}', '{{area}}', '{{description}}']
      : ['{{name}}', '{{complaintId}}'];

  return (
    <div className="w-full bg-white dark:bg-slate-900/90 border border-slate-200/90 dark:border-slate-800 rounded-3xl shadow-xl shadow-slate-200/50 dark:shadow-none overflow-hidden flex flex-col transition-all duration-300">
      
      {/* Top Header Bar */}
      <div className="px-6 py-4.5 bg-gradient-to-r from-slate-50 via-white to-slate-50 dark:from-slate-900 dark:via-slate-850 dark:to-slate-900 border-b border-slate-200/80 dark:border-slate-800 flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-2xl bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border border-indigo-500/30 flex items-center justify-center shrink-0 shadow-sm">
            <MessageSquare size={20} className="text-indigo-500" />
          </div>
          <div>
            <h2 className="text-sm font-black tracking-wider text-slate-900 dark:text-white uppercase font-mono">
              WhatsApp Message Template Studio
            </h2>
            <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
              Customize dynamic notifications and auto-response formats
            </p>
          </div>
        </div>

        {/* Action Save Button */}
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-500 hover:bg-emerald-600 active:scale-98 text-white rounded-xl text-xs font-black uppercase tracking-widest transition-all disabled:opacity-50 cursor-pointer shadow-md shadow-emerald-500/20"
        >
          {isSaved ? <CheckCircle size={15} /> : isSaving ? <Sparkles size={15} className="animate-spin" /> : <Save size={15} />}
          <span>{isSaving ? 'Saving...' : isSaved ? 'Saved!' : 'Save Templates'}</span>
        </button>
      </div>

      {/* Landscape Segmented Tabs Control */}
      <div className="px-6 pt-4 pb-2 border-b border-slate-100 dark:border-slate-800/80 bg-slate-50/40 dark:bg-slate-950/20 flex items-center gap-2 overflow-x-auto">
        <button
          onClick={() => setActiveTab('billing')}
          className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer shrink-0 flex items-center gap-2 ${
            activeTab === 'billing'
              ? 'bg-white dark:bg-slate-800 text-emerald-600 dark:text-emerald-400 shadow-sm border border-slate-200/80 dark:border-slate-700'
              : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
          }`}
        >
          <span>💳</span>
          <span>1. Billing Reminder</span>
        </button>

        <button
          onClick={() => setActiveTab('registered')}
          className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer shrink-0 flex items-center gap-2 ${
            activeTab === 'registered'
              ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-sm border border-slate-200/80 dark:border-slate-700'
              : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
          }`}
        >
          <span>📋</span>
          <span>2. Complaint Registered</span>
        </button>

        <button
          onClick={() => setActiveTab('completed')}
          className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer shrink-0 flex items-center gap-2 ${
            activeTab === 'completed'
              ? 'bg-white dark:bg-slate-800 text-purple-600 dark:text-purple-400 shadow-sm border border-slate-200/80 dark:border-slate-700'
              : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
          }`}
        >
          <span>✅</span>
          <span>3. Complaint Resolved</span>
        </button>
      </div>

      {/* Main Landscape Split Content Frame */}
      <div className="p-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
          
          {/* LEFT COLUMN: Template Editor (7 Cols) */}
          <div className="lg:col-span-7 flex flex-col justify-between space-y-4">
            
            <div className="space-y-3">
              {/* Category Info & Reset Action */}
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  <span className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">
                    {activeTab === 'billing' && 'Billing Due Reminder'}
                    {activeTab === 'registered' && 'Complaint Ticket Registration'}
                    {activeTab === 'completed' && 'Complaint Resolution Message'}
                  </span>
                </div>
                <button
                  onClick={handleResetToDefault}
                  className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors cursor-pointer"
                  title="Reset this template to original default"
                >
                  <RotateCcw size={12} /> Reset to Default
                </button>
              </div>

              {/* Specific Configuration for Complaint Completed */}
              {activeTab === 'completed' && (
                <div className="p-3.5 bg-slate-50 dark:bg-slate-950/40 rounded-2xl border border-slate-200/80 dark:border-slate-800 space-y-2">
                  <label className="text-[10px] font-black uppercase text-slate-500 dark:text-slate-400 tracking-wider flex items-center gap-1.5">
                    <Settings2 size={13} className="text-purple-500" />
                    <span>Status value that triggers 'Resolved' message:</span>
                  </label>
                  <select
                    value={selectValue}
                    onChange={(e) => setCompletedStatusValue(e.target.value)}
                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-xs font-semibold text-slate-700 dark:text-slate-200 focus:ring-2 focus:ring-purple-500/30 outline-none transition-all cursor-pointer"
                  >
                    {!completedStatusValue && (
                      <option value="" disabled>
                        -- Select a Completed Status --
                      </option>
                    )}
                    {completedStatusValue && !isValueInStatuses && (
                      <option value={completedStatusValue}>
                        {completedStatusValue} (Current)
                      </option>
                    )}
                    {configuredStatuses.map((st) => (
                      <option key={st} value={st}>
                        {st}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Textarea Editor Frame */}
              <div className="relative">
                <textarea
                  ref={textareaRef}
                  value={currentText}
                  onChange={(e) => setCurrentText(e.target.value)}
                  rows={5}
                  className="w-full bg-slate-50/70 dark:bg-slate-950/40 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 text-xs font-semibold text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500/50 outline-none resize-none transition-all leading-relaxed shadow-inner"
                  placeholder="Type your message template here..."
                />
                <div className="absolute bottom-3 right-3 text-[10px] font-mono text-slate-400 bg-white/80 dark:bg-slate-900/80 px-2 py-0.5 rounded-md border border-slate-200 dark:border-slate-800 backdrop-blur-xs">
                  {currentText.length} chars
                </div>
              </div>

              {/* Clickable Variable Pills Card */}
              <div className="p-3.5 bg-slate-50/80 dark:bg-slate-950/30 rounded-2xl border border-slate-200/70 dark:border-slate-800/80 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">
                    Click to Insert Dynamic Placeholders:
                  </span>
                  <span className="text-[9px] font-bold text-slate-400">Inserts at cursor</span>
                </div>
                <div className="flex flex-wrap gap-2 pt-1">
                  {currentPlaceholders.map(tag => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => insertTag(tag)}
                      className="px-2.5 py-1.5 bg-white hover:bg-emerald-50 dark:bg-slate-900 dark:hover:bg-emerald-950/40 text-slate-700 hover:text-emerald-700 dark:text-slate-300 dark:hover:text-emerald-300 border border-slate-200 dark:border-slate-700 hover:border-emerald-300 dark:hover:border-emerald-800 rounded-xl text-[11px] font-mono font-black tracking-tight transition-all cursor-pointer active:scale-95 shadow-2xs flex items-center gap-1"
                      title={`Insert ${tag}`}
                    >
                      <span className="text-emerald-500">+</span>
                      <span>{tag}</span>
                    </button>
                  ))}
                </div>
              </div>

            </div>

          </div>

          {/* RIGHT COLUMN: WhatsApp Chat Live Simulator (5 Cols) */}
          <div className="lg:col-span-5 flex flex-col justify-between">
            
            <div className="w-full bg-[#0b141a] dark:bg-[#0b141a] rounded-2xl border border-slate-800 overflow-hidden shadow-lg flex flex-col h-full min-h-[290px]">
              
              {/* WhatsApp Chat Header */}
              <div className="px-4 py-3 bg-[#202c33] border-b border-[#2a3942] flex items-center justify-between gap-3 text-white">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-full bg-emerald-600 flex items-center justify-center font-black text-xs shrink-0 text-white">
                    GTS
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-bold truncate flex items-center gap-1.5">
                      <span>Customer Support</span>
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    </div>
                    <div className="text-[10px] text-slate-400">Official WhatsApp Gateway</div>
                  </div>
                </div>

                <button
                  onClick={copySimulatedPreview}
                  className="p-1.5 text-slate-400 hover:text-white bg-[#111b21] hover:bg-[#2a3942] rounded-lg transition-colors text-[10px] font-bold cursor-pointer"
                  title="Copy Simulated Message"
                >
                  {copiedPreview ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
                </button>
              </div>

              {/* WhatsApp Message Body with Realistic Chat Wallpaper */}
              <div className="flex-1 p-4 bg-[#0b141a] bg-opacity-95 flex flex-col justify-end space-y-2 relative overflow-y-auto min-h-[170px]">
                
                {/* Date separator badge */}
                <div className="flex justify-center mb-2">
                  <span className="px-2.5 py-0.5 bg-[#182229] text-[#8696a0] rounded-md text-[9px] font-medium uppercase tracking-wider">
                    Today
                  </span>
                </div>

                {/* WhatsApp Chat Bubble (Outgoing green) */}
                <div className="self-end max-w-[90%] bg-[#005c4b] text-[#e9edef] rounded-2xl rounded-tr-xs p-3.5 shadow-sm text-xs font-normal leading-relaxed relative space-y-1.5">
                  <p className="whitespace-pre-wrap break-words text-[11.5px] font-sans">
                    {generateSimulatedPreview(currentText) || 'Your preview message will appear here...'}
                  </p>
                  
                  <div className="flex items-center justify-end gap-1 text-[9px] text-[#8696a0] pt-0.5">
                    <span>12:45 PM</span>
                    <CheckCheck size={13} className="text-[#53bdeb]" />
                  </div>
                </div>

              </div>

              {/* WhatsApp Simulator Footer Note */}
              <div className="px-3.5 py-2 bg-[#182229] border-t border-[#2a3942] text-[10px] text-[#8696a0] flex items-center justify-between">
                <span className="flex items-center gap-1">
                  <Eye size={12} /> Live formatting preview
                </span>
                <span className="font-mono text-[9px]">UTF-8</span>
              </div>

            </div>

          </div>

        </div>
      </div>

    </div>
  );
}

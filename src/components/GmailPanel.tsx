// src/components/GmailPanel.tsx
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Mail, Send, CheckCircle2, AlertCircle, Clock, User, Plus, Search, RefreshCw, FileText, Sparkles, Check, ChevronRight, HardDrive, Wifi, ShieldAlert } from 'lucide-react';
import { gmailService, GmailMessage } from '../services/gmailService';
import { googleSheetsService } from '../services/googleSheetsService';
import { firebaseService } from '../lib/firebaseService';
import { UserProfile } from '../types';

interface GmailPanelProps {
  currentUser: UserProfile;
  appConfig: any;
  complaints?: any[];
}

export default function GmailPanel({ currentUser, appConfig, complaints = [] }: GmailPanelProps) {
  // Authentication & Connection State
  const [googleTokens, setGoogleTokens] = useState(googleSheetsService.getTokens());
  const [isConnected, setIsConnected] = useState(!!googleTokens);
  
  // Gmail Messages History
  const [messages, setMessages] = useState<GmailMessage[]>([]);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [msgError, setMsgError] = useState<string | null>(null);

  // Email Composer State
  const [recipientEmail, setRecipientEmail] = useState('');
  const [selectedComplaintId, setSelectedComplaintId] = useState('');
  const [emailSubject, setEmailSubject] = useState('');
  const [emailBody, setEmailBody] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [sendSuccess, setSendSuccess] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  // Template/Preset Selection
  const [availableTemplates] = useState(gmailService.getTemplates(appConfig?.branding?.appName || "Green Tech Services"));
  const [selectedTemplateIndex, setSelectedTemplateIndex] = useState<number | null>(null);

  // Search filter for complaints/clients to email to
  const [searchTerm, setSearchTerm] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);

  // Read Google Auth changes dynamically
  useEffect(() => {
    const handleAuthChange = (e: any) => {
      setGoogleTokens(e.detail);
      setIsConnected(!!e.detail);
    };
    window.addEventListener('google-auth-changed', handleAuthChange);
    return () => window.removeEventListener('google-auth-changed', handleAuthChange);
  }, []);

  // Fetch recent Gmail history on load or connection
  useEffect(() => {
    if (isConnected) {
      loadGmailHistory();
    }
  }, [isConnected]);

  const loadGmailHistory = async () => {
    setIsLoadingMessages(true);
    setMsgError(null);
    try {
      const docs = await gmailService.getMessages();
      setMessages(docs);
    } catch (err: any) {
      console.warn("Could not load Gmail history:", err);
      setMsgError(err.message || "Failed to load sent emails. Reconnect your Google Account.");
    } finally {
      setIsLoadingMessages(false);
    }
  };

  const handleOAuthConnect = async () => {
    try {
      // In sandbox/iframe environment, prioritize direct OAuth URL launcher or Firebase auth login fallback
      await googleSheetsService.initiateAuth();
    } catch (err: any) {
      console.error("Gmail OAuth connect failed:", err);
    }
  };

  const handleApplyTemplate = (index: number) => {
    setSelectedTemplateIndex(index);
    const template = availableTemplates[index];
    
    // Find active complaint if selected
    const complaint = complaints.find(c => c.id === selectedComplaintId) || {};
    
    let subject = template.subject;
    if (complaint.id) {
      subject += complaint.id;
    } else {
      subject += "GENERAL";
    }
    
    const filledBody = template.body({
      customerName: complaint.customerName || "Valued Customer",
      id: complaint.id || "N/A",
      category: complaint.category || "General ISP Query",
      area: complaint.area || "Network Zone A",
      priority: complaint.priority || "Medium",
      description: complaint.description || "NOC operational status inquiry."
    });

    setEmailSubject(subject);
    setEmailBody(filledBody);
    
    if (complaint.customerEmail) {
      setRecipientEmail(complaint.customerEmail);
    } else if (complaint.email) {
      setRecipientEmail(complaint.email);
    }
  };

  const selectComplaint = (complaint: any) => {
    setSelectedComplaintId(complaint.id);
    setSearchTerm(`${complaint.customerName || 'No Name'} (${complaint.id})`);
    setShowDropdown(false);
    
    const email = complaint.customerEmail || complaint.email || '';
    if (email) {
      setRecipientEmail(email);
    }

    // If template index is already selected, re-render the body with this complaint's data
    if (selectedTemplateIndex !== null) {
      const template = availableTemplates[selectedTemplateIndex];
      let subject = template.subject + complaint.id;
      const filledBody = template.body({
        customerName: complaint.customerName || "Valued Customer",
        id: complaint.id,
        category: complaint.category || "Service Interruption",
        area: complaint.area || "Zone Grid",
        priority: complaint.priority || "Medium",
        description: complaint.description || ""
      });
      setEmailSubject(subject);
      setEmailBody(filledBody);
    }
  };

  const handleSendEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recipientEmail || !emailSubject || !emailBody) {
      setSendError("Please specify a recipient email, a valid subject, and body.");
      return;
    }

    setIsSending(true);
    setSendError(null);
    setSendSuccess(false);

    try {
      await gmailService.sendEmail(recipientEmail, emailSubject, emailBody);
      setSendSuccess(true);
      // Clean up inputs on success
      setRecipientEmail('');
      setSelectedComplaintId('');
      setSearchTerm('');
      setEmailSubject('');
      setEmailBody('');
      setSelectedTemplateIndex(null);
      
      // Reload sent logs
      await loadGmailHistory();
      
      // Clear success badge after 4 seconds
      setTimeout(() => setSendSuccess(false), 4000);
    } catch (err: any) {
      setSendError(err.message || "Failed to deliver email through your authenticated Gmail link.");
    } finally {
      setIsSending(false);
    }
  };

  // Filter complaints based on search term
  const filteredComplaints = complaints.filter(c => {
    const term = searchTerm.toLowerCase();
    return (
      (c.id && c.id.toLowerCase().includes(term)) ||
      (c.customerName && c.customerName.toLowerCase().includes(term)) ||
      (c.category && c.category.toLowerCase().includes(term)) ||
      (c.customerEmail && c.customerEmail.toLowerCase().includes(term))
    );
  }).slice(0, 5);

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      {/* 24/7 Gmail Live Connection Status Banner */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${isConnected ? 'bg-emerald-500/10 text-emerald-600' : 'bg-red-500/10 text-red-600'}`}>
              <Mail size={24} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">Gmail Integration Center</h2>
                <span className={`px-2.5 py-0.5 rounded-full text-[10px] uppercase font-black tracking-wider ${
                  isConnected ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400' : 'bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-400'
                }`}>
                  {isConnected ? 'Connected & Live' : 'Not Connected'}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                {isConnected 
                  ? "Your authenticated GTS secure mail dispatch engine is active. All customer telemetry statements will be routed securely via your Gmail profile." 
                  : "Link your company's Google Workspace/Gmail account to enable automated status reports, custom diagnostics receipts, and fiber latency summaries."}
              </p>
            </div>
          </div>
          
          <div>
            {!isConnected ? (
              <button
                onClick={handleOAuthConnect}
                className="px-5 py-2.5 rounded-xl bg-blue-600 text-white font-bold text-xs uppercase tracking-wider hover:bg-blue-700 active:scale-95 transition-all text-center cursor-pointer flex items-center gap-2"
              >
                <Sparkles size={14} />
                Connect Gmail Account
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400 font-mono hidden md:inline">Logged: {currentUser?.username}</span>
                <button
                  onClick={() => {
                    googleSheetsService.clearAuth();
                    setGoogleTokens(null);
                    setIsConnected(false);
                  }}
                  className="px-4 py-2 border border-rose-500/30 text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 rounded-xl text-xs font-bold uppercase tracking-wider cursor-pointer"
                >
                  Disconnect Link
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {!isConnected ? (
        <div className="bg-slate-50 dark:bg-slate-950 border border-dashed border-slate-200 dark:border-slate-800 rounded-3xl p-12 text-center">
          <ShieldAlert className="mx-auto text-slate-400 mb-4" size={48} />
          <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200">Authorization Required</h3>
          <p className="text-sm text-slate-500 max-w-lg mx-auto mt-2 leading-relaxed">
            To compose, preview, or dispatch fiber network log summaries and complaint registration invoices directly from this panel, please link your Google Account inside the connection center above.
          </p>
          <div className="mt-6">
            <button
              onClick={handleOAuthConnect}
              className="px-6 py-3 rounded-2xl bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-950 dark:hover:bg-white text-white text-xs font-black uppercase tracking-wider transition-all"
            >
              Sign In with Google Settings
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Email Composer Sheet (left side) */}
          <div className="lg:col-span-7 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 space-y-6 shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <FileText size={18} className="text-blue-500" />
                Active Communication Station
              </h3>
              <p className="text-xs text-slate-500 mt-1">Compose customized network telemetry reports or apply pre-built NOC diagnostic statement templates.</p>
            </div>

            <form onSubmit={handleSendEmail} className="space-y-4">
              {/* Optional Complaint/Client Binder Hook */}
              <div className="relative">
                <label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1.5">
                  Link Registered Customer / Complaint
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <Search size={14} />
                  </div>
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => {
                      setSearchTerm(e.target.value);
                      setShowDropdown(true);
                    }}
                    onFocus={() => setShowDropdown(true)}
                    placeholder="Search by Customer Name, Complaint ID #, or Issue Description..."
                    className="w-full pl-9 pr-4 py-2 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 dark:text-white"
                  />
                  {searchTerm && (
                    <button
                      type="button"
                      onClick={() => {
                        setSearchTerm('');
                        setSelectedComplaintId('');
                        setRecipientEmail('');
                      }}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-xs text-slate-400 hover:text-slate-600 dark:hover:text-white"
                    >
                      Clear
                    </button>
                  )}
                </div>

                {/* Dropdown entries */}
                <AnimatePresence>
                  {showDropdown && searchTerm.length > 0 && (
                    <motion.div
                      initial={{ opacity: 0, y: -5 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -5 }}
                      className="absolute z-50 left-0 right-0 mt-1 max-h-56 overflow-y-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl divide-y divide-slate-100 dark:divide-slate-800"
                    >
                      {filteredComplaints.length > 0 ? (
                        filteredComplaints.map((c) => (
                          <button
                            type="button"
                            key={c.id}
                            onClick={() => selectComplaint(c)}
                            className="w-full text-left px-4 py-2.5 text-xs hover:bg-slate-50 dark:hover:bg-slate-800/60 flex items-center justify-between"
                          >
                            <div className="truncate">
                              <p className="font-bold text-slate-800 dark:text-slate-200">{c.customerName || 'No Name'}</p>
                              <p className="text-[10px] text-slate-400 truncate mt-0.5">#{c.id} &bull; {c.category || 'General'}</p>
                            </div>
                            <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-[9px] uppercase font-bold text-slate-500">
                              {c.area || 'All Area'}
                            </span>
                          </button>
                        ))
                      ) : (
                        <p className="p-3 text-xs text-slate-500 text-center">No matching operational registries found.</p>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Recipient Email */}
              <div>
                <label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1.5">
                  Recipient Email Address
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <User size={14} />
                  </div>
                  <input
                    type="email"
                    required
                    value={recipientEmail}
                    onChange={(e) => setRecipientEmail(e.target.value)}
                    placeholder="customer@email.com or coworker@isp.com"
                    className="w-full pl-9 pr-4 py-2 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 dark:text-white"
                  />
                </div>
              </div>

              {/* Presets and Templates */}
              <div>
                <label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2">
                  Select NOC Dynamic Template Presets
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {availableTemplates.map((tpl, idx) => (
                    <button
                      type="button"
                      key={tpl.name}
                      onClick={() => handleApplyTemplate(idx)}
                      className={`px-3 py-2 text-left rounded-xl border text-xs transition-all cursor-pointer ${
                        selectedTemplateIndex === idx
                          ? 'border-blue-500 bg-blue-50/40 text-blue-700 dark:bg-blue-950/20 dark:text-blue-400 font-bold'
                          : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-400 font-medium hover:border-slate-300 dark:hover:border-slate-700'
                      }`}
                    >
                      <span className="block truncate">{tpl.name}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Email Subject */}
              <div>
                <label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1.5">
                  Email Subject Line
                </label>
                <input
                  type="text"
                  required
                  value={emailSubject}
                  onChange={(e) => setEmailSubject(e.target.value)}
                  placeholder="e.g. [GTS-ISP] Fiber Network Maintenance Update"
                  className="w-full px-4 py-2 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 dark:text-white"
                />
              </div>

              {/* Email Body HTML editor */}
              <div>
                <label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1.5">
                  HTML Email Statement Content
                </label>
                <textarea
                  required
                  rows={8}
                  value={emailBody}
                  onChange={(e) => setEmailBody(e.target.value)}
                  placeholder="Specify descriptive message or utilize HTML structures for professional layouts..."
                  className="w-full px-4 py-2.5 text-xs font-mono bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 dark:text-white"
                />
              </div>

              {/* Status and Actions */}
              <div className="pt-2">
                {sendSuccess && (
                  <div className="mb-3 p-3 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/80 text-emerald-700 dark:text-emerald-400 text-xs rounded-xl flex items-center gap-2">
                    <CheckCircle2 size={14} className="shrink-0" />
                    <span>Email successfully sent through your Gmail link! Your communications are saved in Sent folder.</span>
                  </div>
                )}
                
                {sendError && (
                  <div className="mb-3 p-3 bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-800/80 text-rose-700 dark:text-rose-400 text-xs rounded-xl flex items-center gap-2">
                    <AlertCircle size={14} className="shrink-0" />
                    <span>{sendError}</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isSending}
                  className="w-full flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:bg-blue-600/60 text-white font-bold text-xs uppercase tracking-wider transition-all shadow-md cursor-pointer"
                >
                  {isSending ? (
                    <>
                      <RefreshCw size={14} className="animate-spin" />
                      Dispatching via Gmail SMTP Core...
                    </>
                  ) : (
                    <>
                      <Send size={14} />
                      Send Secure Diagnostic Email
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>

          {/* Sent Gmail History Log (right side) */}
          <div className="lg:col-span-5 space-y-4">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-sm font-black uppercase text-slate-800 dark:text-slate-200 tracking-wide">
                    Live Dispatch logs
                  </h3>
                  <p className="text-[10px] text-slate-400 dark:text-slate-500 leading-none mt-1">Recently sent statements via Gmail API</p>
                </div>
                
                <button
                  onClick={loadGmailHistory}
                  disabled={isLoadingMessages}
                  className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-950 text-slate-500 dark:text-slate-400 transition-all cursor-pointer"
                  title="Reload Live History"
                >
                  <RefreshCw size={14} className={isLoadingMessages ? "animate-spin" : ""} />
                </button>
              </div>

              {msgError && (
                <div className="p-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-[10px] text-slate-500 dark:text-slate-400 flex items-start gap-2">
                  <AlertCircle size={12} className="shrink-0 text-slate-400 mt-0.5" />
                  <span>{msgError}</span>
                </div>
              )}

              {isLoadingMessages ? (
                <div className="py-12 flex flex-col items-center justify-center text-slate-400">
                  <RefreshCw size={24} className="animate-spin mb-2 text-blue-500" />
                  <p className="text-xs font-mono">Retrieving authenticated Gmail inbox loggers...</p>
                </div>
              ) : messages.length === 0 ? (
                <div className="py-12 text-center text-slate-400">
                  <Clock className="mx-auto mb-2 text-slate-300 dark:text-slate-700" size={32} />
                  <p className="text-xs">No sent telecom communications traced yet.</p>
                  <p className="text-[10px] text-slate-400 mt-1">Emails sent from this terminal will outline live audit trails here.</p>
                </div>
              ) : (
                <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
                  {messages.map((msg) => (
                    <div 
                      key={msg.id}
                      className="p-3.5 bg-slate-50/50 dark:bg-slate-950/40 border border-slate-100 dark:border-slate-850 rounded-2xl space-y-2 hover:border-slate-200 dark:hover:border-slate-800 transition-all"
                    >
                      <div className="flex items-start justify-between">
                        <div className="truncate pr-2">
                          <p className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">{msg.subject}</p>
                          <p className="text-[10px] text-slate-400 mt-0.5">To: <span className="font-mono text-slate-500 dark:text-slate-300 font-bold">{msg.to.replace(/["']/g, '')}</span></p>
                        </div>
                        <span className="text-[9px] font-mono font-bold text-slate-400" title={msg.date}>
                          {msg.date ? new Date(msg.date).toLocaleDateString() : 'N/A'}
                        </span>
                      </div>
                      
                      <p className="text-[10px] text-slate-500 leading-normal italic line-clamp-2 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-850 p-2 rounded-lg">
                        "{msg.snippet}"
                      </p>
                      
                      <div className="flex items-center justify-between text-[9px] font-bold text-slate-400">
                        <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 uppercase tracking-widest text-[8px]">
                          <Check size={10} /> Authenticated
                        </span>
                        <span className="font-mono tracking-tighter text-[8px] text-slate-400 font-semibold uppercase">ID: {msg.id.slice(0, 8)}...</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Educational / Security Guideline Box */}
            <div className="bg-slate-50/50 dark:bg-slate-950/20 border border-slate-200/80 dark:border-slate-850 rounded-3xl p-5 space-y-3.5">
              <h4 className="text-xs font-black uppercase text-slate-800 dark:text-slate-200 tracking-wider flex items-center gap-2">
                🛡️ Telecom Dispatch Compliance
              </h4>
              <ul className="text-[11px] text-slate-500 space-y-2 leading-relaxed font-medium">
                <li className="flex gap-2">
                  <span className="text-blue-500 shrink-0 font-bold">&bull;</span>
                  <span>Gmail logs listed are retrieved directly from your personal or business workspace via OAuth scope protocols.</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-blue-500 shrink-0 font-bold">&bull;</span>
                  <span>Preset telemetry maps use custom high-density CSS/HTML styling, optimized for modern email client previews (Gmail, Outlook).</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

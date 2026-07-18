import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, Sparkles, TrendingUp, Bot, Send, Copy, Check, Loader2, 
  ShieldAlert, Wrench, RefreshCw, MessageSquare, ListTodo, CheckSquare, ArrowRight,
  Globe, ExternalLink, ShieldCheck, CornerDownRight, Flame, Layers, MapPin
} from 'lucide-react';
import { cn } from '../lib/utils';
import { toast } from 'sonner';
import { pocketbaseService } from '../lib/pocketbaseService';
import { Complaint } from '../types';

const getApiUrl = (endpoint: string): string => {
  const host = window.location.hostname;
  if (
    host === 'localhost' || 
    host === '127.0.0.1' || 
    host.includes('.run.app') ||
    host.includes('hf.space') ||
    host.includes('huggingface.co')
  ) {
    return endpoint;
  }
  return `https://ais-pre-y57fbgpyjpmaocrhgtopol-853220806804.asia-southeast1.run.app${endpoint}`;
};

interface AIHelpPanelProps {
  onClose: () => void;
  currentUser: {
    username: string;
    fullName?: string;
    role?: string;
  };
}

interface TopIssue {
  category: string;
  count: number;
  severity: 'high' | 'medium' | 'low';
  areaSuggested: string;
}

interface ActionableSuggestion {
  title: string;
  category: string;
  description: string;
  troubleshootingSteps: string[];
  templateResponse: string;
}

interface TrendData {
  overallStatus: 'safe' | 'alert' | 'critical';
  recentTrendSummary: string;
  topIssues: TopIssue[];
  actionableSuggestions: ActionableSuggestion[];
  generatedAt: number;
  isSimulated?: boolean;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  timestamp: Date;
  sources?: { title: string; uri: string }[];
}

export default function AIHelpPanel({ onClose, currentUser }: AIHelpPanelProps) {
  const [activeSubTab, setActiveSubTab] = useState<'trends' | 'ask' | 'diagnose'>('trends');
  
  // Trend analyzer states
  const [trendData, setTrendData] = useState<TrendData | null>(null);
  const [loadingTrends, setLoadingTrends] = useState(true);
  const [copiedResponseIndex, setCopiedResponseIndex] = useState<number | null>(null);

  // Search Grounding toggle
  const [searchGroundingActive, setSearchGroundingActive] = useState(false);

  // Real-time active complaints diagnostics states
  const [liveComplaints, setLiveComplaints] = useState<Complaint[]>([]);
  const [selectedComplaintId, setSelectedComplaintId] = useState<string>('');
  const [diagnosing, setDiagnosing] = useState(false);
  const [diagnosisResult, setDiagnosisResult] = useState<string>('');
  const [applyingRemark, setApplyingRemark] = useState(false);

  // Chat/Ask states
  const [askHistory, setAskHistory] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      text: `Assalamu Alaikum, ${currentUser.fullName || currentUser.username}! I am your AI Resolution Mentor.\n\nAsk me any fiber diagnostics questions, network architecture guidelines, or customer service coping responses. Switch on "Search Grounding" to fetch live status updates. \n\nExamples: "how to troubleshoot high attenuation levels?", "G-11 fiber template", "peering status route guide".`,
      timestamp: new Date()
    }
  ]);
  const [userInput, setUserInput] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  // Subscribe to real-time complaints context
  useEffect(() => {
    const readTenantId = currentUser.role === 'super_admin' 
      ? undefined 
      : (currentUser.role === 'dealer' ? (currentUser as any).uid : (currentUser as any).dealerId || 'main');

    const unsubscribe = pocketbaseService.subscribeComplaints((complaintsData) => {
      // Filter out completed/resolved ones, keep pending, in process, important
      const activeTickets = complaintsData.filter(c => c.status !== 'complete' && c.status !== 'Resolved');
      setLiveComplaints(activeTickets);
      
      // Auto-select first active complaint if none remains selected or if selected one is completed
       if (activeTickets.length > 0) {
         setSelectedComplaintId(prev => {
           if (!prev || !activeTickets.some(c => c.id === prev)) {
             return activeTickets[0].id;
           }
           return prev;
         });
       } else {
         setSelectedComplaintId('');
       }
    }, readTenantId);

    return () => unsubscribe();
  }, [currentUser]);

  // Fetch trend analysis on mount
  const fetchTrends = async () => {
    setLoadingTrends(true);
    try {
      const response = await fetch(getApiUrl('/api/gemini/analyze-trends'));
      if (!response.ok) {
        throw new Error('Failed to retrieve AI Trend recommendations.');
      }
      const data = await response.json();
      setTrendData(data);
    } catch (err: any) {
      toast.error('Could not analyze trends', { description: err.message });
    } finally {
      setLoadingTrends(false);
    }
  };

  useEffect(() => {
    fetchTrends();
  }, []);

  // Scroll to bottom of assistant chat
  useEffect(() => {
    if (chatBottomRef.current) {
      chatBottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [askHistory, sendingMessage]);

  const handleSendPrompt = async (textToSend?: string) => {
    const prompt = textToSend || userInput;
    if (!prompt.trim() || sendingMessage) return;

    if (!textToSend) setUserInput('');

    const newMsg: ChatMessage = {
      id: Math.random().toString(),
      role: 'user',
      text: prompt,
      timestamp: new Date()
    };

    setAskHistory(prev => [...prev, newMsg]);
    setSendingMessage(true);

    try {
      // Map history for Gemini API payload
      const historyPayload = askHistory.map(m => ({
        role: m.role === 'user' ? 'user' : 'model',
        text: m.text
      }));

      const res = await fetch(getApiUrl('/api/gemini/ask'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          question: prompt,
          history: historyPayload,
          searchGrounding: searchGroundingActive
        })
      });

      if (!res.ok) {
        throw new Error('AI Diagnostics model is temporarily unavailable.');
      }

      const data = await res.json();
      
      setAskHistory(prev => [...prev, {
        id: Math.random().toString(),
        role: 'assistant',
        text: data.answer,
        timestamp: new Date(),
        sources: data.sources
      }]);
    } catch (err: any) {
      setAskHistory(prev => [...prev, {
        id: Math.random().toString(),
        role: 'assistant',
        text: `Error: ${err.message || 'Network loss anomaly detected. Please verify key status.'}`,
        timestamp: new Date()
      }]);
    } finally {
      setSendingMessage(false);
    }
  };

  const handleDiagnoseComplaint = async () => {
    if (!selectedComplaintId) return;
    const complaint = liveComplaints.find(c => c.id === selectedComplaintId);
    if (!complaint) return;

    setDiagnosing(true);
    setDiagnosisResult('');

    try {
      const detailedQuery = `I need an expert ISP diagnosis for this customer ticket:
- **Client Name:** ${complaint.customerName || 'N/A'}
- **Username:** ${complaint.customerUsername || 'N/A'}
- **Current Category:** ${complaint.category || 'N/A'}
- **Reported Issue Description:** "${complaint.description || 'No description provided'}"
- **Ticket Priority:** ${complaint.priority || 'Medium'}
- **Area / Locality:** ${complaint.area || 'Unknown'}
- **User Nearby Device:** ${complaint.userNearby || 'N/A'}
- **Cabinet / Panel Area:** ${complaint.panelDetails || 'N/A'}

Provide:
1. **ROOT CAUSE HYPOTHESIS**: A precise 1-sentence technical explanation of why this is happening (e.g., high line loss / OLT link drop / wireless interference).
2. **TROUBLESHOOTING STEP-BY-STEP CHECKLIST**: 3 actionable, specific steps for a support technician to verify (referencing realistic optical signal RX levels: ideal range -18dBm to -25dBm, OLT loop tracing, router pinging, or DNS flushes).
3. **Copy-paste friendly empathetic CUSTOMER ANSWER TEMPLATE (In Roman Urdu/Hindi + English mixed, e.g., 'Aap ka Router offline dikha raha hai...'):** Keep the tone peaceful, reassuring, polite, and reassuring. Always include simple actions for the consumer (such as power cycling) and let them know a teammate is working on it.`;

      const res = await fetch(getApiUrl('/api/gemini/ask'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          question: detailedQuery,
          history: [],
          searchGrounding: searchGroundingActive
        })
      });

      if (!res.ok) {
        throw new Error('AI Diagnostics model is temporarily unavailable.');
      }

      const data = await res.json();
      setDiagnosisResult(data.answer);
      toast.success('AI Diagnostics generated successfully!', {
        description: `Expert plan ready for ${complaint.customerName}`
      });
    } catch (err: any) {
      toast.error('AI Diagnostics Failed', { description: err.message });
    } finally {
      setDiagnosing(false);
    }
  };

  const handleApplyAIDiagnosisAsRemarks = async () => {
    if (!selectedComplaintId || !diagnosisResult) return;
    const complaint = liveComplaints.find(c => c.id === selectedComplaintId);
    if (!complaint) return;

    setApplyingRemark(true);
    try {
      let remarksText = `[AI Diagnostic Assist Plan]\n${diagnosisResult}\n--- Auto-Generated by Gemini Mentor`;
      
      if (remarksText.length > 1500) {
        remarksText = remarksText.substring(0, 1475) + '... (truncated)';
      }

      const authorName = currentUser.fullName || currentUser.username;
      const authorId = (currentUser as any).uid || 'system_ai';

      await pocketbaseService.updateComplaintRemarks(
        selectedComplaintId,
        remarksText,
        complaint.customerName,
        authorName,
        authorId
      );

      toast.success('AI Plan Applied to Ticket Remarks!', {
        description: `Remarks updated successfully by ${authorName}.`
      });
    } catch (err: any) {
      toast.error('Failed to apply Remarks', { description: err.message });
    } finally {
      setApplyingRemark(false);
    }
  };

  const copyToClipboard = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedResponseIndex(index);
    toast.success('Response template copied!', { description: 'Comfortable Roman Urdu message is on your clipboard.' });
    setTimeout(() => {
      setCopiedResponseIndex(null);
    }, 2000);
  };

  return (
    <>
      {/* Backdrop overlay for focus context */}
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 bg-slate-900/40 dark:bg-slate-950/75 backdrop-blur-[2px] z-[190]"
      />

      <motion.div 
        initial={{ x: 500, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: 500, opacity: 0 }}
        transition={{ type: 'spring', damping: 28, stiffness: 220 }}
        className="fixed top-0 right-0 h-screen w-full sm:w-[500px] z-[200] bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 shadow-[0_0_50px_rgba(0,0,0,0.15)] dark:shadow-[0_0_50px_rgba(0,0,0,0.6)] flex flex-col overflow-hidden text-slate-800 dark:text-slate-100"
      >
        {/* Header Section */}
        <div className="p-4 border-b border-slate-100 dark:border-slate-800/80 bg-slate-50/80 dark:bg-slate-950/80 backdrop-blur-md flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-brand-accent to-blue-400 flex items-center justify-center text-white shadow-md shadow-brand-accent/20">
                <Sparkles size={18} className="animate-pulse" />
              </div>
              <span className="absolute bottom-[-1px] right-[-1px] w-3 h-3 bg-emerald-500 rounded-full border-2 border-slate-50 dark:border-slate-950" />
            </div>
            <div>
              <h3 className="text-[13px] font-black tracking-wider uppercase text-slate-900 dark:text-white flex items-center gap-1.5 font-display">
                ISP Diagnostics Mentor
              </h3>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-[9px] text-slate-500 dark:text-slate-400 tracking-wider font-mono uppercase font-bold">
                  Gemini-3.5-Flash Active
                </span>
              </div>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-950 dark:hover:text-white transition-all duration-200 cursor-pointer active:scale-95 border border-transparent hover:border-slate-200 dark:hover:border-slate-700/60"
          >
            <X size={18} />
          </button>
        </div>

        {/* Dynamic Sub-Tabs Panel Selection */}
        <div className="p-2 bg-slate-50/40 dark:bg-slate-950/40 border-b border-slate-150 dark:border-slate-850/60 flex gap-1 items-center">
          <button
            onClick={() => {
              setActiveSubTab('trends');
              setDiagnosisResult('');
            }}
            className={cn(
              "flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all duration-300 cursor-pointer",
              activeSubTab === 'trends'
                ? "bg-brand-accent text-white shadow-lg shadow-brand-accent/20"
                : "text-slate-500 dark:text-slate-400 hover:text-slate-950 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-850/50"
            )}
          >
            <TrendingUp size={13} />
            Live Analytics
          </button>
          <button
            onClick={() => {
              setActiveSubTab('diagnose');
              setDiagnosisResult('');
            }}
            className={cn(
              "flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all duration-300 cursor-pointer",
              activeSubTab === 'diagnose'
                ? "bg-brand-accent text-white shadow-lg shadow-brand-accent/20"
                : "text-slate-500 dark:text-slate-400 hover:text-slate-950 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-850/50"
            )}
          >
            <Wrench size={13} />
            Active Diagnoser
          </button>
          <button
            onClick={() => {
              setActiveSubTab('ask');
              setDiagnosisResult('');
            }}
            className={cn(
              "flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all duration-300 cursor-pointer",
              activeSubTab === 'ask'
                ? "bg-brand-accent text-white shadow-lg shadow-brand-accent/20"
                : "text-slate-500 dark:text-slate-400 hover:text-slate-950 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-850/50"
            )}
          >
            <Bot size={13} />
            Diagnostic Chat
          </button>
        </div>

        {/* Global Live Search Grounding Toggle Bar */}
        <div className="bg-slate-50/80 dark:bg-slate-950/60 border-b border-slate-150 dark:border-slate-800/60 px-4 py-2.5 flex items-center justify-between text-xs transition-colors duration-200">
          <label className="flex items-center gap-2.5 text-slate-700 dark:text-slate-300 font-semibold cursor-pointer select-none">
            <input
              type="checkbox"
              id="google-search-grounding-toggle"
              checked={searchGroundingActive}
              onChange={(e) => setSearchGroundingActive(e.target.checked)}
              className="rounded-lg border-slate-300 dark:border-slate-700 text-brand-accent focus:ring-brand-accent bg-slate-100 dark:bg-slate-800 w-4 h-4 cursor-pointer transition-all duration-200"
            />
            <span className="flex items-center gap-1.5 text-[10px] sm:text-xs tracking-wider uppercase font-bold text-slate-600 dark:text-slate-300">
              <Globe className={cn("inline-block", searchGroundingActive ? "text-brand-accent animate-spin [animation-duration:8s]" : "text-slate-400 dark:text-slate-500")} size={13} />
              Search Grounding
            </span>
          </label>
          <AnimatePresence mode="wait">
            {searchGroundingActive ? (
              <motion.span 
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                className="text-[9px] text-emerald-600 dark:text-[#34d399] font-mono font-bold tracking-wider flex items-center gap-1.5 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20"
              >
                <span className="w-1.5 h-1.5 bg-emerald-500 dark:bg-emerald-400 rounded-full animate-ping" />
                WEB RESOLVER ON
              </motion.span>
            ) : (
              <motion.span 
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                className="text-[9px] text-emerald-600 dark:text-[#34d399] font-mono font-bold tracking-wider flex items-center gap-1.5 bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/20"
              >
                <span className="w-1.5 h-1.5 bg-emerald-500 dark:bg-emerald-400 rounded-full animate-pulse" />
                ONLINE ENGINE
              </motion.span>
            )}
          </AnimatePresence>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
          <AnimatePresence mode="wait">
            {activeSubTab === 'trends' ? (
              <motion.div
                key="trends"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                className="space-y-5"
              >
                {loadingTrends ? (
                  <div className="space-y-4 py-12 text-center flex flex-col items-center justify-center">
                    <div className="relative">
                      <div className="w-12 h-12 rounded-full border-2 border-slate-200 dark:border-slate-800 border-t-brand-accent animate-spin" />
                      <Sparkles size={16} className="text-brand-accent absolute top-3.5 left-3.5 animate-pulse" />
                    </div>
                    <div className="space-y-1">
                      <p className="text-[10px] font-mono font-black text-slate-400 dark:text-slate-500 tracking-widest uppercase">CONNECTING DIAGNOSTIC SHELF...</p>
                      <p className="text-[11px] font-black tracking-widest text-[#34d399] dark:text-[#34d399] animate-pulse">
                        Splicing intelligence channels...
                      </p>
                    </div>
                  </div>
                ) : trendData ? (
                  <>
                    {/* Overall network condition banner */}
                    <div className={cn(
                      "p-4 rounded-2xl border flex items-start gap-4 shadow-sm",
                      trendData.overallStatus === 'critical' 
                        ? "bg-rose-500/5 dark:bg-rose-500/10 border-rose-200 dark:border-rose-500/20 text-rose-800 dark:text-rose-200"
                        : trendData.overallStatus === 'alert'
                          ? "bg-amber-500/5 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/20 text-amber-800 dark:text-amber-200"
                          : "bg-emerald-500/5 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/20 text-emerald-800 dark:text-emerald-200"
                    )}>
                      <div className="mt-0.5">
                        <ShieldAlert size={20} className={cn(
                          trendData.overallStatus === 'critical' ? 'text-rose-500 dark:text-rose-400 animate-bounce' : 'text-amber-500 dark:text-amber-400'
                        )} />
                      </div>
                      <div className="space-y-1 select-none">
                        <h4 className="text-[11px] font-black tracking-widest uppercase font-mono flex items-center gap-1.5">
                          SYSTEM HEALTH: {trendData.overallStatus}
                        </h4>
                        <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed font-sans font-medium">
                          {trendData.recentTrendSummary}
                        </p>
                      </div>
                    </div>

                    {/* Top Issues Capsule Grid */}
                    <div className="space-y-3">
                      <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 flex items-center gap-1.5 select-none">
                        <Layers size={11} className="text-brand-accent" /> High-frequency fiber issues
                      </h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {trendData.topIssues?.map((issue, idx) => (
                          <motion.div 
                            key={idx} 
                            whileHover={{ y: -3, transition: { duration: 0.2 } }}
                            className="bg-slate-50 dark:bg-slate-950 p-3.5 rounded-2xl border border-slate-100 dark:border-slate-850 shadow-sm space-y-2.5 relative overflow-hidden"
                          >
                            <span className="absolute top-0 right-0 w-24 h-24 bg-brand-accent/5 rounded-full blur-xl pointer-events-none" />
                            <div className="flex items-center justify-between">
                              <span className="text-[9px] font-mono tracking-wider font-black text-slate-400 dark:text-slate-500 uppercase truncate max-w-[125px]">
                                {issue.category}
                              </span>
                              <span className={cn(
                                "px-2 py-0.5 rounded-full text-[8px] font-mono font-bold capitalize",
                                issue.severity === 'high' 
                                  ? "bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/15" 
                                  : issue.severity === 'medium' 
                                    ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/15" 
                                    : "bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/15"
                              )}>
                                {issue.severity}
                              </span>
                            </div>
                            
                            <div className="flex items-baseline justify-between select-none">
                              <h5 className="text-xl font-mono font-black text-slate-900 dark:text-white leading-none">
                                {issue.count} <span className="text-slate-400 dark:text-slate-500 text-[10px] font-normal font-sans tracking-wide">Tickets</span>
                              </h5>
                            </div>
                            
                            <div className="text-[10px] text-slate-500 dark:text-slate-400 flex items-center gap-1.5 truncate font-sans font-medium">
                              <MapPin size={11} className="text-brand-accent shrink-0" />
                              <span className="truncate">Area: <strong>{issue.areaSuggested}</strong></span>
                            </div>
                          </motion.div>
                        ))}
                      </div>
                    </div>

                    {/* Resolution Suggestions & Coping Guides */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between select-none">
                        <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 flex items-center gap-1.5">
                          <Wrench size={11} className="text-brand-accent" /> Actionable Coping Blueprints
                        </h4>
                        {trendData.isSimulated && (
                          <span className="text-[8px] text-brand-accent font-black tracking-widest border border-brand-accent/20 px-2 py-0.5 rounded-lg bg-brand-accent/5 animate-pulse">STANDBY AI</span>
                        )}
                      </div>
                      
                      <div className="space-y-4">
                        {trendData.actionableSuggestions?.map((suggestion, idx) => (
                          <div key={idx} className="bg-slate-50 dark:bg-slate-950 border border-slate-150 dark:border-slate-850 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all duration-300">
                            {/* Inner Title bar */}
                            <div className="p-3 bg-slate-100/50 dark:bg-slate-900/30 border-b border-slate-200/40 dark:border-slate-850 flex items-center justify-between select-none">
                              <div className="flex items-center gap-2">
                                <span className="inline-block w-2.5 h-2.5 rounded-full bg-brand-accent shrink-0 animate-pulse" />
                                <span className="text-[9px] font-black tracking-wider text-brand-accent uppercase">
                                  {suggestion.category}
                                </span>
                              </div>
                              <span className="text-[8px] text-slate-400 dark:text-slate-500 uppercase tracking-widest font-mono font-black">GUIDE CODE {idx + 1}</span>
                            </div>

                            {/* Outer body */}
                            <div className="p-4 space-y-3.5">
                              <div className="space-y-1">
                                <h5 className="text-slate-900 dark:text-white text-xs font-black leading-snug uppercase font-mono tracking-tight">{suggestion.title}</h5>
                                <p className="text-[11px] text-slate-500 dark:text-slate-400 font-sans leading-relaxed font-medium">{suggestion.description}</p>
                              </div>

                              {/* Bullet actions checklist */}
                              <div className="space-y-2 bg-slate-100/40 dark:bg-slate-900/40 p-3 rounded-xl border border-slate-200/50 dark:border-slate-850">
                                <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 font-mono">Troubleshooting Matrix:</p>
                                <ul className="space-y-1.5">
                                  {suggestion.troubleshootingSteps?.map((step, sIdx) => (
                                    <li key={sIdx} className="text-[11px] text-slate-600 dark:text-slate-300 flex items-start gap-2 font-medium">
                                      <CornerDownRight size={10} className="text-brand-accent mt-1 shrink-0" />
                                      <span>{step}</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>

                              {/* Customer communication template wrapper */}
                              <div className="space-y-2">
                                <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 font-mono flex items-center justify-between select-none">
                                  <span>URDU CUSTOMER RESPONSE:</span>
                                  <span className="text-brand-accent text-[8px] tracking-widest lowercase uppercase font-black">Empathetic</span>
                                </p>
                                
                                <div className="relative group/copy p-3 rounded-xl bg-slate-100/50 dark:bg-slate-900 text-[11px] font-medium leading-relaxed font-sans text-slate-700 dark:text-slate-300 border border-dashed border-slate-200 dark:border-slate-800 flex items-start justify-between gap-4 transition-all hover:bg-slate-100 dark:hover:bg-slate-900/60">
                                  <span className="flex-1 select-all">{suggestion.templateResponse}</span>
                                  <button
                                    onClick={() => copyToClipboard(suggestion.templateResponse, idx)}
                                    className="p-1.5 rounded-lg bg-white dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 hover:text-white text-slate-400 hover:text-slate-900 transition-all flex-shrink-0 cursor-pointer shadow border border-slate-200/30 dark:border-slate-700"
                                    title="Copy Template"
                                  >
                                    {copiedResponseIndex === idx ? (
                                      <Check size={11} className="text-emerald-500 dark:text-emerald-400 animate-scale-in" />
                                    ) : (
                                      <Copy size={11} className="text-slate-500 dark:text-slate-400" />
                                    )}
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Manual force reload footer info */}
                    <div className="pt-3 border-t border-slate-100 dark:border-slate-850 flex items-center justify-between text-[9px] font-mono text-slate-400 dark:text-slate-500 select-none">
                      <span>Refreshed: {new Date(trendData.generatedAt).toLocaleTimeString()}</span>
                      <button 
                        onClick={fetchTrends}
                        className="flex items-center gap-1.5 hover:text-brand-accent dark:hover:text-white transition-colors cursor-pointer font-bold uppercase tracking-wider"
                      >
                        <RefreshCw size={9} className="animate-spin [animation-duration:15s]" />
                        REFRESH CACHE
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="text-center py-12 space-y-3">
                    <p className="text-xs text-slate-400">Failed to render parsed suggestions.</p>
                    <button 
                      onClick={fetchTrends}
                      className="text-xs text-brand-accent font-black hover:underline cursor-pointer uppercase tracking-widest"
                    >
                      Try analytics reload
                    </button>
                  </div>
                )}
              </motion.div>
            ) : activeSubTab === 'diagnose' ? (
              <motion.div
                key="diagnose"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                className="space-y-4 pb-16"
              >
                {/* Real-time active complaints listing and diagnosis */}
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 font-mono">
                    Select Active Ticket to Diagnose:
                  </label>
                  {liveComplaints.length === 0 ? (
                    <div className="bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/30 p-4 rounded-2xl text-center space-y-2">
                      <ShieldCheck className="text-emerald-500 mx-auto animate-pulse" size={24} />
                      <div>
                        <h5 className="text-xs font-black uppercase text-emerald-800 dark:text-emerald-400 font-mono">All Operations Green!</h5>
                        <p className="text-[11px] text-slate-500 dark:text-emerald-400/80 leading-relaxed mt-0.5 font-sans font-medium">There are no active unresolved customer complaints in the dashboard stream.</p>
                      </div>
                    </div>
                  ) : (
                    <div className="relative">
                      <select
                        value={selectedComplaintId}
                        onChange={(e) => {
                          setSelectedComplaintId(e.target.value);
                          setDiagnosisResult('');
                        }}
                        className="w-full bg-slate-55 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs px-3.5 py-3 rounded-2xl focus:outline-none focus:border-brand-accent focus:ring-1 focus:ring-brand-accent text-slate-900 dark:text-white cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-900 duration-200 font-medium whitespace-nowrap overflow-ellipsis"
                      >
                        {liveComplaints.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.category?.toUpperCase() || 'GENERAL'} - {c.customerName || c.customerUsername} ({c.area || 'Unknown'})
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>

                {(() => {
                  const complaint = liveComplaints.find(c => c.id === selectedComplaintId);
                  if (!complaint) return null;

                  return (
                    <div className="bg-slate-50 dark:bg-slate-950/50 rounded-2xl border border-slate-150 dark:border-slate-850 p-4 space-y-3 shadow-sm relative overflow-hidden">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-mono font-black text-brand-accent tracking-widest uppercase">
                          TICKET PROFILE
                        </span>
                        <span className={cn(
                          "px-2 py-0.5 rounded-full text-[8.5px] font-mono font-bold capitalize select-none",
                          complaint.priority?.toLowerCase() === 'critical' || complaint.priority?.toLowerCase() === 'high'
                            ? "bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/15" 
                            : "bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/15"
                        )}>
                          {complaint.priority || 'Medium'} Priority
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-x-4 gap-y-2.5 text-[11px] border-b border-dashed border-slate-200 dark:border-slate-800 pb-3">
                        <div>
                          <span className="text-slate-400 dark:text-slate-550 text-[9px] uppercase font-bold tracking-wider font-mono">Subscriber:</span>
                          <p className="font-semibold text-slate-800 dark:text-slate-200 truncate mt-0.5">{complaint.customerName || 'N/A'} ({complaint.customerUsername || 'N/A'})</p>
                        </div>
                        <div>
                          <span className="text-slate-400 dark:text-slate-550 text-[9px] uppercase font-bold tracking-wider font-mono">Area / Cabinet:</span>
                          <p className="font-semibold text-slate-800 dark:text-slate-200 truncate mt-0.5">{complaint.area || 'Unknown'}</p>
                        </div>
                        {complaint.userNearby && (
                          <div className="col-span-2">
                            <span className="text-slate-400 dark:text-slate-550 text-[9px] uppercase font-bold tracking-wider font-mono">User Onward Devices / Location:</span>
                            <p className="font-semibold text-slate-800 dark:text-slate-250 truncate mt-0.5">{complaint.userNearby}</p>
                          </div>
                        )}
                        <div className="col-span-2 mt-1">
                          <span className="text-slate-400 dark:text-slate-550 text-[9px] uppercase font-bold tracking-wider font-mono">Reported Problem:</span>
                          <p className="text-slate-700 dark:text-slate-300 font-medium leading-relaxed mt-1 whitespace-pre-line bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-850 p-2.5 rounded-xl text-[11px]">
                            {complaint.description || 'No description of problem.'}
                          </p>
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <button
                          onClick={handleDiagnoseComplaint}
                          disabled={diagnosing}
                          className="flex-1 bg-brand-accent hover:opacity-90 disabled:opacity-50 text-white font-black text-[10px] uppercase tracking-wider py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 cursor-pointer duration-200 shadow-md shadow-brand-accent/15"
                        >
                          {diagnosing ? (
                            <>
                              <Loader2 size={13} className="animate-spin" />
                              Splicing AI Mentor Feed...
                            </>
                          ) : (
                            <>
                              <Sparkles size={13} className="animate-pulse" />
                              Diagnose Ticket with Gemini
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  );
                })()}

                {diagnosisResult && (
                  <div className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm space-y-3.5 p-4 animate-scale-in">
                    <div className="flex items-center justify-between border-b border-slate-150 dark:border-slate-850 pb-2.5">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                        <span className="text-[9px] font-black tracking-widest text-[#34d399] uppercase font-mono">
                          Gemini Verification Completed
                        </span>
                      </div>
                      <span className="text-[9px] text-slate-400 font-mono font-bold">AI RESOLVE PRO v1</span>
                    </div>

                    <div className="text-xs leading-relaxed text-slate-700 dark:text-slate-300 whitespace-pre-line font-medium space-y-4">
                      {diagnosisResult}
                    </div>

                    <div className="pt-4 border-t border-slate-150 dark:border-slate-850/80 flex flex-col sm:flex-row gap-2 select-none">
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(diagnosisResult);
                          toast.success('Resolution Plan Copied!', {
                            description: 'Operational summary copied to clipboard successfully.'
                          });
                        }}
                        className="flex-1 py-2 px-3 rounded-xl bg-slate-200 dark:bg-slate-800 hover:opacity-90 text-slate-900 dark:text-white font-semibold text-[10px] uppercase tracking-wider flex items-center justify-center gap-1.5 cursor-pointer duration-200 font-mono"
                      >
                        <Copy size={12} />
                        Copy Full Plan
                      </button>
                      <button
                        onClick={handleApplyAIDiagnosisAsRemarks}
                        disabled={applyingRemark}
                        className="flex-1 py-2 px-3 rounded-xl bg-[#10b981] hover:bg-[#059669] text-white font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-1.5 cursor-pointer duration-200 shadow shadow-emerald-500/20 disabled:opacity-50 font-mono"
                      >
                        {applyingRemark ? (
                          <Loader2 size={12} className="animate-spin" />
                        ) : (
                          <ShieldCheck size={12} />
                        )}
                        Apply to Remarks
                      </button>
                    </div>
                  </div>
                )}
              </motion.div>
            ) : (
              <motion.div
                key="ask"
                className="h-full flex flex-col justify-end"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
              >
                <div className="space-y-4 pb-20 max-h-[calc(100vh-235px)] overflow-y-auto pr-1">
                  {askHistory.map((msg) => (
                    <div 
                      key={msg.id}
                      className={cn(
                        "flex flex-col max-w-[85%] rounded-2xl p-3.5 space-y-1.5 font-sans leading-relaxed shadow-sm block-animation",
                        msg.role === 'user'
                          ? "bg-brand-accent text-white ml-auto rounded-tr-none shadow-md shadow-brand-accent/10"
                          : "bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 mr-auto rounded-tl-none border border-slate-150 dark:border-slate-850"
                      )}
                    >
                      {msg.role === 'assistant' && (
                        <div className="flex items-center gap-1.5 mb-1 select-none">
                          <span className="w-1.5 h-1.5 bg-emerald-500 dark:bg-emerald-400 rounded-full animate-pulse" />
                          <span className="text-[9px] font-black uppercase text-brand-accent tracking-widest font-mono">
                            ISP AI Mentor
                          </span>
                        </div>
                      )}
                      <p className="text-xs leading-relaxed whitespace-pre-line font-medium break-words">
                        {msg.text}
                      </p>
                      {msg.role === 'assistant' && msg.sources && msg.sources.length > 0 && (
                        <div className="mt-2 text-left pt-2 border-t border-slate-150 dark:border-slate-850/80 space-y-1.5 w-full select-none">
                          <span className="text-[9px] uppercase font-bold tracking-wider text-slate-400 dark:text-slate-500 flex items-center gap-1.5 font-mono">
                            <Globe size={11} className="text-brand-accent animate-pulse" /> Grounded Web Connections:
                          </span>
                          <div className="flex flex-col gap-1 w-full pl-0.5">
                            {msg.sources.map((src, sIdx) => (
                              <a
                                key={sIdx}
                                href={src.uri}
                                target="_blank"
                                rel="noreferrer"
                                className="text-[10px] text-brand-accent hover:text-brand-accent/80 transition-colors flex items-center gap-1.5 hover:underline truncate font-medium font-sans"
                                title={src.title}
                              >
                                <ExternalLink size={10} className="flex-shrink-0 text-brand-accent" />
                                <span className="truncate">{src.title}</span>
                              </a>
                            ))}
                          </div>
                        </div>
                      )}
                      <span className={cn(
                        "text-[8px] font-mono self-end opacity-70",
                        msg.role === 'user' ? "text-slate-200" : "text-slate-400 dark:text-slate-500"
                      )}>
                        {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  ))}
                  
                  {sendingMessage && (
                    <div className="flex items-center gap-2 mr-auto bg-slate-50 dark:bg-slate-950 border border-slate-150 dark:border-slate-850 rounded-2xl px-4 py-3 shadow-sm content-center font-mono text-[9px] text-slate-400 dark:text-slate-500 uppercase font-bold tracking-widest leading-none">
                      <Loader2 size={12} className="text-brand-accent animate-spin" />
                      <span>compiling diagnostics data...</span>
                    </div>
                  )}
                  <div ref={chatBottomRef} />
                </div>

                {/* Quick Recommendation tags container */}
                <div className="absolute bottom-[72px] left-0 right-0 px-4 bg-gradient-to-t from-white via-white dark:from-slate-900 dark:via-slate-900 to-transparent pt-3 pb-1 space-y-2 select-none">
                  <p className="text-[8px] font-bold uppercase text-slate-400 dark:text-slate-500 tracking-widest font-mono">QUICK DIG QUICKLINKS:</p>
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      "⚡ High Attenuation values?",
                      "🔌 Quick Router templates?",
                      "🛠️ Fiber core color code",
                      "📡 Speed guides Roman Urdu"
                    ].map((quick, idx) => (
                      <button
                        key={idx}
                        onClick={() => handleSendPrompt(quick.slice(2))}
                        className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-850 text-[9px] font-black uppercase tracking-wider text-slate-600 dark:text-slate-300 px-2.5 py-1.5 rounded-xl cursor-pointer transition-all duration-200 active:scale-95 shadow-sm"
                      >
                        {quick}
                      </button>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Chat input footer wrapper (only for ask) */}
        {activeSubTab === 'ask' && (
          <div className="p-3 bg-slate-50 dark:bg-slate-950 border-t border-slate-150 dark:border-slate-850/80 flex items-center gap-2 select-none">
            <input
              type="text"
              value={userInput}
              onChange={(e) => setUserInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSendPrompt()}
              placeholder="Ask diagnostic / template question..."
              className="flex-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs px-3.5 py-2.5 rounded-2xl shadow-[inset_0_1px_2px_rgba(0,0,0,0.03)] focus:outline-none focus:border-brand-accent focus:ring-1 focus:ring-brand-accent text-slate-900 dark:text-white leading-normal"
            />
            <button
              onClick={() => handleSendPrompt()}
              disabled={!userInput.trim() || sendingMessage}
              className="w-10 h-10 rounded-2xl bg-brand-accent hover:opacity-90 disabled:opacity-30 disabled:hover:scale-100 flex items-center justify-center text-white transition-all duration-200 cursor-pointer active:scale-95 shadow-md shadow-brand-accent/20 flex-shrink-0"
            >
              <Send size={15} />
            </button>
          </div>
        )}
      </motion.div>
    </>
  );
}

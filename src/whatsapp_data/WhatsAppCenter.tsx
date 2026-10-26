import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Search, 
  MessageCircle, 
  Check, 
  Clock, 
  AlertCircle, 
  RefreshCw, 
  ArrowLeft,
  X,
  Send,
  Smartphone,
  ShieldAlert,
  SlidersHorizontal,
  ChevronDown
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { sendMessage, getStatus } from './whatsappApi';
import { cn } from '../lib/utils';
import { useTheme } from '../hooks/useTheme';
import { toast } from 'sonner';

export const ALLOWED_KINDS = ['reminder', 'campaign', 'manual'] as const;
export type AllowedKind = typeof ALLOWED_KINDS[number];

export interface WhatsAppMessage {
  id: string;
  session_key: string;
  phone: string;
  client_name?: string;
  client_username?: string;
  direction: 'out' | 'in';
  kind: 'reminder' | 'complaint' | 'campaign' | 'manual' | 'other';
  body: string;
  status: 'sent' | 'failed' | 'received';
  error?: string;
  wa_message_id?: string;
  created_at: string;
}

export interface ConversationThread {
  phone: string;
  norm10: string;
  name: string;
  username: string;
  lastMessage: WhatsAppMessage;
  messages: WhatsAppMessage[];
}

export interface WhatsAppCenterProps {
  currentUser?: any;
  clients?: any[];
  onClose?: () => void;
  standalone?: boolean;
}

function normalize10(phone: string): string {
  const digits = (phone || '').replace(/\D/g, '');
  return digits.length >= 10 ? digits.slice(-10) : digits;
}

function formatRelativeTime(dateStr?: string): string {
  if (!dateStr) return '';
  try {
    const date = new Date(dateStr);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    
    if (isToday) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
    }
    
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    }
    
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  } catch {
    return '';
  }
}

function formatSeparatorDate(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    const now = new Date();
    if (date.toDateString() === now.toDateString()) return 'Today';
    
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
    
    return date.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return dateStr;
  }
}

function getInitials(name?: string, username?: string, phone?: string): string {
  const target = (name || username || phone || 'U').trim();
  const parts = target.split(/\s+/);
  if (parts.length >= 2 && parts[0] && parts[1]) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return target.slice(0, 2).toUpperCase();
}

export default function WhatsAppCenter({
  currentUser,
  clients: propClients,
  onClose,
  standalone = true
}: WhatsAppCenterProps) {
  const navigate = useNavigate();
  const { theme } = useTheme();

  // 1. Session key rule (exact rule from WhatsAppLogView)
  const sessionKey = useMemo(() => {
    const isSubDealerUser = (currentUser?.role === 'dealer' || Boolean(currentUser?.dealerId && currentUser?.dealerId !== 'main') || Boolean(currentUser?.lineCode)) && currentUser?.role !== 'admin' && currentUser?.role !== 'super_admin';
    const subDealerLineCode = (currentUser?.lineCode || '').trim();
    const subDealerDealerId = (currentUser?.role === 'dealer' ? currentUser?.uid : (currentUser?.dealerId || currentUser?.uid || 'main')).trim();
    if (isSubDealerUser) {
      return subDealerLineCode || subDealerDealerId || 'main';
    }
    return 'main';
  }, [currentUser]);

  // Messages state
  const [messages, setMessages] = useState<WhatsAppMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<{ message: string; code?: string } | null>(null);
  const [pageLimit, setPageLimit] = useState(300);
  const [hasMore, setHasMore] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Connection & usage state
  const [waStatus, setWaStatus] = useState<{ connected: boolean; phoneNumber?: string | null; serviceStarting?: boolean } | null>(null);
  const [usage, setUsage] = useState<{ hour: number; hourLimit: number; day: number; dayLimit: number } | null>(null);

  // Clients directory map (10 digits -> { name, username })
  const [clientDirectory, setClientDirectory] = useState<Map<string, { name?: string; username?: string }>>(() => new Map());

  // Search & Active Thread selection
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPhone, setSelectedPhone] = useState<string | null>(null);

  // Composer
  const [inputText, setInputText] = useState('');
  const [isSending, setIsSending] = useState(false);

  // Scrolling
  const chatScrollContainerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const userScrolledUpRef = useRef<boolean>(false);

  // Build client directory map from propClients or fetch from Supabase
  useEffect(() => {
    let active = true;

    if (propClients && propClients.length > 0) {
      const map = new Map<string, { name?: string; username?: string }>();
      propClients.forEach(c => {
        const rawPhone = c.mobileNumber || c.mobile_number || c.number || c.contact_number || '';
        const n10 = normalize10(rawPhone);
        if (n10) {
          map.set(n10, {
            name: c.name || c.full_name || '',
            username: c.username || c.client_id || ''
          });
        }
      });
      setClientDirectory(map);
      return;
    }

    // Fetch clients directory from Supabase
    async function loadClients() {
      try {
        const { data } = await supabase
          .from('clients')
          .select('name, username, mobile_number, number');
        if (data && active) {
          const map = new Map<string, { name?: string; username?: string }>();
          data.forEach(c => {
            const rawPhone = c.mobile_number || c.number || '';
            const n10 = normalize10(rawPhone);
            if (n10) {
              map.set(n10, {
                name: c.name || '',
                username: c.username || ''
              });
            }
          });
          setClientDirectory(map);
        }
      } catch (_) {}
    }

    loadClients();
    return () => { active = false; };
  }, [propClients]);

  // Fetch connection status
  const checkStatus = useCallback(async () => {
    try {
      const st = await getStatus(sessionKey);
      setWaStatus({
        connected: Boolean(st?.connected),
        phoneNumber: st?.phoneNumber || null,
        serviceStarting: Boolean(st?.serviceStarting)
      });
    } catch (_) {
      setWaStatus({ connected: false, phoneNumber: null });
    }
  }, [sessionKey]);

  // Fetch usage stats
  const checkUsage = useCallback(async () => {
    try {
      const res = await fetch(`/send-usage?session=${encodeURIComponent(sessionKey)}`);
      if (res.ok) {
        const data = await res.json();
        if (data && typeof data.day === 'number') {
          setUsage(data);
          return;
        }
      }
    } catch (_) {}

    // Fallback: count from messages today
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    const dayCount = messages.filter(m => m.direction === 'out' && m.status === 'sent' && m.created_at >= startOfDay).length;
    setUsage(prev => ({
      hour: prev?.hour || 0,
      hourLimit: prev?.hourLimit || 60,
      day: dayCount,
      dayLimit: prev?.dayLimit || 250
    }));
  }, [sessionKey, messages]);

  // Initial and periodic status check
  useEffect(() => {
    checkStatus();
    checkUsage();
    const interval = setInterval(() => {
      checkStatus();
      checkUsage();
    }, 20000);
    return () => clearInterval(interval);
  }, [checkStatus, checkUsage]);

  // Fetch messages from Supabase (Strict Data Filter)
  const fetchMessages = useCallback(async (showIndicator = false) => {
    if (showIndicator) setIsRefreshing(true);
    else setLoading(true);

    try {
      const { data, error } = await supabase
        .from('whatsapp_messages')
        .select('*')
        .eq('session_key', sessionKey)
        .eq('direction', 'out')
        .in('kind', ALLOWED_KINDS as any)
        .in('status', ['sent', 'failed'])
        .order('created_at', { ascending: false })
        .limit(pageLimit);

      if (error) {
        console.error('Supabase query error loading whatsapp_messages:', error);
        setLoadError({ message: error.message, code: error.code });
      } else if (data) {
        setLoadError(null);
        setMessages(data as WhatsAppMessage[]);
        if (data.length < pageLimit) {
          setHasMore(false);
        } else {
          setHasMore(true);
        }
      }
    } catch (err: any) {
      console.error('Error fetching WhatsApp Center messages:', err);
      setLoadError({ message: err?.message || String(err) });
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [sessionKey, pageLimit]);

  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  // Realtime subscription with reconciliation
  useEffect(() => {
    const channel = supabase
      .channel(`whatsapp_center_${sessionKey}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'whatsapp_messages',
          filter: `session_key=eq.${sessionKey}`
        },
        (payload) => {
          const newMsg = payload.new as WhatsAppMessage;
          // Apply strict data filters
          if (newMsg.direction !== 'out') return;
          if (!ALLOWED_KINDS.includes(newMsg.kind as any)) return;
          if (newMsg.status !== 'sent' && newMsg.status !== 'failed') return;

          setMessages(prev => {
            // Check if already in list by id
            const existingIdx = prev.findIndex(m => m.id === newMsg.id);
            if (existingIdx !== -1) {
              const updated = [...prev];
              updated[existingIdx] = newMsg;
              return updated;
            }

            // Check if this reconciles an optimistic message
            const newNorm10 = normalize10(newMsg.phone);
            const newTime = new Date(newMsg.created_at).getTime();

            const optimisticIdx = prev.findIndex(m => {
              if (!m.id.startsWith('optimistic_')) return false;
              if (normalize10(m.phone) !== newNorm10) return false;
              const optTime = new Date(m.created_at).getTime();
              return Math.abs(newTime - optTime) <= 15000;
            });

            if (optimisticIdx !== -1) {
              const updated = [...prev];
              updated[optimisticIdx] = newMsg;
              return updated;
            }

            return [newMsg, ...prev];
          });
        }
      )
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.warn(`WhatsApp Center realtime channel status: ${status} for session ${sessionKey}`);
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [sessionKey]);

  // Group messages into customer threads
  const threads = useMemo(() => {
    const map = new Map<string, { phone: string; norm10: string; name: string; username: string; messages: WhatsAppMessage[] }>();

    // Process sorted descending (most recent first)
    messages.forEach(msg => {
      const p = (msg.phone || '').trim();
      if (!p) return;
      const n10 = normalize10(p);
      const groupKey = n10 || p;

      if (!map.has(groupKey)) {
        const directoryHit = n10 ? clientDirectory.get(n10) : undefined;
        const name = msg.client_name?.trim() || directoryHit?.name?.trim() || 'Unknown Client';
        const username = msg.client_username?.trim() || directoryHit?.username?.trim() || '';

        map.set(groupKey, {
          phone: p,
          norm10: n10,
          name,
          username,
          messages: [msg]
        });
      } else {
        const existing = map.get(groupKey)!;
        existing.messages.push(msg);
        // Enrich name / username if previously unknown
        if (existing.name === 'Unknown Client' && msg.client_name) {
          existing.name = msg.client_name;
        }
        if (!existing.username && msg.client_username) {
          existing.username = msg.client_username;
        }
      }
    });

    const threadList: ConversationThread[] = [];
    map.forEach(item => {
      // Sort messages within thread chronologically (oldest to newest for chat view)
      const sortedMessages = [...item.messages].sort((a, b) => 
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );
      const lastMsg = sortedMessages[sortedMessages.length - 1];
      threadList.push({
        phone: item.phone,
        norm10: item.norm10,
        name: item.name,
        username: item.username,
        lastMessage: lastMsg,
        messages: sortedMessages
      });
    });

    // Sort threads newest conversation first
    threadList.sort((a, b) => 
      new Date(b.lastMessage.created_at).getTime() - new Date(a.lastMessage.created_at).getTime()
    );

    return threadList;
  }, [messages, clientDirectory]);

  // Filtered threads by search
  const filteredThreads = useMemo(() => {
    if (!searchQuery.trim()) return threads;
    const q = searchQuery.toLowerCase().trim();
    const qClean = q.replace(/\D/g, '');
    return threads.filter(t => {
      const matchName = t.name.toLowerCase().includes(q);
      const matchUser = t.username.toLowerCase().includes(q);
      const matchPhone = t.phone.includes(q) || (qClean && t.norm10.includes(qClean));
      return matchName || matchUser || matchPhone;
    });
  }, [threads, searchQuery]);

  // Auto-select first thread on desktop if none selected
  useEffect(() => {
    if (!selectedPhone && threads.length > 0 && typeof window !== 'undefined' && window.innerWidth >= 768) {
      setSelectedPhone(threads[0].norm10 || threads[0].phone);
    }
  }, [threads, selectedPhone]);

  // Active selected thread
  const activeThread = useMemo(() => {
    if (!selectedPhone) return null;
    return threads.find(t => (t.norm10 && t.norm10 === selectedPhone) || t.phone === selectedPhone) || null;
  }, [threads, selectedPhone]);

  // Auto scroll logic
  const handleChatScroll = () => {
    if (!chatScrollContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = chatScrollContainerRef.current;
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 80;
    userScrolledUpRef.current = !isAtBottom;
  };

  useEffect(() => {
    if (!userScrolledUpRef.current && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [activeThread?.messages]);

  // Send message
  const handleSendMessage = async () => {
    const text = inputText.trim();
    if (!text || !activeThread || isSending) return;

    if (!waStatus?.connected) {
      toast.error('WhatsApp is not connected');
      return;
    }

    setIsSending(true);
    const targetPhone = activeThread.phone;
    const optimisticId = `optimistic_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const nowIso = new Date().toISOString();

    const optimisticMsg: WhatsAppMessage = {
      id: optimisticId,
      session_key: sessionKey,
      phone: targetPhone,
      client_name: activeThread.name,
      client_username: activeThread.username,
      direction: 'out',
      kind: 'manual',
      body: text,
      status: 'sent',
      created_at: nowIso
    };

    // Immediately update UI
    setMessages(prev => [optimisticMsg, ...prev]);
    setInputText('');
    userScrolledUpRef.current = false;
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 50);

    try {
      const res = await sendMessage(
        targetPhone,
        text,
        sessionKey,
        {
          kind: 'manual',
          clientName: activeThread.name,
          clientUsername: activeThread.username
        }
      );

      if (res && res.success) {
        toast.success('Message sent');
        // Update usage stats locally
        setUsage(prev => prev ? { ...prev, day: prev.day + 1, hour: prev.hour + 1 } : null);
      } else {
        throw new Error(res?.error || 'Failed to send message');
      }
    } catch (err: any) {
      console.error('Failed to send WhatsApp message:', err);
      toast.error(err.message || 'Failed to send message');
      // Mark optimistic message as failed
      setMessages(prev => prev.map(m => m.id === optimisticId ? { ...m, status: 'failed', error: err.message || 'Failed to send' } : m));
    } finally {
      setIsSending(false);
    }
  };

  const handleClose = () => {
    if (onClose) {
      onClose();
    } else {
      if (window.history.length > 1) {
        navigate(-1);
      } else {
        navigate('/billingmod');
      }
    }
  };

  // Keyboard shortcut: Escape to close / back
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (selectedPhone && typeof window !== 'undefined' && window.innerWidth < 768) {
          setSelectedPhone(null);
        } else {
          handleClose();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedPhone]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-100 dark:bg-slate-950 text-slate-800 dark:text-slate-100 font-sans select-none overflow-hidden">
      {/* Top Main Navigation / Brand Bar */}
      <div className="h-14 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 flex items-center justify-between shrink-0 shadow-xs">
        <div className="flex items-center gap-3">
          <button
            onClick={handleClose}
            className="p-2 rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            title="Exit WhatsApp Center"
          >
            <ArrowLeft size={18} />
          </button>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-xs">
              <MessageCircle size={18} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-sm font-black text-slate-900 dark:text-white tracking-tight">
                  WhatsApp Center
                </h1>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                  Live Center
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                Session: <span className="font-mono font-bold text-slate-700 dark:text-slate-300">{sessionKey}</span>
              </p>
            </div>
          </div>
        </div>

        {/* Header Right: Connection Pill & Controls */}
        <div className="flex items-center gap-3">
          {/* Connection Pill */}
          <div className={cn(
            "flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold border transition-colors",
            waStatus?.connected
              ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-400"
              : waStatus?.serviceStarting
              ? "bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-400"
              : "bg-red-500/10 border-red-500/30 text-red-600 dark:text-red-400"
          )}>
            <span className={cn(
              "w-2 h-2 rounded-full shrink-0",
              waStatus?.connected ? "bg-emerald-500 animate-pulse" : "bg-red-500"
            )} />
            <span>
              {waStatus?.connected
                ? (waStatus.phoneNumber ? `+${waStatus.phoneNumber}` : 'Connected')
                : waStatus?.serviceStarting
                ? 'Starting Service...'
                : 'WhatsApp Offline'}
            </span>
          </div>

          {/* Refresh Button */}
          <button
            onClick={() => {
              checkStatus();
              fetchMessages(true);
              checkUsage();
            }}
            disabled={isRefreshing}
            className="p-2 rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors disabled:opacity-50"
            title="Refresh logs & connection"
          >
            <RefreshCw size={16} className={isRefreshing ? 'animate-spin' : ''} />
          </button>

          {/* Close Window */}
          <button
            onClick={handleClose}
            className="p-2 rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            title="Close"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      {/* Main Dual-Pane Body */}
      <div className="flex-1 flex overflow-hidden">
        {/* ===================== LEFT PANE: Conversation Threads ===================== */}
        <div className={cn(
          "w-full md:w-[360px] md:min-w-[360px] md:max-w-[360px] bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col z-10 transition-all duration-200",
          selectedPhone ? "hidden md:flex" : "flex"
        )}>
          {/* Search Box */}
          <div className="p-3 border-b border-slate-100 dark:border-slate-800/80">
            <div className="relative">
              <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search name, username, or phone..."
                className="w-full pl-9 pr-3 py-2 text-xs rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-transparent focus:border-emerald-500 focus:bg-white dark:focus:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 outline-none transition-colors"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X size={13} />
                </button>
              )}
            </div>
          </div>

          {/* Error Banner if Query Failed */}
          {loadError && (
            <div className="m-3 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-xs">
              <div className="flex items-start gap-2">
                <AlertCircle size={15} className="shrink-0 mt-0.5" />
                <div className="flex-1">
                  <div className="font-bold">Could not load WhatsApp messages</div>
                  <div className="text-[11px] text-red-500/90 mt-0.5">{loadError.message}</div>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">
                    Check that the table whatsapp_messages exists and that its row level security policies allow select.
                  </p>
                  <button
                    onClick={() => fetchMessages(true)}
                    className="mt-2 px-2.5 py-1 rounded-lg bg-red-600 text-white font-bold text-[10px] hover:bg-red-700 transition-colors cursor-pointer"
                  >
                    Retry
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Thread List */}
          <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/60">
            {loading && messages.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-xs flex flex-col items-center gap-2">
                <RefreshCw size={20} className="animate-spin text-emerald-500" />
                <span>Loading conversations...</span>
              </div>
            ) : filteredThreads.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-xs flex flex-col items-center gap-2">
                <MessageCircle size={32} className="text-slate-300 dark:text-slate-700" />
                <span className="font-bold text-slate-600 dark:text-slate-400 text-sm">No messages sent yet</span>
                <span className="text-[11px]">
                  {searchQuery ? 'No conversations match your search filter' : 'Outgoing reminders and typed messages will appear here'}
                </span>
              </div>
            ) : (
              filteredThreads.map(thread => {
                const isSelected = selectedPhone === thread.norm10 || selectedPhone === thread.phone;
                const initials = getInitials(thread.name, thread.username, thread.phone);
                const lastTime = formatRelativeTime(thread.lastMessage.created_at);

                return (
                  <div
                    key={thread.norm10 || thread.phone}
                    onClick={() => setSelectedPhone(thread.norm10 || thread.phone)}
                    className={cn(
                      "p-3.5 flex items-start gap-3 cursor-pointer transition-colors duration-150 relative",
                      isSelected
                        ? "bg-emerald-500/10 dark:bg-emerald-500/15 border-l-4 border-l-emerald-500"
                        : "hover:bg-slate-50 dark:hover:bg-slate-800/50"
                    )}
                  >
                    {/* Customer Initials Avatar */}
                    <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-emerald-600 to-teal-500 text-white font-black text-xs flex items-center justify-center shrink-0 shadow-xs">
                      {initials}
                    </div>

                    {/* Content Preview */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1 mb-0.5">
                        <h4 className="text-xs font-bold text-slate-900 dark:text-white truncate">
                          {thread.name}
                        </h4>
                        <span className="text-[10px] text-slate-400 dark:text-slate-500 shrink-0 font-medium">
                          {lastTime}
                        </span>
                      </div>

                      {thread.username && (
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 font-medium truncate mb-1">
                          @{thread.username}
                        </div>
                      )}

                      <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                        {thread.lastMessage.status === 'sent' && (
                          <Check size={13} className="text-emerald-500 shrink-0" />
                        )}
                        {thread.lastMessage.status === 'failed' && (
                          <AlertCircle size={13} className="text-red-500 shrink-0" />
                        )}
                        <span className="truncate text-[11px] font-normal text-slate-600 dark:text-slate-300">
                          {thread.lastMessage.body}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Left Pane Footer Notice */}
          <div className="p-3 bg-slate-50 dark:bg-slate-950/60 border-t border-slate-200 dark:border-slate-800 text-[10px] text-slate-500 dark:text-slate-400 leading-tight">
            Only reminders and messages you type appear here. Messages go to registered customers only.
          </div>
        </div>

        {/* ===================== RIGHT PANE: Chat View & Composer ===================== */}
        <div className={cn(
          "flex-1 flex flex-col bg-[#efeae2] dark:bg-[#0b141a] relative overflow-hidden",
          !selectedPhone ? "hidden md:flex" : "flex"
        )}>
          {activeThread ? (
            <>
              {/* Chat Header */}
              <div className="h-14 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 flex items-center justify-between shrink-0 shadow-xs z-10">
                <div className="flex items-center gap-3 min-w-0">
                  {/* Mobile Back Button */}
                  <button
                    onClick={() => setSelectedPhone(null)}
                    className="md:hidden p-1.5 -ml-1 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
                  >
                    <ArrowLeft size={18} />
                  </button>

                  {/* Customer Avatar */}
                  <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-emerald-600 to-teal-500 text-white font-bold text-xs flex items-center justify-center shrink-0 shadow-xs">
                    {getInitials(activeThread.name, activeThread.username, activeThread.phone)}
                  </div>

                  {/* Name & Details */}
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="text-xs font-bold text-slate-900 dark:text-white truncate">
                        {activeThread.name}
                      </h3>
                      {activeThread.username && (
                        <span className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                          (@{activeThread.username})
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] font-mono text-emerald-600 dark:text-emerald-400 font-medium">
                      {activeThread.phone}
                    </div>
                  </div>
                </div>

                {/* Status Indicator */}
                <div className="text-[11px] text-slate-500 dark:text-slate-400 font-medium hidden sm:block">
                  {activeThread.messages.length} message{activeThread.messages.length === 1 ? '' : 's'}
                </div>
              </div>

              {/* Chat Message Scroll Area */}
              <div
                ref={chatScrollContainerRef}
                onScroll={handleChatScroll}
                className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-3"
                style={{
                  backgroundImage: theme === 'dark' 
                    ? 'radial-gradient(rgba(255, 255, 255, 0.03) 1px, transparent 0)' 
                    : 'radial-gradient(rgba(0, 0, 0, 0.04) 1px, transparent 0)',
                  backgroundSize: '20px 20px'
                }}
              >
                {/* Load More Button */}
                {hasMore && (
                  <div className="flex justify-center mb-3">
                    <button
                      onClick={() => setPageLimit(prev => prev + 200)}
                      className="px-3 py-1 rounded-full bg-white/80 dark:bg-slate-800/80 backdrop-blur-xs border border-slate-200 dark:border-slate-700 text-[11px] font-bold text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-800 transition-colors shadow-xs"
                    >
                      Load older messages
                    </button>
                  </div>
                )}

                {/* Group messages by date with date separator */}
                {(() => {
                  let lastDateHeader = '';
                  return activeThread.messages.map(msg => {
                    const dateHeader = formatSeparatorDate(msg.created_at);
                    const showDateHeader = dateHeader !== lastDateHeader;
                    if (showDateHeader) {
                      lastDateHeader = dateHeader;
                    }

                    const timeStr = new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });

                    return (
                      <React.Fragment key={msg.id}>
                        {showDateHeader && (
                          <div className="flex justify-center my-3">
                            <span className="px-3 py-0.5 rounded-full bg-white/90 dark:bg-slate-800/90 text-slate-500 dark:text-slate-400 text-[10px] font-bold uppercase tracking-wider shadow-xs border border-slate-200/60 dark:border-slate-700/60">
                              {dateHeader}
                            </span>
                          </div>
                        )}

                        {/* Outgoing Message Bubble (Right Aligned) */}
                        <div className="flex justify-end">
                          <div className={cn(
                            "max-w-[85%] sm:max-w-[70%] rounded-2xl rounded-tr-xs px-3.5 py-2.5 shadow-xs relative transition-all duration-150",
                            msg.status === 'failed'
                              ? "bg-red-50 dark:bg-red-950/40 border border-red-500/30 text-slate-900 dark:text-slate-100"
                              : "bg-[#d9fdd3] dark:bg-[#005c4b] text-slate-900 dark:text-slate-100 border border-emerald-500/10 dark:border-emerald-500/20"
                          )}>
                            {/* Small Kind Chip */}
                            <div className="flex items-center justify-between gap-2 mb-1">
                              <span className={cn(
                                "text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded",
                                msg.kind === 'reminder'
                                  ? "bg-blue-500/20 text-blue-700 dark:text-blue-300"
                                  : msg.kind === 'campaign'
                                  ? "bg-purple-500/20 text-purple-700 dark:text-purple-300"
                                  : "bg-emerald-500/20 text-emerald-800 dark:text-emerald-200"
                              )}>
                                {msg.kind === 'manual' ? 'Typed' : msg.kind}
                              </span>
                            </div>

                            {/* Message Body */}
                            <p className="text-xs sm:text-sm leading-relaxed whitespace-pre-wrap break-words">
                              {msg.body}
                            </p>

                            {/* Message Footer: Time + Status Tick */}
                            <div className="flex items-center justify-end gap-1.5 mt-1 text-[10px] text-slate-500 dark:text-slate-300/80">
                              <span>{timeStr}</span>
                              {msg.status === 'sent' && (
                                <Check size={13} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
                              )}
                              {msg.status === 'failed' && (
                                <span title={msg.error || 'Failed to send'}>
                                  <AlertCircle size={13} className="text-red-500 shrink-0 cursor-pointer" />
                                </span>
                              )}
                              {msg.id.startsWith('optimistic_') && (
                                <Clock size={12} className="text-slate-400 shrink-0" />
                              )}
                            </div>

                            {/* Error text if failed */}
                            {msg.status === 'failed' && msg.error && (
                              <div className="mt-1 pt-1 border-t border-red-500/20 text-[10px] text-red-500 font-medium">
                                Error: {msg.error}
                              </div>
                            )}
                          </div>
                        </div>
                      </React.Fragment>
                    );
                  });
                })()}

                <div ref={messagesEndRef} />
              </div>

              {/* Composer Section */}
              <div className="bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 p-3 sm:p-4 shrink-0 shadow-lg z-10">
                {!waStatus?.connected ? (
                  <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-400 text-xs flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <ShieldAlert size={16} className="shrink-0" />
                      <span className="font-semibold">WhatsApp is not connected</span>
                    </div>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400">
                      Connect your device via Settings or WP Campaigns to send messages
                    </span>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {/* Text Input Row */}
                    <div className="flex items-end gap-2">
                      <textarea
                        value={inputText}
                        onChange={e => setInputText(e.target.value.slice(0, 1000))}
                        onKeyDown={e => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            handleSendMessage();
                          }
                        }}
                        rows={2}
                        maxLength={1000}
                        placeholder={`Type a message to ${activeThread.name}... (Press Enter to send, Shift+Enter for new line)`}
                        className="flex-1 p-2.5 text-xs sm:text-sm rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:border-emerald-500 dark:focus:border-emerald-500 text-slate-900 dark:text-white placeholder-slate-400 outline-none resize-none transition-colors"
                      />
                      <button
                        onClick={handleSendMessage}
                        disabled={isSending || !inputText.trim() || !waStatus?.connected}
                        className="h-10 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-md transition-all shrink-0 cursor-pointer disabled:cursor-not-allowed"
                        title="Send Message"
                      >
                        {isSending ? (
                          <RefreshCw size={15} className="animate-spin" />
                        ) : (
                          <>
                            <Send size={15} />
                            <span className="hidden sm:inline">Send</span>
                          </>
                        )}
                      </button>
                    </div>

                    {/* Bottom Metadata: Counter & Usage Meter */}
                    <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 px-1">
                      <div>
                        {usage ? (
                          <span>
                            Today <strong className="text-slate-700 dark:text-slate-200">{usage.day}</strong>/{usage.dayLimit || 250}
                          </span>
                        ) : (
                          <span>Usage: Registered customers only</span>
                        )}
                      </div>
                      <div className={cn(
                        "font-mono font-medium",
                        inputText.length > 900 ? "text-amber-500 font-bold" : ""
                      )}>
                        {inputText.length}/1000
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </>
          ) : (
            /* Empty State when no conversation selected */
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-400">
              <div className="w-16 h-16 rounded-3xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-emerald-500 shadow-md mb-4">
                <MessageCircle size={32} />
              </div>
              <h2 className="text-base font-bold text-slate-700 dark:text-slate-200 mb-1">
                WhatsApp Center
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm">
                Select a conversation from the left to view message history or type a direct message to a customer.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

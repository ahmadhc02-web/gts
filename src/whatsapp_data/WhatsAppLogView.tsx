import React, { useState, useEffect, useMemo, memo } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { 
  X, 
  Search, 
  MessageCircle, 
  Check, 
  CheckCheck, 
  Clock, 
  AlertCircle, 
  RefreshCw, 
  Smartphone, 
  Users, 
  ChevronRight, 
  Phone,
  ArrowLeft,
  Sun,
  Moon
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import WhatsAppChatModal from './WhatsAppChatModal';
import { cn } from '../lib/utils';
import { useTheme } from '../hooks/useTheme';

interface MessageItem {
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

interface GroupedThread {
  phone: string;
  clientName: string;
  clientUsername: string;
  lastMessage: MessageItem;
  messagesCount: number;
  unreadCount: number;
}

interface WhatsAppLogViewProps {
  isOpen?: boolean;
  onClose?: () => void;
  currentUser?: any;
  standalone?: boolean;
}

// Memoized Row Component supporting both Light & Dark modes - Full Width
const ThreadRow = memo(({
  thread,
  sessionKey,
  onOpenChat
}: {
  thread: GroupedThread;
  sessionKey: string;
  onOpenChat: (phone: string, name?: string, username?: string) => void;
}) => {
  const { phone, clientName, clientUsername, lastMessage } = thread;
  const isOut = lastMessage.direction === 'out';
  const timeStr = formatRelativeTime(lastMessage.created_at);

  const kindColors: Record<string, string> = {
    reminder: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
    complaint: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
    campaign: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20',
    manual: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
    other: 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20'
  };

  const initials = (clientName || phone || 'U')
    .split(' ')
    .map(s => s[0])
    .join('')
    .substring(0, 2)
    .toUpperCase();

  return (
    <div
      onClick={() => onOpenChat(phone, clientName, clientUsername)}
      className="group w-full p-4.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-emerald-500/50 hover:shadow-lg dark:hover:shadow-emerald-950/20 transition-all duration-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 cursor-pointer"
    >
      {/* Left: Avatar & Identity */}
      <div className="flex items-center gap-3.5 min-w-0 flex-1">
        <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white font-black text-sm flex items-center justify-center shrink-0 shadow-md">
          {initials}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h4 className="text-sm font-black text-slate-900 dark:text-slate-100 truncate">
              {clientName || 'Unknown Client'}
            </h4>
            {clientUsername && (
              <span className="text-xs text-slate-500 dark:text-slate-400 font-medium truncate">
                (@{clientUsername})
              </span>
            )}
            <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border", kindColors[lastMessage.kind] || kindColors.other)}>
              {lastMessage.kind || 'manual'}
            </span>
          </div>
          <div className="flex items-center gap-2 mt-1 text-xs text-slate-500 dark:text-slate-400">
            <span className="font-mono font-bold text-slate-700 dark:text-slate-300">{phone}</span>
            <span>•</span>
            <span className="truncate max-w-2xl text-slate-600 dark:text-slate-300 font-medium">
              {lastMessage.body}
            </span>
          </div>
        </div>
      </div>

      {/* Right: Time, Status & Open Chat Button */}
      <div className="flex items-center gap-4 self-end sm:self-center shrink-0 w-full sm:w-auto justify-between sm:justify-end border-t sm:border-t-0 pt-3 sm:pt-0 border-slate-100 dark:border-slate-800">
        <div className="flex flex-col sm:items-end">
          <span className="text-xs font-bold text-slate-400 dark:text-slate-500">{timeStr}</span>
          <div className="flex items-center gap-1 mt-0.5">
            {lastMessage.status === 'failed' ? (
              <span className="text-xs text-red-500 font-bold flex items-center gap-1">
                <AlertCircle size={12} /> Failed
              </span>
            ) : lastMessage.status === 'received' ? (
              <span className="text-xs text-blue-500 font-bold flex items-center gap-1">
                <CheckCheck size={12} /> Received
              </span>
            ) : (
              <span className="text-xs text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1">
                <Check size={12} /> Sent
              </span>
            )}
          </div>
        </div>

        <button
          onClick={(e) => {
            e.stopPropagation();
            onOpenChat(phone, clientName, clientUsername);
          }}
          className="px-4 py-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-950/70 font-black text-xs flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
        >
          <MessageCircle size={14} />
          <span>Open Chat</span>
          <ChevronRight size={14} />
        </button>
      </div>
    </div>
  );
});

function formatRelativeTime(isoString: string): string {
  try {
    const date = new Date(isoString);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    const isYesterday = date.toDateString() === yesterday.toDateString();

    if (isToday) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    if (isYesterday) {
      return `Yesterday ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    }
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  } catch {
    return '';
  }
}

export default function WhatsAppLogView({
  isOpen = true,
  onClose,
  currentUser,
  standalone = true
}: WhatsAppLogViewProps) {
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();

  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<{ message: string; code?: string } | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [pageLimit, setPageLimit] = useState(300);
  const [hasMore, setHasMore] = useState(true);
  
  // Active chat modal state
  const [activeChatPhone, setActiveChatPhone] = useState<string | null>(null);
  const [activeChatName, setActiveChatName] = useState<string | undefined>();
  const [activeChatUsername, setActiveChatUsername] = useState<string | undefined>();

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

  // Compute session key securely with app rule
  const sessionKey = useMemo(() => {
    const isSubDealerUser = (currentUser?.role === 'dealer' || Boolean(currentUser?.dealerId && currentUser?.dealerId !== 'main') || Boolean(currentUser?.lineCode)) && currentUser?.role !== 'admin' && currentUser?.role !== 'super_admin';
    const subDealerLineCode = (currentUser?.lineCode || '').trim();
    const subDealerDealerId = (currentUser?.role === 'dealer' ? currentUser?.uid : (currentUser?.dealerId || currentUser?.uid || 'main')).trim();
    if (isSubDealerUser) {
      return subDealerLineCode || subDealerDealerId || 'main';
    }
    return 'main';
  }, [currentUser]);

  // Debounce search query (200ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 200);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Handle Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (activeChatPhone) {
          setActiveChatPhone(null);
        } else {
          handleClose();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, activeChatPhone]);

  // Fetch messages from Supabase
  const fetchMessages = async (showRefreshIndicator = false) => {
    if (showRefreshIndicator) setIsRefreshing(true);
    else setLoading(true);

    try {
      const { data, error } = await supabase
        .from('whatsapp_messages')
        .select('*')
        .eq('session_key', sessionKey)
        .order('created_at', { ascending: false })
        .limit(pageLimit);

      if (error) {
        console.error('Supabase query error loading whatsapp_messages:', error);
        setLoadError({ message: error.message, code: error.code });
        // Keep existing list unchanged
      } else if (data) {
        setLoadError(null);
        setMessages(data as MessageItem[]);
        if (data.length < pageLimit) {
          setHasMore(false);
        }
      }
    } catch (err: any) {
      console.error('Error loading WhatsApp message log:', err);
      setLoadError({ message: err?.message || String(err) });
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    let active = true;

    fetchMessages();

    // Real-time subscription
    const channel = supabase
      .channel(`whatsapp_log_${sessionKey}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'whatsapp_messages',
          filter: `session_key=eq.${sessionKey}`
        },
        (payload) => {
          const newMsg = payload.new as MessageItem;
          setMessages(prev => {
            if (prev.some(m => m.id === newMsg.id)) return prev;
            return [newMsg, ...prev];
          });
        }
      )
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.warn(`WhatsApp realtime channel status: ${status} for session ${sessionKey}`);
        }
      });

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [isOpen, sessionKey, pageLimit]);

  // Group messages by phone number
  const groupedThreads = useMemo(() => {
    const map = new Map<string, GroupedThread>();

    messages.forEach(m => {
      const phoneKey = (m.phone || '').trim();
      if (!phoneKey) return;

      if (!map.has(phoneKey)) {
        map.set(phoneKey, {
          phone: phoneKey,
          clientName: m.client_name || '',
          clientUsername: m.client_username || '',
          lastMessage: m,
          messagesCount: 1,
          unreadCount: 0
        });
      } else {
        const thread = map.get(phoneKey)!;
        thread.messagesCount += 1;
        if (new Date(m.created_at).getTime() > new Date(thread.lastMessage.created_at).getTime()) {
          thread.lastMessage = m;
          if (m.client_name) thread.clientName = m.client_name;
          if (m.client_username) thread.clientUsername = m.client_username;
        }
      }
    });

    return Array.from(map.values());
  }, [messages]);

  // Filter threads by search query
  const filteredThreads = useMemo(() => {
    if (!debouncedSearch.trim()) return groupedThreads;
    const q = debouncedSearch.toLowerCase();
    return groupedThreads.filter(t => {
      return (
        t.phone.toLowerCase().includes(q) ||
        t.clientName.toLowerCase().includes(q) ||
        t.clientUsername.toLowerCase().includes(q) ||
        t.lastMessage.body.toLowerCase().includes(q)
      );
    });
  }, [groupedThreads, debouncedSearch]);

  // Header statistics chips
  const stats = useMemo(() => {
    const totalUsers = groupedThreads.length;
    const todayStr = new Date().toDateString();
    const messagesToday = messages.filter(m => new Date(m.created_at).toDateString() === todayStr).length;
    const failedToday = messages.filter(m => m.status === 'failed' && new Date(m.created_at).toDateString() === todayStr).length;
    return { totalUsers, messagesToday, failedToday };
  }, [groupedThreads, messages]);

  if (!isOpen) return null;

  const content = (
    <div className="min-h-screen w-full bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col font-sans">
      {/* Top Header Bar - Full Width Edge to Edge */}
      <header className="w-full px-4 sm:px-6 lg:px-8 py-3.5 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0 shadow-xs z-20">
        <div className="flex items-center gap-3 sm:gap-4">
          <button
            onClick={handleClose}
            className="p-2 sm:px-3 sm:py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer border border-slate-200 dark:border-slate-700 shrink-0"
            title="Go Back"
          >
            <ArrowLeft size={16} />
            <span className="hidden sm:inline">Back</span>
          </button>

          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 shrink-0">
              <MessageCircle size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-base sm:text-lg font-black font-lexend text-slate-900 dark:text-white tracking-tight">
                  WhatsApp Message Log
                </h1>
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 font-mono font-bold border border-emerald-500/30">
                  Session: {sessionKey}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium hidden sm:block">
                Centralized real-time audit log of all automated reminders, campaigns, complaints, and manual chats.
              </p>
            </div>
          </div>
        </div>

        {/* Right Header Actions */}
        <div className="flex items-center gap-2">
          {/* Refresh Button */}
          <button
            onClick={() => fetchMessages(true)}
            disabled={isRefreshing || loading}
            className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors cursor-pointer border border-slate-200 dark:border-slate-700"
            title="Refresh Messages"
          >
            <RefreshCw size={16} className={isRefreshing ? "animate-spin text-emerald-500" : ""} />
          </button>

          {/* Theme Toggle (Light / Dark) */}
          <button
            onClick={toggleTheme}
            className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors cursor-pointer border border-slate-200 dark:border-slate-700"
            title={theme === 'dark' ? "Switch to Light Mode" : "Switch to Dark Mode"}
          >
            {theme === 'dark' ? <Sun size={16} className="text-amber-400" /> : <Moon size={16} className="text-slate-700" />}
          </button>

          {/* Close Button */}
          <button
            onClick={handleClose}
            className="p-2 rounded-xl bg-slate-100 hover:bg-red-50 dark:bg-slate-800 dark:hover:bg-red-950/40 text-slate-600 dark:text-slate-300 hover:text-red-600 dark:hover:text-red-400 transition-colors cursor-pointer border border-slate-200 dark:border-slate-700"
            title="Close WhatsApp Log (Esc)"
          >
            <X size={18} />
          </button>
        </div>
      </header>

      {/* Main Screen Content - Width Fits Across the Entire Screen */}
      <main className="flex-1 w-full px-4 sm:px-6 lg:px-8 py-5 flex flex-col gap-5 overflow-y-auto">
        {/* Header Stats Chips - Full Width */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 w-full">
          <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center gap-3.5 shadow-xs">
            <div className="p-3 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 shrink-0">
              <Users size={20} />
            </div>
            <div>
              <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Total Users Messaged</p>
              <p className="text-2xl font-black text-slate-900 dark:text-white leading-tight">{stats.totalUsers}</p>
            </div>
          </div>
          <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center gap-3.5 shadow-xs">
            <div className="p-3 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 shrink-0">
              <MessageCircle size={20} />
            </div>
            <div>
              <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Messages Today</p>
              <p className="text-2xl font-black text-slate-900 dark:text-white leading-tight">{stats.messagesToday}</p>
            </div>
          </div>
          <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center gap-3.5 shadow-xs">
            <div className="p-3 rounded-xl bg-red-500/10 text-red-600 dark:text-red-400 shrink-0">
              <AlertCircle size={20} />
            </div>
            <div>
              <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Failed Today</p>
              <p className="text-2xl font-black text-slate-900 dark:text-white leading-tight">{stats.failedToday}</p>
            </div>
          </div>
        </div>

        {/* Search Bar - Full Width Fit */}
        <div className="w-full relative">
          <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search by client name, username, phone number, or message text..."
            className="w-full pl-11 pr-10 py-3 text-xs sm:text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl focus:border-emerald-500 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 shadow-xs outline-none transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white cursor-pointer"
            >
              <X size={16} />
            </button>
          )}
        </div>

        {/* Threads List - Full Width Edge to Edge */}
        <div className="w-full flex-1 space-y-3 pb-8">
          {loadError && (
            <div className="w-full p-4 rounded-2xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 text-red-900 dark:text-red-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
              <div className="flex items-start gap-3">
                <AlertCircle size={20} className="text-red-500 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-xs sm:text-sm font-black text-red-700 dark:text-red-400">
                    Could not load WhatsApp logs: {loadError.message}{loadError.code ? ` (${loadError.code})` : ''}
                  </h4>
                  <p className="text-[11px] text-red-600/90 dark:text-red-400/90 mt-0.5">
                    Check that the table whatsapp_messages exists and that its row level security policies allow select.
                  </p>
                </div>
              </div>
              <button
                onClick={() => fetchMessages(true)}
                disabled={isRefreshing || loading}
                className="px-3.5 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white font-black text-xs flex items-center gap-1.5 transition-colors cursor-pointer shrink-0 shadow-xs"
              >
                <RefreshCw size={13} className={isRefreshing ? "animate-spin" : ""} />
                <span>Retry</span>
              </button>
            </div>
          )}

          {loading ? (
            <div className="space-y-3 w-full">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="h-20 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl animate-pulse w-full" />
              ))}
            </div>
          ) : filteredThreads.length === 0 ? (
            <div className="w-full p-12 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center flex flex-col items-center justify-center gap-3 text-slate-500 dark:text-slate-400 shadow-xs">
              <Smartphone size={44} className="opacity-35" />
              <h3 className="text-base font-black text-slate-800 dark:text-slate-200">
                {searchQuery ? 'No WhatsApp messages found' : `No messages logged yet for session ${sessionKey}.`}
              </h3>
              <p className="text-xs max-w-md">
                {searchQuery
                  ? 'No conversations match your search query.'
                  : `No messages logged yet for session ${sessionKey}. Messages sent after the logging update appear here.`}
              </p>
            </div>
          ) : (
            <>
              {filteredThreads.map(thread => (
                <ThreadRow
                  key={thread.phone}
                  thread={thread}
                  sessionKey={sessionKey}
                  onOpenChat={(ph, name, username) => {
                    setActiveChatPhone(ph);
                    setActiveChatName(name);
                    setActiveChatUsername(username);
                  }}
                />
              ))}

              {hasMore && !searchQuery && (
                <div className="pt-4 text-center">
                  <button
                    onClick={() => setPageLimit(prev => prev + 300)}
                    className="px-6 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-850 text-xs font-black text-slate-700 dark:text-slate-300 transition-colors cursor-pointer shadow-xs"
                  >
                    Load Older Messages (+300)
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </main>

      {/* Active Chat Modal */}
      {activeChatPhone && (
        <WhatsAppChatModal
          isOpen={Boolean(activeChatPhone)}
          onClose={() => setActiveChatPhone(null)}
          phone={activeChatPhone}
          clientName={activeChatName}
          clientUsername={activeChatUsername}
          sessionKey={sessionKey}
        />
      )}
    </div>
  );

  return content;
}

import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, Send, Check, CheckCheck, Clock, AlertCircle, RefreshCw, Smartphone } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { sendMessage, getStatus } from './whatsappApi';
import { cn } from '../lib/utils';
import { toast } from 'sonner';

interface MessageRow {
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

interface WhatsAppChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  phone: string;
  clientName?: string;
  clientUsername?: string;
  sessionKey: string;
  onMessageSent?: () => void;
}

export default function WhatsAppChatModal({
  isOpen,
  onClose,
  phone,
  clientName,
  clientUsername,
  sessionKey,
  onMessageSent
}: WhatsAppChatModalProps) {
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [inputText, setInputText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isConnected, setIsConnected] = useState(true);
  const [lastSentTime, setLastSentTime] = useState<number>(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Check connection status
  useEffect(() => {
    if (!isOpen) return;
    getStatus(sessionKey).then(st => {
      setIsConnected(Boolean(st?.connected));
    }).catch(() => {});
  }, [isOpen, sessionKey]);

  // Fetch initial messages for this phone & session_key
  useEffect(() => {
    if (!isOpen || !phone) return;
    let active = true;
    setLoading(true);

    async function fetchChat() {
      try {
        const normPhone = phone.replace(/\D/g, '');
        const { data, error } = await supabase
          .from('whatsapp_messages')
          .select('*')
          .eq('session_key', sessionKey)
          .or(`phone.eq.${phone},phone.eq.${normPhone},phone.ilike.%${normPhone}%`)
          .order('created_at', { ascending: true })
          .limit(200);

        if (!error && data && active) {
          setMessages(data as MessageRow[]);
        }
      } catch (err) {
        console.error('Error fetching chat messages:', err);
      } finally {
        if (active) setLoading(false);
      }
    }

    fetchChat();

    // Subscribe to real-time inserts for this chat
    const channel = supabase
      .channel(`chat_${sessionKey}_${phone}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'whatsapp_messages',
          filter: `session_key=eq.${sessionKey}`
        },
        (payload) => {
          const newMsg = payload.new as MessageRow;
          const targetNorm = phone.replace(/\D/g, '');
          const msgNorm = (newMsg.phone || '').replace(/\D/g, '');
          if (msgNorm === targetNorm || newMsg.phone === phone) {
            setMessages(prev => {
              if (prev.some(m => m.id === newMsg.id)) return prev;
              return [...prev, newMsg];
            });
          }
        }
      )
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [isOpen, phone, sessionKey]);

  // Auto scroll to bottom
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  // Handle Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSend = async (textToSend?: string) => {
    const text = (textToSend !== undefined ? textToSend : inputText).trim();
    if (!text || isSending) return;

    if (!isConnected) {
      toast.error('WhatsApp is not connected. Please connect WhatsApp first.');
      return;
    }

    // Rate limit: 1 manual message per second
    const now = Date.now();
    if (now - lastSentTime < 1000) {
      toast.warning('Please wait a second between messages.');
      return;
    }

    setIsSending(true);
    setLastSentTime(now);

    // Optimistic message
    const tempId = 'opt_' + Math.random().toString(36).substring(2, 9);
    const optimisticMsg: MessageRow = {
      id: tempId,
      session_key: sessionKey,
      phone,
      client_name: clientName,
      client_username: clientUsername,
      direction: 'out',
      kind: 'manual',
      body: text,
      status: 'sent',
      created_at: new Date().toISOString()
    };

    setMessages(prev => [...prev, optimisticMsg]);
    if (!textToSend) setInputText('');

    try {
      await sendMessage(
        phone,
        text,
        sessionKey,
        {
          kind: 'manual',
          clientName: clientName || '',
          clientUsername: clientUsername || ''
        }
      );
      if (onMessageSent) onMessageSent();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to send message');
      // Update optimistic msg to failed
      setMessages(prev =>
        prev.map(m => (m.id === tempId ? { ...m, status: 'failed', error: err?.message } : m))
      );
    } finally {
      setIsSending(false);
      if (textareaRef.current) {
        textareaRef.current.focus();
      }
    }
  };

  const handleRetry = (msg: MessageRow) => {
    handleSend(msg.body);
  };

  const initials = (clientName || phone || 'U')
    .split(' ')
    .map(s => s[0])
    .join('')
    .substring(0, 2)
    .toUpperCase();

  return createPortal(
    <div
      className="fixed inset-0 z-50 bg-slate-900/60 dark:bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-0 sm:p-4 animate-[fadeIn_0.2s_ease-out]"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-2xl h-full sm:h-[85vh] bg-white dark:bg-slate-900 sm:rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col overflow-hidden text-slate-900 dark:text-slate-100"
        onClick={e => e.stopPropagation()}
      >
        {/* Chat Header */}
        <div className="px-5 py-4 bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white font-black text-sm flex items-center justify-center shadow-md relative">
              <span>{initials}</span>
              <span
                className={cn(
                  "absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white dark:border-slate-900",
                  isConnected ? "bg-emerald-500 animate-pulse" : "bg-amber-500"
                )}
              />
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-900 dark:text-slate-100">
                {clientName || phone}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium flex items-center gap-2">
                <span>{phone}</span>
                {clientUsername && <span className="opacity-80">(@{clientUsername})</span>}
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-mono">
                  Session: {sessionKey}
                </span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        {/* Message Area */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 bg-slate-100/60 dark:bg-slate-950/60">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-slate-400">
              <div className="w-8 h-8 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin" />
              <p className="text-xs font-bold">Loading conversation...</p>
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-2 text-slate-400">
              <Smartphone size={36} className="opacity-40" />
              <p className="text-sm font-bold">No messages in this chat yet</p>
              <p className="text-xs">Send a message below to start the conversation.</p>
            </div>
          ) : (
            messages.map((m, idx) => {
              const isOut = m.direction === 'out';
              const timeStr = new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
              return (
                <div
                  key={m.id || idx}
                  className={cn("flex flex-col", isOut ? "items-end" : "items-start")}
                >
                  <div
                    className={cn(
                      "max-w-[80%] sm:max-w-[70%] rounded-2xl px-4 py-2.5 shadow-sm text-sm relative group",
                      isOut
                        ? "bg-emerald-600 text-white rounded-tr-none"
                        : "bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-tl-none border border-slate-200 dark:border-slate-700"
                    )}
                  >
                    {/* Kind badge if not manual */}
                    {m.kind && m.kind !== 'manual' && (
                      <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-black uppercase tracking-wider mb-1 bg-black/20 text-white/90">
                        {m.kind}
                      </span>
                    )}
                    <p className="whitespace-pre-wrap break-words leading-relaxed">{m.body}</p>
                    
                    <div className={cn("flex items-center gap-1.5 mt-1 text-[10px]", isOut ? "text-emerald-100 justify-end" : "text-slate-400 dark:text-slate-400 justify-end")}>
                      <span>{timeStr}</span>
                      {isOut && (
                        m.status === 'failed' ? (
                          <button
                            onClick={() => handleRetry(m)}
                            className="text-amber-200 hover:text-white flex items-center gap-1 underline font-bold cursor-pointer"
                            title="Failed to send. Click to retry."
                          >
                            <AlertCircle size={12} /> Retry
                          </button>
                        ) : m.status === 'received' ? (
                          <CheckCheck size={13} className="text-blue-300" />
                        ) : (
                          <Check size={13} className="text-emerald-200" />
                        )
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Footer */}
        <div className="p-3 sm:p-4 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 shrink-0">
          {!isConnected && (
            <div className="mb-2 px-3 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-800 dark:text-amber-200 text-xs font-bold flex items-center gap-2">
              <AlertCircle size={14} className="shrink-0" />
              <span>WhatsApp is currently disconnected. Messages cannot be sent until reconnected.</span>
            </div>
          )}
          <div className="flex items-end gap-2">
            <textarea
              ref={textareaRef}
              value={inputText}
              onChange={e => setInputText(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder={isConnected ? "Type a WhatsApp message... (Enter to send)" : "WhatsApp disconnected..."}
              disabled={isSending}
              rows={1}
              className="flex-1 px-4 py-2.5 text-xs sm:text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl focus:border-emerald-500 dark:focus:border-emerald-500 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 resize-none max-h-32"
            />
            <button
              onClick={() => handleSend()}
              disabled={!inputText.trim() || isSending || !isConnected}
              className={cn(
                "p-3 rounded-2xl font-black text-white flex items-center justify-center transition-all shrink-0 shadow-md cursor-pointer",
                !inputText.trim() || isSending || !isConnected
                  ? "bg-slate-300 dark:bg-slate-800 text-slate-400 cursor-not-allowed shadow-none"
                  : "bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/20"
              )}
            >
              {isSending ? <RefreshCw size={18} className="animate-spin" /> : <Send size={18} />}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

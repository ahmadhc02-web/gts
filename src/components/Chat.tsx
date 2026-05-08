import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Send, User, X, MessageSquare, Clock, CheckCheck, Eye, Trash2, Smile, Paperclip, Mic, CornerUpLeft, Loader2 } from 'lucide-react';
import EmojiPicker, { Theme, EmojiClickData } from 'emoji-picker-react';
import { ChatMessage, UserProfile } from '../types';
import { firebaseService } from '../lib/firebaseService';
import { cn } from '../lib/utils';
import { useTheme } from '../hooks/useTheme';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import VoiceRecorder from './VoiceRecorder';
import VoiceMsgPlayer from './VoiceMsgPlayer';
import { toast } from 'sonner';

interface ChatProps {
  currentUser: UserProfile;
  users?: UserProfile[];
  onClose: () => void;
  isAudioMuted?: boolean;
  isMicMuted?: boolean;
}

export default function Chat({ currentUser, users = [], onClose, isAudioMuted = false, isMicMuted = false }: ChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [typingUsers, setTypingUsers] = useState<{ uid: string, username: string }[]>([]);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [selectedScope, setSelectedScope] = useState<string>(currentUser.role === 'member' ? (users.find(u => u.role === 'super_admin' || u.role === 'admin')?.uid || users.find(u => u.role === 'dealer')?.uid || 'global') : 'global');

  useEffect(() => {
    if (currentUser.role === 'member' && selectedScope === 'global') {
       const uScope = users.find(u => u.role === 'super_admin' || u.role === 'admin')?.uid || users.find(u => u.role === 'dealer')?.uid;
       if (uScope) setSelectedScope(uScope);
    }
  }, [currentUser.role, users, selectedScope]);

  const { theme } = useTheme();
  const isOnline = useOnlineStatus();

  const scrollRef = useRef<HTMLDivElement>(null);
  const emojiPickerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [viewportHeight, setViewportHeight] = useState<string>('100%');
  const [viewportTop, setViewportTop] = useState<number>(0);
  const [isUserSelectorOpen, setIsUserSelectorOpen] = useState(false);

  const isUserOnline = (lastActive?: number) => {
    if (!lastActive) return false;
    const fiveMinutes = 5 * 60 * 1000;
    return Date.now() - lastActive < fiveMinutes;
  };

  // Handle Visual Viewport for mobile keyboards
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleResize = () => {
      const vv = window.visualViewport;
      if (vv) {
        // Update height and offset from layout top
        setViewportHeight(`${vv.height}px`);
        setViewportTop(vv.offsetTop);
      } else {
        setViewportHeight('100%');
        setViewportTop(0);
      }
    };

    window.visualViewport?.addEventListener('resize', handleResize);
    window.visualViewport?.addEventListener('scroll', handleResize);
    window.addEventListener('resize', handleResize);
    
    // Initial sync
    handleResize();

    return () => {
      window.visualViewport?.removeEventListener('resize', handleResize);
      window.visualViewport?.removeEventListener('scroll', handleResize);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  const QUICK_RESPONSES = [
    "Roger that. 👍",
    "Operation started. 🚀",
    "Technician dispatched. 🔧",
    "Status updated. ✅",
    "Critical alarm! 🚨"
  ];
  
  useEffect(() => {
    const handleOpenChatEvent = (e: any) => {
      if (e.detail?.uid) {
        setSelectedScope(e.detail.uid);
      }
    };
    window.addEventListener('openChat', handleOpenChatEvent);
    return () => window.removeEventListener('openChat', handleOpenChatEvent);
  }, []);

  useEffect(() => {
    const unsubscribe = firebaseService.subscribeMessages((msgs) => {
      setMessages(msgs);
      
      msgs.forEach(msg => {
        if (!msg.seenBy?.[currentUser.uid]) {
          // Only mark as seen if it's a global message or current user is the intended recipient
          if (!msg.recipientId || msg.recipientId === currentUser.uid) {
            firebaseService.markMessageAsSeen(msg.id, currentUser);
          }
        }
      });
    });

    const unsubscribeTyping = firebaseService.subscribeTypingStatus((typing) => {
      setTypingUsers(typing.filter(t => t.uid !== currentUser.uid));
    });

    return () => {
      unsubscribe();
      unsubscribeTyping();
    };
  }, [currentUser]);

  // Handle typing status
  useEffect(() => {
    if (newMessage.trim() === '') {
      firebaseService.setTypingStatus(currentUser.uid, currentUser.username, false);
      return;
    }

    firebaseService.setTypingStatus(currentUser.uid, currentUser.username, true);
    
    const timeout = setTimeout(() => {
      firebaseService.setTypingStatus(currentUser.uid, currentUser.username, false);
    }, 3000);

    return () => clearTimeout(timeout);
  }, [newMessage, currentUser]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: 'smooth'
      });
    }
  }, [messages, isRecording, replyTo, selectedScope, typingUsers]);

  // Handle clicking outside emoji picker to close it
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(event.target as Node)) {
        setShowEmojiPicker(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSendMessage = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || isSending) return;

    setIsSending(true);
    try {
      const replyData: ChatMessage['replyTo'] = replyTo ? {
        id: replyTo.id,
        senderName: replyTo.senderName,
        ...(replyTo.text && { text: replyTo.text }),
        ...(replyTo.type && { type: replyTo.type })
      } : undefined;

      const recipientId = selectedScope === 'global' ? undefined : selectedScope;
      await firebaseService.sendMessage(currentUser, trimmed, replyData, recipientId);
      setNewMessage('');
      setShowEmojiPicker(false);
      setReplyTo(null);
    } catch (err) {
      console.error('Failed to send message:', err instanceof Error ? err.message : String(err));
      toast.error('Failed to send message. Please check your connection.');
    } finally {
      setIsSending(false);
    }
  };

  const handleSendVoice = async (base64: string, duration: number) => {
    setIsSending(true);
    try {
      const replyData: ChatMessage['replyTo'] = replyTo ? {
        id: replyTo.id,
        senderName: replyTo.senderName,
        ...(replyTo.text && { text: replyTo.text }),
        ...(replyTo.type && { type: replyTo.type })
      } : undefined;

      const recipientId = selectedScope === 'global' ? undefined : selectedScope;
      await firebaseService.sendVoiceMessage(currentUser, base64, duration, replyData, recipientId);
      setIsRecording(false);
      setReplyTo(null);
    } catch (err) {
      console.error('Failed to send voice message:', err instanceof Error ? err.message : String(err));
      toast.error('Failed to send voice message. It might be too large or your connection is weak.');
    } finally {
      setIsSending(false);
    }
  };

  const onEmojiClick = (emojiData: EmojiClickData) => {
    setNewMessage(prev => prev + emojiData.emoji);
  };

  const handleDeleteMessage = async (messageId: string) => {
    try {
      setDeleteConfirmId(null);
      await firebaseService.deleteMessage(messageId);
      toast.success('Message deleted');
    } catch (err) {
      console.error('Failed to delete message:', err instanceof Error ? err.message : String(err));
      toast.error('Failed to delete message');
    }
  };

  const handleClearChat = async () => {
    if (!window.confirm('WIPE ALL OPERATIONAL LOGS?')) return;
    try {
      await firebaseService.clearAllMessages();
    } catch (err) {
      console.error('Failed to clear chat:', err instanceof Error ? err.message : String(err));
    }
  };

  const formatTime = (ts: number) => {
    return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const visibleMessages = messages.filter(msg => {
    if (!msg.recipientId) return true;
    if (msg.senderId === currentUser.uid || msg.recipientId === currentUser.uid) return true;
    return false;
  });

  const displayedMessages = visibleMessages.filter(msg => {
    if (selectedScope === 'global') {
      return !msg.recipientId;
    }
    return !!msg.recipientId && (
      (msg.recipientId === selectedScope && msg.senderId === currentUser.uid) || 
      (msg.senderId === selectedScope && msg.recipientId === currentUser.uid)
    );
  });

  // Lock body scroll on mobile when chat is open
  useEffect(() => {
    if (window.innerWidth < 640) {
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = '';
      };
    }
  }, []);

  return (
    <motion.div
      initial={{ x: window.innerWidth < 640 ? '-100%' : -400, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: window.innerWidth < 640 ? '-100%' : -400, opacity: 0 }}
      transition={{ 
        type: 'spring', 
        damping: 25, 
        stiffness: 200
      }}
      className="fixed left-0 w-full sm:w-96 bg-white dark:bg-slate-950 shadow-2xl z-[150] border-r border-slate-200 dark:border-slate-800 flex flex-col"
      style={{ 
        height: viewportHeight,
        top: 0,
        transform: `translateY(${viewportTop}px)`,
        willChange: 'transform',
        overscrollBehavior: 'contain'
      }}
    >
      {/* Header */}
      <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-950/80 backdrop-blur-md flex flex-col gap-3 shrink-0 z-[160]">
        <div className="flex justify-between items-center w-full">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-10 h-10 rounded-2xl bg-blue-600/10 dark:bg-blue-500/10 flex items-center justify-center text-blue-600 dark:text-blue-400 border border-blue-600/20 shadow-inner">
                <MessageSquare size={20} />
              </div>
              <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 border-2 border-white dark:border-slate-950 rounded-full animate-pulse" />
            </div>
            <div>
              <h3 className="text-sm font-black uppercase tracking-tight text-slate-900 dark:text-white leading-tight font-display">Communication Node</h3>
              <div className="flex items-center gap-1.5 mt-0.5">
                <div className={cn(
                  "w-1.5 h-1.5 rounded-full animate-pulse",
                  isOnline ? "bg-emerald-500" : "bg-amber-500"
                )} />
                <p className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest leading-none">
                  {isOnline ? 'Encrypted • Live Relay' : 'Offline • Local Access'}
                </p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {currentUser.role === 'admin' && (
              <button 
                onClick={handleClearChat}
                className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-xl transition-all"
                title="Clear Logs"
              >
                <Trash2 size={16} />
              </button>
            )}
            <button 
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Channel Selector - Redesigned */}
        <div className="w-full relative mt-1 z-[170]">
          <button
            onClick={() => setIsUserSelectorOpen(!isUserSelectorOpen)}
            className="w-full px-4 py-3 text-[11px] font-black uppercase tracking-[0.15em] rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 text-slate-700 dark:text-slate-300 flex items-center justify-between shadow-sm active:scale-[0.98] transition-all"
          >
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-blue-600 animate-pulse shadow-[0_0_8px_rgba(37,99,235,0.5)]" />
              <span>
                {selectedScope === 'global' 
                  ? 'GLOBAL RELAY (ALL)' 
                  : `PRIVATE: ${users.find(u => u.uid === selectedScope)?.username || 'SECURE_NODE'}`
                }
              </span>
            </div>
            <motion.div
              animate={{ rotate: isUserSelectorOpen ? 180 : 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 20 }}
            >
              <svg width="10" height="6" viewBox="0 0 10 6" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </motion.div>
          </button>

          <AnimatePresence>
            {isUserSelectorOpen && (
              <>
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={() => setIsUserSelectorOpen(false)}
                  className="fixed inset-0 z-10"
                />
                <motion.div
                  initial={{ opacity: 0, y: -10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 4, scale: 1 }}
                  exit={{ opacity: 0, y: -10, scale: 0.95 }}
                  transition={{ type: "spring", stiffness: 400, damping: 30 }}
                  className="absolute top-full left-0 right-0 z-20 mt-1 p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.2)] max-h-64 overflow-y-auto scrollbar-thin overflow-x-hidden"
                >
                  <div className="space-y-1">
                    {currentUser.role !== 'member' && (
                      <>
                        <button
                          onClick={() => {
                            setSelectedScope('global');
                            setIsUserSelectorOpen(false);
                          }}
                          className={cn(
                            "w-full px-4 py-3 rounded-xl text-left transition-all flex items-center justify-between group",
                            selectedScope === 'global' ? "bg-blue-600 text-white" : "hover:bg-slate-100 dark:hover:bg-slate-800"
                          )}
                        >
                          <div className="flex items-center gap-3">
                            <div className={cn(
                              "w-8 h-8 rounded-lg flex items-center justify-center border",
                              selectedScope === 'global' ? "bg-white/20 border-white/30" : "bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700"
                            )}>
                              <MessageSquare size={14} className={selectedScope === 'global' ? 'text-white' : 'text-blue-600'} />
                            </div>
                            <div>
                              <p className="text-[10px] font-black uppercase tracking-widest">Global Relay</p>
                              <p className={cn("text-[8px] font-bold uppercase tracking-widest opacity-60", selectedScope === 'global' ? "text-white" : "text-slate-500")}>
                                All active personnel
                              </p>
                            </div>
                          </div>
                          {selectedScope === 'global' && <CheckCheck size={14} className="text-white" />}
                        </button>

                        <div className="my-2 px-4 flex items-center gap-2">
                          <div className="flex-1 h-px bg-slate-100 dark:bg-slate-800" />
                          <span className="text-[7px] font-black text-slate-400 uppercase tracking-[0.2em]">Deployment Nodes</span>
                          <div className="flex-1 h-px bg-slate-100 dark:bg-slate-800" />
                        </div>
                      </>
                    )}

                    {users
                      .filter(u => u.uid !== currentUser.uid)
                      .filter(u => {
                        if (currentUser.role === 'member') {
                          return u.role === 'admin' || u.role === 'super_admin' || (u.role === 'dealer' && u.uid === currentUser.dealerId);
                        }
                        if (currentUser.role === 'admin' || currentUser.role === 'super_admin') {
                          return u.role !== 'dealer';
                        }
                        if (currentUser.role === 'dealer') {
                          return u.role !== 'dealer';
                        }
                        return true;
                      })
                      .map((user, idx) => {
                        const online = isUserOnline(user.lastActive);
                        return (
                          <motion.button
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: idx * 0.03 }}
                            key={user.uid}
                            onClick={() => {
                              setSelectedScope(user.uid);
                              setIsUserSelectorOpen(false);
                            }}
                            className={cn(
                              "w-full px-4 py-3 rounded-xl text-left transition-all flex items-center justify-between group",
                              selectedScope === user.uid ? "bg-blue-600 text-white" : "hover:bg-slate-100 dark:hover:bg-slate-800"
                            )}
                          >
                            <div className="flex items-center gap-3">
                              <div className="relative">
                                <div className={cn(
                                  "w-8 h-8 rounded-lg flex items-center justify-center border",
                                  selectedScope === user.uid ? "bg-white/20 border-white/30" : "bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700"
                                )}>
                                  <User size={14} className={selectedScope === user.uid ? 'text-white' : 'text-slate-500'} />
                                </div>
                                <span className={cn(
                                  "absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 border-2 rounded-full",
                                  online ? "bg-emerald-500" : "bg-blue-500",
                                  selectedScope === user.uid ? (online ? "border-blue-600" : "border-blue-600") : "border-white dark:border-slate-900"
                                )} />
                              </div>
                              <div>
                                <div className="flex items-center gap-1.5">
                                  <p className="text-[10px] font-black uppercase tracking-widest">{user.username}</p>
                                  {user.role === 'admin' && (
                                    <span className={cn("text-[7px] px-1.5 py-0.5 rounded-full font-black uppercase tracking-tighter", selectedScope === user.uid ? "bg-white/20 text-white" : "bg-amber-500/10 text-amber-600")}>
                                      Admin
                                    </span>
                                  )}
                                </div>
                                <p className={cn("text-[8px] font-bold uppercase tracking-widest opacity-60", selectedScope === user.uid ? "text-white" : "text-slate-500")}>
                                  {online ? 'Active Connection' : user.lastActive ? `Last Seen: ${new Date(user.lastActive).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'Signal Lost'}
                                </p>
                              </div>
                            </div>
                            {selectedScope === user.uid && <CheckCheck size={14} className="text-white" />}
                          </motion.button>
                        );
                      })}
                  </div>
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Messages */}
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-4 space-y-6 scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-800"
      >
        {displayedMessages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center opacity-40">
            <MessageSquare size={48} className="text-slate-300 mb-4" />
            <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Secure link established<br/>Awaiting tactical transmission</p>
          </div>
        ) : (
          displayedMessages.map((msg, index) => {
            const isMe = msg.senderId === currentUser.uid;
            const prevMsg = displayedMessages[index - 1];
            const isConsecutive = prevMsg && prevMsg.senderId === msg.senderId && (msg.createdAt - prevMsg.createdAt < 60000);
            
            const seenBy = msg.seenBy || {};
            const isSeenByRecipient = msg.recipientId ? !!seenBy[msg.recipientId] : false;
            const seenList = Object.values(seenBy) as { username: string; time: number }[];
            
            // For private messages, only show seen status of the recipient
            const filteredSeen = msg.recipientId 
              ? (isSeenByRecipient ? [seenBy[msg.recipientId]] : [])
              : seenList.filter(s => s.username !== msg.senderName);

            const handleDragEnd = (_: any, info: any) => {
              const swipeThreshold = 80;
              if (info.offset.x > swipeThreshold) {
                setReplyTo(msg);
              } else if (info.offset.x < -swipeThreshold) {
                if (isMe || currentUser.role === 'admin') {
                  setDeleteConfirmId(msg.id);
                }
              }
            };

            return (
              <motion.div 
                layout
                initial={{ opacity: 0, x: isMe ? 40 : -40, scale: 0.9, y: 10 }}
                animate={{ opacity: 1, x: 0, scale: 1, y: 0 }}
                transition={{ 
                  type: "spring",
                  stiffness: 350,
                  damping: 30,
                  mass: 0.8,
                  opacity: { duration: 0.2 }
                }}
                key={msg.id}
                className={cn(
                  "flex flex-col max-w-[85%] group relative",
                  isMe ? "ml-auto items-end" : "mr-auto items-start",
                  isConsecutive ? "mt-1" : "mt-6"
                )}
              >
                {!isConsecutive && (
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className={cn(
                      "flex items-center gap-2 mb-1.5 px-1",
                      isMe ? "flex-row-reverse" : "flex-row"
                    )}
                  >
                    <div className={cn(
                      "w-1 h-3 rounded-full shadow-[0_0_10px_rgba(37,99,235,0.4)]",
                      isMe ? "bg-slate-400 dark:bg-slate-600" : "bg-blue-600"
                    )} />
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-900 dark:text-slate-100 font-display">
                      {isMe ? 'Internal Protocol' : msg.senderName}
                    </span>
                    <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 font-mono">
                      {formatTime(msg.createdAt)}
                    </span>
                  </motion.div>
                )}
                
                <div className="relative group/bubble flex items-center gap-2 w-full">
                  {/* Swipe Background Indicators - Polished */}
                  <div className="absolute inset-0 flex items-center justify-between pointer-events-none overflow-hidden rounded-2xl">
                    <motion.div 
                      className="flex items-center gap-2 text-blue-500 pl-4"
                      initial={{ opacity: 0, x: -20 }}
                      whileDrag={{ opacity: 1, x: 0 }}
                    >
                      <div className="w-8 h-8 rounded-full bg-blue-500/10 flex items-center justify-center border border-blue-500/20">
                        <CornerUpLeft size={16} />
                      </div>
                      <span className="font-black text-[9px] uppercase tracking-tighter">Reply</span>
                    </motion.div>
                    <motion.div 
                      className="flex items-center gap-2 text-rose-500 pr-4"
                      initial={{ opacity: 0, x: 20 }}
                      whileDrag={{ opacity: 1, x: 0 }}
                    >
                      <span className="font-black text-[9px] uppercase tracking-tighter">Delete</span>
                      <div className="w-8 h-8 rounded-full bg-rose-500/10 flex items-center justify-center border border-rose-500/20">
                        <Trash2 size={16} />
                      </div>
                    </motion.div>
                  </div>

                  <div className={cn(
                    "flex flex-col w-full z-10",
                    isMe ? "items-end" : "items-start"
                  )}>
                    {/* Reply Context - Polished */}
                    {msg.replyTo && (
                      <motion.div 
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={cn(
                          "px-3 py-2 mb-0.5 rounded-t-2xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-x border-t border-slate-200/50 dark:border-slate-800/50 border-l-4 border-l-blue-600 text-[11px] w-fit max-w-[95%] shadow-sm",
                          isMe ? "mr-4 rounded-br-none" : "ml-4 rounded-bl-none"
                        )}
                      >
                        <div className="flex items-center gap-1.5 mb-1">
                          <span className="font-black uppercase tracking-widest text-blue-600 dark:text-blue-400 text-[8px]">{msg.replyTo.senderName}</span>
                          <span className="w-1 h-1 bg-slate-300 dark:bg-slate-700 rounded-full" />
                          <span className="text-slate-400 uppercase text-[7px] font-bold italic">RE: MSG_{msg.replyTo.id.slice(-4).toUpperCase()}</span>
                        </div>
                        <p className="text-slate-500 dark:text-slate-400 truncate font-medium max-w-[200px]">
                          {msg.replyTo.type === 'voice' ? '🎤 Voice Transmission' : msg.replyTo.text}
                        </p>
                      </motion.div>
                    )}

                    <motion.div 
                      drag="x"
                      dragConstraints={{ left: (isMe || currentUser.role === 'admin') ? -120 : 0, right: 120 }}
                      dragSnapToOrigin={true}
                      dragElastic={0.15}
                      onDragEnd={handleDragEnd}
                      whileDrag={{ scale: 1.02, transition: { duration: 0.1 } }}
                      className={cn(
                        "group/inner relative flex items-center gap-2 cursor-grab active:cursor-grabbing max-w-full",
                        isMe ? "flex-row" : "flex-row-reverse"
                      )}
                    >
                      <div className={cn(
                        "px-4 py-3 rounded-2xl text-[14px] leading-relaxed font-medium shadow-md shadow-black/[0.03] break-words relative transition-all w-fit group-active:scale-[0.98]",
                        isMe 
                          ? "bg-gradient-to-br from-slate-900 to-slate-800 dark:from-blue-600 dark:to-blue-700 text-white shadow-lg shadow-slate-900/10 dark:shadow-blue-600/15" 
                          : "bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 border border-slate-200 dark:border-slate-800 shadow-md",
                        isMe 
                          ? (msg.replyTo ? "rounded-tr-none rounded-tl-xl" : "rounded-tr-none") 
                          : (msg.replyTo ? "rounded-tl-none rounded-tr-xl" : "rounded-tl-none"),
                        isMe ? "order-2" : "order-1"
                      )}
                    >
                      {msg.type === 'voice' ? (
                        <VoiceMsgPlayer audioUrl={msg.audioUrl!} duration={msg.duration!} isMe={isMe} isAudioMuted={isAudioMuted} />
                      ) : (
                        <span className="tracking-tight antialiased">{msg.text}</span>
                      )}
                      
                      {isMe && index === displayedMessages.length - 1 && (
                        <div className="absolute -right-5 bottom-1">
                           <div className={cn("text-blue-500 transition-all transform", filteredSeen.length > 0 ? "opacity-100 scale-110" : "opacity-30 scale-100")}>
                             <CheckCheck size={12} />
                           </div>
                        </div>
                      )}
                    </div>
                  </motion.div>
                </div>
              </div>
              
              {filteredSeen.length > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-x-2 gap-y-0.5 justify-end px-1 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                    <span className="text-[7px] font-black uppercase tracking-widest text-slate-400 font-mono">Acknowledged by: </span>
                    {filteredSeen.map((viewer, idx) => (
                      <span key={idx} className="text-[7px] font-bold text-slate-500 whitespace-nowrap font-mono">
                        {viewer.username.toUpperCase()}
                        {idx < filteredSeen.length - 1 ? ' ' : ''}
                      </span>
                    ))}
                  </div>
                )}
              </motion.div>
            );
          })
        )}

        {/* Typing Indicators */}
        <AnimatePresence mode="popLayout">
          {typingUsers.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.9 }}
              className="flex items-center gap-3 px-2 pt-2"
            >
              <div className="flex gap-2.5 bg-blue-50/50 dark:bg-blue-900/20 px-4 py-2.5 rounded-2xl border border-blue-100 dark:border-blue-900/30 shadow-sm backdrop-blur-sm">
                <div className="flex gap-1 items-center">
                  <span className="w-1.5 h-1.5 bg-blue-600 rounded-full animate-bounce [animation-delay:-0.3s]" />
                  <span className="w-1.5 h-1.5 bg-blue-600 rounded-full animate-bounce [animation-delay:-0.15s]" />
                  <span className="w-1.5 h-1.5 bg-blue-600 rounded-full animate-bounce" />
                </div>
                <span className="text-[10px] font-black uppercase tracking-widest text-blue-600 dark:text-blue-400 flex items-center gap-2">
                  {typingUsers.length === 1 
                    ? `${typingUsers[0].username.toUpperCase()}` 
                    : `${typingUsers.length} OPERATIVES`}
                  <span className="text-[9px] font-bold opacity-60">IS TYPING...</span>
                </span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Sending State */}
        <AnimatePresence mode="popLayout">
          {isSending && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="flex flex-col items-end max-w-[85%] ml-auto mt-4"
            >
              <div className="flex items-center gap-2 mb-1 px-1">
                <span className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400 flex items-center gap-2">
                  <Loader2 size={10} className="animate-spin" />
                  Transmitting...
                </span>
              </div>
              <div className="px-4 py-3 rounded-2xl rounded-tr-none bg-slate-50 dark:bg-slate-900/50 text-slate-400 border border-slate-200 dark:border-slate-800 opacity-60 italic text-[13px] font-mono">
                PACKET_SYNC_INIT...
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Quick Responses & Emoji Picker & Recorder Area */}
      <div className="relative">
        {/* Reply Preview - Polished */}
        <AnimatePresence>
          {replyTo && (
            <motion.div 
              initial={{ y: 50, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 50, opacity: 0 }}
              className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-lg border-t border-slate-200 dark:border-slate-800 px-5 py-4 flex items-center gap-4 overflow-hidden shadow-[0_-8px_30px_rgba(0,0,0,0.08)] z-[155] rounded-t-3xl mx-2"
            >
              <div className="w-1.5 h-10 bg-blue-600 dark:bg-blue-500 rounded-full shrink-0 shadow-[0_0_12px_rgba(37,99,235,0.3)]" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[10px] font-black uppercase tracking-widest text-blue-600 dark:text-blue-400">Tactical Reference</span>
                  <span className="w-1 h-1 bg-slate-300 dark:bg-slate-700 rounded-full" />
                  <span className="text-[9px] font-bold text-slate-400 uppercase">{replyTo.senderName}</span>
                </div>
                <p className="text-[13px] text-slate-600 dark:text-slate-300 truncate font-medium">
                  {replyTo.type === 'voice' ? '🎤 AUDIO_LOG_TRANSMISSION' : replyTo.text}
                </p>
              </div>
              <button 
                onClick={() => setReplyTo(null)}
                className="p-2.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-2xl transition-all shrink-0 border border-transparent hover:border-rose-100 dark:hover:border-rose-900/30"
              >
                <X size={18} />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {showEmojiPicker && (
            <motion.div 
              ref={emojiPickerRef}
              initial={{ opacity: 0, y: 20, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.9 }}
              className="absolute bottom-full left-4 z-[200] shadow-2xl rounded-2xl overflow-hidden mb-2"
            >
              <EmojiPicker 
                onEmojiClick={onEmojiClick}
                theme={theme === 'dark' ? Theme.DARK : Theme.LIGHT}
                width={320}
                height={400}
                lazyLoadEmojis={true}
              />
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {newMessage.length === 0 && !isSending && !showEmojiPicker && !isRecording && !replyTo && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="px-4 py-2 flex gap-2 overflow-x-auto no-scrollbar"
            >
              {QUICK_RESPONSES.map(resp => (
                <button
                  key={resp}
                  onClick={() => handleSendMessage(resp)}
                  className="shrink-0 px-4 py-2 rounded-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-700 dark:text-slate-300 hover:border-blue-600 hover:text-blue-600 transition-all font-sans shadow-sm"
                >
                  {resp}
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Recording Overlay */}
      {isRecording ? (
        <VoiceRecorder 
          onSend={handleSendVoice} 
          onCancel={() => setIsRecording(false)} 
          isAudioMuted={isAudioMuted}
          isMicMuted={isMicMuted}
        />
      ) : (
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 shrink-0 bg-white/95 dark:bg-slate-950/95 backdrop-blur-sm z-[160]">
          <form onSubmit={(e) => { e.preventDefault(); handleSendMessage(newMessage); }} className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => setShowEmojiPicker(!showEmojiPicker)}
              className={cn(
                "p-2.5 rounded-2xl transition-all shadow-sm ring-1 ring-inset",
                showEmojiPicker 
                  ? "bg-blue-600 text-white ring-blue-700" 
                  : "bg-slate-50 dark:bg-slate-900 text-slate-400 hover:text-blue-600 ring-slate-200 dark:ring-slate-800 hover:ring-blue-200 dark:hover:ring-blue-900"
              )}
            >
              <Smile size={20} />
            </button>
            
            <div className="flex-1 relative group">
              <input
                ref={inputRef}
                type="text"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onFocus={() => {
                  // Wait for both the keyboard and the dynamic height update
                  setTimeout(() => {
                    if (scrollRef.current) {
                      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
                    }
                  }, 150);
                  setTimeout(() => {
                    if (scrollRef.current) {
                      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
                    }
                  }, 400);
                }}
                placeholder="Tactical relay..."
                className="w-full px-5 py-3 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-4 focus:ring-blue-600/10 focus:border-blue-600 dark:focus:border-blue-500 transition-all font-medium text-[13px] placeholder:text-slate-400 placeholder:uppercase placeholder:text-[10px] placeholder:tracking-widest shadow-sm"
              />
            </div>

            {newMessage.trim() ? (
              <button
                type="submit"
                disabled={isSending}
                className="w-12 h-12 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-lg shadow-blue-600/30 hover:bg-blue-700 hover:shadow-blue-600/40 transition-all active:scale-90 disabled:opacity-50"
              >
                <Send size={18} className="translate-x-0.5" />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setIsRecording(true)}
                title="Voice message"
                className="w-12 h-12 rounded-2xl bg-slate-900 dark:bg-blue-600 text-white hover:bg-slate-800 dark:hover:bg-blue-500 flex items-center justify-center shadow-lg shadow-slate-900/10 dark:shadow-blue-600/20 transition-all active:scale-90"
              >
                <Mic size={20} />
              </button>
            )}
          </form>
        </div>
      )}

      {/* Delete Confirmation Modal - Polished */}
      <AnimatePresence>
        {deleteConfirmId && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[300] flex items-center justify-center p-6 bg-slate-950/60 backdrop-blur-md"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="bg-white dark:bg-slate-900 rounded-3xl p-8 shadow-[0_32px_64px_-16px_rgba(0,0,0,0.3)] max-w-sm w-full border border-slate-200 dark:border-slate-800 relative overflow-hidden"
            >
              {/* Emergency Pattern Background */}
              <div className="absolute top-0 left-0 right-0 h-1.5 bg-rose-600" />
              <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-b from-rose-500/5 to-transparent pointer-events-none" />

              <div className="w-16 h-16 rounded-2xl bg-rose-500/10 flex items-center justify-center text-rose-600 mb-6 border border-rose-500/20 shadow-inner group">
                <Trash2 size={32} className="group-hover:rotate-12 transition-transform" />
              </div>
              
              <h3 className="text-xl font-black uppercase tracking-tight text-slate-900 dark:text-white mb-3">Terminate Transmission?</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-8 font-medium leading-relaxed">
                Confirming this action will permanently purge this record from the operational relay. This cannot be reversed.
              </p>
              
              <div className="flex flex-col gap-3">
                <button
                  onClick={() => handleDeleteMessage(deleteConfirmId)}
                  className="w-full px-6 py-4 rounded-2xl bg-rose-600 text-white text-sm font-black uppercase tracking-widest hover:bg-rose-700 transition-all shadow-lg shadow-rose-600/30 active:scale-95"
                >
                  Confirm Purge
                </button>
                <button
                  onClick={() => setDeleteConfirmId(null)}
                  className="w-full px-6 py-4 rounded-2xl border border-slate-200 dark:border-slate-800 text-sm font-black uppercase tracking-widest text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all active:scale-95"
                >
                  Abort
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}



import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Send, User, X, MessageSquare, Clock, CheckCheck, Eye, Trash2, Smile, Paperclip, Mic, CornerUpLeft } from 'lucide-react';
import EmojiPicker, { Theme, EmojiClickData } from 'emoji-picker-react';
import { ChatMessage, UserProfile } from '../types';
import { firebaseService } from '../lib/firebaseService';
import { cn } from '../lib/utils';
import { useTheme } from '../hooks/useTheme';
import VoiceRecorder from './VoiceRecorder';
import VoiceMsgPlayer from './VoiceMsgPlayer';
import { toast } from 'sonner';

interface ChatProps {
  currentUser: UserProfile;
  onClose: () => void;
  isAudioMuted?: boolean;
  isMicMuted?: boolean;
}

export default function Chat({ currentUser, onClose, isAudioMuted = false, isMicMuted = false }: ChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const { theme } = useTheme();

  const scrollRef = useRef<HTMLDivElement>(null);
  const emojiPickerRef = useRef<HTMLDivElement>(null);

  const QUICK_RESPONSES = [
    "Roger that. 👍",
    "Operation started. 🚀",
    "Technician dispatched. 🔧",
    "Status updated. ✅",
    "Critical alarm! 🚨"
  ];
  
  useEffect(() => {
    const unsubscribe = firebaseService.subscribeMessages((msgs) => {
      setMessages(msgs);
      
      msgs.forEach(msg => {
        if (!msg.seenBy?.[currentUser.uid]) {
          firebaseService.markMessageAsSeen(msg.id, currentUser);
        }
      });
    });
    return () => unsubscribe();
  }, [currentUser]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isRecording, replyTo]);

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

      await firebaseService.sendMessage(currentUser, trimmed, replyData);
      setNewMessage('');
      setShowEmojiPicker(false);
      setReplyTo(null);
    } catch (err) {
      console.error('Failed to send message:', err);
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

      await firebaseService.sendVoiceMessage(currentUser, base64, duration, replyData);
      setIsRecording(false);
      setReplyTo(null);
    } catch (err) {
      console.error('Failed to send voice message:', err);
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
      await firebaseService.deleteMessage(messageId);
    } catch (err) {
      console.error('Failed to delete message:', err);
    }
  };

  const handleClearChat = async () => {
    if (!window.confirm('WIPE ALL OPERATIONAL LOGS?')) return;
    try {
      await firebaseService.clearAllMessages();
    } catch (err) {
      console.error('Failed to clear chat:', err);
    }
  };

  const formatTime = (ts: number) => {
    return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <motion.div
      initial={{ x: -400, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: -400, opacity: 0 }}
      transition={{ type: 'spring', damping: 25, stiffness: 200 }}
      className="fixed left-0 top-0 bottom-0 w-80 sm:w-96 bg-white dark:bg-slate-950 shadow-2xl z-[150] border-r border-slate-200 dark:border-slate-800 flex flex-col"
    >
      {/* Header */}
      <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 flex justify-between items-center shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-600/10 flex items-center justify-center text-blue-600">
            <MessageSquare size={20} />
          </div>
          <div>
            <h3 className="text-sm font-black uppercase tracking-tight text-slate-900 dark:text-white leading-tight font-sans">Team Protocol</h3>
            <p className="text-xs font-bold text-emerald-600 dark:text-emerald-500 uppercase tracking-widest leading-none mt-1">Operational Channel</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {currentUser.role === 'admin' && (
            <button 
              onClick={handleClearChat}
              className="p-2 text-rose-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-lg transition-all"
              title="Clear Logs"
            >
              <Trash2 size={16} />
            </button>
          )}
          <button 
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-all"
          >
            <X size={20} />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-4 space-y-6 scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-800"
      >
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center opacity-40">
            <MessageSquare size={48} className="text-slate-300 mb-4" />
            <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Secure link established<br/>Awaiting tactical transmission</p>
          </div>
        ) : (
          messages.map((msg, index) => {
            const isMe = msg.senderId === currentUser.uid;
            const prevMsg = messages[index - 1];
            const isConsecutive = prevMsg && prevMsg.senderId === msg.senderId && (msg.createdAt - prevMsg.createdAt < 60000);
            
            const seenList = Object.values(msg.seenBy || {}) as { username: string; time: number }[];
            const filteredSeen = seenList.filter(s => s.username !== msg.senderName);

            return (
              <motion.div 
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                key={msg.id}
                className={cn(
                  "flex flex-col max-w-[85%] group",
                  isMe ? "ml-auto items-end" : "mr-auto items-start",
                  isConsecutive ? "mt-1" : "mt-6"
                )}
              >
                {!isConsecutive && (
                  <div className="flex items-center gap-1.5 mb-1 px-1">
                    <span className="text-xs font-black uppercase tracking-widest text-slate-600 dark:text-slate-200">
                      {isMe ? 'You' : msg.senderName}
                    </span>
                    <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500">
                      {formatTime(msg.createdAt)}
                    </span>
                  </div>
                )}
                
                <div className="relative group/bubble flex items-center gap-2 w-full">
                  <div className={cn(
                    "flex flex-col w-full",
                    isMe ? "items-end" : "items-start"
                  )}>
                    {/* Reply Context */}
                    {msg.replyTo && (
                      <div className={cn(
                        "px-3 py-1.5 mb-1 rounded-t-xl bg-slate-100 dark:bg-slate-900 border-l-2 border-blue-500 text-xs w-fit max-w-[90%]",
                        isMe ? "mr-1 rounded-br-none" : "ml-1 rounded-bl-none"
                      )}>
                        <p className="font-bold uppercase tracking-widest text-blue-600 dark:text-blue-400 mb-0.5 text-[10px]">{msg.replyTo.senderName}</p>
                        <p className="text-slate-600 dark:text-slate-400 truncate font-medium">
                          {msg.replyTo.type === 'voice' ? '🎤 Voice Message' : msg.replyTo.text}
                        </p>
                      </div>
                    )}

                    <div className={cn(
                      "group/inner relative flex items-center gap-2",
                      isMe ? "flex-row" : "flex-row-reverse"
                    )}>
                      {/* Interaction Buttons (Reply/Delete) */}
                      <div className={cn(
                        "flex items-center gap-1 opacity-0 group-hover/bubble:opacity-100 transition-all",
                        isMe ? "order-1" : "order-2"
                      )}>
                        <button 
                          onClick={() => setReplyTo(msg)}
                          className="p-1.5 text-slate-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-md"
                          title="Reply"
                        >
                          <CornerUpLeft size={14} />
                        </button>
                        {(isMe || currentUser.role === 'admin') && (
                          <button 
                            onClick={() => handleDeleteMessage(msg.id)}
                            className="p-1.5 text-rose-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-md"
                            title="Delete"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>

                      <div 
                        className={cn(
                          "px-4 py-2.5 rounded-2xl text-sm font-medium shadow-sm break-words relative transition-all w-fit",
                          isMe 
                            ? "bg-blue-600 dark:bg-blue-600 text-white shadow-blue-600/10" 
                            : "bg-slate-100 dark:bg-slate-900 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-800 shadow-slate-100/50 dark:shadow-none",
                          isMe ? (msg.replyTo ? "rounded-tr-none rounded-tl-none" : "rounded-tr-none") : (msg.replyTo ? "rounded-tl-none rounded-tr-none" : "rounded-tl-none"),
                          isMe ? "order-2" : "order-1"
                        )}
                      >
                        {msg.type === 'voice' ? (
                          <VoiceMsgPlayer audioUrl={msg.audioUrl!} duration={msg.duration!} isMe={isMe} isAudioMuted={isAudioMuted} />
                        ) : (
                          msg.text
                        )}
                        
                        {isMe && index === messages.length - 1 && (
                          <div className="absolute -right-5 bottom-0">
                             <div className={cn("text-blue-500 transition-opacity", filteredSeen.length > 0 ? "opacity-100" : "opacity-40")}>
                               <CheckCheck size={12} />
                             </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {filteredSeen.length > 0 && (
                  <div className="mt-1 flex flex-wrap gap-x-2 gap-y-0.5 justify-end px-1 opacity-0 group-hover:opacity-60 transition-opacity duration-300">
                    <span className="text-[7px] font-black uppercase tracking-tight text-slate-400">Seen by: </span>
                    {filteredSeen.map((viewer, idx) => (
                      <span key={idx} className="text-[7px] font-bold text-slate-500 whitespace-nowrap">
                        {viewer.username}
                        {idx < filteredSeen.length - 1 ? ',' : ''}
                      </span>
                    ))}
                  </div>
                )}
              </motion.div>
            );
          })
        )}
      </div>

      {/* Quick Responses & Emoji Picker & Recorder Area */}
      <div className="relative">
        {/* Reply Preview */}
        <AnimatePresence>
          {replyTo && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="bg-slate-100 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 px-4 py-3 flex items-center gap-3 overflow-hidden"
            >
              <div className="w-1 h-8 bg-blue-500 rounded-full shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-black uppercase tracking-widest text-blue-500 mb-0.5">Replying to {replyTo.senderName}</p>
                <p className="text-xs text-slate-500 truncate">{replyTo.type === 'voice' ? '🎤 Voice Message' : replyTo.text}</p>
              </div>
              <button 
                onClick={() => setReplyTo(null)}
                className="p-1.5 text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-lg transition-all shrink-0"
              >
                <X size={16} />
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
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 shrink-0 bg-white dark:bg-slate-950">
          <form onSubmit={(e) => { e.preventDefault(); handleSendMessage(newMessage); }} className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowEmojiPicker(!showEmojiPicker)}
              className={cn(
                "p-2.5 rounded-xl transition-all",
                showEmojiPicker 
                  ? "bg-blue-600 text-white" 
                  : "text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20"
              )}
            >
              <Smile size={20} />
            </button>
            
            <div className="flex-1 relative">
              <input
                type="text"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Relay operational data..."
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-600/30 transition-all font-medium text-sm placeholder:text-slate-400"
              />
            </div>

            {newMessage.trim() ? (
              <button
                type="submit"
                disabled={isSending}
                className="w-11 h-11 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-lg shadow-blue-600/20 hover:bg-blue-700 transition-all active:scale-95 disabled:opacity-50"
              >
                <Send size={18} />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setIsRecording(true)}
                title="Voice message"
                className="w-11 h-11 rounded-xl bg-slate-100 dark:bg-slate-900 text-slate-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 flex items-center justify-center transition-all active:scale-95"
              >
                <Mic size={20} />
              </button>
            )}
          </form>
        </div>
      )}
    </motion.div>
  );
}



import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Send, User, X, MessageSquare, Clock, CheckCheck, Eye, Trash2, Smile, Paperclip, Mic, CornerUpLeft, Loader2, Plus, Users, ChevronLeft, Search, MoreVertical, LifeBuoy, Globe } from 'lucide-react';
import EmojiPicker, { Theme, EmojiClickData } from 'emoji-picker-react';
import { ChatMessage, UserProfile, ChatGroup } from '../types';
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
  selectedId?: string | null;
}

type ViewState = 'list' | 'chat' | 'create-group' | 'new-chat';

export default function Chat({ currentUser, users = [], onClose, isAudioMuted = false, isMicMuted = false, selectedId }: ChatProps) {
  const [viewState, setViewState] = useState<ViewState>('list');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [groups, setGroups] = useState<ChatGroup[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [typingUsers, setTypingUsers] = useState<{ uid: string, username: string }[]>([]);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const [selectedScope, setSelectedScope] = useState<string>('support');
  const [isGroupChat, setIsGroupChat] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [newGroupName, setNewGroupName] = useState<string>('');
  const [selectedMembers, setSelectedMembers] = useState<string[]>([currentUser.uid]);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deleteChatConfirm, setDeleteChatConfirm] = useState<{id: string, name: string, isGroup: boolean} | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const emojiPickerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { theme } = useTheme();
  const isOnline = useOnlineStatus();

  // Handling external chat trigger
  useEffect(() => {
    if (selectedId) {
      if (selectedId === 'global') {
        setSelectedScope('global');
        setIsGroupChat(false);
        setViewState('chat');
      } else if (groups.length > 0 && groups.some(g => g.id === selectedId)) {
        setSelectedScope(selectedId);
        setIsGroupChat(true);
        setViewState('chat');
      } else if (users.length > 0 && users.some(u => u.uid === selectedId)) {
        setSelectedScope(selectedId);
        setIsGroupChat(false);
        setViewState('chat');
      }
    }
  }, [selectedId, groups, users]);

  const [viewportHeight, setViewportHeight] = useState<string>('100%');
  const [viewportTop, setViewportTop] = useState<number>(0);

  const QUICK_RESPONSES = [
    "Roger that. 👍",
    "Operation started. 🚀",
    "Technician dispatched. 🔧",
    "Status updated. ✅",
    "Critical alarm! 🚨"
  ];

  const superAdmin = users.find(u => u.role === 'super_admin');
  const isSuperAdmin = currentUser.role === 'super_admin';

  // Redirect 'support' scope for regular users to Super Admin DM
  useEffect(() => {
    if (selectedScope === 'support' && !isSuperAdmin && superAdmin) {
      setSelectedScope(superAdmin.uid);
      setIsGroupChat(false);
    }
  }, [selectedScope, isSuperAdmin, superAdmin]);

  // Subscription for messages, groups and typing status
  useEffect(() => {
    const tenantId = firebaseService.getReadTenantId(currentUser);

    const unsubMessages = firebaseService.subscribeMessages((msgs) => {
      setMessages(msgs);
    }, tenantId);

    const unsubTyping = firebaseService.subscribeTypingStatus((typing) => {
      setTypingUsers(typing.filter(u => u.uid !== currentUser.uid));
    });

    const unsubGroups = firebaseService.subscribeGroups((gs) => {
      setGroups(gs);
    }, currentUser.uid, tenantId);

    return () => {
      unsubMessages();
      unsubTyping();
      unsubGroups();
    };
  }, [currentUser]);

  // Mark messages as seen when entering a chat
  useEffect(() => {
    if (viewState === 'chat' && messages.length > 0) {
      const unseenMsgs = messages.filter(msg => {
        if (selectedScope === 'global' || selectedScope === 'support') return !msg.recipientId && !msg.seenBy?.[currentUser.uid];
        if (isGroupChat) return msg.isGroup && msg.recipientId === selectedScope && !msg.seenBy?.[currentUser.uid];
        return !msg.isGroup && msg.senderId === selectedScope && msg.recipientId === currentUser.uid && !msg.seenBy?.[currentUser.uid];
      });

      unseenMsgs.forEach(msg => {
        firebaseService.markAsSeen(msg.id, currentUser.uid, currentUser.username);
      });
    }
  }, [viewState, messages, selectedScope, isGroupChat, currentUser]);

  // Handle typing status
  useEffect(() => {
    if (newMessage.trim() === '' || viewState !== 'chat') {
      firebaseService.setTypingStatus(currentUser.uid, currentUser.username, false);
      return;
    }

    firebaseService.setTypingStatus(currentUser.uid, currentUser.username, true);
    
    const timeout = setTimeout(() => {
      firebaseService.setTypingStatus(currentUser.uid, currentUser.username, false);
    }, 3000);

    return () => clearTimeout(timeout);
  }, [newMessage, currentUser, viewState]);

  // Handle openChat custom event
  useEffect(() => {
    const handleOpenChatEvent = (e: any) => {
      if (e.detail?.uid) {
        setSelectedScope(e.detail.uid);
        setIsGroupChat(!!e.detail.isGroup);
        setViewState('chat');
      }
    };
    window.addEventListener('openChat', handleOpenChatEvent as EventListener);
    return () => window.removeEventListener('openChat', handleOpenChatEvent as EventListener);
  }, []);

  // Handle Visual Viewport for mobile keyboards
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleResize = () => {
      const vv = window.visualViewport;
      if (vv) {
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
    handleResize();

    return () => {
      window.visualViewport?.removeEventListener('resize', handleResize);
      window.visualViewport?.removeEventListener('scroll', handleResize);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  // Handle clicking outside emoji picker
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(event.target as Node)) {
        setShowEmojiPicker(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Scroll to bottom on updates
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: 'smooth'
      });
    }
  }, [messages, isRecording, replyTo, selectedScope, typingUsers, viewState]);

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

      const recipientId = (selectedScope === 'global' || selectedScope === 'support') ? undefined : selectedScope;
      await firebaseService.sendMessage(currentUser, trimmed, replyData, recipientId, isGroupChat);
      setNewMessage('');
      setShowEmojiPicker(false);
      setReplyTo(null);
    } catch (err) {
      console.error('Failed to send message:', err);
      toast.error('Failed to send message.');
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

      const recipientId = (selectedScope === 'global' || selectedScope === 'support') ? undefined : selectedScope;
      await firebaseService.sendVoiceMessage(currentUser, base64, duration, replyData, recipientId, isGroupChat);
      setIsRecording(false);
      setReplyTo(null);
    } catch (err) {
      console.error('Failed to send voice message:', err);
      toast.error('Failed to send voice message.');
    } finally {
      setIsSending(false);
    }
  };

  const onEmojiClick = (emojiData: EmojiClickData) => {
    setNewMessage(prev => prev + emojiData.emoji);
  };

  const handleDeleteMessage = async (messageId: string | null) => {
    if (!messageId) return;
    try {
      setDeleteConfirmId(null);
      await firebaseService.deleteMessage(messageId);
      toast.success('Message purged');
    } catch (err) {
      console.error('Failed to purge message:', err);
      toast.error('Failed to purge message');
    }
  };

  const [isInitializingGroup, setIsInitializingGroup] = useState(false);
  const handleCreateGroup = async () => {
    if (!newGroupName.trim() || selectedMembers.length === 0) {
      toast.error('Tactical unit requires designation and recruits.');
      return;
    }

    setIsInitializingGroup(true);
    try {
      console.log('Initiating unit deployment:', { name: newGroupName, members: selectedMembers });
      const group = await firebaseService.createGroup(newGroupName, selectedMembers, currentUser);
      console.log('Group created successfully:', group);
      toast.success(`Unit "${group.name}" initialized!`);
      setSelectedScope(group.id);
      setIsGroupChat(true);
      setViewState('chat');
      setNewGroupName('');
      setSelectedMembers([currentUser.uid]);
    } catch (err: any) {
      console.error('Failed to deploy unit:', err);
      toast.error(`Initialization failed: ${err?.message || 'Check network link.'}`);
    } finally {
      setIsInitializingGroup(false);
    }
  };

  const handleDeleteChat = async () => {
    if (!deleteChatConfirm) return;
    
    // Final security check
    if (deleteChatConfirm.isGroup && currentUser.role === 'member') {
      toast.error('Tactical units can only be decommissioned by administrators.');
      setDeleteChatConfirm(null);
      return;
    }

    try {
      if (deleteChatConfirm.isGroup) {
        await firebaseService.deleteGroup(deleteChatConfirm.id);
        toast.success(`Unit "${deleteChatConfirm.name}" decommissioned`);
      } else {
        await firebaseService.clearMessagesByScope(currentUser.uid, deleteChatConfirm.id, false);
        toast.success(`Terminal link with ${deleteChatConfirm.name} closed`);
      }
    } catch (err) {
      console.error('Failed to delete chat:', err);
      toast.error('Operation failed.');
    } finally {
      setDeleteChatConfirm(null);
    }
  };

  const isUserOnline = (lastActive?: number) => {
    if (!lastActive) return false;
    const fiveMinutes = 5 * 60 * 1000;
    return Date.now() - lastActive < fiveMinutes;
  };

  const getLastMessage = (scopeId: string, isGroup: boolean) => {
    const scopeMsgs = messages.filter(msg => {
      // support/global logic - merged
      if (scopeId === 'global' || scopeId === 'support') {
        if (msg.recipientId) return false;
        if (isSuperAdmin) return true; // Super admin sees all orphaned support messages
        return msg.senderId === currentUser.uid || msg.seenBy?.[currentUser.uid];
      }

      if (isGroup) return msg.isGroup && msg.recipientId === scopeId;

      // Direct Message (DM) Logic - handles users and support line with Super Admin
      const isDirect = !msg.isGroup;
      if (!isDirect) return false;

      // If Super Admin is viewing a user, they should see direct messages AND support messages sent by that user
      if (isSuperAdmin) {
        return (msg.senderId === currentUser.uid && msg.recipientId === scopeId) || // From SA to user
               (msg.senderId === scopeId && (msg.recipientId === currentUser.uid || !msg.recipientId)); // From user to SA or support
      }

      // If regular user is viewing Super Admin, they see their DM and their support messages
      const isViewingSuperAdmin = users.find(u => u.uid === scopeId)?.role === 'super_admin';
      if (isViewingSuperAdmin) {
        return (msg.senderId === currentUser.uid && (msg.recipientId === scopeId || !msg.recipientId)) || // From user to SA or support
               (msg.senderId === scopeId && msg.recipientId === currentUser.uid); // From SA to user
      }

      // Normal DM
      return (msg.senderId === currentUser.uid && msg.recipientId === scopeId) ||
             (msg.senderId === scopeId && msg.recipientId === currentUser.uid);
    });
    return scopeMsgs[scopeMsgs.length - 1];
  };

  const getUnseenCount = (scopeId: string, isGroup: boolean) => {
    const scopeMsgs = messages.filter(msg => {
      if (scopeId === 'global' || scopeId === 'support') {
        if (msg.recipientId) return false;
        if (isSuperAdmin) return !msg.seenBy?.[currentUser.uid];
        return msg.senderId !== currentUser.uid && !msg.seenBy?.[currentUser.uid];
      }
      
      if (isGroup) return msg.isGroup && msg.recipientId === scopeId;

      // DM Unseen Logic
      const isDirect = !msg.isGroup;
      if (!isDirect) return false;

      if (isSuperAdmin) {
        return msg.senderId === scopeId && (msg.recipientId === currentUser.uid || !msg.recipientId);
      }

      const isViewingSuperAdmin = users.find(u => u.uid === scopeId)?.role === 'super_admin';
      if (isViewingSuperAdmin) {
        return msg.senderId === scopeId && msg.recipientId === currentUser.uid;
      }

      return msg.senderId === scopeId && msg.recipientId === currentUser.uid;
    });
    return scopeMsgs.filter(msg => !msg.seenBy?.[currentUser.uid]).length;
  };

  const ChatListItem = ({ id, name, isOnline, isGroup, icon: Icon }: { id: string, name: string, isOnline?: boolean, isGroup?: boolean, icon: any, key?: React.Key }) => {
    const lastMsg = getLastMessage(id, !!isGroup);
    const unseenCount = getUnseenCount(id, !!isGroup);

    const handleSeen = () => {
      const unseenMsgs = messages.filter(msg => {
        if (id === 'global' || id === 'support') return !msg.recipientId && !msg.seenBy?.[currentUser.uid];
        if (isGroup) return msg.isGroup && msg.recipientId === id && !msg.seenBy?.[currentUser.uid];
        return !msg.isGroup && msg.senderId === id && msg.recipientId === currentUser.uid && !msg.seenBy?.[currentUser.uid];
      });
      
      if (unseenMsgs.length === 0) {
        toast.info('No new transmissions to confirm.');
        return;
      }

      unseenMsgs.forEach(msg => {
        firebaseService.markAsSeen(msg.id, currentUser.uid, currentUser.username);
      });
      toast.success(`Broadcasting SEEN status for ${name}`);
    };

    const handleDelete = () => {
      if (isGroup && currentUser.role === 'member') {
        toast.error('Members are restricted from decommissioning tactical units.');
        return;
      }
      setDeleteChatConfirm({ id, name, isGroup: !!isGroup });
    };

    const handleDragEnd = (_: any, info: any) => {
      const threshold = 120;
      if (info.offset.x > threshold) {
        handleSeen();
      } else if (info.offset.x < -threshold) {
        // Prevent swipe if group and member
        if (isGroup && currentUser.role === 'member') {
          return;
        }
        handleDelete();
      }
    };
    
    const showDeleteAction = !isGroup || (currentUser.role === 'admin' || currentUser.role === 'super_admin');

    return (
      <div className="relative overflow-hidden bg-slate-100 dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800">
        {/* Background Swipe Actions */}
        <div className="absolute inset-0 flex items-center justify-between px-6 z-0">
          <div className="flex items-center gap-2 text-emerald-500">
            <Eye size={20} className="animate-pulse" />
            <span className="text-[10px] font-black uppercase tracking-widest">Mark Seen</span>
          </div>
          {showDeleteAction && (
            <div className="flex items-center gap-2 text-rose-500">
              <span className="text-[10px] font-black uppercase tracking-widest">Decommission</span>
              <Trash2 size={20} className="animate-pulse" />
            </div>
          )}
        </div>

        <motion.button
          drag="x"
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={showDeleteAction ? 0.8 : 0.2}
          onDragEnd={handleDragEnd}
          onClick={() => {
            setSelectedScope(id);
            setIsGroupChat(!!isGroup);
            setViewState('chat');
          }}
          className="relative w-full p-4 flex items-center gap-3 bg-white dark:bg-slate-950 transition-colors group cursor-pointer z-10 touch-pan-y"
        >
          <div className="relative shrink-0">
            <div className={cn(
              "w-12 h-12 rounded-2xl flex items-center justify-center border transition-all",
              isGroup ? "bg-indigo-500/10 text-indigo-500 border-indigo-500/20" : "bg-blue-500/10 text-blue-500 border-blue-500/20"
            )}>
              <Icon size={24} />
            </div>
            {isOnline && (
              <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-emerald-500 border-2 border-white dark:border-slate-950 rounded-full" />
            )}
          </div>
          <div className="flex-1 text-left min-w-0">
            <div className="flex justify-between items-center mb-0.5">
              <h4 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-tight truncate">
                {name}
              </h4>
              {lastMsg && (
                <span className="text-[10px] font-bold text-slate-400 font-mono">
                  {new Date(lastMsg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              )}
            </div>
            <div className="flex justify-between items-center">
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate pr-4 italic">
                {lastMsg ? (lastMsg.type === 'voice' ? '🎤 Voice Message' : lastMsg.text) : 'Awaiting transmission...'}
              </p>
              {unseenCount > 0 && (
                <span className="shrink-0 bg-blue-600 text-white text-[10px] font-black px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                  {unseenCount}
                </span>
              )}
            </div>
          </div>
        </motion.button>
      </div>
    );
  };

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
      {/* List View */}
      {viewState === 'list' && (
        <div className="flex flex-col h-full bg-slate-50/30 dark:bg-slate-900/10">
          {/* Header */}
          <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-white dark:bg-slate-950">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-blue-600 flex items-center justify-center text-white shadow-lg shadow-blue-600/30">
                <MessageSquare size={20} />
              </div>
              <div>
                <h2 className="text-sm font-black uppercase tracking-widest text-slate-900 dark:text-white leading-tight">Relay Center</h2>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <div className={cn("w-1.5 h-1.5 rounded-full", isOnline ? "bg-emerald-500 animate-pulse" : "bg-amber-500")} />
                  <span className="text-[8px] font-black uppercase tracking-widest text-slate-400">
                    {isOnline ? 'Encrypted Connection' : 'Offline Mode'}
                  </span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {(currentUser.role === 'super_admin' || currentUser.role === 'admin') && (
                <button 
                  onClick={() => setViewState('create-group')} 
                  className="p-2.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-xl transition-all" 
                  title="New Group"
                >
                  <Users size={20} />
                </button>
              )}
              <button 
                onClick={() => setViewState('new-chat')} 
                className="p-2.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-xl transition-all" 
                title="New Chat"
              >
                <Plus size={20} />
              </button>
              <button 
                onClick={onClose} 
                className="p-2.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-xl transition-all"
              >
                <X size={20} />
              </button>
            </div>
          </div>

          {/* Search Bar - Added */}
          <div className="px-4 py-2 bg-white dark:bg-slate-950 border-b border-slate-100 dark:border-slate-800">
             <div className="relative group">
                <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-600 transition-colors" />
                <input 
                  type="text" 
                  placeholder="SEARCH CHATS..." 
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-[10px] font-black uppercase tracking-widest focus:ring-4 focus:ring-blue-600/10 focus:border-blue-600 outline-none transition-all"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
             </div>
          </div>

          <div className="flex-1 overflow-y-auto no-scrollbar">
            {/* Help & Support */}
            {!isSuperAdmin && (!searchTerm || 'help & support'.includes(searchTerm.toLowerCase())) && (
              <ChatListItem id="support" name="Help & Support" icon={LifeBuoy} />
            )}

            {/* Support Requests (Super Admin Only) */}
            {isSuperAdmin && (
              <div className="px-5 py-3 bg-rose-500/10 dark:bg-rose-500/5 border-y border-rose-500/10 mb-2">
                 <span className="text-[9px] font-black uppercase tracking-[0.2em] text-rose-600 dark:text-rose-400 flex items-center gap-2">
                    <LifeBuoy size={12} />
                    Support Desk
                 </span>
              </div>
            )}
            {isSuperAdmin && users
              .filter(u => u.uid !== currentUser.uid)
              .filter(u => !searchTerm || u.username.toLowerCase().includes(searchTerm.toLowerCase()))
              .map(user => {
                const lastM = getLastMessage(user.uid, false);
                const unseen = getUnseenCount(user.uid, false);
                // Also check if they have messages with recipientId === undefined (legacy Support messages)
                const hasLegacySupport = messages.some(m => !m.recipientId && m.senderId === user.uid);
                
                if (!lastM && !unseen && !hasLegacySupport) return null; // Only show users who have chatted
                return <ChatListItem key={user.uid} id={user.uid} name={user.username} isOnline={isUserOnline(user.lastActive)} icon={User} />;
              })
            }

            {/* Groups Section */}
            <div className="px-5 py-3 bg-slate-100/50 dark:bg-slate-900/50 border-y border-slate-200 dark:border-slate-800">
               <span className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400">Tactical Units ({groups.length})</span>
            </div>
            {groups
              .filter(g => !searchTerm || g.name.toLowerCase().includes(searchTerm.toLowerCase()))
              .length === 0 ? (
              <div className="p-8 text-center opacity-40 italic text-[11px] text-slate-500 uppercase tracking-widest">No matching units.</div>
            ) : (
              groups
                .filter(g => !searchTerm || g.name.toLowerCase().includes(searchTerm.toLowerCase()))
                .map(group => (
                  <ChatListItem key={group.id} id={group.id} name={group.name} isGroup={true} icon={Users} />
                ))
            )}

            {/* Individual DM Section */}
            <div className="px-5 py-3 bg-slate-100/50 dark:bg-slate-900/50 border-y border-slate-200 dark:border-slate-800">
               <span className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400">Secure Uplinks</span>
            </div>
            {users
              .filter(u => u.uid !== currentUser.uid)
              .filter(u => !searchTerm || u.username.toLowerCase().includes(searchTerm.toLowerCase()))
              .filter(u => !!getLastMessage(u.uid, false))
              .map(user => (
                <ChatListItem key={user.uid} id={user.uid} name={user.username} isOnline={isUserOnline(user.lastActive)} icon={User} />
              ))}
              
            {users
              .filter(u => u.uid !== currentUser.uid)
              .filter(u => !searchTerm || u.username.toLowerCase().includes(searchTerm.toLowerCase()))
              .filter(u => !!getLastMessage(u.uid, false)).length === 0 && (
                <div className="p-8 text-center opacity-40 italic text-[11px] text-slate-500 uppercase tracking-widest">No matching transmissions.</div>
            )}
          </div>
        </div>
      )}

      {/* New Chat View */}
      {viewState === 'new-chat' && (
        <div className="flex flex-col h-full animate-in slide-in-from-right duration-300">
          <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center gap-4 bg-white dark:bg-slate-950">
             <button onClick={() => setViewState('list')} className="p-2 -ml-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all">
               <ChevronLeft size={20} />
             </button>
             <h2 className="text-sm font-black uppercase tracking-widest text-slate-900 dark:text-white">New Transmission</h2>
          </div>
          <div className="p-4 border-b border-slate-100 dark:border-slate-900 bg-slate-50/50 dark:bg-slate-900/50">
             <div className="relative group">
               <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-600 transition-colors" />
               <input 
                 type="text" 
                 placeholder="SEARCH OPERATIVE..." 
                 className="w-full pl-11 pr-4 py-3 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-[11px] font-black uppercase tracking-widest focus:ring-4 focus:ring-blue-600/10 focus:border-blue-600 outline-none transition-all shadow-sm"
                 value={searchTerm}
                 onChange={(e) => setSearchTerm(e.target.value)}
               />
             </div>
          </div>
          <div className="flex-1 overflow-y-auto no-scrollbar">
             {users
               .filter(u => u.uid !== currentUser.uid)
               .filter(u => u.username.toLowerCase().includes(searchTerm.toLowerCase()))
               .filter(u => {
                 if (currentUser.role === 'member') {
                   return u.role === 'admin';
                 }
                 return true;
               })
               .map(user => (
                 <button
                   key={user.uid}
                   onClick={() => {
                     setSelectedScope(user.uid);
                     setIsGroupChat(false);
                     setViewState('chat');
                     setSearchTerm('');
                   }}
                   className="w-full p-4 flex items-center gap-4 hover:bg-slate-50 dark:hover:bg-slate-900 border-b border-slate-50 dark:border-slate-900 transition-all group"
                 >
                   <div className="w-11 h-11 rounded-2xl bg-blue-600/10 text-blue-600 flex items-center justify-center font-black shadow-inner border border-blue-600/20 group-hover:bg-blue-600 group-hover:text-white transition-all">
                     {user.username[0].toUpperCase()}
                   </div>
                   <div className="text-left flex-1 min-w-0">
                     <p className="text-sm font-black uppercase tracking-tight text-slate-900 dark:text-white truncate">{user.username}</p>
                     <p className="text-[10px] uppercase font-bold text-slate-400 tracking-widest">{user.role}</p>
                   </div>
                   {isUserOnline(user.lastActive) && (
                     <div className="w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-white dark:border-slate-950 shadow-[0_0_8px_rgba(16,185,129,0.4)]" />
                   )}
                 </button>
               ))
             }
          </div>
        </div>
      )}

      {/* Create Group View */}
      {viewState === 'create-group' && (
        <div className="flex flex-col h-full animate-in slide-in-from-right duration-300">
          <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-white dark:bg-slate-950">
             <div className="flex items-center gap-3">
               <button onClick={() => setViewState('list')} className="p-2 -ml-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all">
                 <ChevronLeft size={20} />
               </button>
               <h2 className="text-sm font-black uppercase tracking-widest text-slate-900 dark:text-white">Unit Deployment</h2>
             </div>
             <button
               disabled={!newGroupName.trim() || selectedMembers.length === 0}
               onClick={handleCreateGroup}
               className="px-5 py-2.5 bg-blue-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-700 disabled:opacity-50 disabled:grayscale transition-all shadow-lg shadow-blue-600/30 active:scale-95"
             >
               Initialize
             </button>
          </div>
          <div className="p-5 space-y-6">
             <div>
                <label className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400 mb-2 block">Tactical Designation</label>
                <input 
                  type="text" 
                  placeholder="UNIT CALLSIGN..." 
                  className="w-full px-5 py-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-[11px] font-black uppercase tracking-widest focus:ring-4 focus:ring-blue-600/10 focus:border-blue-600 outline-none transition-all shadow-sm"
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                />
             </div>
             <div>
                <label className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400 mb-2 block">Select Recruits ({selectedMembers.length})</label>
                <div className="relative mb-4 group">
                   <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-600 transition-colors" />
                   <input 
                     type="text" 
                     placeholder="FILTER PERSONEL..." 
                     className="w-full pl-11 pr-4 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-[10px] font-black uppercase tracking-widest outline-none shadow-sm focus:ring-4 focus:ring-blue-600/10 transition-all"
                     value={searchTerm}
                     onChange={(e) => setSearchTerm(e.target.value)}
                   />
                </div>
                <div className="max-h-[350px] overflow-y-auto space-y-2 p-1 no-scrollbar">
                   {users
                     .filter(u => u.username.toLowerCase().includes(searchTerm.toLowerCase()))
                     .map(user => {
                        const isSelected = selectedMembers.includes(user.uid);
                        const isMe = user.uid === currentUser.uid;
                        return (
                          <button
                            key={user.uid}
                            onClick={() => {
                               if (isMe) return; // Cannot unselect self
                               if (isSelected) {
                                 setSelectedMembers(prev => prev.filter(id => id !== user.uid));
                               } else {
                                 setSelectedMembers(prev => [...prev, user.uid]);
                               }
                            }}
                            className={cn(
                              "w-full p-3.5 rounded-2xl flex items-center gap-4 transition-all border",
                              isSelected 
                                ? "bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-600/20" 
                                : "bg-white dark:bg-slate-950 border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900 shadow-sm",
                              isMe && "ring-2 ring-emerald-500/50"
                            )}
                          >
                             <div className={cn(
                               "w-9 h-9 rounded-xl flex items-center justify-center font-black", 
                               isSelected ? "bg-white/20" : "bg-blue-500/10 text-blue-500"
                             )}>
                               {user.username[0].toUpperCase()}
                             </div>
                             <div className="text-left flex-1 min-w-0">
                               <p className="text-[12px] font-black uppercase truncate tracking-tight">
                                 {user.username} {isMe && "(YOU)"}
                                </p>
                               <p className={cn("text-[9px] uppercase font-bold tracking-widest", isSelected ? "text-blue-100" : "text-slate-400")}>{user.role}</p>
                             </div>
                             <div className={cn(
                               "w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all", 
                               isSelected ? "bg-white border-white" : "border-slate-200 dark:border-slate-800"
                             )}>
                                {isSelected && <CheckCheck size={12} className="text-blue-600" />}
                             </div>
                          </button>
                        );
                     })
                   }
                </div>
             </div>
          </div>
        </div>
      )}

      {/* Chat View (Actual Conversation) */}
      <AnimatePresence>
        {deleteChatConfirm && (
          <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="bg-white dark:bg-slate-900 w-full max-w-xs p-8 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 shadow-2xl relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 p-8 opacity-5">
                <Trash2 size={80} />
              </div>
              <div className="w-14 h-14 rounded-3xl bg-rose-500/10 text-rose-600 flex items-center justify-center mb-6 border border-rose-500/20">
                <Trash2 size={28} />
              </div>
              <h3 className="text-base font-black uppercase tracking-tight text-slate-900 dark:text-white mb-3">
                {deleteChatConfirm.isGroup ? 'DECIMILARIZE UNIT?' : 'TERMINATE LINK?'}
              </h3>
              <p className="text-[12px] text-slate-500 dark:text-slate-400 uppercase font-bold leading-relaxed mb-8 tracking-tight">
                Are you sure you want to permanently erase all transmissions associated with <span className="text-rose-500 font-black">{deleteChatConfirm.name}</span>? This action cannot be reversed.
              </p>
              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={() => setDeleteChatConfirm(null)}
                  className="px-4 py-4 rounded-3xl bg-slate-100 dark:bg-slate-800 text-[11px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all"
                >
                  ABORT
                </button>
                <button
                  onClick={handleDeleteChat}
                  className="px-4 py-4 rounded-3xl bg-rose-600 text-white text-[11px] font-black uppercase tracking-widest hover:bg-rose-700 shadow-xl shadow-rose-600/30 transition-all active:scale-95"
                >
                  CONFIRM
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {viewState === 'chat' && (
        <div className="flex-1 flex flex-col min-h-0 bg-slate-50/30 dark:bg-slate-900/10">
          {/* Header */}
          <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-950/80 backdrop-blur-md flex items-center gap-3 shrink-0 z-[160]">
            <button 
              onClick={() => {
                setViewState('list');
                setSelectedScope('global');
                setIsGroupChat(false);
              }} 
              className="p-2 -ml-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors shrink-0"
            >
              <ChevronLeft size={20} className="text-slate-600 dark:text-slate-400" />
            </button>
            <div className="relative shrink-0">
              <div className={cn(
                "w-10 h-10 rounded-2xl flex items-center justify-center shadow-inner border",
                isGroupChat ? "bg-indigo-600/10 text-indigo-600 border-indigo-600/20" : "bg-blue-600/10 text-blue-600 border-blue-600/20"
              )}>
                {isGroupChat ? <Users size={20} /> : <User size={20} />}
              </div>
              {!isGroupChat && isUserOnline(users.find(u => u.uid === selectedScope)?.lastActive) && (
                <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 border-2 border-white dark:border-slate-950 rounded-full animate-pulse" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-[13px] font-black uppercase tracking-tight text-slate-900 dark:text-white leading-tight font-display truncate">
                {selectedScope === 'global' || selectedScope === 'support'
                  ? 'Help & Support' 
                  : isGroupChat 
                    ? groups.find(g => g.id === selectedScope)?.name 
                    : users.find(u => u.uid === selectedScope)?.username}
              </h3>
              <p className="text-[9px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest leading-none mt-1">
                {selectedScope === 'global' || selectedScope === 'support' ? 'Encrypted Support Line' : isGroupChat ? `${groups.find(g => g.id === selectedScope)?.members.length} Members` : 'Secure Direct Line'}
              </p>
            </div>
            <div className="flex items-center gap-1">
              <button 
                onClick={onClose}
                className="p-2 text-slate-400 hover:text-rose-600 transition-all rounded-xl"
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
            {(() => {
              const displayedMessages = messages.filter(msg => {
                if (selectedScope === 'global' || selectedScope === 'support') {
                   const isSupportMsg = !msg.recipientId;
                   if (!isSupportMsg) return false;
                   if (isSuperAdmin) return true;
                   return msg.senderId === currentUser.uid;
                }
                
                if (isGroupChat) return msg.isGroup && msg.recipientId === selectedScope;
                
                // DM Filter Logic
                if (msg.isGroup) return false;
                
                // SA viewing an operative: see DMs + support requests from that operative
                if (isSuperAdmin) {
                  const isDm = (msg.senderId === currentUser.uid && msg.recipientId === selectedScope) ||
                              (msg.senderId === selectedScope && msg.recipientId === currentUser.uid);
                  const isOrphanedSupport = !msg.recipientId && msg.senderId === selectedScope;
                  return isDm || isOrphanedSupport;
                }
                
                // User viewing SA: see DMs + their own support requests
                const targetUser = users.find(u => u.uid === selectedScope);
                const isViewingSuperAdmin = targetUser?.role === 'super_admin';
                if (isViewingSuperAdmin) {
                  const isDm = (msg.senderId === currentUser.uid && msg.recipientId === selectedScope) ||
                              (msg.senderId === selectedScope && msg.recipientId === currentUser.uid);
                  const isMyOrphanedSupport = !msg.recipientId && msg.senderId === currentUser.uid;
                  return isDm || isMyOrphanedSupport;
                }

                return (msg.senderId === currentUser.uid && msg.recipientId === selectedScope) ||
                       (msg.senderId === selectedScope && msg.recipientId === currentUser.uid);
              });

              if (displayedMessages.length === 0) {
                return (
                  <div className="h-full flex flex-col items-center justify-center text-center opacity-40">
                    <MessageSquare size={48} className="text-slate-300 mb-4" />
                    <p className="text-xs font-bold uppercase tracking-widest text-slate-400 font-mono italic">
                      [ SECURE LINK_STABLE ]<br/>Awaiting tactical transmission
                    </p>
                  </div>
                );
              }

              return displayedMessages.map((msg, index) => {
                const isMe = msg.senderId === currentUser.uid;
                const prevMsg = displayedMessages[index - 1];
                const isConsecutive = prevMsg && prevMsg.senderId === msg.senderId && (msg.createdAt - prevMsg.createdAt < 60000);
                
                const seenBy = msg.seenBy || {};
                const isSeenByRecipient = msg.recipientId ? !!seenBy[msg.recipientId] : false;
                const seenList = Object.values(seenBy) as { username: string; time: number }[];
                
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
                      <span className="text-[9px] font-black uppercase tracking-[0.1em] text-slate-400 mb-1.5 px-1 flex items-center gap-2">
                        {isMe ? 'Command Node' : msg.senderName}
                        <span className="w-1 h-1 rounded-full bg-slate-300" />
                        {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    )}

                    <motion.div
                      drag="x"
                      dragConstraints={{ left: 0, right: 0 }}
                      onDragEnd={handleDragEnd}
                      className={cn(
                        "relative px-4 py-2.5 rounded-2xl shadow-sm border transition-all cursor-grab active:cursor-grabbing",
                        isMe 
                          ? "rounded-tr-none bg-blue-600 text-white border-blue-500 shadow-blue-600/10" 
                          : "rounded-tl-none bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 border-slate-100 dark:border-slate-800 shadow-slate-200/50 dark:shadow-none"
                      )}
                    >
                      {msg.replyTo && (
                        <div className={cn(
                          "mb-2 p-2 rounded-xl text-[11px] border-l-4 font-medium flex items-center gap-2 max-w-[200px] truncate",
                          isMe 
                            ? "bg-blue-700/50 border-blue-300 text-blue-100" 
                            : "bg-slate-100 dark:bg-slate-800 border-blue-600 text-slate-500 dark:text-slate-400"
                        )}>
                          <CornerUpLeft size={10} className="shrink-0" />
                          <span className="truncate">{msg.replyTo.text || 'AUDIO_LOG'}</span>
                        </div>
                      )}

                      {msg.type === 'voice' ? (
                        <VoiceMsgPlayer 
                          audioUrl={msg.audioUrl || ''} 
                          duration={msg.duration || 0} 
                          isMe={isMe} 
                        />
                      ) : (
                        <p className="text-[13px] leading-relaxed font-medium whitespace-pre-wrap break-words">{msg.text}</p>
                      )}

                      {isMe && !isGroupChat && (
                        <div className="absolute -bottom-1 -right-4 flex items-center gap-0.5">
                          {isSeenByRecipient ? (
                            <CheckCheck size={12} className="text-blue-500" />
                          ) : (
                            <div className="w-1 h-1 rounded-full bg-slate-300 dark:bg-slate-700" />
                          )}
                        </div>
                      )}
                    </motion.div>

                    {isMe && isGroupChat && filteredSeen.length > 0 && (
                      <div className="mt-1 flex items-center gap-1 overflow-x-auto no-scrollbar">
                         <CheckCheck size={10} className="text-blue-500 shrink-0" />
                         <span className="text-[8px] font-bold text-slate-400 uppercase tracking-tighter truncate">
                           Read by {filteredSeen.map(s => s.username).join(', ')}
                         </span>
                      </div>
                    )}
                  </motion.div>
                );
              });
            })()}

            {/* Typing Indicator */}
            <AnimatePresence>
              {typingUsers.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  className="flex items-center gap-3 px-1 mt-4"
                >
                  <div className="flex -space-x-2">
                    {typingUsers.slice(0, 3).map((u) => (
                      <div key={u.uid} className="w-5 h-5 rounded-lg bg-blue-600 border border-white dark:border-slate-950 flex items-center justify-center text-[8px] font-black text-white shadow-sm">
                        {u.username[0].toUpperCase()}
                      </div>
                    ))}
                  </div>
                  <div className="px-3 py-1.5 rounded-2xl rounded-tl-none bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 shadow-sm">
                    <span className="text-[10px] font-black uppercase tracking-widest text-blue-600 dark:text-blue-400 flex items-center gap-2">
                      {typingUsers.length === 1 
                        ? `${typingUsers[0].username.toUpperCase()}` 
                        : `${typingUsers.length} OPERATIVES`}
                      <span className="text-[9px] font-bold opacity-60">TRANSCRIPTING...</span>
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
                      SYNCHRONIZING...
                    </span>
                  </div>
                  <div className="px-4 py-3 rounded-2xl rounded-tr-none bg-slate-50 dark:bg-slate-900/50 text-slate-400 border border-slate-200 dark:border-slate-800 opacity-60 italic text-[12px] font-mono shadow-sm">
                    PACKET_TRANSIT
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Quick Responses & Emoji Picker & Recorder Area */}
          <div className="relative shrink-0">
            {/* Reply Preview */}
            <AnimatePresence>
              {replyTo && (
                <motion.div 
                  initial={{ y: 50, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ y: 50, opacity: 0 }}
                  className="absolute bottom-full left-0 right-0 bg-white/95 dark:bg-slate-900/95 backdrop-blur-lg border-t border-slate-200 dark:border-slate-800 px-5 py-3 flex items-center gap-4 overflow-hidden shadow-[0_-8px_30px_rgba(0,0,0,0.08)] z-[155] rounded-t-3xl mx-2 mb-[-1px]"
                >
                  <div className="w-1.5 h-10 bg-blue-600 dark:bg-blue-500 rounded-full shrink-0 shadow-[0_0_12px_rgba(37,99,235,0.3)]" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-[9px] font-black uppercase tracking-widest text-blue-600 dark:text-blue-400">Context Node</span>
                      <span className="w-1 h-1 bg-slate-300 dark:bg-slate-700 rounded-full" />
                      <span className="text-[8px] font-bold text-slate-400 uppercase">{replyTo.senderName}</span>
                    </div>
                    <p className="text-[12px] text-slate-600 dark:text-slate-300 truncate font-medium">
                      {replyTo.type === 'voice' ? '🎤 AUDIO_LOG' : replyTo.text}
                    </p>
                  </div>
                  <button 
                    onClick={() => setReplyTo(null)}
                    className="p-2 text-slate-400 hover:text-rose-600 transition-all"
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
                  className="px-4 py-2 flex gap-2 overflow-x-auto no-scrollbar scroll-smooth"
                >
                  {QUICK_RESPONSES.map(resp => (
                    <button
                      key={resp}
                      onClick={() => handleSendMessage(resp)}
                      className="shrink-0 px-4 py-1.5 rounded-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-[10px] font-bold text-slate-700 dark:text-slate-300 hover:border-blue-600 hover:text-blue-600 transition-all shadow-sm active:scale-95"
                    >
                      {resp}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Input Overlay */}
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
                        : "bg-slate-50 dark:bg-slate-900 text-slate-400 hover:text-blue-600 ring-slate-200 dark:ring-slate-800 hover:ring-blue-200 dark:hover:ring-blue-900 shadow-inner"
                    )}
                  >
                    <Smile size={20} />
                  </button>
                  
                  <div className="flex-1 relative">
                    <input
                      ref={inputRef}
                      type="text"
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      onFocus={() => {
                        setTimeout(() => {
                          if (scrollRef.current) {
                            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
                          }
                        }, 150);
                      }}
                      placeholder="Transmitting tactical data..."
                      className="w-full px-5 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-4 focus:ring-blue-600/10 focus:border-blue-600 dark:focus:border-blue-500 transition-all font-medium text-[13px] placeholder:text-slate-400 placeholder:uppercase placeholder:text-[10px] placeholder:tracking-widest shadow-inner shadow-black/5"
                    />
                  </div>

                  {newMessage.trim() ? (
                    <button
                      type="submit"
                      disabled={isSending}
                      className="w-11 h-11 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-lg shadow-blue-600/30 hover:bg-blue-700 hover:shadow-blue-600/40 transition-all active:scale-90 disabled:opacity-50"
                    >
                      <Send size={18} className="translate-x-0.5" />
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setIsRecording(true)}
                      title="Voice message"
                      className="w-11 h-11 rounded-2xl bg-slate-900 dark:bg-blue-600 text-white hover:bg-slate-800 dark:hover:bg-blue-500 flex items-center justify-center shadow-lg shadow-black/10 dark:shadow-blue-600/20 transition-all active:scale-90"
                    >
                      <Mic size={20} />
                    </button>
                  )}
                </form>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
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
              className="bg-white dark:bg-slate-900 rounded-3xl p-8 shadow-2xl max-w-sm w-full border border-slate-200 dark:border-slate-800 relative overflow-hidden"
            >
              <div className="absolute top-0 left-0 right-0 h-1.5 bg-rose-600" />
              <div className="w-16 h-16 rounded-2xl bg-rose-500/10 flex items-center justify-center text-rose-600 mb-6 border border-rose-500/20 shadow-inner">
                <Trash2 size={32} />
              </div>
              <h3 className="text-xl font-black uppercase tracking-tight text-slate-900 dark:text-white mb-3">Confirm Purge?</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-8 font-medium leading-relaxed">
                Record deletion is permanent and cannot be reversed from the relay nexus.
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
                  Hold Record
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

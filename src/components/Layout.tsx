import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Sun, Moon, LogOut, User, MessageSquare, ChevronRight, Bell, BellOff, Volume2, VolumeX, Settings, ShieldAlert, AlertTriangle, Mic, WifiOff, Wifi, History, Trash2, Clock, CheckCircle2, X } from 'lucide-react';
import { useTheme } from '../hooks/useTheme';
import { cn } from '../lib/utils';
import { UserProfile, Notification } from '../types';
import Chat from './Chat';
import RefreshControl from './RefreshControl';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { firebaseService } from '../lib/firebaseService';

interface LayoutProps {
  children: React.ReactNode;
  user?: UserProfile | null;
  users?: UserProfile[];
  notifications?: Notification[];
  onLogout?: () => void;
  onRefresh?: () => void;
  isLoading?: boolean;
  alertAuthorized?: boolean;
  isAudioMuted?: boolean;
  onToggleAudio?: () => void;
  isMicMuted?: boolean;
  micAuthorized?: boolean;
  onToggleMic?: () => void;
  onResetBanner?: () => void;
}

export default function Layout({ 
  children, 
  user, 
  users = [],
  notifications = [],
  onLogout, 
  onRefresh, 
  isLoading,
  alertAuthorized = false,
  isAudioMuted = false,
  onToggleAudio,
  isMicMuted = false,
  micAuthorized = false,
  onToggleMic,
  onResetBanner
}: LayoutProps) {
  const { theme, toggleTheme } = useTheme();
  const [isChatOpen, setIsChatOpen] = React.useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = React.useState(false);
  const [selectedNotif, setSelectedNotif] = React.useState<Notification | null>(null);
  const isOnline = useOnlineStatus();
  const [showSyncStatus, setShowSyncStatus] = useState(false);

  useEffect(() => {
    if (isOnline) {
      setShowSyncStatus(true);
      const timer = setTimeout(() => setShowSyncStatus(false), 5000);
      return () => clearTimeout(timer);
    }
  }, [isOnline]);

  useEffect(() => {
    const handleOpenChat = () => setIsChatOpen(true);
    window.addEventListener('openChat', handleOpenChat);
    return () => window.removeEventListener('openChat', handleOpenChat);
  }, []);

  const formatTimestamp = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  const getNotifIcon = (type: string) => {
    switch (type) {
      case 'complaint_created': return <ChevronRight className="text-emerald-500" size={14} />;
      case 'complaint_updated': return <AlertTriangle className="text-blue-500" size={14} />;
      case 'complaint_deleted': return <Trash2 className="text-red-500" size={14} />;
      case 'user_created': return <User className="text-brand-accent" size={14} />;
      case 'config_updated': return <Settings className="text-amber-500" size={14} />;
      default: return <Bell className="text-slate-400" size={14} />;
    }
  };

  const handleClearAll = async () => {
    try {
      await firebaseService.clearAllNotifications();
    } catch (error) {
      console.error('Failed to clear notifications:', error);
    }
  };

  return (
    <div className="min-h-screen transition-colors duration-500 overflow-x-hidden">
      {/* Network Status Banner */}
      <AnimatePresence>
        {!isOnline && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="bg-amber-500 text-white py-1.5 px-4 flex items-center justify-center gap-2 overflow-hidden sticky top-0 z-[100] shadow-md"
          >
            <WifiOff size={14} className="animate-pulse" />
            <span className="text-[10px] font-black uppercase tracking-widest">
              Offline Mode — Work will be saved locally and synced automatically when connected.
            </span>
          </motion.div>
        )}
        {showSyncStatus && isOnline && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="bg-emerald-600 text-white py-1.5 px-4 flex items-center justify-center gap-2 overflow-hidden sticky top-0 z-[100] shadow-md"
          >
            <Wifi size={14} />
            <span className="text-[10px] font-black uppercase tracking-widest">
              Connection Restored — Synchronizing data with server...
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Detail Modal Overlay */}
      <AnimatePresence>
        {selectedNotif && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedNotif(null)}
              className="fixed inset-0 bg-slate-950/60 backdrop-blur-md z-[300]"
            />
            <div className="fixed inset-0 flex items-center justify-center z-[310] p-4 pointer-events-none">
              <motion.div
                initial={{ opacity: 0, scale: 0.8, y: 100, filter: 'blur(20px)', rotate: -5 }}
                animate={{ opacity: 1, scale: 1, y: 0, filter: 'blur(0px)', rotate: 0 }}
                exit={{ 
                  opacity: 0, 
                  scale: 0.5, 
                  y: -200, 
                  x: 300, 
                  rotate: 20, 
                  skewX: 20, 
                  filter: 'blur(50px)',
                  transition: { duration: 0.8, ease: [0.4, 0, 0.2, 1] }
                }}
                className="w-full max-w-lg bg-white dark:bg-slate-950 rounded-[2.5rem] border border-slate-200/50 dark:border-white/10 shadow-[0_40px_100px_rgba(0,0,0,0.4)] pointer-events-auto overflow-hidden relative"
              >
                {/* Decorative Elements */}
                <div className="absolute top-0 right-0 -tr-20 -u-20 w-40 h-40 bg-brand-accent/10 blur-[60px] rounded-full" />
                <div className="absolute bottom-0 left-0 -bl-20 -d-20 w-40 h-40 bg-emerald-500/10 blur-[60px] rounded-full" />

                <div className="p-8 relative z-10">
                  <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-2xl bg-brand-accent/10 flex items-center justify-center border border-brand-accent/20">
                        <Bell className="text-brand-accent" size={24} />
                      </div>
                      <div>
                        <h4 className="text-lg font-black uppercase tracking-tight text-slate-900 dark:text-white">Intelligence Packet</h4>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Metadata Breakdown</p>
                      </div>
                    </div>
                    <button 
                      onClick={() => setSelectedNotif(null)}
                      className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-900 flex items-center justify-center text-slate-500 hover:scale-110 active:scale-95 transition-all"
                    >
                      <X size={20} />
                    </button>
                  </div>

                  <div className="space-y-6">
                    <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-800">
                      <p className="text-sm font-bold text-slate-700 dark:text-slate-200 leading-relaxed">
                        {selectedNotif.message}
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-4 rounded-xl border border-slate-100 dark:border-slate-800">
                        <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">Author</p>
                        <div className="flex items-center gap-2">
                          <User size={12} className="text-brand-accent" />
                          <span className="text-xs font-bold text-slate-900 dark:text-slate-100">{selectedNotif.authorName}</span>
                        </div>
                      </div>
                      <div className="p-4 rounded-xl border border-slate-100 dark:border-slate-800">
                        <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">Timestamp</p>
                        <div className="flex items-center gap-2">
                          <Clock size={12} className="text-emerald-500" />
                          <span className="text-xs font-bold text-slate-900 dark:text-slate-100">{new Date(selectedNotif.createdAt).toLocaleString()}</span>
                        </div>
                      </div>
                    </div>

                    {selectedNotif.details && (
                      <div className="p-5 rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/20">
                         <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-3">Payload Data</p>
                         <div className="space-y-2">
                            {Object.entries(selectedNotif.details).filter(([k]) => k !== 'id' && k !== 'createdAt').slice(0, 5).map(([key, value]) => (
                              <div key={key} className="flex justify-between items-center text-[10px] py-1 border-b border-slate-100 dark:border-slate-800/50 last:border-0">
                                <span className="font-bold uppercase text-slate-500">{key}</span>
                                <span className="font-black text-slate-900 dark:text-slate-100 truncate max-w-[200px]">{String(value)}</span>
                              </div>
                            ))}
                         </div>
                      </div>
                    )}
                  </div>

                  <button 
                    onClick={() => setSelectedNotif(null)}
                    className="w-full mt-8 py-4 bg-slate-900 dark:bg-brand-accent text-white rounded-2xl text-xs font-black uppercase tracking-[0.3em] shadow-xl shadow-brand-accent/20 hover:scale-[1.02] active:scale-95 transition-all"
                  >
                    Acknowledge Intelligence
                  </button>
                </div>
              </motion.div>
            </div>
          </>
        )}
      </AnimatePresence>

      {/* Global Loading Indicator */}
      <AnimatePresence>
        {isLoading && (
          <motion.div
            initial={{ scaleX: 0, opacity: 1 }}
            animate={{ scaleX: 1, opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1, ease: "easeInOut" }}
            className="fixed top-0 left-0 right-0 h-1 bg-brand-accent z-[9999] origin-left"
          />
        )}
      </AnimatePresence>

      {/* Chat Sidebar */}
      <AnimatePresence>
        {isChatOpen && user && (
          <Chat 
            currentUser={user} 
            users={users}
            onClose={() => setIsChatOpen(false)} 
            isAudioMuted={isAudioMuted} 
            isMicMuted={isMicMuted} 
          />
        )}
      </AnimatePresence>

      {/* Notifications Panel */}
      <AnimatePresence>
        {isNotificationsOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsNotificationsOpen(false)}
              className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[150]"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, x: 100, y: -100, filter: 'blur(20px)', rotate: 5 }}
              animate={{ opacity: 1, scale: 1, x: 0, y: 0, filter: 'blur(0px)', rotate: 0 }}
              exit={{ 
                opacity: 0, 
                scale: 0.8, 
                x: 400, 
                y: -200, 
                rotate: 15, 
                skewX: 40, 
                filter: 'blur(50px)',
                transition: { duration: 1, ease: [0.4, 0, 0.2, 1] }
              }}
              transition={{ 
                type: "spring",
                damping: 25,
                stiffness: 200,
                duration: 0.6
              }}
              className="fixed top-20 right-4 sm:right-8 w-[calc(100vw-2rem)] sm:w-[380px] max-h-[70vh] bg-white dark:bg-slate-950 rounded-3xl border border-slate-200/60 dark:border-slate-800/80 shadow-[0_20px_60px_rgba(0,0,0,0.15)] dark:shadow-[0_20px_60px_rgba(0,0,0,0.4)] z-[200] overflow-hidden flex flex-col"
            >
              <div className="p-6 border-b border-slate-100 dark:border-slate-800/50 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/50">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-brand-accent/10 flex items-center justify-center">
                    <History size={16} className="text-brand-accent" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black uppercase tracking-tight text-slate-900 dark:text-slate-50 leading-none">Operation History</h3>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mt-1">Live Intelligence Feed</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {notifications.length > 0 && (
                    <button 
                      onClick={handleClearAll}
                      className="p-2 rounded-full hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-400 hover:text-emerald-500 transition-all group"
                      title="Mark all as read / Clear Feed"
                    >
                      <CheckCircle2 size={18} className="group-hover:scale-110 transition-transform" />
                    </button>
                  )}
                  <button 
                    onClick={() => setIsNotificationsOpen(false)}
                    className="p-2 rounded-full hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
                  >
                    <ChevronRight size={18} />
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
                {notifications.length === 0 ? (
                  <div className="py-20 text-center">
                    <Bell className="mx-auto text-slate-200 dark:text-slate-800 mb-4" size={48} />
                    <p className="text-xs font-black uppercase tracking-widest text-slate-400">Empty Log Cache</p>
                  </div>
                ) : (
                  notifications.map((notif, idx) => (
                    <motion.div
                      key={notif.id}
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.05 }}
                      onClick={() => {
                        setSelectedNotif(notif);
                        setIsNotificationsOpen(false);
                      }}
                      className="p-4 rounded-2xl border border-slate-100 dark:border-slate-800/50 bg-slate-50/30 dark:bg-slate-900/20 hover:bg-white dark:hover:bg-slate-900 transition-all group cursor-pointer"
                    >
                      <div className="flex gap-4 items-start">
                        <div className="mt-1">
                          {getNotifIcon(notif.type)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold text-slate-800 dark:text-slate-200 leading-relaxed mb-2">
                            {notif.message}
                          </p>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <div className="w-4 h-4 rounded-full bg-slate-200 dark:bg-slate-800 flex items-center justify-center overflow-hidden">
                                <User size={10} className="text-slate-500" />
                              </div>
                              <span className="text-[10px] font-black uppercase tracking-tighter text-brand-accent">
                                {notif.authorName}
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5 text-[9px] font-bold text-slate-400">
                              <Clock size={10} />
                              {formatTimestamp(notif.createdAt)}
                            </div>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  ))
                )}
              </div>

              <div className="p-4 bg-slate-50 dark:bg-slate-900/50 border-t border-slate-100 dark:border-slate-800/50">
                <button 
                  onClick={() => setIsNotificationsOpen(false)}
                  className="w-full py-2.5 bg-slate-900 dark:bg-brand-accent text-white rounded-xl text-[10px] font-black uppercase tracking-[0.2em] shadow-lg shadow-brand-accent/10 hover:scale-[1.02] active:scale-95 transition-all"
                >
                  Close Access Feed
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Chat Toggle Button (Left Side) */}
      {user && !isChatOpen && (
        <motion.button
          initial={{ x: -50, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          onClick={() => setIsChatOpen(true)}
          className="fixed left-0 top-1/2 -translate-y-1/2 z-[140] bg-slate-900 dark:bg-brand-accent text-white p-2 rounded-r-xl shadow-2xl hover:pr-4 transition-all group border-y border-r border-white/20"
          title="Open Team Chat"
        >
          <div className="flex items-center gap-2">
            <MessageSquare size={20} />
            <ChevronRight size={16} className="opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
        </motion.button>
      )}

      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-950/80 backdrop-blur-md">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex items-center gap-4"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-slate-900 dark:bg-brand-accent flex items-center justify-center shadow-lg">
                <span className="text-white font-black text-xl tracking-tighter">GTS</span>
              </div>
              <div className="hidden sm:block">
                <h1 className="text-lg font-black tracking-tight text-slate-900 dark:text-white uppercase leading-none">Operations</h1>
                <p className="text-[10px] text-brand-accent font-bold uppercase tracking-[0.15em] mt-1">
                  Yaseen Tahir Service
                </p>
              </div>
            </div>
          </motion.div>

          <div className="flex items-center gap-3">
            {user && onRefresh && (
              <RefreshControl onRefresh={onRefresh} isLoading={isLoading} />
            )}

            {user && (
              <div className="flex items-center gap-1 sm:gap-2 mr-2">
                <button
                  onClick={onToggleAudio}
                  className={cn(
                    "p-2 rounded-lg transition-all",
                    isAudioMuted ? "text-slate-400 hover:text-amber-500 bg-amber-500/5" : "text-emerald-500 bg-emerald-500/5 hover:bg-emerald-500/10"
                  )}
                  title={isAudioMuted ? "Unmute Audio Alerts" : "Mute Audio Alerts"}
                >
                  {isAudioMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
                </button>

                <button
                  onClick={() => {
                    if (!alertAuthorized && onResetBanner) {
                      onResetBanner();
                    } else {
                      setIsNotificationsOpen(!isNotificationsOpen);
                    }
                  }}
                  className={cn(
                    "p-2 rounded-lg transition-all relative",
                    alertAuthorized 
                      ? "text-emerald-500 bg-emerald-500/5 hover:bg-emerald-500/10" 
                      : "text-amber-500 bg-amber-500/5 animate-pulse"
                  )}
                  title={alertAuthorized ? "Open Notification History" : "Alerts Restricted - Click to configure"}
                >
                  {alertAuthorized ? <Bell size={18} /> : <BellOff size={18} />}
                  {alertAuthorized && notifications.length > 0 && (
                    <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full border border-white dark:border-slate-950" />
                  )}
                </button>
              </div>
            )}
            
            <button
              onClick={toggleTheme}
              className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 transition-all"
              title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            >
              {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
            </button>

            {user && (
              <div className="hidden md:flex items-center gap-3 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900">
                <User size={16} className="text-brand-accent" />
                <span className="text-sm font-semibold">{user.username}</span>
                <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-brand-accent/10 text-brand-accent border border-brand-accent/20">
                  {user.role}
                </span>
              </div>
            )}

            <div className={cn(
              "hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-all",
              isOnline 
                ? "border-emerald-500/20 bg-emerald-500/5 opacity-100" 
                : "border-amber-500/20 bg-amber-500/5 opacity-100"
            )}>
              <div className={cn(
                "w-2 h-2 rounded-full animate-pulse",
                isOnline ? "bg-emerald-500" : "bg-amber-500"
              )} />
              <span className={cn(
                "text-[10px] uppercase font-black tracking-widest",
                isOnline ? "text-emerald-600 dark:text-emerald-500" : "text-amber-600 dark:text-amber-500"
              )}>
                {isOnline ? 'Live Relay' : 'Offline Access'}
              </span>
            </div>

            {user && (
              <button
                id="logout-button"
                onClick={onLogout}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-slate-600 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition-all font-semibold text-sm"
              >
                <LogOut size={18} />
                <span className="hidden sm:inline">Sign Out</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          {children}
        </motion.div>
      </main>

      {/* Footer */}
      <footer className="py-12 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950">
        <div className="container mx-auto px-4">
          <div className="flex flex-col items-center">
             <div className="w-8 h-8 rounded-lg bg-slate-900 dark:bg-brand-accent flex items-center justify-center mb-4">
                <span className="text-white font-black text-sm">GTS</span>
             </div>
             <p className="text-[10px] text-slate-400 dark:text-slate-500 uppercase font-black tracking-[0.3em] mb-1">Green Tech Services</p>
             <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100 uppercase tracking-tight">ISP Management Pro</h4>
          </div>
          
          <div className="h-px w-8 bg-slate-200 dark:bg-slate-800 mx-auto my-8" />

          <div className="flex flex-col md:flex-row items-center justify-between gap-6 max-w-4xl mx-auto">
            <p className="text-[11px] text-slate-400 dark:text-slate-500 font-medium">
              © {new Date().getFullYear()} Green Tech Services Operations. Enterprise Edition.
            </p>
            <div className="inline-flex items-center gap-4 px-4 py-1.5 rounded-full border border-slate-200 dark:border-slate-800 text-[10px] uppercase font-bold tracking-widest text-slate-400 cursor-default">
              Proprietor: Yaseen Tahir
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

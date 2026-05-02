import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Sun, Moon, LogOut, User, MessageSquare, ChevronRight, Bell, BellOff, Volume2, VolumeX, Settings, ShieldAlert, AlertTriangle, Mic, WifiOff, Wifi } from 'lucide-react';
import { useTheme } from '../hooks/useTheme';
import { cn } from '../lib/utils';
import { UserProfile } from '../types';
import Chat from './Chat';
import RefreshControl from './RefreshControl';

interface LayoutProps {
  children: React.ReactNode;
  user?: UserProfile | null;
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

import { useOnlineStatus } from '../hooks/useOnlineStatus';

export default function Layout({ 
  children, 
  user, 
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
  const isOnline = useOnlineStatus();
  const [showSyncStatus, setShowSyncStatus] = useState(false);

  useEffect(() => {
    if (isOnline) {
      setShowSyncStatus(true);
      const timer = setTimeout(() => setShowSyncStatus(false), 5000);
      return () => clearTimeout(timer);
    }
  }, [isOnline]);

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
            onClose={() => setIsChatOpen(false)} 
            isAudioMuted={isAudioMuted} 
            isMicMuted={isMicMuted} 
          />
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
                  onClick={onResetBanner}
                  className={cn(
                    "p-2 rounded-lg transition-all",
                    alertAuthorized ? "text-emerald-500 bg-emerald-500/5" : "text-amber-500 bg-amber-500/5 animate-pulse"
                  )}
                  title={alertAuthorized ? "Alerts Active" : "Alerts Restricted - Click to configure"}
                >
                  {alertAuthorized ? <Bell size={18} /> : <BellOff size={18} />}
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

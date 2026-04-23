import React from 'react';
import { motion } from 'motion/react';
import { Sun, Moon, LogOut, User } from 'lucide-react';
import { useTheme } from '../hooks/useTheme';
import { cn } from '../lib/utils';

interface LayoutProps {
  children: React.ReactNode;
  user?: { username: string; role: string } | null;
  onLogout?: () => void;
}

export default function Layout({ children, user, onLogout }: LayoutProps) {
  const { theme, toggleTheme } = useTheme();

  return (
    <div className="min-h-screen text-slate-800 dark:text-white transition-colors duration-300">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b border-slate-200 dark:border-white/10 glass">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex items-center gap-2"
          >
            <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
              <span className="text-white font-bold text-xl tracking-tighter">GTS</span>
            </div>
            <div className="hidden sm:block">
              <h1 className="text-lg font-bold tracking-tight text-slate-900 dark:text-white transition-colors duration-500">ISP Management</h1>
              <p className="text-[10px] text-blue-600 dark:text-blue-400 font-black uppercase tracking-widest leading-none drop-shadow-sm">
                Proprietor -- Yaseen Tahir
              </p>
            </div>
          </motion.div>

          <div className="flex items-center gap-3">
            {user && (
              <div className="hidden md:flex items-center gap-2 mr-4 px-3 py-1.5 rounded-full glass border border-slate-200 dark:border-white/5">
                <User size={14} className="text-blue-600 dark:text-blue-400" />
                <span className="text-sm font-medium text-slate-700 dark:text-white">{user.username}</span>
                <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-blue-500/10 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 border border-blue-500/20 dark:border-blue-500/30">
                  {user.role}
                </span>
              </div>
            )}

            <button
              id="theme-toggle"
              onClick={toggleTheme}
              className="p-2 rounded-lg hover:bg-slate-200 dark:hover:bg-white/10 transition-colors text-slate-500 dark:text-white hover:text-slate-900 dark:hover:text-white"
              aria-label="Toggle theme"
            >
              {theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
            </button>

            {user && (
              <button
                id="logout-button"
                onClick={onLogout}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-100 dark:bg-white/10 hover:bg-red-500/10 dark:hover:bg-red-500/20 text-slate-600 dark:text-white hover:text-red-600 dark:hover:text-red-400 border border-slate-200 dark:border-white/10 hover:border-red-500/30 transition-all duration-200"
              >
                <LogOut size={18} />
                <span className="hidden sm:inline font-medium text-sm">Logout</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          {children}
        </motion.div>
      </main>

      {/* Footer */}
      <footer className="py-8 border-t border-slate-200 dark:border-white/10 mt-auto glass">
        <div className="container mx-auto px-4 text-center">
          <p className="text-sm text-slate-500 dark:text-white/80">
            © {new Date().getFullYear()} GTS ISP Services. All rights reserved.
          </p>
          <div className="mt-2 inline-block px-3 py-1 rounded-full bg-blue-500/5 dark:bg-blue-500/10 border border-blue-500/10 dark:border-blue-500/20 text-[10px] uppercase font-bold tracking-widest text-blue-600 dark:text-blue-400">
            Proprietor: Yaseen Tahir
          </div>
        </div>
      </footer>
    </div>
  );
}

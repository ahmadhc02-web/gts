import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Lock, User, Eye, EyeOff, Loader2 } from 'lucide-react';
import { cn } from '../lib/utils';
import NetworkBackground from './NetworkBackground';

interface LoginFormProps {
  onLogin: (username: string, pass: string) => Promise<void>;
  isLoading: boolean;
  error?: string | null;
}

export default function LoginForm({ onLogin, isLoading, error }: LoginFormProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) return;
    await onLogin(username, password);
  };

  const inputClasses = "w-full pl-10 pr-4 py-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-accent/30 transition-all placeholder:text-slate-400 dark:placeholder:text-slate-600 font-medium";

  return (
    <div className="relative min-h-[calc(100vh-16rem)] flex items-center justify-center py-12 px-4">
      <NetworkBackground />
      
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="relative z-10 w-full max-w-md mx-auto business-card p-10 bg-white dark:bg-slate-950 shadow-2xl"
      >
        <div className="text-center mb-10">
          <div className="w-16 h-16 bg-slate-950 dark:bg-brand-accent rounded-2xl flex items-center justify-center mx-auto shadow-xl mb-6">
            <span className="text-white font-black text-2xl tracking-tighter">GTS</span>
          </div>
          <h2 className="text-3xl font-black tracking-tight text-slate-950 dark:text-white uppercase leading-none">GTS TEAM</h2>
          <p className="text-slate-600 dark:text-slate-400 text-xs uppercase font-black tracking-[0.2em] mt-3">
            Secure System
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <label className="block text-xs font-black text-slate-700 dark:text-slate-300 uppercase tracking-widest ml-1">Identity</label>
            <div className="relative">
              <User className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input
                id="username-input"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Username"
                className={inputClasses}
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="block text-xs font-black text-slate-700 dark:text-slate-300 uppercase tracking-widest ml-1">Passkey</label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input
                id="password-input"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className={inputClasses}
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-brand-accent transition-colors"
                title={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {error && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="text-center p-4 rounded-xl bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-900/30 shadow-sm shadow-red-500/5 transition-all"
            >
              <p className="text-sm font-bold text-red-600 dark:text-red-400">{error}</p>
            </motion.div>
          )}

          <motion.button
            id="login-button"
            type="submit"
            disabled={isLoading}
            whileHover={{ scale: 1.02, y: -2 }}
            whileTap={{ scale: 0.98 }}
            className="w-full py-4 rounded-xl bg-slate-950 dark:bg-brand-accent text-white font-black uppercase tracking-[0.2em] text-xs shadow-lg transition-all hover:bg-black dark:hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-3"
          >
            {isLoading ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Validating Authorization...
              </>
            ) : (
              'Log In'
            )}
          </motion.button>
        </form>

        <div className="mt-10 pt-8 border-t border-slate-100 dark:border-slate-800 text-center">
          <p className="text-[11px] text-slate-500 dark:text-slate-400 uppercase tracking-[0.4em] font-black leading-none italic">
            Green Tech Services Operations
          </p>
          <p className="text-xs text-brand-accent font-black mt-3 uppercase tracking-tight">
            Proprietor: Yaseen Tahir
          </p>
        </div>
      </motion.div>
    </div>
  );
}

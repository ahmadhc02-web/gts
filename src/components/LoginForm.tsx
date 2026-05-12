import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Lock, User, Eye, EyeOff, Loader2, Key } from 'lucide-react';
import { cn } from '../lib/utils';
import NetworkBackground from './NetworkBackground';
import { firebaseService } from '../lib/firebaseService';

interface LoginFormProps {
  onLogin: (username: string, pass: string, lineCode?: string) => Promise<void>;
  isLoading: boolean;
  error?: string | null;
}

export default function LoginForm({ onLogin, isLoading, error }: LoginFormProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [lineCode, setLineCode] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [requiredLineCode, setRequiredLineCode] = useState<boolean>(false);
  const [isCheckingUser, setIsCheckingUser] = useState(false);
  const [detectedCompanyName, setDetectedCompanyName] = useState<string>("Green Tech Services");

  // Check if username needs a line code and fetch branding
  useEffect(() => {
    const checkUser = async () => {
      if (username.length < 3) {
        setRequiredLineCode(false);
        setDetectedCompanyName("Green Tech Services");
        return;
      }
      
      setIsCheckingUser(true);
      try {
        const allUsers = await firebaseService.getUsers();
        const foundUser = allUsers.find(u => u.username.toLowerCase() === username.trim().toLowerCase());
        setRequiredLineCode(!!foundUser?.lineCode);

        if (foundUser) {
          if (foundUser.role === 'dealer' && foundUser.companyName) {
            setDetectedCompanyName(foundUser.companyName);
          } else if (foundUser.dealerId && foundUser.dealerId !== 'main') {
            const dealer = allUsers.find(u => u.uid === foundUser.dealerId && u.role === 'dealer');
            if (dealer && dealer.companyName) {
              setDetectedCompanyName(dealer.companyName);
            } else {
              setDetectedCompanyName("Green Tech Services");
            }
          } else {
            setDetectedCompanyName("Green Tech Services");
          }
        } else {
          setDetectedCompanyName("Green Tech Services");
        }
      } catch (err) {
        console.warn("User protocol validation pending...");
      } finally {
        setIsCheckingUser(false);
      }
    };

    const timer = setTimeout(checkUser, 800); 
    return () => clearTimeout(timer);
  }, [username]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) return;
    if (requiredLineCode && !lineCode) {
      alert("Network Code is mandatory for this account.");
      return;
    }
    await onLogin(username, password, lineCode || undefined);
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
          <div className="relative group w-20 h-20 mx-auto mb-8">
            <div className="absolute -inset-4 bg-gradient-to-r from-brand-accent via-blue-500 to-emerald-500 rounded-3xl blur-2xl opacity-20 group-hover:opacity-50 transition-opacity duration-700 animate-pulse" />
            <div className="relative w-20 h-20 bg-slate-950 rounded-2xl flex items-center justify-center shadow-2xl border border-white/10 overflow-hidden group/logo">
              <div className="absolute inset-0 opacity-40">
                <div className="absolute top-0 -left-1/4 w-1/2 h-1/2 bg-brand-accent/40 blur-2xl rounded-full animate-blob" />
                <div className="absolute bottom-0 -right-1/4 w-1/2 h-1/2 bg-blue-500/40 blur-2xl rounded-full animate-blob animation-delay-2000" />
              </div>
              <div className="relative flex items-baseline">
                <span className="text-white font-black text-4xl sm:text-5xl tracking-tighter italic leading-none drop-shadow-lg">G</span>
                <span className="text-brand-accent font-black text-4xl sm:text-5xl tracking-tighter italic leading-none drop-shadow-lg">TS</span>
              </div>
              {/* Corner Accents */}
              <div className="absolute top-2 left-2 w-3 h-0.5 bg-white/20 rounded-full" />
              <div className="absolute top-2 left-2 w-0.5 h-3 bg-white/20 rounded-full" />
              <div className="absolute bottom-2 right-2 w-3 h-0.5 bg-white/20 rounded-full" />
              <div className="absolute bottom-2 right-2 w-0.5 h-3 bg-white/20 rounded-full" />
            </div>
          </div>
          <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-950 dark:text-white uppercase leading-none font-mono">
            {detectedCompanyName}
          </h2>
          <p className="text-brand-accent text-[10px] uppercase font-bold tracking-[0.4em] mt-3 flex items-center justify-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-brand-accent animate-ping" />
            Access Restricted
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
                className={cn(inputClasses, isCheckingUser && "opacity-70")}
                required
              />
              {isCheckingUser && (
                <div className="absolute right-3.5 top-1/2 -translate-y-1/2">
                   <Loader2 size={16} className="animate-spin text-brand-accent" />
                </div>
              )}
            </div>
          </div>

          <AnimatePresence>
            {requiredLineCode && (
              <motion.div 
                initial={{ opacity: 0, height: 0, scale: 0.95 }}
                animate={{ opacity: 1, height: 'auto', scale: 1 }}
                exit={{ opacity: 0, height: 0, scale: 0.95 }}
                className="space-y-2 overflow-hidden"
              >
                <label className="block text-xs font-black text-brand-accent uppercase tracking-widest ml-1">Network Code (Mandatory)</label>
                <div className="relative">
                  <Key className="absolute left-3.5 top-1/2 -translate-y-1/2 text-brand-accent" size={18} />
                  <input
                    id="line-code-input"
                    type="text"
                    value={lineCode}
                    onChange={(e) => setLineCode(e.target.value)}
                    placeholder="Enter Network Code"
                    className={cn(inputClasses, "border-brand-accent/30 ring-2 ring-brand-accent/10")}
                    required
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>

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
            Powered by {detectedCompanyName}
          </p>
          <p className="text-xs text-brand-accent font-black mt-3 uppercase tracking-tight">
            Proprietor: Yaseen Tahir
          </p>
        </div>
      </motion.div>
    </div>
  );
}

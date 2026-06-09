import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Lock, User, Eye, EyeOff, Loader2, Key, Terminal, Globe, AlertTriangle } from 'lucide-react';
import { cn } from '../lib/utils';
import NetworkBackground from './NetworkBackground';
import { firebaseService } from '../lib/firebaseService';

const getApiUrl = (endpoint: string): string => {
  const host = window.location.hostname;
  if (
    host === 'localhost' || 
    host === '127.0.0.1' || 
    host.includes('.run.app') ||
    host.includes('hf.space') ||
    host.includes('huggingface.co')
  ) {
    return endpoint;
  }
  return `https://ais-pre-y57fbgpyjpmaocrhgtopol-853220806804.asia-southeast1.run.app${endpoint}`;
};

// Typing sound effect using Web Audio API
const playTypeSound = async () => {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    
    const audioCtx = new AudioContextClass();
    if (audioCtx.state === 'suspended') {
      await audioCtx.resume();
    }
    
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    const filter = audioCtx.createBiquadFilter();

    oscillator.type = 'square'; // More mechanical sound
    oscillator.frequency.setValueAtTime(150 + Math.random() * 50, audioCtx.currentTime);
    
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1000, audioCtx.currentTime);

    gainNode.gain.setValueAtTime(0.04, audioCtx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.1);

    oscillator.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    oscillator.start();
    oscillator.stop(audioCtx.currentTime + 0.1);
  } catch (e) {
    // Fail silently if audio is blocked
  }
};

interface TypewriterProps {
  text: string;
  className?: string;
}

function TypewriterText({ text, className }: TypewriterProps) {
  const [displayText, setDisplayText] = useState('');
  const [currentIndex, setCurrentIndex] = useState(0);
  const audioInitialized = useRef(false);

  useEffect(() => {
    if (currentIndex < text.length) {
      const timeout = setTimeout(() => {
        setDisplayText(prev => prev + text[currentIndex]);
        setCurrentIndex(prev => prev + 1);
        playTypeSound();
      }, 40 + Math.random() * 60);
      return () => clearTimeout(timeout);
    }
  }, [currentIndex, text]);

  return (
    <div className={cn("font-mono", className)}>
      {displayText}
      <motion.span
        animate={{ opacity: [1, 0] }}
        transition={{ duration: 0.8, repeat: Infinity }}
        className="inline-block w-2 sm:w-4 h-8 sm:h-12 bg-brand-accent ml-2 align-middle"
      />
    </div>
  );
}

interface LoginFormProps {
  onLogin: (username: string, pass: string, lineCode?: string) => Promise<void>;
  onGoogleLogin?: () => Promise<void>;
  isLoading: boolean;
  error?: string | null;
}

export default function LoginForm({ onLogin, onGoogleLogin, isLoading, error }: LoginFormProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [lineCode, setLineCode] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [requiredLineCode, setRequiredLineCode] = useState<boolean>(false);
  const [isCheckingUser, setIsCheckingUser] = useState(false);
  const [detectedCompanyName, setDetectedCompanyName] = useState<string>("Green Tech Services");

  // Recovery Flow State
  const [showRecoveryModal, setShowRecoveryModal] = useState(false);
  const [recoveryUsername, setRecoveryUsername] = useState('');
  const [recoveryStage, setRecoveryStage] = useState<'request' | 'verify' | 'reset' | 'success'>('request');
  const [recoveryOtp, setRecoveryOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [isRecovering, setIsRecovering] = useState(false);
  const [recoveryError, setRecoveryError] = useState<string | null>(null);
  const [recoverySuccess, setRecoverySuccess] = useState<string | null>(null);
  const [recoveryEmail, setRecoveryEmail] = useState('');

  const obscureEmail = (email: string) => {
    if (!email) return '';
    const parts = email.split('@');
    if (parts.length < 2) return email;
    const [local, domain] = parts;
    if (local.length <= 3) {
      return `${local.charAt(0)}***@${domain}`;
    }
    return `${local.slice(0, 3)}***@${domain}`;
  };

  // Check for deep link on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const rUsername = params.get('reset_username');
    const rCode = params.get('reset_code');
    if (rUsername && rCode) {
      setRecoveryUsername(rUsername);
      setRecoveryOtp(rCode);
      setRecoveryStage('reset'); // Jump directly to new password entry
      setShowRecoveryModal(true);
      // Clean query params so they don't stick around in address bar
      try {
        window.history.replaceState({}, document.title, window.location.pathname);
      } catch (err) {}
    }
  }, []);

  const handleRecoveryRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recoveryUsername.trim()) return;
    setIsRecovering(true);
    setRecoveryError(null);
    setRecoverySuccess(null);
    try {
      const response = await fetch(getApiUrl('/api/auth/send-otp'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: recoveryUsername.trim() })
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to dispatch verification code.');
      }
      setRecoveryEmail(data.email || '');
      setRecoveryStage('verify');
    } catch (err: any) {
      console.error("Recovery request failed:", err);
      setRecoveryError(err.message || 'Verification passcode dispatch failed.');
    } finally {
      setIsRecovering(false);
    }
  };

  const handleRecoveryVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recoveryOtp.trim()) return;
    setIsRecovering(true);
    setRecoveryError(null);
    try {
      const response = await fetch(getApiUrl('/api/auth/verify-otp'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: recoveryUsername.trim(), code: recoveryOtp.trim() })
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Incorrect code. Please verification checks and retry.');
      }
      setRecoveryStage('reset');
    } catch (err: any) {
      console.error("Recovery verify failed:", err);
      setRecoveryError(err.message || 'Passcode verification failed.');
    } finally {
      setIsRecovering(false);
    }
  };

  const handleRecoveryReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword) {
      setRecoveryError('Please establish a new passcode.');
      return;
    }
    if (newPassword.length < 5) {
      setRecoveryError('Passcode must be at least 5 characters long.');
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setRecoveryError('Passcodes do not match.');
      return;
    }
    setIsRecovering(true);
    setRecoveryError(null);
    try {
      const response = await fetch(getApiUrl('/api/auth/reset-password'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: recoveryUsername.trim(),
          code: recoveryOtp.trim(),
          newPassword
        })
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to update passcode.');
      }
      setRecoverySuccess(data.message || 'Passcode updated successfully!');
      setRecoveryStage('success');
    } catch (err: any) {
      console.error("Recovery reset failed:", err);
      setRecoveryError(err.message || 'Failed to update your credentials.');
    } finally {
      setIsRecovering(false);
    }
  };

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
    <div className="relative h-screen sm:h-[100dvh] w-full flex flex-col-reverse lg:flex-row items-center justify-center py-6 sm:py-16 md:py-24 px-4 sm:px-12 md:px-20 gap-8 lg:gap-16 overflow-hidden bg-slate-50 dark:bg-slate-950">
      <NetworkBackground />
      
      {/* Brand Details - Below form on mobile, Left side on desktop */}
      <div className="relative z-10 w-full lg:flex-1 flex flex-col justify-center items-center lg:items-start lg:max-w-[55%] text-center lg:text-left mt-4 lg:mt-0">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 0.5 }}
          className="space-y-3 sm:space-y-6"
        >
          <TypewriterText 
            text="GREEN TECH SERVICES"
            className="text-2xl sm:text-6xl md:text-[5.5rem] lg:text-[7rem] font-black text-slate-900 dark:text-white leading-[0.8] uppercase tracking-tighter font-mono"
          />
          
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.8, duration: 1 }}
            className="flex flex-col gap-2 sm:gap-4 items-center lg:items-start"
          >
            <p className="text-[9px] sm:text-lg font-bold text-slate-500 dark:text-slate-400 uppercase tracking-[0.3em] max-w-xl leading-relaxed">
              Industrial Grade Network Infrastructure.
            </p>
            
            <div className="flex items-center gap-4 sm:gap-6 pt-1">
              <div className="flex flex-col">
                <span className="text-[7px] sm:text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Matrix Status</span>
                <span className="text-[10px] sm:text-lg font-black text-emerald-500 flex items-center gap-1 sm:gap-1.5">
                  <div className="w-1 h-1 sm:w-1.5 sm:h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  ONLINE
                </span>
              </div>
              <div className="w-px h-5 sm:h-8 bg-slate-200 dark:bg-slate-800" />
              <div className="flex flex-col">
                <span className="text-[7px] sm:text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Authorization</span>
                <span className="text-[10px] sm:text-lg font-black text-brand-accent italic">v2.6.5</span>
              </div>
            </div>
          </motion.div>
        </motion.div>
      </div>

      {/* Login Form - Top on mobile, Right side on desktop */}
      <motion.div
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="relative z-10 w-full max-w-[310px] sm:max-w-sm business-card p-5 sm:p-7 bg-white/90 dark:bg-slate-950/90 backdrop-blur-xl shadow-[0_50px_100px_-20px_rgba(0,0,0,0.5)] border border-white/20 dark:border-white/5 rounded-[2.5rem] rounded-tr-[10rem]"
      >
        <div className="text-center mb-6">
          <div className="relative group w-20 h-20 mx-auto mb-6">
            <div className="absolute -inset-4 bg-gradient-to-r from-brand-accent via-blue-500 to-emerald-500 rounded-3xl blur-2xl opacity-20 group-hover:opacity-40 transition-opacity duration-700 animate-pulse" />
            <div className="relative w-20 h-20 bg-slate-950 rounded-2xl flex items-center justify-center shadow-2xl border border-white/10 overflow-hidden group/logo transition-all duration-700 group-hover:scale-105">
              <div className="absolute inset-0 opacity-40">
                <div className="absolute top-0 -left-1/4 w-1/2 h-1/2 bg-brand-accent/40 blur-2xl rounded-full animate-blob" />
                <div className="absolute bottom-0 -right-1/4 w-1/2 h-1/2 bg-blue-500/40 blur-2xl rounded-full animate-blob animation-delay-2000" />
              </div>
              
              {/* Subtle Tech Grid Background */}
              <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)', backgroundSize: '8px 8px' }} />
              <div className="absolute inset-0 bg-slate-900/50 mix-blend-overlay" />

              <div className="relative flex items-center justify-center gap-0.5">
                <span className="text-white font-black text-3xl sm:text-4xl tracking-tighter italic leading-none drop-shadow-[0_0_15px_rgba(255,255,255,0.4)]">G</span>
                <span className="text-brand-accent font-black text-3xl sm:text-4xl tracking-tighter italic leading-none drop-shadow-[0_0_15px_rgba(59,130,246,0.6)]">TS</span>
              </div>
              
              {/* Futuristic Corner Accents */}
              <div className="absolute top-3 left-3 w-4 h-[1.5px] bg-white/20 rounded-full group-hover/logo:bg-brand-accent/50 transition-colors" />
              <div className="absolute top-3 left-3 w-[1.5px] h-4 bg-white/20 rounded-full group-hover/logo:bg-brand-accent/50 transition-colors" />
              <div className="absolute bottom-3 right-3 w-4 h-[1.5px] bg-white/20 rounded-full group-hover/logo:bg-brand-accent/50 transition-colors" />
              <div className="absolute bottom-3 right-3 w-[1.5px] h-4 bg-white/20 rounded-full group-hover/logo:bg-brand-accent/50 transition-colors" />
              
              {/* Laser Scan Effect */}
              <motion.div 
                animate={{ top: ['-100%', '200%'] }}
                transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                className="absolute left-0 right-0 h-1 bg-gradient-to-r from-transparent via-brand-accent/30 to-transparent blur-[1px] z-10"
              />
            </div>
          </div>
          <h2 className="text-xl sm:text-2xl font-black tracking-tight text-slate-950 dark:text-white uppercase leading-none font-mono">
            {detectedCompanyName}
          </h2>
          <p className="text-brand-accent text-[9px] uppercase font-bold tracking-[0.4em] mt-2 flex items-center justify-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-brand-accent animate-ping" />
            Access Restricted
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="block text-[10px] font-black text-slate-700 dark:text-slate-300 uppercase tracking-widest ml-1">Identity</label>
            <div className="relative">
              <User className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input
                id="username-input"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Username"
                className={cn(inputClasses, "py-2.5", isCheckingUser && "opacity-70")}
                required
              />
              {isCheckingUser && (
                <div className="absolute right-3.5 top-1/2 -translate-y-1/2">
                   <Loader2 size={14} className="animate-spin text-brand-accent" />
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
                className="space-y-1.5 overflow-hidden"
              >
                <label className="block text-[10px] font-black text-brand-accent uppercase tracking-widest ml-1">Network Code</label>
                <div className="relative">
                  <Key className="absolute left-3.5 top-1/2 -translate-y-1/2 text-brand-accent" size={16} />
                  <input
                    id="line-code-input"
                    type="text"
                    value={lineCode}
                    onChange={(e) => setLineCode(e.target.value)}
                    placeholder="Enter Code"
                    className={cn(inputClasses, "py-2.5 border-brand-accent/30 ring-2 ring-brand-accent/10")}
                    required
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="space-y-1.5">
            <label className="block text-[10px] font-black text-slate-700 dark:text-slate-300 uppercase tracking-widest ml-1">Passkey</label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input
                id="password-input"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className={cn(inputClasses, "py-2.5")}
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-brand-accent transition-colors"
                title={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <div className="flex justify-end pr-1 -mt-1 pb-1">
            <button
              type="button"
              onClick={() => {
                setRecoveryUsername(username);
                setRecoveryError(null);
                setRecoverySuccess(null);
                setShowRecoveryModal(true);
              }}
              className="text-[9px] font-black uppercase tracking-widest text-[#2563EB] dark:text-brand-accent hover:underline transition-colors cursor-pointer"
            >
              Forgot Password?
            </button>
          </div>

          {error && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="text-center p-3 rounded-xl bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-900/30 transition-all"
            >
              <p className="text-[11px] font-bold text-red-600 dark:text-red-400">{error}</p>
            </motion.div>
          )}

          <motion.button
            id="login-button"
            type="submit"
            disabled={isLoading}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="w-full py-3.5 rounded-xl bg-slate-950 dark:bg-brand-accent text-white font-black uppercase tracking-[0.2em] text-[10px] shadow-lg transition-all hover:bg-black dark:hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                Validating...
              </>
            ) : (
              'Log In'
            )}
          </motion.button>

          {onGoogleLogin && (
            <div className="mt-4">
              <div className="relative mb-4">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-slate-200 dark:border-slate-800"></div>
                </div>
                <div className="relative flex justify-center text-[10px] uppercase font-black tracking-widest">
                  <span className="px-2 bg-white dark:bg-slate-950 text-slate-400">Or continue with</span>
                </div>
              </div>
              
              <motion.button
                type="button"
                onClick={onGoogleLogin}
                disabled={isLoading}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="w-full py-3.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-100 font-black uppercase tracking-[0.2em] text-[10px] shadow-sm transition-all hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
                Google Identity
              </motion.button>


            </div>
          )}
        </form>

        <div className="mt-8 pt-6 border-t border-slate-100 dark:border-slate-800 text-center">
          <p className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-[0.4em] font-black leading-none italic">
            Powered by {detectedCompanyName}
          </p>
          <p className="text-[10px] text-brand-accent font-black mt-2.5 uppercase tracking-tight">
            Powered by Green Net
          </p>
        </div>
      </motion.div>

      <AnimatePresence>
        {showRecoveryModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md"
          >
            <motion.div
              initial={{ scale: 0.95, y: 15 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 15 }}
              className="relative w-full max-w-md p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl overflow-hidden"
            >
              {/* Corner Accents */}
              <div className="absolute top-0 right-0 w-24 h-24 bg-brand-accent/10 rounded-full blur-2xl pointer-events-none" />
              <div className="absolute bottom-0 left-0 w-24 h-24 bg-blue-500/10 rounded-full blur-2xl pointer-events-none" />

              <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-100 dark:border-slate-800/60">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-brand-accent/10 flex items-center justify-center text-brand-accent">
                    <Terminal size={16} />
                  </div>
                  <div>
                    <h3 className="text-sm font-black uppercase tracking-tight text-slate-900 dark:text-slate-50">Identity Recovery</h3>
                    <p className="text-[9px] font-bold uppercase tracking-widest text-[#2563EB] dark:text-brand-accent">Passkey Protocol Restore</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setShowRecoveryModal(false);
                    // Reset to request stage on close
                    setTimeout(() => {
                      setRecoveryStage('request');
                      setRecoveryOtp('');
                      setNewPassword('');
                      setConfirmNewPassword('');
                      setRecoveryError(null);
                    }, 300);
                  }}
                  className="p-1 px-2 rounded-lg bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700/80 text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-300 transition-colors cursor-pointer"
                >
                  Close
                </button>
              </div>

              {recoveryStage === 'request' && (
                <form onSubmit={handleRecoveryRequest} className="space-y-4">
                  <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed font-semibold">
                    To initiate the secure protocol restore, enter your registered <strong>Access ID (Username)</strong> below. We will match the credentials and dispatch an OTP code via Gmail.
                  </p>

                  <div className="space-y-1.5">
                    <label className="block text-[10px] font-black text-slate-700 dark:text-slate-300 uppercase tracking-widest ml-1">Access ID (Username)</label>
                    <div className="relative">
                      <User className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                      <input
                        type="text"
                        value={recoveryUsername}
                        onChange={(e) => setRecoveryUsername(e.target.value)}
                        placeholder="Enter Username"
                        className={cn(inputClasses, "py-2.5")}
                        required
                        disabled={isRecovering}
                      />
                    </div>
                  </div>

                  {recoveryError && (
                    <motion.div
                      initial={{ opacity: 0, y: -5 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="p-3 rounded-xl bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/30 text-[11px] font-bold text-red-600 dark:text-red-400 flex gap-2 items-start"
                    >
                      <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 animate-pulse" />
                      <span>{recoveryError}</span>
                    </motion.div>
                  )}

                  <div className="pt-2 flex gap-3">
                    <button
                      type="button"
                      onClick={() => setShowRecoveryModal(false)}
                      className="flex-1 py-3 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-xl text-[10.5px] font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 transition-all border border-slate-200/50 dark:border-slate-700/50"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isRecovering || !recoveryUsername}
                      className="flex-1 py-3 bg-slate-900 dark:bg-brand-accent text-white rounded-xl text-[10.5px] font-black uppercase tracking-wider shadow-lg shadow-brand-accent/10 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {isRecovering ? (
                        <>
                          <Loader2 size={14} className="animate-spin" />
                          Checking...
                        </>
                      ) : (
                        'Send OTP Code'
                      )}
                    </button>
                  </div>
                </form>
              )}

              {recoveryStage === 'verify' && (
                <form onSubmit={handleRecoveryVerify} className="space-y-4">
                  <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed font-semibold">
                    A secure authentication code has been dispatched to your backup destination: <strong className="text-blue-500">{obscureEmail(recoveryEmail)}</strong>. Enter the 6-digit code below:
                  </p>

                  <div className="space-y-1.5">
                    <label className="block text-[10px] font-black text-slate-700 dark:text-slate-300 uppercase tracking-widest ml-1">6-Digit Secure Code</label>
                    <div className="relative">
                      <Key className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                      <input
                        type="text"
                        maxLength={6}
                        value={recoveryOtp}
                        onChange={(e) => setRecoveryOtp(e.target.value.replace(/\D/g, ''))}
                        placeholder="e.g. 123456"
                        className={cn(inputClasses, "py-2.5 text-center font-mono tracking-[0.3em] text-lg font-bold pl-4")}
                        required
                        disabled={isRecovering}
                      />
                    </div>
                  </div>

                  {recoveryError && (
                    <motion.div
                      initial={{ opacity: 0, y: -5 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="p-3 rounded-xl bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/30 text-[11px] font-bold text-red-600 dark:text-red-400 flex gap-2 items-start"
                    >
                      <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                      <span>{recoveryError}</span>
                    </motion.div>
                  )}

                  <div className="pt-2 flex gap-3">
                    <button
                      type="button"
                      onClick={() => setRecoveryStage('request')}
                      className="flex-1 py-3 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-xl text-[10.5px] font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 transition-all border border-slate-200/50 dark:border-slate-700/50"
                    >
                      Back
                    </button>
                    <button
                      type="submit"
                      disabled={isRecovering || recoveryOtp.length < 6}
                      className="flex-1 py-3 bg-slate-900 dark:bg-brand-accent text-white rounded-xl text-[10.5px] font-black uppercase tracking-wider shadow-lg shadow-brand-accent/10 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {isRecovering ? (
                        <>
                          <Loader2 size={14} className="animate-spin" />
                          Verifying...
                        </>
                      ) : (
                        'Verify Code'
                      )}
                    </button>
                  </div>
                </form>
              )}

              {recoveryStage === 'reset' && (
                <form onSubmit={handleRecoveryReset} className="space-y-4">
                  <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed font-semibold">
                    Establish your new security configurations for access ID <strong>{recoveryUsername}</strong>.
                  </p>

                  <div className="space-y-1.5">
                    <label className="block text-[10px] font-black text-slate-700 dark:text-slate-300 uppercase tracking-widest ml-1">New Secure Passcode</label>
                    <div className="relative">
                      <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                      <input
                        type={showPassword ? "text" : "password"}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="Min 5 characters"
                        className={cn(inputClasses, "py-2.5")}
                        required
                        disabled={isRecovering}
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-[10px] font-black text-slate-700 dark:text-slate-300 uppercase tracking-widest ml-1">Confirm Secure Passcode</label>
                    <div className="relative">
                      <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                      <input
                        type={showPassword ? "text" : "password"}
                        value={confirmNewPassword}
                        onChange={(e) => setConfirmNewPassword(e.target.value)}
                        placeholder="Repeat passcode"
                        className={cn(inputClasses, "py-2.5")}
                        required
                        disabled={isRecovering}
                      />
                    </div>
                  </div>

                  <div className="flex justify-start">
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="text-[10px] font-black uppercase tracking-wider text-slate-500 hover:text-brand-accent transition-all flex items-center gap-1.5"
                    >
                      {showPassword ? <EyeOff size={12} /> : <Eye size={12} />}
                      {showPassword ? "Reveal Passwords" : "Hide Passwords"}
                    </button>
                  </div>

                  {recoveryError && (
                    <motion.div
                      initial={{ opacity: 0, y: -5 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="p-3 rounded-xl bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/30 text-[11px] font-bold text-red-600 dark:text-red-400 flex gap-2 items-start"
                    >
                      <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                      <span>{recoveryError}</span>
                    </motion.div>
                  )}

                  <div className="pt-2 flex gap-3">
                    <button
                      type="button"
                      onClick={() => setRecoveryStage('verify')}
                      className="flex-1 py-3 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-xl text-[10.5px] font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 transition-all border border-slate-200/50 dark:border-slate-700/50"
                    >
                      Back
                    </button>
                    <button
                      type="submit"
                      disabled={isRecovering || !newPassword || !confirmNewPassword}
                      className="flex-1 py-3 bg-emerald-600 text-white rounded-xl text-[10.5px] font-black uppercase tracking-wider shadow-lg shadow-emerald-500/10 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {isRecovering ? (
                        <>
                          <Loader2 size={14} className="animate-spin" />
                          Finalizing...
                        </>
                      ) : (
                        'Save Passcode'
                      )}
                    </button>
                  </div>
                </form>
              )}

              {recoveryStage === 'success' && (
                <div className="space-y-4 text-center py-2 animate-fadeIn">
                  <div className="w-12 h-12 rounded-full bg-emerald-500/15 text-emerald-500 flex items-center justify-center mx-auto mb-2 font-black text-xl">
                    ✓
                  </div>
                  <h4 className="text-sm font-black uppercase tracking-tight text-emerald-600 dark:text-emerald-400 leading-none">Security Updated</h4>
                  <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed font-bold p-3 bg-slate-50 dark:bg-slate-900/40 rounded-2xl border border-slate-100 dark:border-slate-800/50 text-left">
                    {recoverySuccess}
                  </p>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-relaxed">
                    Your security nodes have successfully registered the new credentials. You can now sign in with your updated passcode.
                  </p>
                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        setShowRecoveryModal(false);
                        setRecoveryStage('request');
                        setRecoveryOtp('');
                        setNewPassword('');
                        setConfirmNewPassword('');
                        setRecoveryError(null);
                        setRecoverySuccess(null);
                      }}
                      className="w-full py-3 bg-slate-950 dark:bg-slate-800 hover:scale-[1.01] active:scale-95 text-white rounded-xl text-[10px] font-black uppercase tracking-[0.2em] transition-all"
                    >
                      Return to Sign In
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

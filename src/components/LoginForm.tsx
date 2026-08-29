import React, { useState, useEffect, useRef } from "react";
import { Loader2, Sun, Moon, Key, ShieldCheck, ChevronDown, ChevronUp } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useTheme } from "../hooks/useTheme";
import NetworkBackground from "./NetworkBackground";

interface LoginFormProps {
  onLogin: (username: string, pass: string, lineCode?: string) => Promise<void>;
  onGoogleLogin?: () => Promise<void>;
  isLoading: boolean;
  error?: string | null;
}

export default function LoginForm({ onLogin, onGoogleLogin, isLoading, error }: LoginFormProps) {
  const { theme, toggleTheme } = useTheme();
  const isDarkMode = theme === "dark";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [lineCode, setLineCode] = useState("");
  const [isCheckingUser, setIsCheckingUser] = useState(false);
  const [requiredLineCode, setRequiredLineCode] = useState(false);
  const [manualShowLineCode, setManualShowLineCode] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  // If external error mentions Line Code, ensure line code field is expanded
  useEffect(() => {
    if (error && (error.toLowerCase().includes('line code') || error.toLowerCase().includes('network code'))) {
      setRequiredLineCode(true);
    }
  }, [error]);

  useEffect(() => {
    const checkUser = async () => {
      const cleanUsername = email.trim().toLowerCase();
      if (!cleanUsername || cleanUsername.length < 2) {
        setRequiredLineCode(false);
        return;
      }
      setIsCheckingUser(true);
      try {
        const { supabaseService } = await import('../lib/supabaseService');
        // Check user directly
        const users = await supabaseService.getUsers('all');
        const foundUser = users.find(u => 
          u.username.trim().toLowerCase() === cleanUsername || 
          (u.email && u.email.trim().toLowerCase() === cleanUsername) ||
          u.uid === cleanUsername
        );
        
        let hasLc = false;
        if (foundUser) {
          if (foundUser.lineCode && foundUser.lineCode.trim()) {
            hasLc = true;
          } else if (foundUser.dealerId && foundUser.dealerId !== 'main') {
            const parentDealer = users.find(u => u.uid === foundUser.dealerId || u.username.toLowerCase() === foundUser.dealerId.toLowerCase());
            if (parentDealer?.lineCode && parentDealer.lineCode.trim()) {
              hasLc = true;
            }
          }
        } else {
          // Try single direct database query
          const directUser = await supabaseService.getUserForLogin(cleanUsername);
          if (directUser) {
            if (directUser.lineCode && directUser.lineCode.trim()) {
              hasLc = true;
            } else if (directUser.dealerId && directUser.dealerId !== 'main') {
              const parentDealer = users.find(u => u.uid === directUser.dealerId || u.username.toLowerCase() === directUser.dealerId.toLowerCase());
              if (parentDealer?.lineCode && parentDealer.lineCode.trim()) {
                hasLc = true;
              }
            }
          }
        }
        setRequiredLineCode(hasLc);
      } catch (e) {
        setRequiredLineCode(false);
      } finally {
        setIsCheckingUser(false);
      }
    };
    
    const timer = setTimeout(checkUser, 300);
    return () => clearTimeout(timer);
  }, [email]);

  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const card = cardRef.current;
    if (!card) return;

    const handleMouseMove = (e: MouseEvent) => {
      const rect = card.getBoundingClientRect();
      const x = (e.clientX - rect.left - rect.width / 2) / (rect.width / 2);
      const y = (e.clientY - rect.top - rect.height / 2) / (rect.height / 2);
      
      // We apply the effect but maybe tone it down in dark mode
      if (!isDarkMode) {
          card.style.boxShadow = `${x * 30}px ${y * 30}px 60px #bec3cf, ${-x * 30}px ${-y * 30}px 60px #ffffff`;
      } else {
          card.style.boxShadow = `${x * 30}px ${y * 30}px 60px rgba(0,0,0,0.5), ${-x * 30}px ${-y * 30}px 60px rgba(255,255,255,0.05)`;
      }
    };
    
    // reset on mouse leave
    const handleMouseLeave = () => {
      if (!isDarkMode) {
          card.style.boxShadow = `20px 20px 60px #bec3cf, -20px -20px 60px #ffffff`;
      } else {
          card.style.boxShadow = `20px 20px 60px rgba(0,0,0,0.5), -20px -20px 60px rgba(255,255,255,0.05)`;
      }
    };

    document.addEventListener("mousemove", handleMouseMove);
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
    };
  }, [isDarkMode]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    if (!email.trim() || !password.trim()) {
      setLocalError("Please enter your username and password.");
      return;
    }

    if (requiredLineCode && !lineCode.trim()) {
      setLocalError("Line Code is required for this account. Without a valid Line Code, login is not allowed.");
      return;
    }

    await onLogin(email.trim(), password.trim(), lineCode.trim());
  };

  const isLineCodeVisible = requiredLineCode || manualShowLineCode || lineCode.length > 0;

  return (
    <div className="neumorphism-wrapper">
      <div className="absolute top-4 right-4 z-50">
        <button
          onClick={toggleTheme}
          className="p-3 rounded-xl text-slate-600 dark:text-slate-300 hover:text-emerald-600 dark:hover:text-emerald-400 transition-all cursor-pointer flex items-center justify-center bg-[var(--neu-surface)]/80 backdrop-blur-md border border-white/60 dark:border-white/5"
          style={{ boxShadow: '4px 4px 10px #bec3cf, -4px -4px 10px #ffffff' }}
          aria-label="Toggle Theme"
        >
          {isDarkMode ? <Sun size={18} /> : <Moon size={18} />}
        </button>
      </div>

      <NetworkBackground className="opacity-40 pointer-events-none fixed inset-0 z-0" />

      <div className="login-container relative z-10">
        <div className="login-card" ref={cardRef}>
          <div className="login-header">
            <div className="neu-icon">
              <div className="icon-inner">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
              </div>
            </div>
            <h2>Welcome back</h2>
            <p>Please sign in to continue</p>
          </div>

          <form className="login-form" id="loginForm" onSubmit={handleSubmit} noValidate>
            <div className="form-group">
              <div className="input-group neu-input">
                <input
                  type="text"
                  id="email"
                  name="email"
                  required
                  autoComplete="email"
                  placeholder=" "
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setLocalError(null);
                  }}
                />
                <label htmlFor="email">Email address or Username</label>
                <div className="input-icon">
                  {isCheckingUser ? (
                    <Loader2 size={18} className="animate-spin text-emerald-500" />
                  ) : (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                      <polyline points="22,6 12,13 2,6" />
                    </svg>
                  )}
                </div>
              </div>
            </div>

            <AnimatePresence>
              {isLineCodeVisible && (
                <motion.div
                  initial={{ opacity: 0, height: 0, scale: 0.95 }}
                  animate={{ opacity: 1, height: "auto", scale: 1 }}
                  exit={{ opacity: 0, height: 0, scale: 0.95 }}
                  transition={{ duration: 0.3 }}
                  className="form-group overflow-hidden space-y-1.5"
                >
                  <div className="flex items-center justify-between px-1">
                    <span className="text-[11px] font-bold tracking-wide uppercase flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                      <ShieldCheck size={13} className="text-emerald-500" />
                      {requiredLineCode ? "Line Code (Required / لازمی)" : "Line Code (Optional)"}
                    </span>
                    {requiredLineCode && (
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                        Mandatory
                      </span>
                    )}
                  </div>
                  <div className="input-group neu-input" style={{ borderColor: requiredLineCode ? 'var(--brand-accent, #10b981)' : undefined }}>
                    <input
                      type="text"
                      id="lineCode"
                      name="lineCode"
                      required={requiredLineCode}
                      placeholder=" "
                      value={lineCode}
                      onChange={(e) => {
                        setLineCode(e.target.value);
                        setLocalError(null);
                      }}
                    />
                    <label htmlFor="lineCode">
                      {requiredLineCode ? "Gateway Line Code (Mandatory / لازمی)" : "Gateway Node Code (Line Code)"}
                    </label>
                    <div className="input-icon text-emerald-500">
                      <Key size={18} />
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {!requiredLineCode && !isLineCodeVisible && (
              <div className="flex justify-end -mt-2 mb-2">
                <button
                  type="button"
                  onClick={() => setManualShowLineCode(true)}
                  className="text-[11px] font-medium text-slate-500 dark:text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 flex items-center gap-1 transition-colors"
                >
                  <Key size={12} />
                  + Enter Line Code
                </button>
              </div>
            )}

            <div className="form-group">
              <div className="input-group neu-input password-group">
                <input
                  type={showPassword ? "text" : "password"}
                  id="password"
                  name="password"
                  required
                  autoComplete="current-password"
                  placeholder=" "
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setLocalError(null);
                  }}
                />
                <label htmlFor="password">Password</label>
                <div className="input-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0110 0v4" />
                  </svg>
                </div>
                <button
                  type="button"
                  className={`password-toggle neu-toggle ${showPassword ? "show-password" : ""}`}
                  id="passwordToggle"
                  aria-label="Toggle password visibility"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  <svg className="eye-open" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                  <svg className="eye-closed" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                    <line x1="1" y1="1" x2="23" y2="23" />
                  </svg>
                </button>
              </div>
            </div>

            {(error || localError) && (
              <div className="text-red-500 text-xs font-semibold mb-4 px-2 py-1.5 rounded-lg bg-red-500/10 border border-red-500/20">
                {localError || error}
              </div>
            )}

            <div className="form-options">
              <div className="remember-wrapper">
                <input type="checkbox" id="remember" name="remember" />
                <label htmlFor="remember" className="checkbox-label">
                  <div className="neu-checkbox">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </div>
                  Remember me
                </label>
              </div>
              <a href="#" className="forgot-link">Forgot password?</a>
            </div>

            <button type="submit" className={`neu-button login-btn ${isLoading ? 'loading' : ''}`} disabled={isLoading}>
              <span className="btn-text">Sign In</span>
              <div className="btn-loader">
                <div className="neu-spinner"></div>
              </div>
            </button>
          </form>

          <div className="divider">
            <div className="divider-line"></div>
            <span>or continue with</span>
            <div className="divider-line"></div>
          </div>

          <div className="social-login">
            <button type="button" className="social-btn neu-social" onClick={onGoogleLogin}>
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
            </button>
          </div>

          <div className="signup-link">
            <p>Don't have an account? <a href="#">Sign up</a></p>
          </div>

        </div>
      </div>
    </div>
  );
}

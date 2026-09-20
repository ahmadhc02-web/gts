import React, { useState, useEffect } from "react";
import { Loader2, Sun, Moon, Key, ShieldCheck, Mail, Lock, Check, Zap, Receipt, ShieldAlert, Building2 } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useTheme } from "../hooks/useTheme";
import NetworkBackground from "./NetworkBackground";

interface LoginFormProps {
  onLogin: (username: string, pass: string, lineCode?: string) => Promise<void>;
  onGoogleLogin?: () => Promise<void>;
  isLoading: boolean;
  error?: string | null;
}

export default function LoginForm({ onLogin, isLoading, error }: LoginFormProps) {
  const { theme, toggleTheme } = useTheme();
  const isDarkMode = theme === "dark";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [lineCode, setLineCode] = useState("");
  const [isCheckingUser, setIsCheckingUser] = useState(false);
  const [requiredLineCode, setRequiredLineCode] = useState(false);
  const [detectedCompany, setDetectedCompany] = useState<string>("");
  const [localError, setLocalError] = useState<string | null>(null);
  const [rememberMe, setRememberMe] = useState(false);
  const [brandingLogo, setBrandingLogo] = useState<string>("");

  useEffect(() => {
    try {
      const cached = localStorage.getItem("gts_branding");
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed.logoUrl) setBrandingLogo(parsed.logoUrl);
      }
    } catch (_) {}
  }, []);

  // Typewriter animation state for the stylish left title
  const fullTitle = "Premium Complaints and Billing Managment System";
  const [typedTitle, setTypedTitle] = useState("");

  useEffect(() => {
    let index = 0;
    let isCancelled = false;
    setTypedTitle("");

    const typeNextChar = () => {
      if (isCancelled) return;
      if (index <= fullTitle.length) {
        setTypedTitle(fullTitle.slice(0, index));
        index++;
        // Natural keyboard typing cadence with slight variations
        const delay = index < fullTitle.length && fullTitle[index - 1] === " " ? 100 : Math.floor(Math.random() * 25) + 40;
        setTimeout(typeNextChar, delay);
      }
    };

    const initialTimeout = setTimeout(typeNextChar, 180);

    return () => {
      isCancelled = true;
      clearTimeout(initialTimeout);
    };
  }, []);

  // Load Remember Me data
  useEffect(() => {
    const saved = localStorage.getItem("gts_remember_login");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.email) setEmail(parsed.email);
        if (parsed.password) setPassword(parsed.password);
        if (parsed.lineCode) {
          setLineCode(parsed.lineCode);
        }
        setRememberMe(true);
      } catch (e) {
        console.error("Failed to parse remember me data", e);
      }
    }
  }, []);

  // If external error mentions Line Code, ensure line code field is expanded
  useEffect(() => {
    if (error && (error.toLowerCase().includes("line code") || error.toLowerCase().includes("network code"))) {
      setRequiredLineCode(true);
    }
  }, [error]);

  useEffect(() => {
    let isMounted = true;
    const checkUser = async () => {
      const cleanUsername = email.trim().toLowerCase();
      if (!cleanUsername || cleanUsername.length < 2) {
        if (isMounted) {
          setRequiredLineCode(false);
          setDetectedCompany("");
          setIsCheckingUser(false);
        }
        return;
      }
      setIsCheckingUser(true);
      try {
        const { supabaseService } = await import("../lib/supabaseService");

        // 1. Direct indexed login lookup (fastest)
        let foundUser = await supabaseService.getUserForLogin(cleanUsername);

        // 2. Fallback to comprehensive users scan
        let parentLineCode = "";
        let parentDealerObj: any = null;
        if (!foundUser) {
          const users = await supabaseService.getUsers("all");
          foundUser =
            users.find(
              (u) =>
                (u.username && u.username.trim().toLowerCase() === cleanUsername) ||
                (u.email && u.email.trim().toLowerCase() === cleanUsername) ||
                u.uid === cleanUsername
            ) || null;

          if (foundUser?.dealerId && foundUser.dealerId !== "main") {
            const parentDealer = users.find(
              (u) =>
                u.uid === foundUser?.dealerId ||
                (u.username && foundUser?.dealerId && u.username.toLowerCase() === foundUser.dealerId.toLowerCase())
            );
            if (parentDealer) {
              parentDealerObj = parentDealer;
              if (parentDealer.lineCode && String(parentDealer.lineCode).trim()) {
                parentLineCode = String(parentDealer.lineCode).trim();
              }
            }
          }
        } else if (foundUser.dealerId && foundUser.dealerId !== "main") {
          const parent =
            (await supabaseService.getUser(foundUser.dealerId)) ||
            (await supabaseService.getUserForLogin(foundUser.dealerId));
          if (parent) {
            parentDealerObj = parent;
            if (parent.lineCode && String(parent.lineCode).trim()) {
              parentLineCode = String(parent.lineCode).trim();
            }
          }
        }

        let hasLc = false;
        let resolvedCompany = "";

        if (foundUser) {
          // Line Code resolution
          if (foundUser.lineCode && String(foundUser.lineCode).trim()) {
            hasLc = true;
          } else if (parentLineCode) {
            hasLc = true;
          }

          // Company Name resolution
          if (foundUser.companyName && String(foundUser.companyName).trim()) {
            resolvedCompany = String(foundUser.companyName).trim();
          } else if (parentDealerObj?.companyName && String(parentDealerObj.companyName).trim()) {
            resolvedCompany = String(parentDealerObj.companyName).trim();
          } else if (foundUser.dealerId && foundUser.dealerId !== "main") {
            const parent =
              (await supabaseService.getUser(foundUser.dealerId)) ||
              (await supabaseService.getUserForLogin(foundUser.dealerId));
            if (parent?.companyName && String(parent.companyName).trim()) {
              resolvedCompany = String(parent.companyName).trim();
            }
          } else if (foundUser.createdBy) {
            const creator =
              (await supabaseService.getUser(foundUser.createdBy)) ||
              (await supabaseService.getUserForLogin(foundUser.createdBy));
            if (creator?.companyName && String(creator.companyName).trim()) {
              resolvedCompany = String(creator.companyName).trim();
            }
          }

          // Global branding fallback for admin/super_admin or default system accounts
          if (!resolvedCompany) {
            try {
              const cached = localStorage.getItem("gts_branding");
              if (cached) {
                const parsed = JSON.parse(cached);
                if (parsed.projectName && parsed.projectName.trim()) {
                  resolvedCompany = parsed.projectName.trim();
                }
              }
            } catch (_) {}
          }
        }

        if (isMounted) {
          setRequiredLineCode(hasLc);
          setDetectedCompany(resolvedCompany);
          if (!hasLc) {
            setLineCode("");
          }
        }
      } catch (e) {
        if (isMounted) {
          setRequiredLineCode(false);
          setDetectedCompany("");
        }
      } finally {
        if (isMounted) {
          setIsCheckingUser(false);
        }
      }
    };

    const timer = setTimeout(checkUser, 250);
    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [email]);

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

    // Save remember me before login
    if (rememberMe) {
      localStorage.setItem(
        "gts_remember_login",
        JSON.stringify({
          email: email.trim(),
          password: password.trim(),
          lineCode: requiredLineCode ? lineCode.trim() : ""
        })
      );
    } else {
      localStorage.removeItem("gts_remember_login");
    }

    await onLogin(email.trim(), password.trim(), requiredLineCode ? lineCode.trim() : undefined);
  };

  const isLineCodeVisible = requiredLineCode;

  return (
    <div className="min-h-[100dvh] w-full flex items-center justify-center px-3.5 py-6 sm:px-6 sm:py-10 lg:p-12 relative font-sans overflow-x-hidden transition-colors duration-300 bg-[var(--neu-bg)]">
      {/* Neumorphic Theme Toggle Pill - Touch friendly */}
      <div className="absolute top-3.5 right-3.5 sm:top-6 sm:right-8 z-50">
        <button
          onClick={toggleTheme}
          className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl text-slate-700 dark:text-slate-200 transition-all cursor-pointer flex items-center justify-center border border-white/60 dark:border-white/5 active:scale-90"
          style={{
            backgroundColor: "var(--neu-surface)",
            boxShadow: "var(--neu-shadow-raised-sm)"
          }}
          aria-label="Toggle Theme"
        >
          {isDarkMode ? <Sun size={19} className="text-amber-400" /> : <Moon size={19} className="text-slate-800" />}
        </button>
      </div>

      {/* Ambient Network Node Background */}
      <NetworkBackground />

      {/* Main Split Layout Container: order-1 on mobile for Login Frame, order-2 for presentation info */}
      <div className="w-full max-w-7xl mx-auto flex flex-col lg:flex-row items-center justify-between gap-8 sm:gap-10 lg:gap-14 xl:gap-20 relative z-10 py-6 sm:py-8 lg:py-0">
        
        {/* 1. LOGIN FRAME (Appears with Brand Header 1st on Mobile / Android View, Right-side on Desktop) */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="w-full sm:max-w-[440px] lg:max-w-none lg:w-[420px] xl:w-[460px] shrink-0 order-1 lg:order-2 lg:ml-auto"
        >
          {/* Mobile / Android Top Brand Header: GTS Logo + Green Tech Services */}
          <div className="flex lg:hidden items-center justify-center gap-3.5 mb-5 sm:mb-6 select-none">
            <div
              className="w-13 h-13 p-2 rounded-2xl flex items-center justify-center border border-white/80 dark:border-white/5 transition-transform active:scale-95 shrink-0"
              style={{
                backgroundColor: "var(--neu-surface)",
                boxShadow: "var(--neu-shadow-raised)"
              }}
            >
              {brandingLogo ? (
                <img
                  src={brandingLogo}
                  alt="GTS Logo"
                  className="w-full h-full object-contain rounded-xl"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <span className="text-slate-900 dark:text-white font-black text-xl tracking-tighter italic select-none">
                  G<span className="text-emerald-500">TS</span>
                </span>
              )}
            </div>
            <div className="flex flex-col select-none text-left">
              <span className="text-base sm:text-lg font-black tracking-tight text-slate-950 dark:text-white leading-tight">
                Green Tech Services
              </span>
              <span className="text-[10px] sm:text-[11px] font-black tracking-widest text-emerald-600 dark:text-emerald-400 uppercase mt-0.5">
                Telecom & Fiber Infrastructure
              </span>
            </div>
          </div>

          {/* Neumorphic Card Container */}
          <div
            className="rounded-[28px] sm:rounded-[34px] p-5 sm:p-8 md:p-10 relative border border-white/80 dark:border-white/5 transition-all shadow-xl"
            style={{
              backgroundColor: "var(--neu-surface)",
              boxShadow: "var(--neu-shadow-raised-lg)"
            }}
          >
            {/* Header / Avatar */}
            <div className="text-center mb-6 sm:mb-8">
              <div
                className="w-14 h-14 sm:w-16 sm:h-16 mx-auto rounded-2xl flex items-center justify-center text-slate-900 dark:text-white border border-white/70 dark:border-white/5 mb-3.5 sm:mb-5 transition-transform active:scale-95"
                style={{
                  backgroundColor: "var(--neu-surface)",
                  boxShadow: "var(--neu-shadow-raised)"
                }}
              >
                <ShieldCheck size={28} className="text-emerald-500 stroke-[2.2] sm:w-8 sm:h-8" />
              </div>
              <h2 className="text-xl sm:text-2xl font-black text-slate-950 dark:text-white tracking-tight mb-1">
                Welcome back
              </h2>
              <p className="text-[11.5px] sm:text-xs font-semibold text-slate-500 dark:text-slate-400">
                Please sign in to access your portal
              </p>

              {/* User's Associated Company Name Badge */}
              <AnimatePresence>
                {detectedCompany && (
                  <motion.div
                    key="detected-company-badge"
                    initial={{ opacity: 0, y: -6, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -6, scale: 0.95 }}
                    transition={{ duration: 0.22, ease: "easeOut" }}
                    className="mt-3 inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 max-w-full"
                    style={{
                      boxShadow: "var(--neu-shadow-raised-sm)"
                    }}
                  >
                    <Building2 size={13} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <span className="text-[11.5px] sm:text-xs font-black tracking-wide uppercase truncate">
                      {detectedCompany}
                    </span>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <form onSubmit={handleSubmit} noValidate className="space-y-4 sm:space-y-5">
              {/* Email / Username Field */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-800 dark:text-slate-200 ml-1">
                  Email address or Username
                </label>
                <div
                  className="relative rounded-2xl border border-white/60 dark:border-white/5 transition-all"
                  style={{
                    backgroundColor: "var(--neu-bg)",
                    boxShadow: "var(--neu-shadow-inset)"
                  }}
                >
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Mail size={18} />
                  </div>
                  <input
                    type="text"
                    required
                    inputMode="text"
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    autoComplete="username"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      setLocalError(null);
                    }}
                    className="w-full bg-transparent text-slate-900 dark:text-white rounded-2xl pl-10 pr-10 py-3 sm:py-3 text-base sm:text-sm focus:outline-none font-bold placeholder:text-slate-400 placeholder:font-normal"
                    placeholder="Enter your email or username"
                  />
                  <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none">
                    {isCheckingUser && <Loader2 size={16} className="animate-spin text-emerald-500" />}
                  </div>
                </div>
              </div>

              {/* Line Code Field (Smooth Animated Reveal if user has a Line Code) */}
              <AnimatePresence>
                {isLineCodeVisible && (
                  <motion.div
                    key="linecode-field"
                    initial={{ opacity: 0, height: 0, y: -8 }}
                    animate={{ opacity: 1, height: "auto", y: 0 }}
                    exit={{ opacity: 0, height: 0, y: -8 }}
                    transition={{
                      height: { duration: 0.28, ease: "easeOut" },
                      opacity: { duration: 0.22, delay: 0.05 },
                      y: { duration: 0.2 }
                    }}
                    className="space-y-1.5 overflow-hidden"
                  >
                    <div className="flex items-center justify-between ml-1">
                      <label className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                        <Key size={13} className="text-amber-500" />
                        Line Code
                      </label>
                      <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                        Required / لازمی
                      </span>
                    </div>
                    <div
                      className="relative rounded-2xl border border-amber-500/40 transition-all"
                      style={{
                        backgroundColor: "var(--neu-bg)",
                        boxShadow: "var(--neu-shadow-inset)"
                      }}
                    >
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-amber-500">
                        <Key size={18} />
                      </div>
                      <input
                        type="text"
                        required={requiredLineCode}
                        inputMode="text"
                        autoCapitalize="none"
                        autoCorrect="off"
                        spellCheck={false}
                        value={lineCode}
                        onChange={(e) => {
                          setLineCode(e.target.value);
                          setLocalError(null);
                        }}
                        className="w-full bg-transparent text-slate-900 dark:text-white rounded-2xl pl-10 pr-4 py-3 sm:py-3 text-base sm:text-sm focus:outline-none font-bold placeholder:text-slate-400 placeholder:font-normal"
                        placeholder="Gateway Line Code"
                      />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Password Field */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-800 dark:text-slate-200 ml-1">
                  Password
                </label>
                <div
                  className="relative rounded-2xl border border-white/60 dark:border-white/5 transition-all"
                  style={{
                    backgroundColor: "var(--neu-bg)",
                    boxShadow: "var(--neu-shadow-inset)"
                  }}
                >
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Lock size={18} />
                  </div>
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      setLocalError(null);
                    }}
                    className="w-full bg-transparent text-slate-900 dark:text-white rounded-2xl pl-10 pr-11 py-3 sm:py-3 text-base sm:text-sm focus:outline-none font-bold placeholder:text-slate-400 placeholder:font-normal"
                    placeholder="Enter your password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 w-11 h-full flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? (
                      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                        <line x1="1" y1="1" x2="23" y2="23" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              {/* Error Alert */}
              {(error || localError) && (
                <div className="text-xs font-semibold text-rose-600 dark:text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-2xl px-3.5 py-2.5 flex items-start gap-2">
                  <svg className="w-4 h-4 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>{localError || error}</span>
                </div>
              )}

              {/* Neumorphic Checkbox & Forgot link */}
              <div className="flex items-center justify-between pt-1">
                <label className="flex items-center gap-2.5 cursor-pointer select-none group py-1">
                  <div
                    className="w-5 h-5 rounded-lg flex items-center justify-center transition-all border border-white/60 dark:border-white/5"
                    style={{
                      backgroundColor: rememberMe ? "var(--brand-accent, #10b981)" : "var(--neu-surface)",
                      boxShadow: rememberMe ? "var(--neu-shadow-inset)" : "var(--neu-shadow-raised-sm)"
                    }}
                  >
                    {rememberMe && <Check size={13} className="text-white stroke-[3]" />}
                  </div>
                  <input
                    type="checkbox"
                    className="hidden"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                  />
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Remember me</span>
                </label>
                <a
                  href="#"
                  className="text-xs font-bold text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-colors py-1"
                >
                  Forgot password?
                </a>
              </div>

              {/* Neumorphic Submit Button (Native Android Touch Feedback) */}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full min-h-[48px] py-3.5 rounded-2xl font-black text-sm transition-all duration-150 cursor-pointer flex items-center justify-center gap-2 active:scale-[0.97] disabled:opacity-60 disabled:pointer-events-none mt-2 border border-slate-900/10 dark:border-white/10 bg-slate-950 text-white hover:bg-slate-900 dark:bg-slate-100 dark:text-slate-950 dark:hover:bg-white touch-manipulation"
                style={{
                  boxShadow: isDarkMode
                    ? "5px 5px 16px rgba(0,0,0,0.5), -3px -3px 10px rgba(255,255,255,0.06)"
                    : "5px 5px 16px rgba(0,0,0,0.18), -5px -5px 14px rgba(255,255,255,0.9)"
                }}
              >
                {isLoading ? (
                  <>
                    <Loader2 size={17} className="animate-spin" />
                    <span>Signing in...</span>
                  </>
                ) : (
                  <span>Sign In</span>
                )}
              </button>

              {/* Copyright Notice Centered in Frame */}
              <div className="text-center pt-2 pb-0.5">
                <p className="text-[12px] font-bold text-slate-500 dark:text-slate-400 select-none tracking-wide">
                  Copyright © Green Tech Services
                </p>
              </div>
            </form>
          </div>
        </motion.div>

        {/* 2. PRESENTATION / BRANDING INFO (Appears Below Login Frame on Mobile & Tablet, Centered; Left-side on Desktop) */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut", delay: 0.1 }}
          className="w-full lg:w-[54%] xl:w-[58%] flex flex-col items-center lg:items-start justify-center text-center lg:text-left space-y-5 sm:space-y-7 order-2 lg:order-1 pt-4 lg:pt-0 mx-auto lg:mx-0"
        >
          {/* GTS Logo Brand Unit (Shown on desktop in left column; on mobile it sits at the top above login card) */}
          <div className="hidden lg:flex items-center gap-3.5">
            <div
              className="w-12 h-12 sm:w-15 sm:h-15 p-2 rounded-2xl flex items-center justify-center border border-white/80 dark:border-white/5 transition-transform active:scale-95 shrink-0"
              style={{
                backgroundColor: "var(--neu-surface)",
                boxShadow: "var(--neu-shadow-raised)"
              }}
            >
              {brandingLogo ? (
                <img
                  src={brandingLogo}
                  alt="GTS Logo"
                  className="w-full h-full object-contain rounded-xl"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <span className="text-slate-900 dark:text-white font-black text-lg sm:text-2xl tracking-tighter italic select-none">
                  G<span className="text-emerald-500">TS</span>
                </span>
              )}
            </div>
            <div className="flex flex-col select-none text-left">
              <span className="text-sm sm:text-lg font-black tracking-tight text-slate-950 dark:text-white leading-tight">
                Green Tech Services
              </span>
              <span className="text-[9.5px] sm:text-[11px] font-black tracking-widest text-emerald-600 dark:text-emerald-400 uppercase mt-0.5">
                Telecom & Fiber Infrastructure
              </span>
            </div>
          </div>

          {/* Neumorphic System Badge - Centered on Mobile/Tablet */}
          <div
            className="inline-flex items-center gap-2.5 px-3.5 py-1.5 sm:px-4 sm:py-2 rounded-2xl border border-white/80 dark:border-white/5 w-fit mx-auto lg:mx-0"
            style={{
              backgroundColor: "var(--neu-surface)",
              boxShadow: "var(--neu-shadow-raised-sm)"
            }}
          >
            <span className="relative flex h-2 w-2 sm:h-2.5 sm:w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 sm:h-2.5 sm:w-2.5 bg-emerald-500"></span>
            </span>
            <span className="text-[11px] sm:text-xs font-black uppercase tracking-wider text-slate-900 dark:text-slate-100">
              Enterprise ISP Gateway v3.4
            </span>
          </div>

          {/* Typing Title in Deep Stylish Black Typography - Centered on Mobile/Tablet */}
          <div className="space-y-3 sm:space-y-4 w-full flex flex-col items-center lg:items-start text-center lg:text-left">
            <h1 className="text-2xl sm:text-4xl md:text-5xl xl:text-6xl font-black text-slate-950 dark:text-slate-50 leading-[1.15] tracking-tight min-h-[75px] sm:min-h-[120px] lg:min-h-[160px] xl:min-h-[185px] text-center lg:text-left mx-auto lg:mx-0">
              <span className="inline bg-gradient-to-r from-slate-950 via-slate-900 to-slate-800 dark:from-white dark:via-slate-100 dark:to-slate-300 bg-clip-text text-transparent drop-shadow-sm">
                {typedTitle}
              </span>
              <span
                className="inline-block w-1.5 sm:w-2 lg:w-2.5 h-6 sm:h-9 md:h-11 lg:h-12 bg-slate-950 dark:bg-slate-100 ml-1.5 align-middle rounded-full animate-[pulse_0.75s_infinite]"
                style={{ verticalAlign: "middle" }}
              />
            </h1>

            <p className="text-xs sm:text-base text-slate-600 dark:text-slate-300 font-medium max-w-xl leading-relaxed text-center lg:text-left mx-auto lg:mx-0">
              An end-to-end management platform featuring automated customer billing, and secure Customers line-code authorization—engineered for high-availability fiber operations.
            </p>
          </div>

          {/* Neumorphic Feature Chips / Status Badges - Centered Grid on Mobile/Tablet */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-3.5 pt-1 sm:pt-2 w-full max-w-xl lg:max-w-2xl pb-4 sm:pb-0 mx-auto lg:mx-0">
            <div
              className="p-3 sm:p-3.5 rounded-2xl border border-white/60 dark:border-white/5 flex items-center justify-start gap-3 transition-transform active:scale-98 hover:-translate-y-0.5 text-left"
              style={{
                backgroundColor: "var(--neu-surface)",
                boxShadow: "var(--neu-shadow-raised-sm)"
              }}
            >
              <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 shrink-0">
                <Zap size={16} className="sm:w-[18px] sm:h-[18px]" />
              </div>
              <div className="min-w-0">
                <h4 className="text-xs font-black text-slate-900 dark:text-slate-100 truncate">Fast Complaints</h4>
                <p className="text-[10.5px] sm:text-[11px] text-slate-500 dark:text-slate-400 font-medium">Real-time alerts</p>
              </div>
            </div>

            <div
              className="p-3 sm:p-3.5 rounded-2xl border border-white/60 dark:border-white/5 flex items-center justify-start gap-3 transition-transform active:scale-98 hover:-translate-y-0.5 text-left"
              style={{
                backgroundColor: "var(--neu-surface)",
                boxShadow: "var(--neu-shadow-raised-sm)"
              }}
            >
              <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center text-indigo-600 dark:text-indigo-400 bg-indigo-500/10 shrink-0">
                <Receipt size={16} className="sm:w-[18px] sm:h-[18px]" />
              </div>
              <div className="min-w-0">
                <h4 className="text-xs font-black text-slate-900 dark:text-slate-100 truncate">Smart Billing</h4>
                <p className="text-[10.5px] sm:text-[11px] text-slate-500 dark:text-slate-400 font-medium">Auto ledger sync</p>
              </div>
            </div>

            <div
              className="p-3 sm:p-3.5 rounded-2xl border border-white/60 dark:border-white/5 flex items-center justify-start gap-3 transition-transform active:scale-98 hover:-translate-y-0.5 text-left"
              style={{
                backgroundColor: "var(--neu-surface)",
                boxShadow: "var(--neu-shadow-raised-sm)"
              }}
            >
              <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center text-amber-600 dark:text-amber-400 bg-amber-500/10 shrink-0">
                <ShieldAlert size={16} className="sm:w-[18px] sm:h-[18px]" />
              </div>
              <div className="min-w-0">
                <h4 className="text-xs font-black text-slate-900 dark:text-slate-100 truncate">Line Security</h4>
                <p className="text-[10.5px] sm:text-[11px] text-slate-500 dark:text-slate-400 font-medium">Gateway verified</p>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

import React, { useState, useEffect } from "react";
import { 
  Loader2, Sun, Moon, Key, ShieldCheck, Mail, Lock, Check, Zap, Receipt, 
  ShieldAlert, Building2, ArrowRight, ArrowLeft, Eye, EyeOff, KeyRound, 
  MailCheck, RefreshCw, AlertCircle, CheckCircle2, X 
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { toast } from "sonner";
import { useTheme } from "../hooks/useTheme";
import NetworkBackground from "./NetworkBackground";
import type { UserProfile } from "../types";

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

  // Multi-step animated states: 'login' | 'forgot_lookup' | 'forgot_confirm' | 'forgot_reset'
  type AuthStep = "login" | "forgot_lookup" | "forgot_confirm" | "forgot_reset";
  const [authStep, setAuthStep] = useState<AuthStep>("login");
  const [direction, setDirection] = useState<number>(1);

  // Forgot password lookup state
  const [lookupInput, setLookupInput] = useState<string>("");
  const [isSearchingUser, setIsSearchingUser] = useState<boolean>(false);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [recoverUser, setRecoverUser] = useState<UserProfile | null>(null);
  const [resolvedUserCompany, setResolvedUserCompany] = useState<string>("");

  // OTP & Reset state
  const [isSendingOtp, setIsSendingOtp] = useState<boolean>(false);
  const [otpCode, setOtpCode] = useState<string>("");
  const [newPassword, setNewPassword] = useState<string>("");
  const [confirmPassword, setConfirmPassword] = useState<string>("");
  const [showNewPassword, setShowNewPassword] = useState<boolean>(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState<boolean>(false);
  const [isResettingPassword, setIsResettingPassword] = useState<boolean>(false);
  const [resendCountdown, setResendCountdown] = useState<number>(0);

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

  // Countdown timer for OTP resend
  useEffect(() => {
    if (resendCountdown <= 0) return;
    const timer = setInterval(() => {
      setResendCountdown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCountdown]);

  const getMaskedEmail = (user: UserProfile | null, inputFallback: string) => {
    const raw = user?.email || (inputFallback.includes("@") ? inputFallback : "");
    if (!raw || !raw.includes("@")) return "Your registered account Gmail / Email";
    const [local, domain] = raw.split("@");
    if (local.length <= 2) return `${local[0] || "*"}***@${domain}`;
    const head = local.slice(0, 2);
    const masked = "*".repeat(Math.min(local.length - 2, 4));
    return `${head}${masked}@${domain}`;
  };

  const getUserAvatar = (u: UserProfile | null) => {
    if (!u) return null;
    return (
      u.profilePicture ||
      (u as any).avatarUrl ||
      (u as any).photo ||
      (u as any).image ||
      (u as any).picture ||
      null
    );
  };

  // 1. Search account by username or email
  const handleLookupUser = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setLookupError(null);
    const cleanInput = lookupInput.trim();
    if (!cleanInput) {
      setLookupError("Please enter your username or registered Gmail address.");
      return;
    }

    setIsSearchingUser(true);
    try {
      const { supabaseService } = await import("../lib/supabaseService");
      let found = await supabaseService.getUserForLogin(cleanInput);

      if (!found) {
        const allUsers = await supabaseService.getUsers("all");
        const lower = cleanInput.toLowerCase();
        found = allUsers.find(
          (u) =>
            (u.username && u.username.trim().toLowerCase() === lower) ||
            (u.email && u.email.trim().toLowerCase() === lower) ||
            u.uid === cleanInput
        ) || null;
      }

      if (!found) {
        setLookupError("No matching account found. Please check your username or Gmail.");
        return;
      }

      // Check user's company name
      let company = found.companyName || "";
      if (!company && found.dealerId && found.dealerId !== "main") {
        const parent = await supabaseService.getUser(found.dealerId);
        if (parent?.companyName) company = parent.companyName;
      }
      if (!company) {
        company = detectedCompany || "Green Tech Services";
      }

      setRecoverUser(found);
      setResolvedUserCompany(company);
      setDirection(1);
      setAuthStep("forgot_confirm");
    } catch (err: any) {
      setLookupError(err.message || "Failed to search account. Please try again.");
    } finally {
      setIsSearchingUser(false);
    }
  };

  // 2. Dispatch OTP via Brevo / Gmail
  const handleSendOtp = async () => {
    if (!recoverUser) return;
    setIsSendingOtp(true);
    try {
      const targetIdentifier = recoverUser.username || lookupInput.trim();
      const res = await fetch("/api/auth/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: targetIdentifier }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to send verification code.");
      }

      toast.success("Verification code sent to your email!", {
        description: data.emailStatus === "sent_brevo_api" 
          ? "Delivered securely via Brevo Mail Gateway." 
          : "Delivered via Google Mail API.",
      });

      setResendCountdown(45);
      setOtpCode("");
      setDirection(1);
      setAuthStep("forgot_reset");
    } catch (err: any) {
      toast.error("Failed to send code", {
        description: err.message || "Please check your internet connection and try again.",
      });
    } finally {
      setIsSendingOtp(false);
    }
  };

  // 3. Verify OTP & update password in DB
  const handleResetPassword = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!recoverUser) return;

    const cleanCode = otpCode.trim();
    if (cleanCode.length !== 6) {
      toast.error("Invalid Code", { description: "Please enter the 6-digit verification code sent to your email." });
      return;
    }

    if (!newPassword || newPassword.length < 5) {
      toast.error("Weak Password", { description: "New password must be at least 5 characters long." });
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error("Mismatch", { description: "New password and confirmation password do not match." });
      return;
    }

    setIsResettingPassword(true);
    try {
      // 1. Verify code on server
      const verifyRes = await fetch("/api/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: recoverUser.username,
          code: cleanCode,
        }),
      });
      const verifyData = await verifyRes.json();
      if (!verifyRes.ok) {
        throw new Error(verifyData.error || "Verification code is incorrect or expired.");
      }

      // 2. Commit reset password on server (updates database)
      const resetRes = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: recoverUser.username,
          code: cleanCode,
          newPassword: newPassword,
        }),
      });
      const resetData = await resetRes.json();
      if (!resetRes.ok) {
        throw new Error(resetData.error || "Failed to update password in database.");
      }

      // 3. Client-side database update guarantee
      try {
        const { supabaseService } = await import("../lib/supabaseService");
        if (recoverUser.uid) {
          await supabaseService.updateUserPassword(
            recoverUser.uid,
            recoverUser.username,
            newPassword,
            recoverUser.username
          );
        }
      } catch (dbErr) {
        console.warn("Client fallback update note:", dbErr);
      }

      toast.success("Password Changed Successfully!", {
        description: `Your new password has been updated. You can now log in as @${recoverUser.username}.`,
        duration: 5000,
      });

      // Pre-fill login credentials so user can log in immediately
      setEmail(recoverUser.username);
      setPassword(newPassword);

      // Slide smoothly back to login screen
      setDirection(-1);
      setAuthStep("login");
    } catch (err: any) {
      toast.error("Reset Failed", {
        description: err.message || "Failed to change password. Please check the code and try again.",
      });
    } finally {
      setIsResettingPassword(false);
    }
  };

  const slideVariants = {
    enter: (dir: number) => ({
      x: (dir || 1) > 0 ? 32 : -32,
      opacity: 0,
    }),
    center: {
      x: 0,
      opacity: 1,
      transition: {
        duration: 0.22,
        ease: "easeOut",
      },
    },
    exit: (dir: number) => ({
      x: (dir || 1) > 0 ? -32 : 32,
      opacity: 0,
      transition: {
        duration: 0.16,
        ease: "easeIn",
      },
    }),
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
            className="rounded-[28px] sm:rounded-[34px] p-5 sm:p-8 md:p-10 relative border border-white/80 dark:border-white/5 transition-all shadow-xl overflow-hidden min-h-[520px] flex flex-col justify-center"
            style={{
              backgroundColor: "var(--neu-surface)",
              boxShadow: "var(--neu-shadow-raised-lg)"
            }}
          >
            <AnimatePresence initial={false} mode="wait" custom={direction}>
              {/* STEP 0: LOGIN VIEW */}
              {authStep === "login" && (
                <motion.div
                  key="login-view"
                  custom={direction}
                  variants={slideVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  className="w-full flex flex-col justify-between"
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
                            <EyeOff size={18} />
                          ) : (
                            <Eye size={18} />
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Error Alert */}
                    {(error || localError) && (
                      <div className="text-xs font-semibold text-rose-600 dark:text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-2xl px-3.5 py-2.5 flex items-start gap-2">
                        <AlertCircle size={16} className="shrink-0 text-rose-500 mt-0.5" />
                        <span>{localError || error}</span>
                      </div>
                    )}

                    {/* Neumorphic Checkbox & Forgot password button */}
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
                      <button
                        type="button"
                        id="forgot-password-btn"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setLookupInput(email.trim());
                          setLookupError(null);
                          setDirection(1);
                          setAuthStep("forgot_lookup");
                        }}
                        className="text-xs font-bold text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300 transition-colors py-1 cursor-pointer select-none underline-offset-2 hover:underline"
                      >
                        Forgot password?
                      </button>
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
                </motion.div>
              )}

              {/* STEP 1: USERNAME / GMAIL INPUT */}
              {authStep === "forgot_lookup" && (
                <motion.div
                  key="forgot-lookup-view"
                  custom={direction}
                  variants={slideVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  className="w-full space-y-5"
                >
                  <div className="flex items-center justify-between mb-1">
                    <button
                      type="button"
                      onClick={() => {
                        setDirection(-1);
                        setAuthStep("login");
                      }}
                      className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 dark:text-slate-400 hover:text-emerald-500 dark:hover:text-emerald-400 transition-colors cursor-pointer py-1"
                    >
                      <ArrowLeft size={16} />
                      <span>Back to Sign In</span>
                    </button>
                    <span className="text-[10px] font-extrabold uppercase tracking-widest px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                      Step 1 of 3
                    </span>
                  </div>

                  <div className="text-center mb-6">
                    <div
                      className="w-14 h-14 sm:w-16 sm:h-16 mx-auto rounded-2xl flex items-center justify-center text-slate-900 dark:text-white border border-white/70 dark:border-white/5 mb-3.5 transition-transform active:scale-95"
                      style={{
                        backgroundColor: "var(--neu-surface)",
                        boxShadow: "var(--neu-shadow-raised)"
                      }}
                    >
                      <KeyRound size={26} className="text-emerald-500 stroke-[2.2] sm:w-7 sm:h-7" />
                    </div>
                    <h2 className="text-xl sm:text-2xl font-black text-slate-950 dark:text-white tracking-tight mb-1">
                      Account Recovery
                    </h2>
                    <p className="text-[11.5px] sm:text-xs font-semibold text-slate-500 dark:text-slate-400">
                      Enter your username or registered Gmail address
                    </p>
                  </div>

                  <form onSubmit={handleLookupUser} noValidate className="space-y-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-800 dark:text-slate-200 ml-1">
                        Username or Gmail / Email
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
                          autoFocus
                          value={lookupInput}
                          onChange={(e) => {
                            setLookupInput(e.target.value);
                            setLookupError(null);
                          }}
                          className="w-full bg-transparent text-slate-900 dark:text-white rounded-2xl pl-10 pr-4 py-3 sm:py-3.5 text-base sm:text-sm focus:outline-none font-bold placeholder:text-slate-400 placeholder:font-normal"
                          placeholder="e.g. admin or user@gmail.com"
                        />
                      </div>
                    </div>

                    {lookupError && (
                      <motion.div
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="text-xs font-semibold text-rose-600 dark:text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-2xl px-3.5 py-2.5 flex items-center gap-2"
                      >
                        <AlertCircle size={15} className="shrink-0" />
                        <span>{lookupError}</span>
                      </motion.div>
                    )}

                    {/* Next Button replaces Sign In */}
                    <button
                      type="submit"
                      disabled={isSearchingUser || !lookupInput.trim()}
                      className="w-full min-h-[48px] py-3.5 rounded-2xl font-black text-sm transition-all duration-150 cursor-pointer flex items-center justify-center gap-2 active:scale-[0.97] disabled:opacity-60 disabled:pointer-events-none mt-4 border border-slate-900/10 dark:border-white/10 bg-slate-950 text-white hover:bg-slate-900 dark:bg-slate-100 dark:text-slate-950 dark:hover:bg-white touch-manipulation"
                      style={{
                        boxShadow: isDarkMode
                          ? "5px 5px 16px rgba(0,0,0,0.5), -3px -3px 10px rgba(255,255,255,0.06)"
                          : "5px 5px 16px rgba(0,0,0,0.18), -5px -5px 14px rgba(255,255,255,0.9)"
                      }}
                    >
                      {isSearchingUser ? (
                        <>
                          <Loader2 size={17} className="animate-spin text-emerald-500" />
                          <span>Searching Account...</span>
                        </>
                      ) : (
                        <>
                          <span>Next</span>
                          <ArrowRight size={17} className="text-emerald-500" />
                        </>
                      )}
                    </button>
                  </form>
                </motion.div>
              )}

              {/* STEP 2: CONFIRM ACCOUNT DETAILS (PHOTO, NAME, COMPANY) */}
              {authStep === "forgot_confirm" && (
                <motion.div
                  key="forgot-confirm-view"
                  custom={direction}
                  variants={slideVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  className="w-full space-y-4"
                >
                  <div className="flex items-center justify-between mb-1">
                    <button
                      type="button"
                      onClick={() => {
                        setDirection(-1);
                        setAuthStep("forgot_lookup");
                      }}
                      className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 dark:text-slate-400 hover:text-emerald-500 dark:hover:text-emerald-400 transition-colors cursor-pointer py-1"
                    >
                      <ArrowLeft size={16} />
                      <span>Back</span>
                    </button>
                    <span className="text-[10px] font-extrabold uppercase tracking-widest px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                      Step 2 of 3
                    </span>
                  </div>

                  <div className="text-center mb-3">
                    <h2 className="text-lg sm:text-xl font-black text-slate-950 dark:text-white tracking-tight">
                      Confirm Your Account
                    </h2>
                    <p className="text-[11.5px] sm:text-xs font-semibold text-slate-500 dark:text-slate-400">
                      Verify your details below to receive your passcode
                    </p>
                  </div>

                  {/* Profile Card */}
                  <div
                    className="rounded-2xl p-4 sm:p-5 border border-white/60 dark:border-white/5 space-y-3.5"
                    style={{
                      backgroundColor: "var(--neu-bg)",
                      boxShadow: "var(--neu-shadow-inset)"
                    }}
                  >
                    <div className="flex items-center gap-3.5">
                      {/* User Avatar */}
                      <div className="shrink-0 relative">
                        {getUserAvatar(recoverUser) ? (
                          <img
                            src={getUserAvatar(recoverUser)!}
                            alt={recoverUser?.fullName || recoverUser?.username || "User"}
                            className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl object-cover border-2 border-emerald-500/40 shadow-md"
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <div
                            className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl flex items-center justify-center font-black text-lg text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 bg-emerald-500/10"
                          >
                            {(recoverUser?.fullName || recoverUser?.username || "U").slice(0, 2).toUpperCase()}
                          </div>
                        )}
                        <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-md">
                          <Check size={11} strokeWidth={3} />
                        </div>
                      </div>

                      {/* Names & Badges */}
                      <div className="min-w-0 flex-1 text-left">
                        <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white truncate">
                          {recoverUser?.fullName || recoverUser?.username}
                        </h3>
                        <p className="text-xs font-mono font-bold text-slate-500 dark:text-slate-400 truncate">
                          @{recoverUser?.username}
                        </p>
                        
                        <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                          {resolvedUserCompany && (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-lg bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/25 truncate max-w-[170px]">
                              <Building2 size={11} className="shrink-0" />
                              <span className="truncate">{resolvedUserCompany}</span>
                            </span>
                          )}
                          <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-lg bg-slate-200/80 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-300/60 dark:border-white/10">
                            {recoverUser?.role || "User"}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Email delivery badge */}
                    <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/25 flex items-start gap-2.5">
                      <MailCheck size={17} className="text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                      <div className="min-w-0 flex-1 text-left">
                        <p className="text-[11px] font-bold text-emerald-900 dark:text-emerald-200">
                          Code will be sent via Brevo Email to:
                        </p>
                        <p className="text-xs font-black font-mono text-emerald-700 dark:text-emerald-300 truncate mt-0.5">
                          {getMaskedEmail(recoverUser, lookupInput)}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Buttons: Cancel & Confirm */}
                  <div className="flex items-center gap-2.5 pt-2">
                    <button
                      type="button"
                      disabled={isSendingOtp}
                      onClick={() => {
                        setDirection(-1);
                        setAuthStep("forgot_lookup");
                      }}
                      className="w-1/3 min-h-[48px] py-3 rounded-2xl font-bold text-xs transition-all duration-150 cursor-pointer flex items-center justify-center gap-1.5 border border-slate-300/80 dark:border-white/10 text-slate-700 dark:text-slate-300 hover:bg-slate-200/50 dark:hover:bg-white/5 active:scale-95 disabled:opacity-50"
                    >
                      <X size={15} />
                      <span>Cancel</span>
                    </button>

                    <button
                      type="button"
                      disabled={isSendingOtp}
                      onClick={handleSendOtp}
                      className="flex-1 min-h-[48px] py-3 rounded-2xl font-black text-xs transition-all duration-150 cursor-pointer flex items-center justify-center gap-2 border border-emerald-500/20 bg-emerald-600 text-white hover:bg-emerald-500 active:scale-[0.97] shadow-lg shadow-emerald-600/20 disabled:opacity-60 disabled:pointer-events-none"
                    >
                      {isSendingOtp ? (
                        <>
                          <Loader2 size={16} className="animate-spin" />
                          <span>Sending Code...</span>
                        </>
                      ) : (
                        <>
                          <Check size={16} strokeWidth={2.5} />
                          <span>Confirm & Send Code</span>
                        </>
                      )}
                    </button>
                  </div>
                </motion.div>
              )}

              {/* STEP 3: CODE INPUT & NEW PASSWORD SET */}
              {authStep === "forgot_reset" && (
                <motion.div
                  key="forgot-reset-view"
                  custom={direction}
                  variants={slideVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  className="w-full space-y-4"
                >
                  <div className="flex items-center justify-between mb-1">
                    <button
                      type="button"
                      onClick={() => {
                        setDirection(-1);
                        setAuthStep("forgot_confirm");
                      }}
                      className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 dark:text-slate-400 hover:text-emerald-500 dark:hover:text-emerald-400 transition-colors cursor-pointer py-1"
                    >
                      <ArrowLeft size={16} />
                      <span>Back</span>
                    </button>
                    <span className="text-[10px] font-extrabold uppercase tracking-widest px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                      Step 3 of 3
                    </span>
                  </div>

                  <div className="text-center mb-3">
                    <div
                      className="w-12 h-12 sm:w-14 sm:h-14 mx-auto rounded-2xl flex items-center justify-center text-slate-900 dark:text-white border border-white/70 dark:border-white/5 mb-2 transition-transform active:scale-95"
                      style={{
                        backgroundColor: "var(--neu-surface)",
                        boxShadow: "var(--neu-shadow-raised)"
                      }}
                    >
                      <Lock size={22} className="text-emerald-500 stroke-[2.2]" />
                    </div>
                    <h2 className="text-lg sm:text-xl font-black text-slate-950 dark:text-white tracking-tight">
                      Set New Password
                    </h2>
                    <p className="text-[11.5px] sm:text-xs font-semibold text-slate-500 dark:text-slate-400">
                      Enter the 6-digit code sent to your Gmail and set your new password
                    </p>
                  </div>

                  <form onSubmit={handleResetPassword} noValidate className="space-y-3.5">
                    {/* OTP Code Input Box */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between ml-1">
                        <label className="text-xs font-bold text-slate-800 dark:text-slate-200">
                          6-Digit Verification Code
                        </label>
                        {resendCountdown > 0 ? (
                          <span className="text-[11px] font-bold text-slate-400">
                            Resend in {resendCountdown}s
                          </span>
                        ) : (
                          <button
                            type="button"
                            disabled={isSendingOtp}
                            onClick={handleSendOtp}
                            className="text-[11px] font-bold text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 cursor-pointer inline-flex items-center gap-1"
                          >
                            <RefreshCw size={11} className={isSendingOtp ? "animate-spin" : ""} />
                            <span>Resend Code</span>
                          </button>
                        )}
                      </div>
                      <div
                        className="relative rounded-2xl border border-emerald-500/30 transition-all"
                        style={{
                          backgroundColor: "var(--neu-bg)",
                          boxShadow: "var(--neu-shadow-inset)"
                        }}
                      >
                        <input
                          type="text"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          maxLength={6}
                          required
                          autoFocus
                          value={otpCode}
                          onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                          className="w-full bg-transparent text-slate-900 dark:text-white rounded-2xl px-4 py-3 sm:py-3.5 text-center text-xl sm:text-2xl tracking-[0.35em] font-mono font-black focus:outline-none placeholder:text-slate-400/40 placeholder:tracking-normal placeholder:font-sans placeholder:text-sm"
                          placeholder="• • • • • •"
                        />
                      </div>
                    </div>

                    {/* New Password Field */}
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-800 dark:text-slate-200 ml-1">
                        New Password (نیا پاس ورڈ)
                      </label>
                      <div
                        className="relative rounded-2xl border border-white/60 dark:border-white/5 transition-all"
                        style={{
                          backgroundColor: "var(--neu-bg)",
                          boxShadow: "var(--neu-shadow-inset)"
                        }}
                      >
                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                          <Lock size={17} />
                        </div>
                        <input
                          type={showNewPassword ? "text" : "password"}
                          required
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          className="w-full bg-transparent text-slate-900 dark:text-white rounded-2xl pl-10 pr-10 py-2.5 sm:py-3 text-base sm:text-sm focus:outline-none font-bold placeholder:text-slate-400 placeholder:font-normal"
                          placeholder="Minimum 5 characters"
                        />
                        <button
                          type="button"
                          onClick={() => setShowNewPassword(!showNewPassword)}
                          className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                        >
                          {showNewPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                        </button>
                      </div>
                    </div>

                    {/* Confirm Password Field */}
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-800 dark:text-slate-200 ml-1">
                        Confirm New Password (پاس ورڈ کی تصدیق)
                      </label>
                      <div
                        className="relative rounded-2xl border border-white/60 dark:border-white/5 transition-all"
                        style={{
                          backgroundColor: "var(--neu-bg)",
                          boxShadow: "var(--neu-shadow-inset)"
                        }}
                      >
                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                          <CheckCircle2 size={17} />
                        </div>
                        <input
                          type={showConfirmPassword ? "text" : "password"}
                          required
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          className="w-full bg-transparent text-slate-900 dark:text-white rounded-2xl pl-10 pr-10 py-2.5 sm:py-3 text-base sm:text-sm focus:outline-none font-bold placeholder:text-slate-400 placeholder:font-normal"
                          placeholder="Re-enter new password"
                        />
                        <button
                          type="button"
                          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                          className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                        >
                          {showConfirmPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                        </button>
                      </div>
                    </div>

                    {/* Action buttons: Cancel & Save */}
                    <div className="flex items-center gap-2.5 pt-2">
                      <button
                        type="button"
                        disabled={isResettingPassword}
                        onClick={() => {
                          setDirection(-1);
                          setAuthStep("login");
                        }}
                        className="w-1/3 min-h-[48px] py-3 rounded-2xl font-bold text-xs transition-all duration-150 cursor-pointer flex items-center justify-center gap-1 border border-slate-300/80 dark:border-white/10 text-slate-700 dark:text-slate-300 hover:bg-slate-200/50 dark:hover:bg-white/5 active:scale-95 disabled:opacity-50"
                      >
                        <X size={15} />
                        <span>Cancel</span>
                      </button>

                      <button
                        type="submit"
                        disabled={isResettingPassword || otpCode.length !== 6 || newPassword.length < 5 || newPassword !== confirmPassword}
                        className="flex-1 min-h-[48px] py-3 rounded-2xl font-black text-xs transition-all duration-150 cursor-pointer flex items-center justify-center gap-2 border border-slate-900/10 dark:border-white/10 bg-slate-950 text-white hover:bg-slate-900 dark:bg-slate-100 dark:text-slate-950 dark:hover:bg-white active:scale-[0.97] shadow-xl disabled:opacity-60 disabled:pointer-events-none"
                      >
                        {isResettingPassword ? (
                          <>
                            <Loader2 size={16} className="animate-spin text-emerald-500" />
                            <span>Updating Database...</span>
                          </>
                        ) : (
                          <>
                            <CheckCircle2 size={16} className="text-emerald-500" />
                            <span>Set New Password & Login</span>
                          </>
                        )}
                      </button>
                    </div>
                  </form>
                </motion.div>
              )}
            </AnimatePresence>
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

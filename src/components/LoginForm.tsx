import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Lock,
  User,
  Eye,
  EyeOff,
  Loader2,
  Key,
  Terminal,
  Globe,
  AlertTriangle,
  ShieldCheck,
  Mail,
  MapPin,
  UserPlus,
  X,
  Menu,
  ChevronRight,
  ChevronLeft,
  Sun,
  Moon,
  Wifi,
  Zap,
  Rocket,
} from "lucide-react";
import { cn } from "../lib/utils";
import NetworkBackground from "./NetworkBackground";
import { pocketbaseService } from "../lib/pocketbaseService";

const getApiUrl = (endpoint: string): string => {
  const host = window.location.hostname;
  if (
    host === "localhost" ||
    host === "127.0.0.1" ||
    host.includes(".run.app") ||
    host.includes("hf.space") ||
    host.includes("huggingface.co")
  ) {
    return endpoint;
  }
  return `https://ais-pre-y57fbgpyjpmaocrhgtopol-853220806804.asia-southeast1.run.app${endpoint}`;
};

// Typing sound effect using Web Audio API
const playTypeSound = async () => {
  try {
    const AudioContextClass =
      window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;

    const audioCtx = new AudioContextClass();
    if (audioCtx.state === "suspended") {
      await audioCtx.resume();
    }

    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    const filter = audioCtx.createBiquadFilter();

    oscillator.type = "square"; // More mechanical sound
    oscillator.frequency.setValueAtTime(
      150 + Math.random() * 50,
      audioCtx.currentTime,
    );

    filter.type = "lowpass";
    filter.frequency.setValueAtTime(1000, audioCtx.currentTime);

    gainNode.gain.setValueAtTime(0.04, audioCtx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(
      0.001,
      audioCtx.currentTime + 0.1,
    );

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
  textClassName?: string;
  cursorClassName?: string;
}

function TypewriterText({
  text,
  className,
  textClassName,
  cursorClassName,
}: TypewriterProps) {
  const [displayText, setDisplayText] = useState("");
  const [currentIndex, setCurrentIndex] = useState(0);
  const audioInitialized = useRef(false);

  useEffect(() => {
    if (currentIndex < text.length) {
      const timeout = setTimeout(
        () => {
          setDisplayText((prev) => prev + text[currentIndex]);
          setCurrentIndex((prev) => prev + 1);
          playTypeSound();
        },
        40 + Math.random() * 60,
      );
      return () => clearTimeout(timeout);
    }
  }, [currentIndex, text]);

  return (
    <div
      className={cn("font-mono flex items-center justify-center", className)}
    >
      <span className={textClassName}>{displayText}</span>
      <motion.span
        animate={{ opacity: [1, 0] }}
        transition={{ duration: 0.8, repeat: Infinity }}
        className={cn(
          "inline-block bg-emerald-500 ml-2 rounded-sm",
          cursorClassName,
        )}
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

export default function LoginForm({
  onLogin,
  onGoogleLogin,
  isLoading,
  error,
}: LoginFormProps) {
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isDarkMode, setIsDarkMode] = useState(false);

  useEffect(() => {
    if (document.documentElement.classList.contains("dark")) {
      setIsDarkMode(true);
    }
  }, []);

  const toggleTheme = () => {
    setIsDarkMode(!isDarkMode);
    if (!isDarkMode) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  };

  const SLIDER_IMAGES = [
    "https://images.unsplash.com/photo-1614064641936-38998971f11e?q=80&w=1920&h=1080&fit=crop", // Fiber optics
    "https://images.unsplash.com/photo-1558494949-ef010cbdcc31?q=80&w=1920&h=1080&fit=crop", // Servers
    "https://images.unsplash.com/photo-1544197150-b99a580bb7a8?q=80&w=1920&h=1080&fit=crop", // Network cables
  ];

  useEffect(() => {
    if (!showAuthModal) {
      const interval = setInterval(() => {
        setCurrentSlide((prev) => (prev + 1) % SLIDER_IMAGES.length);
      }, 5000);
      return () => clearInterval(interval);
    }
  }, [showAuthModal]);

  const [isRightPanelActive, setIsRightPanelActive] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [lineCode, setLineCode] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [requiredLineCode, setRequiredLineCode] = useState<boolean>(false);
  const [isCheckingUser, setIsCheckingUser] = useState(false);
  const [detectedCompanyName, setDetectedCompanyName] = useState<string>(
    "Green Tech Services",
  );

  // Sign Up / Client Registration details
  const [signupUsername, setSignupUsername] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [signupFullName, setSignupFullName] = useState("");
  const [signupEmail, setSignupEmail] = useState("");
  const [signupArea, setSignupArea] = useState("");
  const [isSigningUp, setIsSigningUp] = useState(false);
  const [signupSuccess, setSignupSuccess] = useState(false);
  const [signupError, setSignupError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) return;

    setIsCheckingUser(true);
    setDealerCodeError(null);
    try {
      // Direct login path for editors/admins or if requiredLineCode is true but it handles it internally
      await onLogin(
        username.trim(),
        password,
        requiredLineCode ? lineCode.trim() : undefined,
      );
    } catch (err: any) {
      console.error("Login flow error:", err);
    } finally {
      setIsCheckingUser(false);
    }
  };

  const [signupType, setSignupType] = useState<"dealer" | "self">("self");
  const [dealersList, setDealersList] = useState<
    { uid: string; companyName: string; username: string }[]
  >([]);
  const [selectedDealerId, setSelectedDealerId] = useState("");

  const [verificationStep, setVerificationStep] = useState(false);
  const [verificationCode, setVerificationCode] = useState("");
  const [generatedCode, setGeneratedCode] = useState("");
  const [verificationError, setVerificationError] = useState<string | null>(
    null,
  );

  useEffect(() => {
    if (isRightPanelActive) {
      pocketbaseService.getUsers().then((users) => {
        const d = users.filter((u: any) => u.role === "dealer");
        setDealersList(d);
      });
    }
  }, [isRightPanelActive]);

  const validatePassword = (pwd: string) => {
    const minLen = pwd.length >= 8;
    const hasUpper = /[A-Z]/.test(pwd);
    const hasLower = /[a-z]/.test(pwd);
    const hasNum = /\d/.test(pwd);
    return minLen && hasUpper && hasLower && hasNum;
  };

  const validateEmail = (email: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  const handleRegisterUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (
      !signupUsername.trim() ||
      !signupPassword.trim() ||
      !signupFullName.trim() ||
      !signupEmail.trim()
    ) {
      setSignupError(
        "Username, Password, Full Name and Backup Email are strictly required.",
      );
      return;
    }
    if (!validateEmail(signupEmail.trim())) {
      setSignupError(
        "Please enter a valid email format (e.g., name@domain.com).",
      );
      return;
    }
    if (!validatePassword(signupPassword)) {
      setSignupError(
        "Password must be at least 8 characters long, contain an uppercase letter, a lowercase letter, and a number.",
      );
      return;
    }
    if (signupType === "dealer" && !selectedDealerId) {
      setSignupError("Please select a dealer from the list.");
      return;
    }

    setIsSigningUp(true);
    setSignupError(null);
    setSignupSuccess(false);

    try {
      const allUsers = await pocketbaseService.getUsers();
      if (
        allUsers.some(
          (u) =>
            u.username.toLowerCase() === signupUsername.trim().toLowerCase(),
        )
      ) {
        throw new Error(
          "This username already exists on our GTS network nodes.",
        );
      }

      // Dispatch real email via backend API
      const response = await fetch(
        getApiUrl("/api/auth/send-registration-otp"),
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: signupEmail.trim(),
            fullName: signupFullName.trim(),
            username: signupUsername.trim(),
          }),
        },
      );
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to dispatch verification code.");
      }

      setVerificationStep(true);
      setVerificationError(null);
      setVerificationCode("");
    } catch (err: any) {
      console.error("Sign up check failed:", err);
      setSignupError(err.message || "Identity verification protocol failed.");
    } finally {
      setIsSigningUp(false);
    }
  };

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!verificationCode.trim()) {
      setVerificationError("Please enter the verification code.");
      return;
    }

    setIsSigningUp(true);
    setVerificationError(null);

    try {
      const response = await fetch(
        getApiUrl("/api/auth/verify-registration-otp"),
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: signupEmail.trim(),
            code: verificationCode.trim(),
          }),
        },
      );
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Invalid verification passcode.");
      }

      // Email Verified! Proceed to create user record.
      const uid = Math.random().toString(36).substr(2, 9);
      await pocketbaseService.createUser(
        uid,
        signupUsername.trim(),
        signupPassword,
        "member",
        signupType === "dealer" ? selectedDealerId : "self_signup",
        signupFullName.trim(),
        signupType === "self" && signupArea ? signupArea.trim() : "main",
        undefined,
        undefined,
        "pending",
      );

      setSignupSuccess(true);
      setVerificationStep(false);
      setSignupUsername("");
      setSignupPassword("");
      setSignupFullName("");
      setSignupEmail("");
      setSignupArea("");
      setSelectedDealerId("");
    } catch (err: any) {
      console.error("Sign up failed:", err);
      setVerificationError(
        err.message || "Identity registration protocol failed.",
      );
    } finally {
      setIsSigningUp(false);
    }
  };

  // Dealer Tied Authentication Challenge
  const [matchedDealer, setMatchedDealer] = useState<any | null>(null);
  const [dealerNetworkCode, setDealerNetworkCode] = useState("");
  const [dealerCodeVerified, setDealerCodeVerified] = useState(false);
  const [dealerCodeError, setDealerCodeError] = useState<string | null>(null);

  // Recovery Flow State
  const [showRecoveryModal, setShowRecoveryModal] = useState(false);
  const [recoveryUsername, setRecoveryUsername] = useState("");
  const [recoveryStage, setRecoveryStage] = useState<
    "request" | "verify" | "reset" | "success"
  >("request");
  const [recoveryOtp, setRecoveryOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [isRecovering, setIsRecovering] = useState(false);
  const [recoveryError, setRecoveryError] = useState<string | null>(null);
  const [recoverySuccess, setRecoverySuccess] = useState<string | null>(null);
  const [recoveryEmail, setRecoveryEmail] = useState("");

  const obscureEmail = (email: string) => {
    if (!email) return "";
    const parts = email.split("@");
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
    const rUsername = params.get("reset_username");
    const rCode = params.get("reset_code");
    if (rUsername && rCode) {
      setRecoveryUsername(rUsername);
      setRecoveryOtp(rCode);
      setRecoveryStage("reset"); // Jump directly to new password entry
      setShowRecoveryModal(true);
      // Clean query params so they don't stick around in address bar
      try {
        window.history.replaceState(
          {},
          document.title,
          window.location.pathname,
        );
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
      const response = await fetch(getApiUrl("/api/auth/send-otp"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: recoveryUsername.trim() }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to dispatch verification code.");
      }
      setRecoveryEmail(data.email || "");
      setRecoveryStage("verify");
    } catch (err: any) {
      console.error("Recovery request failed:", err);
      setRecoveryError(err.message || "Verification passcode dispatch failed.");
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
      const response = await fetch(getApiUrl("/api/auth/verify-otp"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: recoveryUsername.trim(),
          code: recoveryOtp.trim(),
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(
          data.error || "Incorrect code. Please verification checks and retry.",
        );
      }
      setRecoveryStage("reset");
    } catch (err: any) {
      console.error("Recovery verify failed:", err);
      setRecoveryError(err.message || "Passcode verification failed.");
    } finally {
      setIsRecovering(false);
    }
  };

  const handleRecoveryReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword) {
      setRecoveryError("Please establish a new passcode.");
      return;
    }
    if (newPassword.length < 5) {
      setRecoveryError("Passcode must be at least 5 characters long.");
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setRecoveryError("Passcodes do not match.");
      return;
    }
    setIsRecovering(true);
    setRecoveryError(null);
    try {
      const response = await fetch(getApiUrl("/api/auth/reset-password"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: recoveryUsername.trim(),
          code: recoveryOtp.trim(),
          newPassword,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to update passcode.");
      }
      setRecoverySuccess(data.message || "Passcode updated successfully!");
      setRecoveryStage("success");
    } catch (err: any) {
      console.error("Recovery reset failed:", err);
      setRecoveryError(err.message || "Failed to update your credentials.");
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
        setMatchedDealer(null);
        setDealerCodeVerified(false);
        setDealerNetworkCode("");
        setDealerCodeError(null);
        return;
      }

      setIsCheckingUser(true);
      try {
        const allUsers = await pocketbaseService.getUsers();
        const foundUser = allUsers.find(
          (u) => u.username.toLowerCase() === username.trim().toLowerCase(),
        );
        setRequiredLineCode(!!foundUser?.lineCode);

        if (foundUser) {
          // If the profile is created from a dealer account
          const isTied =
            ["admin", "liteadmin", "member", "editor"].includes(
              foundUser.role,
            ) &&
            foundUser.dealerId &&
            foundUser.dealerId !== "main";

          if (isTied) {
            const dealer = allUsers.find(
              (u) => u.uid === foundUser.dealerId && u.role === "dealer",
            );
            if (dealer) {
              setMatchedDealer(dealer);
              setDetectedCompanyName(
                dealer.companyName || "Green Tech Services",
              );
            } else {
              setMatchedDealer(null);
            }
          } else {
            setMatchedDealer(null);
            if (foundUser.role === "dealer" && foundUser.companyName) {
              setDetectedCompanyName(foundUser.companyName);
            } else if (foundUser.dealerId && foundUser.dealerId !== "main") {
              const dealer = allUsers.find(
                (u) => u.uid === foundUser.dealerId && u.role === "dealer",
              );
              if (dealer && dealer.companyName) {
                setDetectedCompanyName(dealer.companyName);
              } else {
                setDetectedCompanyName("Green Tech Services");
              }
            } else {
              setDetectedCompanyName("Green Tech Services");
            }
          }
        } else {
          setMatchedDealer(null);
          setDetectedCompanyName("Green Tech Services");
        }
      } catch (err) {
        console.warn("User protocol validation pending...");
      } finally {
        setIsCheckingUser(false);
      }
    };

    const timer = setTimeout(checkUser, 350);
    return () => clearTimeout(timer);
  }, [username]);

  const inputClasses =
    "w-full pl-10 pr-4 py-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-4 focus:ring-blue-600 dark:focus:ring-blue-500 focus:border-blue-600 dark:focus:border-blue-500 transition-all placeholder:text-slate-400 dark:placeholder:text-slate-500 font-medium";

  return (
    <div className="relative min-h-[100dvh] w-full flex flex-col bg-slate-50 dark:bg-slate-900 overflow-x-hidden text-slate-800 dark:text-slate-100 font-sans transition-colors duration-300">
      {/* Slider Background */}
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
        <AnimatePresence mode="popLayout">
          {!showAuthModal && (
            <motion.div
              key={currentSlide}
              initial={{ x: "100%", opacity: 0.5 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: "-100%", opacity: 0.5 }}
              transition={{ duration: 1.5, ease: [0.25, 1, 0.5, 1] }}
              className="absolute inset-0"
            >
              <img
                src={SLIDER_IMAGES[currentSlide]}
                alt={`Slide ${currentSlide + 1}`}
                className="w-full h-full object-cover opacity-80 dark:opacity-60"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-50 via-slate-100/60 to-transparent dark:from-slate-950 dark:via-slate-900/60 dark:to-slate-950/20" />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Main Header */}
      <header className="fixed top-0 left-0 right-0 z-40 w-full px-4 sm:px-8 py-3 sm:py-4 flex items-center justify-between bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border-b border-slate-200/50 dark:border-slate-800/50 shadow-sm transition-colors duration-300">
        <div className="flex items-center space-x-3 cursor-pointer group">
          <div className="relative shrink-0 select-none transition-all duration-500 ease-[cubic-bezier(0.25,1,0.5,1)]">
            <div className="absolute -inset-0.5 bg-gradient-to-r from-emerald-500 to-teal-500 rounded-2xl blur-sm opacity-25 group-hover:opacity-60 transition duration-1000 animate-pulse" />
            <div className="relative w-11 h-11 rounded-2xl bg-slate-950 flex items-center justify-center border border-white/10 shadow-lg group-hover:shadow-[0_0_20px_rgba(16,185,129,0.3)] transition-all">
              <span className="text-white font-black text-lg tracking-tighter italic leading-none">
                G<span className="text-emerald-500">TS</span>
              </span>
            </div>
          </div>
          <span className="hidden sm:block text-slate-800 dark:text-white font-black tracking-tight text-xl group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
            Green Tech Services
          </span>
        </div>

        <nav className="hidden lg:flex items-center space-x-8">
          {["Home", "About", "Packages", "FAQ", "Contact"].map((item) => (
            <a
              key={item}
              href={`#${item.toLowerCase()}`}
              className="text-sm font-bold uppercase tracking-wider text-slate-600 hover:text-emerald-600 dark:text-slate-300 dark:hover:text-emerald-400 transition-colors"
            >
              {item}
            </a>
          ))}
          <button
            onClick={() => setShowAuthModal(true)}
            className="text-sm font-bold uppercase tracking-wider text-slate-600 hover:text-emerald-600 dark:text-slate-300 dark:hover:text-emerald-400 transition-colors"
          >
            Logins
          </button>
        </nav>

        <div className="flex items-center space-x-4">
          <button
            onClick={toggleTheme}
            className="p-2 sm:p-2.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
            aria-label="Toggle Theme"
          >
            {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
          </button>

          <button
            onClick={() => setShowAuthModal(true)}
            className="hidden lg:flex px-6 py-2.5 rounded-full bg-gradient-to-r from-emerald-600 to-teal-500 text-white font-bold uppercase text-sm tracking-wider shadow-lg hover:shadow-[0_0_20px_rgba(16,185,129,0.4)] hover:scale-105 transition-all active:scale-95"
          >
            Get Started
          </button>

          <button
            onClick={() => setShowAuthModal(true)}
            className="lg:hidden text-slate-800 dark:text-white hover:text-emerald-600 dark:hover:text-emerald-400"
            aria-label="Menu"
          >
            <Menu size={28} />
          </button>
        </div>
      </header>

      {/* Tagline Content */}
      <main className="relative z-20 flex-1 flex flex-col items-center justify-center pt-24 pb-12 px-4 text-center pointer-events-none">
        <AnimatePresence>
          {!showAuthModal && (
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -30 }}
              transition={{ duration: 0.8 }}
              className="max-w-5xl mx-auto"
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.2, duration: 0.8 }}
                className="inline-flex items-center space-x-2 bg-white/60 dark:bg-slate-900/60 backdrop-blur-md px-4 py-2 rounded-full border border-slate-200/50 dark:border-white/10 shadow-sm mb-6"
              >
                <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                </span>
                <span className="text-xs font-bold uppercase tracking-widest text-slate-800 dark:text-emerald-400">
                  99.9% Uptime Guarantee
                </span>
              </motion.div>
              <h1 className="text-5xl sm:text-7xl md:text-8xl font-black uppercase tracking-tight text-slate-900 dark:text-white drop-shadow-2xl leading-[1.1]">
                Ultra-Fast <br className="hidden sm:block" />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-600 to-teal-500 dark:from-emerald-400 dark:to-teal-300">
                  Fiber Internet
                </span>
              </h1>
              <p className="mt-8 text-lg sm:text-2xl text-slate-700 dark:text-slate-300 max-w-3xl mx-auto drop-shadow-md font-medium leading-relaxed">
                Experience symmetrical gigabit speeds, ultra-low latency, and
                seamless streaming. Connect your entire world with Green Tech
                Services (GTS).
              </p>
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4, duration: 0.8 }}
                className="mt-12 pointer-events-auto"
              >
                <button
                  onClick={() => {
                    document
                      .getElementById("plans")
                      ?.scrollIntoView({ behavior: "smooth" });
                  }}
                  className="group relative px-8 py-4 bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold uppercase tracking-widest text-sm rounded-full overflow-hidden shadow-xl hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 pointer-events-auto cursor-pointer"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-emerald-600 to-teal-500 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                  <span className="relative z-10 flex items-center space-x-2">
                    <span>Explore Plans & Portal</span>
                    <ChevronRight
                      size={18}
                      className="group-hover:translate-x-1 transition-transform"
                    />
                  </span>
                </button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Plans Section */}
      <AnimatePresence>
        {!showAuthModal && (
          <motion.section
            id="plans"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="relative z-20 w-full py-24 px-4 bg-slate-50 dark:bg-[#0b0f19] pointer-events-auto"
          >
            <div className="max-w-7xl mx-auto">
              <div className="text-center mb-16">
                <h2 className="text-4xl md:text-5xl font-black uppercase tracking-tight text-slate-900 dark:text-white mb-4">
                  Internet{" "}
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-600 to-teal-500">
                    Packages
                  </span>
                </h2>
                <p className="text-slate-600 dark:text-slate-400 text-lg font-medium max-w-2xl mx-auto">
                  Choose the perfect fiber internet plan for your home or
                  business. Experience unmatched speed and reliability.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                {/* Plan A */}
                <motion.div
                  whileHover={{ y: -10 }}
                  className="bg-white dark:bg-slate-900/80 backdrop-blur-sm rounded-3xl p-8 border border-slate-200 dark:border-slate-800 shadow-xl relative overflow-hidden group"
                >
                  <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:opacity-20 transition-opacity">
                    <Wifi size={64} className="text-emerald-500" />
                  </div>
                  <div className="relative z-10">
                    <div className="inline-block px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold uppercase tracking-widest mb-4">
                      Plan A
                    </div>
                    <div className="flex items-end gap-2 mb-2">
                      <span className="text-5xl font-black text-slate-900 dark:text-white leading-none">
                        6
                      </span>
                      <span className="text-xl font-bold text-slate-500 mb-1">
                        MB Pure
                      </span>
                    </div>
                    <div className="text-3xl font-black text-emerald-600 dark:text-emerald-400 mb-6">
                      1300
                      <span className="text-sm text-slate-500 dark:text-slate-400 uppercase">
                        {" "}
                        pkr/mo
                      </span>
                    </div>

                    <ul className="space-y-3 mb-8">
                      <li className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />{" "}
                        Seamless Streaming
                      </li>
                      <li className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />{" "}
                        Basic Gaming
                      </li>
                      <li className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />{" "}
                        Unlimited Data
                      </li>
                    </ul>

                    <button
                      onClick={() => setShowAuthModal(true)}
                      className="w-full py-3 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white font-bold uppercase text-xs tracking-widest hover:bg-emerald-500 hover:text-white transition-colors shadow-sm cursor-pointer"
                    >
                      Subscribe Now
                    </button>
                  </div>
                </motion.div>

                {/* Plan B */}
                <motion.div
                  whileHover={{ y: -10 }}
                  className="bg-white dark:bg-slate-900 rounded-3xl p-8 border border-emerald-500 shadow-2xl relative overflow-hidden group lg:-mt-4 lg:mb-4"
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-teal-500/5" />
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 bg-emerald-500 text-white text-[10px] font-black uppercase tracking-widest py-1 px-4 rounded-b-lg shadow-sm">
                    Most Popular
                  </div>
                  <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:opacity-20 transition-opacity">
                    <Zap size={64} className="text-emerald-500" />
                  </div>
                  <div className="relative z-10 mt-2">
                    <div className="inline-block px-3 py-1 rounded-full bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-xs font-bold uppercase tracking-widest mb-4">
                      Plan B
                    </div>
                    <div className="flex items-end gap-2 mb-2">
                      <span className="text-5xl font-black text-slate-900 dark:text-white leading-none">
                        8
                      </span>
                      <span className="text-xl font-bold text-slate-500 mb-1">
                        MB Pure
                      </span>
                    </div>
                    <div className="text-3xl font-black text-emerald-600 dark:text-emerald-400 mb-6">
                      1500
                      <span className="text-sm text-slate-500 dark:text-slate-400 uppercase">
                        {" "}
                        pkr/mo
                      </span>
                    </div>

                    <ul className="space-y-3 mb-8">
                      <li className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />{" "}
                        HD Streaming
                      </li>
                      <li className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />{" "}
                        Smooth Online Gaming
                      </li>
                      <li className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />{" "}
                        Unlimited Data
                      </li>
                    </ul>

                    <button
                      onClick={() => setShowAuthModal(true)}
                      className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 text-white font-bold uppercase text-xs tracking-widest shadow-lg hover:shadow-emerald-500/30 transition-all active:scale-95 cursor-pointer"
                    >
                      Subscribe Now
                    </button>
                  </div>
                </motion.div>

                {/* Plan C */}
                <motion.div
                  whileHover={{ y: -10 }}
                  className="bg-white dark:bg-slate-900/80 backdrop-blur-sm rounded-3xl p-8 border border-slate-200 dark:border-slate-800 shadow-xl relative overflow-hidden group"
                >
                  <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:opacity-20 transition-opacity">
                    <Rocket size={64} className="text-emerald-500" />
                  </div>
                  <div className="relative z-10">
                    <div className="inline-block px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold uppercase tracking-widest mb-4">
                      Plan C
                    </div>
                    <div className="flex items-end gap-2 mb-2">
                      <span className="text-5xl font-black text-slate-900 dark:text-white leading-none">
                        10
                      </span>
                      <span className="text-xl font-bold text-slate-500 mb-1">
                        MB Pure
                      </span>
                    </div>
                    <div className="text-3xl font-black text-emerald-600 dark:text-emerald-400 mb-6">
                      1800
                      <span className="text-sm text-slate-500 dark:text-slate-400 uppercase">
                        {" "}
                        pkr/mo
                      </span>
                    </div>

                    <ul className="space-y-3 mb-8">
                      <li className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />{" "}
                        4K Video Streaming
                      </li>
                      <li className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />{" "}
                        Pro Gaming
                      </li>
                      <li className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />{" "}
                        Unlimited Data
                      </li>
                    </ul>

                    <button
                      onClick={() => setShowAuthModal(true)}
                      className="w-full py-3 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white font-bold uppercase text-xs tracking-widest hover:bg-emerald-500 hover:text-white transition-colors shadow-sm cursor-pointer"
                    >
                      Subscribe Now
                    </button>
                  </div>
                </motion.div>

                {/* Plan D */}
                <motion.div
                  whileHover={{ y: -10 }}
                  className="bg-white dark:bg-slate-900/80 backdrop-blur-sm rounded-3xl p-8 border border-slate-200 dark:border-slate-800 shadow-xl relative overflow-hidden group"
                >
                  <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:opacity-20 transition-opacity">
                    <Globe size={64} className="text-emerald-500" />
                  </div>
                  <div className="relative z-10">
                    <div className="inline-block px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold uppercase tracking-widest mb-4">
                      Plan D
                    </div>
                    <div className="flex items-end gap-2 mb-2">
                      <span className="text-5xl font-black text-slate-900 dark:text-white leading-none">
                        12
                      </span>
                      <span className="text-xl font-bold text-slate-500 mb-1">
                        MB Pure
                      </span>
                    </div>
                    <div className="text-3xl font-black text-emerald-600 dark:text-emerald-400 mb-6">
                      2000
                      <span className="text-sm text-slate-500 dark:text-slate-400 uppercase">
                        {" "}
                        pkr/mo
                      </span>
                    </div>

                    <ul className="space-y-3 mb-8">
                      <li className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />{" "}
                        Multiple 4K Streams
                      </li>
                      <li className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />{" "}
                        Heavy Downloading
                      </li>
                      <li className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />{" "}
                        Unlimited Data
                      </li>
                    </ul>

                    <button
                      onClick={() => setShowAuthModal(true)}
                      className="w-full py-3 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white font-bold uppercase text-xs tracking-widest hover:bg-emerald-500 hover:text-white transition-colors shadow-sm cursor-pointer"
                    >
                      Subscribe Now
                    </button>
                  </div>
                </motion.div>
              </div>
            </div>
          </motion.section>
        )}
      </AnimatePresence>

      {/* Auth Modal Overlay */}
      <AnimatePresence>
        {showAuthModal && (
          <motion.div
            initial={{ opacity: 0, backdropFilter: "blur(0px)" }}
            animate={{ opacity: 1, backdropFilter: "blur(12px)" }}
            exit={{ opacity: 0, backdropFilter: "blur(0px)" }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-100/85 dark:bg-slate-950/85 overflow-y-auto pointer-events-auto"
          >
            <button
              onClick={() => setShowAuthModal(false)}
              className="absolute top-4 left-4 sm:top-8 sm:left-8 px-4 py-2 bg-slate-900/10 dark:bg-white/10 hover:bg-slate-900/20 dark:hover:bg-white/20 border border-slate-900/10 dark:border-white/10 rounded-full text-slate-800 dark:text-white font-bold text-sm flex items-center space-x-1 transition-all z-[100] shadow-sm cursor-pointer pointer-events-auto"
            >
              <ChevronLeft size={20} />
              <span>Go Back</span>
            </button>
            <button
              onClick={() => setShowAuthModal(false)}
              className="absolute top-4 right-4 sm:top-8 sm:right-8 p-3 bg-slate-900/10 dark:bg-white/10 hover:bg-slate-900/20 dark:hover:bg-white/20 border border-slate-900/10 dark:border-white/10 rounded-full text-slate-800 dark:text-white transition-all z-[100] shadow-sm cursor-pointer pointer-events-auto"
            >
              <X size={28} />
            </button>
            <NetworkBackground className="opacity-40" />

            <motion.div
              initial={{ scale: 0.95, y: 20, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.95, y: 20, opacity: 0 }}
              transition={{ duration: 0.4 }}
              className={cn(
                "gts-login-container w-full max-w-4xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] relative bg-white/95 dark:bg-[#0b0f19]/90 backdrop-blur-2xl border border-emerald-500/20 rounded-[2rem] overflow-hidden min-h-[500px] sm:min-h-[550px] flex-shrink-0 z-20 my-auto",
                isRightPanelActive && "active",
              )}
            >
              {/* --- SIGN IN FORM CONTAINER --- */}
              <div className="gts-form-container gts-sign-in w-full sm:w-1/2 h-full flex flex-col justify-center p-5 sm:p-12 z-20">
                <form
                  onSubmit={handleSubmit}
                  className="space-y-4 w-full max-w-sm mx-auto"
                >
                  <div className="text-center sm:text-left mb-6">
                    <span className="text-[10px] font-black uppercase tracking-[0.25em] text-[#2563EB] dark:text-blue-500">
                      SECURE AUTHENTICATION
                    </span>
                    <h1 className="text-2xl font-black mt-1 text-slate-900 dark:text-white uppercase tracking-tight">
                      Operator Sign In
                    </h1>
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-[10px] font-black text-slate-700 dark:text-slate-300 uppercase tracking-widest ml-1">
                      Identity (Access Username)
                    </label>
                    <div className="relative">
                      <User
                        className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                        size={16}
                      />
                      <input
                        id="username-input"
                        type="text"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        placeholder="Username"
                        className={cn(
                          inputClasses,
                          "py-2.5",
                          isCheckingUser && "opacity-70",
                        )}
                        required
                      />
                      {isCheckingUser && (
                        <div className="absolute right-3.5 top-1/2 -translate-y-1/2">
                          <Loader2
                            size={14}
                            className="animate-spin text-brand-accent"
                          />
                        </div>
                      )}
                    </div>
                  </div>

                  <AnimatePresence>
                    {requiredLineCode && (
                      <motion.div
                        initial={{ opacity: 0, height: 0, scale: 0.95 }}
                        animate={{ opacity: 1, height: "auto", scale: 1 }}
                        exit={{ opacity: 0, height: 0, scale: 0.95 }}
                        className="space-y-1.5 overflow-hidden"
                      >
                        <label className="block text-[10px] font-black text-brand-accent uppercase tracking-widest ml-1">
                          Network Code
                        </label>
                        <div className="relative">
                          <Key
                            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-brand-accent"
                            size={16}
                          />
                          <input
                            id="line-code-input"
                            type="text"
                            value={lineCode}
                            onChange={(e) => setLineCode(e.target.value)}
                            placeholder="Enter Gateway Node Code"
                            className={cn(
                              inputClasses,
                              "py-2.5 border-brand-accent/30 ring-2 ring-brand-accent/10",
                            )}
                            required
                          />
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <div className="space-y-1.5">
                    <label className="block text-[10px] font-black text-slate-700 dark:text-slate-300 uppercase tracking-widest ml-1">
                      Passkey Credentials
                    </label>
                    <div className="relative">
                      <Lock
                        className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                        size={16}
                      />
                      <input
                        id="password-input"
                        type={showPassword ? "text" : "password"}
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
                        {showPassword ? (
                          <EyeOff size={16} />
                        ) : (
                          <Eye size={16} />
                        )}
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
                      animate={{ opacity: 1, height: "auto" }}
                      className="text-center p-3 rounded-xl bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-900/30 transition-all"
                    >
                      <p className="text-[11px] font-bold text-red-600 dark:text-red-400">
                        {error}
                      </p>
                    </motion.div>
                  )}

                  <motion.button
                    id="login-button"
                    type="submit"
                    disabled={isLoading}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="w-full py-3 rounded-xl bg-slate-950 dark:bg-brand-accent hover:bg-black dark:hover:bg-blue-700 text-white font-black uppercase tracking-[0.2em] text-[10px] shadow-lg transition-all disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 size={14} className="animate-spin" />
                        Authorizing Gateway...
                      </>
                    ) : (
                      "Sign In"
                    )}
                  </motion.button>

                  {onGoogleLogin && (
                    <div className="pt-2">
                      <div className="relative mb-3">
                        <div className="absolute inset-0 flex items-center">
                          <div className="w-full border-t border-slate-200 dark:border-slate-800"></div>
                        </div>
                        <div className="relative flex justify-center text-[9px] uppercase font-black tracking-widest">
                          <span className="px-2 bg-white dark:bg-[#0b0f19] text-slate-400">
                            or secondary access
                          </span>
                        </div>
                      </div>

                      <motion.button
                        type="button"
                        onClick={onGoogleLogin}
                        disabled={isLoading}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        className="w-full py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-850 text-slate-800 dark:text-slate-100 font-extrabold uppercase tracking-[0.15em] text-[9px] shadow-sm transition-all hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
                      >
                        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24">
                          <path
                            fill="#4285F4"
                            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                          />
                          <path
                            fill="#34A853"
                            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                          />
                          <path
                            fill="#FBBC05"
                            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                          />
                          <path
                            fill="#EA4335"
                            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                          />
                        </svg>
                        Google Identity
                      </motion.button>
                    </div>
                  )}
                </form>
              </div>

              {/* --- SIGN UP / CONNECTION REQUEST FORM --- */}
              <div className="gts-form-container gts-sign-up w-full sm:w-1/2 h-full flex flex-col justify-center p-5 sm:p-12 z-20">
                <form
                  onSubmit={handleRegisterUser}
                  className="space-y-4 w-full max-w-sm mx-auto"
                >
                  <div className="text-center sm:text-left mb-4">
                    <span className="text-[10px] font-black uppercase tracking-[0.25em] text-emerald-500">
                      CONNECTION REQUEST CONTROL
                    </span>
                    <h1 className="text-2xl font-black mt-1 text-slate-900 dark:text-white uppercase tracking-tight">
                      Self Register Node
                    </h1>
                  </div>

                  {verificationStep && !signupSuccess ? (
                    <motion.div
                      initial={{ scale: 0.95, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      className="bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-5 rounded-2xl text-center space-y-4"
                    >
                      <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-300 flex items-center justify-center mx-auto">
                        <Mail size={20} />
                      </div>
                      <h3 className="text-xs font-black uppercase tracking-widest text-slate-800 dark:text-slate-200">
                        Verify Node Location
                      </h3>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-widest leading-relaxed">
                        Activation code dispatched to <br />
                        <span className="text-emerald-600 dark:text-emerald-400">
                          {signupEmail}
                        </span>
                      </p>

                      <div className="space-y-1.5 pt-2 text-left">
                        <label className="block text-[9px] font-black text-slate-700 dark:text-slate-300 uppercase tracking-widest ml-1">
                          Activation Code
                        </label>
                        <div className="relative">
                          <ShieldCheck
                            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                            size={14}
                          />
                          <input
                            type="text"
                            value={verificationCode}
                            onChange={(e) =>
                              setVerificationCode(
                                e.target.value.replace(/\s+/g, ""),
                              )
                            }
                            placeholder="e.g. 123456"
                            className={cn(
                              inputClasses,
                              "py-2.5 text-xs pl-9 font-mono tracking-widest",
                            )}
                            required
                            disabled={isSigningUp}
                          />
                        </div>
                      </div>

                      {verificationError && (
                        <p className="text-[10px] text-red-500 font-bold uppercase tracking-wider text-center">
                          ⚠️ {verificationError}
                        </p>
                      )}

                      <motion.button
                        type="button"
                        onClick={handleVerifyCode}
                        disabled={isSigningUp || !verificationCode}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 dark:bg-slate-700 dark:hover:bg-slate-600 text-white font-black uppercase tracking-[0.2em] text-[10px] shadow-lg transition-all disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer mt-2"
                      >
                        {isSigningUp ? (
                          <Loader2 size={12} className="animate-spin" />
                        ) : (
                          "Confirm Activation"
                        )}
                      </motion.button>
                      <button
                        type="button"
                        onClick={() => {
                          setVerificationStep(false);
                          setGeneratedCode("");
                        }}
                        className="text-[9px] mt-2 text-slate-400 font-bold uppercase tracking-widest hover:underline"
                      >
                        Cancel
                      </button>
                    </motion.div>
                  ) : signupSuccess ? (
                    <motion.div
                      initial={{ scale: 0.95, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      className="bg-emerald-500/10 border border-emerald-500/20 p-5 rounded-2xl text-center space-y-3"
                    >
                      <div className="w-10 h-10 rounded-full bg-emerald-500/15 text-emerald-400 flex items-center justify-center mx-auto">
                        <ShieldCheck size={20} />
                      </div>
                      <h3 className="text-xs font-black uppercase tracking-widest text-emerald-400">
                        Account Request Submitted
                      </h3>
                      <p className="text-[10px] text-slate-400 uppercase tracking-widest leading-relaxed">
                        Identity requested successfully! Status:{" "}
                        <strong>PENDING approval</strong>. Administrators will
                        activate your node soon.
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          setSignupSuccess(false);
                          setIsRightPanelActive(false);
                        }}
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-[9px] font-black uppercase tracking-widest rounded-lg transition-transform hover:scale-105"
                      >
                        Return to login
                      </button>
                    </motion.div>
                  ) : (
                    <>
                      <div className="flex bg-slate-100 dark:bg-slate-800/50 p-1 rounded-lg mb-4">
                        <button
                          type="button"
                          onClick={() => setSignupType("dealer")}
                          className={cn(
                            "flex-1 py-1.5 text-[9px] font-black uppercase tracking-widest rounded transition-all",
                            signupType === "dealer"
                              ? "bg-white dark:bg-slate-700 text-slate-900 border"
                              : "text-slate-500 hover:text-slate-700",
                          )}
                        >
                          Select Dealer
                        </button>
                        <button
                          type="button"
                          onClick={() => setSignupType("self")}
                          className={cn(
                            "flex-1 py-1.5 text-[9px] font-black uppercase tracking-widest rounded transition-all",
                            signupType === "self"
                              ? "bg-white dark:bg-slate-700 text-slate-900 border"
                              : "text-slate-500 hover:text-slate-700",
                          )}
                        >
                          Self
                        </button>
                      </div>

                      {signupType === "dealer" && (
                        <div className="space-y-1.5">
                          <label className="block text-[9px] font-black text-slate-700 dark:text-slate-300 uppercase tracking-widest ml-1">
                            Assigned Dealer
                          </label>
                          <select
                            value={selectedDealerId}
                            onChange={(e) =>
                              setSelectedDealerId(e.target.value)
                            }
                            className={cn(
                              inputClasses,
                              "py-2.5 text-xs px-3 w-full",
                            )}
                            disabled={isSigningUp}
                            required={signupType === "dealer"}
                          >
                            <option value="">Select a Dealer...</option>
                            {dealersList.map((dealer) => (
                              <option key={dealer.uid} value={dealer.uid}>
                                {dealer.companyName || dealer.username}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}

                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <label className="block text-[9px] font-black text-slate-700 dark:text-slate-300 uppercase tracking-widest ml-1">
                            Username
                          </label>
                          <div className="relative">
                            <User
                              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                              size={14}
                            />
                            <input
                              type="text"
                              value={signupUsername}
                              onChange={(e) =>
                                setSignupUsername(
                                  e.target.value.replace(/\s+/g, ""),
                                )
                              }
                              placeholder="Login ID"
                              className={cn(
                                inputClasses,
                                "py-2.5 text-xs pl-8",
                              )}
                              required
                              disabled={isSigningUp}
                            />
                          </div>
                        </div>

                        <div className="space-y-1.5">
                          <label className="block text-[9px] font-black text-slate-700 dark:text-slate-300 uppercase tracking-widest ml-1">
                            Full Name
                          </label>
                          <div className="relative">
                            <Terminal
                              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                              size={14}
                            />
                            <input
                              type="text"
                              value={signupFullName}
                              onChange={(e) =>
                                setSignupFullName(e.target.value)
                              }
                              placeholder="Customer Name"
                              className={cn(
                                inputClasses,
                                "py-2.5 text-xs pl-8",
                              )}
                              required
                              disabled={isSigningUp}
                            />
                          </div>
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <label className="block text-[9px] font-black text-slate-700 dark:text-slate-300 uppercase tracking-widest ml-1">
                          Passkey
                        </label>
                        <div className="relative">
                          <Lock
                            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                            size={14}
                          />
                          <input
                            type="password"
                            value={signupPassword}
                            onChange={(e) => setSignupPassword(e.target.value)}
                            placeholder="••••••••"
                            className={cn(
                              inputClasses,
                              "py-2.5 text-xs pl-9",
                              signupPassword &&
                                !validatePassword(signupPassword)
                                ? "border-red-500 focus:border-red-500 focus:ring-red-500/30"
                                : "",
                            )}
                            required
                            disabled={isSigningUp}
                          />
                        </div>
                        {signupPassword &&
                          !validatePassword(signupPassword) && (
                            <p className="text-[9px] text-red-500 ml-1 font-medium">
                              Require 8+ chars, 1 uppercase, 1 lowercase, 1
                              number.
                            </p>
                          )}
                      </div>

                      <div className="space-y-1.5">
                        <label className="block text-[9px] font-black text-slate-700 dark:text-slate-300 uppercase tracking-widest ml-1">
                          Backup Email (Important)
                        </label>
                        <div className="relative">
                          <Mail
                            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                            size={14}
                          />
                          <input
                            type="email"
                            value={signupEmail}
                            onChange={(e) => setSignupEmail(e.target.value)}
                            placeholder="name@example.com"
                            className={cn(
                              inputClasses,
                              "py-2.5 text-xs pl-9",
                              signupEmail && !validateEmail(signupEmail)
                                ? "border-red-500 focus:border-red-500 focus:ring-red-500/30"
                                : "",
                            )}
                            disabled={isSigningUp}
                            required
                          />
                        </div>
                        {signupEmail && !validateEmail(signupEmail) && (
                          <p className="text-[9px] text-red-500 ml-1 font-medium">
                            Enter a valid email address.
                          </p>
                        )}
                      </div>

                      {signupType === "self" && (
                        <div className="space-y-1.5">
                          <label className="block text-[9px] font-black text-slate-700 dark:text-slate-300 uppercase tracking-widest ml-1">
                            Company Name (Optional)
                          </label>
                          <div className="relative">
                            <MapPin
                              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                              size={14}
                            />
                            <input
                              type="text"
                              value={signupArea}
                              onChange={(e) => setSignupArea(e.target.value)}
                              placeholder="Your Company Name"
                              className={cn(
                                inputClasses,
                                "py-2.5 text-xs pl-9",
                              )}
                              disabled={isSigningUp}
                            />
                          </div>
                        </div>
                      )}

                      {signupError && (
                        <p className="text-[10px] text-red-500 font-bold uppercase tracking-wider text-center">
                          ⚠️ {signupError}
                        </p>
                      )}

                      <motion.button
                        type="submit"
                        disabled={isSigningUp}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black uppercase tracking-[0.2em] text-[10px] shadow-lg transition-all disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer pt-3 pb-3 mt-4"
                      >
                        {isSigningUp ? (
                          <>
                            <Loader2 size={12} className="animate-spin" />
                          </>
                        ) : (
                          "Register Account"
                        )}
                      </motion.button>
                    </>
                  )}
                </form>
              </div>

              {/* --- DUAL GRADIENT INTERACTIVE TOGGLE CONTAINER --- */}
              <div className="gts-toggle-container">
                <div className="gts-toggle">
                  {/* Left Toggle Panel */}
                  <div className="gts-toggle-panel gts-toggle-left space-y-1.5 sm:space-y-6">
                    <div className="relative w-fit mx-auto mb-2 sm:mb-4 hidden sm:block">
                      <div className="p-4 rounded-3xl bg-white/10 border border-white/20 text-white">
                        <ShieldCheck size={36} className="animate-pulse" />
                      </div>
                    </div>
                    <h1 className="text-xl sm:text-3xl font-black text-white uppercase tracking-tight leading-none">
                      Core Gateways
                    </h1>
                    <p className="hidden sm:block text-[11px] font-extrabold uppercase tracking-widest text-slate-200 max-w-[240px] mx-auto leading-relaxed">
                      Already registered in the ISP node ledger? Return to
                      validation instantly.
                    </p>
                    <button
                      type="button"
                      onClick={() => setIsRightPanelActive(false)}
                      className="hidden-btn border-2 border-white text-white px-6 sm:px-8 py-2 sm:py-2.5 text-[10px] font-black uppercase tracking-[0.2em] rounded-xl hover:bg-white hover:text-blue-600 transition-all cursor-pointer hover:shadow-xl"
                    >
                      Sign In Portal
                    </button>
                  </div>

                  {/* Right Toggle Panel */}
                  <div className="gts-toggle-panel gts-toggle-right space-y-1.5 sm:space-y-6">
                    <div className="relative w-fit mx-auto mb-2 sm:mb-4 hidden sm:block">
                      <div className="p-4 rounded-3xl bg-white/10 border border-white/20 text-white">
                        <UserPlus size={36} className="animate-bounce" />
                      </div>
                    </div>
                    <h1 className="text-xl sm:text-3xl font-black text-white uppercase tracking-tight leading-none">
                      Hello, Friend!
                    </h1>
                    <p className="hidden sm:block text-[11px] font-extrabold uppercase tracking-widest text-slate-200 max-w-[240px] mx-auto leading-relaxed">
                      Need to register your node or lodge connection credentials
                      for the first time?
                    </p>
                    <button
                      type="button"
                      onClick={() => setIsRightPanelActive(true)}
                      className="hidden-btn border-2 border-white text-white px-6 sm:px-8 py-2 sm:py-2.5 text-[10px] font-black uppercase tracking-[0.2em] rounded-xl hover:bg-white hover:text-blue-600 transition-all cursor-pointer hover:shadow-xl"
                    >
                      Self-Register
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Persistent footer brand coordinates */}
      <div className="mt-8 text-center space-y-1 z-10">
        <p className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-[0.35em] font-black flex items-center justify-center gap-1.5">
          <Globe className="w-3.5 h-3.5 animate-spin-slow text-brand-accent" />
          {detectedCompanyName}
        </p>
        <p className="text-[8px] font-extrabold text-slate-400/50 uppercase tracking-widest">
          GATEWAY LATENCY: 1.5ms · MATRIX SECURITY V2.6.5 · GREEN NET CO
        </p>
      </div>

      <AnimatePresence>
        {matchedDealer && !dealerCodeVerified && (
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
              className="relative w-full max-w-sm p-6 bg-white dark:bg-[#0b0f19] border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="text-center mb-6">
                <div className="inline-flex p-3 rounded-full bg-blue-50 dark:bg-blue-950/20 text-blue-600 dark:text-blue-400 mb-2 border border-blue-200/50">
                  <Globe className="w-6 h-6 animate-spin-slow" />
                </div>
                <h3 className="text-xs font-black uppercase tracking-widest text-[#2563EB] dark:text-blue-400">
                  Dealer Connection Synced
                </h3>
                <p className="text-[10px] text-slate-400 dark:text-slate-500 font-extrabold uppercase mt-1">
                  Node Authentication Link Found
                </p>
              </div>

              <div className="bg-slate-50 dark:bg-slate-900/60 p-4 rounded-2xl border border-slate-150 dark:border-slate-800 space-y-1.5 text-center mb-4">
                <span className="text-[9px] font-black uppercase tracking-wider text-slate-400">
                  Linked to Dealer Network
                </span>
                <div className="text-sm font-black text-slate-900 dark:text-slate-100 uppercase font-mono">
                  {matchedDealer.fullName || matchedDealer.username}
                </div>
                <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                  Parent Company:{" "}
                  <span className="font-extrabold text-blue-600 dark:text-brand-accent">
                    {matchedDealer.companyName || "Green Tech Services"}
                  </span>
                </div>
              </div>

              <motion.div
                initial={{ y: -30, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.2, type: "spring", damping: 15 }}
                className="space-y-2 border-t border-slate-100 dark:border-slate-800 pt-4"
              >
                <label className="block text-center text-[10px] font-black text-brand-accent uppercase tracking-widest leading-normal">
                  Enter Dealer Network Code
                </label>
                <div className="relative">
                  <Key
                    className="absolute left-3.5 top-1/2 -translate-y-1/2 text-brand-accent"
                    size={16}
                  />
                  <input
                    type="text"
                    value={dealerNetworkCode}
                    onChange={(e) => {
                      setDealerNetworkCode(e.target.value);
                      setDealerCodeError(null);
                    }}
                    placeholder="e.g. 001"
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-brand-accent/20 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-accent/30 text-center font-mono tracking-widest text-sm font-black placeholder:text-slate-400"
                  />
                </div>
                {dealerCodeError && (
                  <p className="text-[10px] font-bold text-red-650 dark:text-red-400 text-center uppercase tracking-wider mt-1 leading-tight animate-pulse">
                    ❌ {dealerCodeError}
                  </p>
                )}
              </motion.div>

              <div className="space-y-2 pt-6 mt-4 border-t border-slate-200/50 dark:border-slate-800/85">
                <button
                  type="button"
                  onClick={() => {
                    if (!dealerNetworkCode.trim()) {
                      setDealerCodeError(
                        "Please input the Dealer's Network Code",
                      );
                      return;
                    }
                    if (
                      dealerNetworkCode.trim().toLowerCase() ===
                      matchedDealer.lineCode?.toLowerCase()
                    ) {
                      setDealerCodeVerified(true);
                      setLineCode(matchedDealer.lineCode);
                      setDealerCodeError(null);
                    } else {
                      setDealerCodeError(
                        "Incorrect network code. Access Denied.",
                      );
                    }
                  }}
                  className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-black uppercase tracking-widest transition-all hover:scale-[1.02] flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-blue-500/20"
                >
                  <Lock size={12} />
                  Authorize Gateway
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setUsername("");
                    setMatchedDealer(null);
                  }}
                  className="w-full py-2 rounded-xl bg-transparent hover:bg-slate-100 dark:hover:bg-slate-900 text-slate-400 dark:text-[#64748B] text-[9px] font-bold uppercase tracking-widest transition-all cursor-pointer"
                >
                  Use Another Account
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

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
                    <h3 className="text-sm font-black uppercase tracking-tight text-slate-900 dark:text-slate-50">
                      Identity Recovery
                    </h3>
                    <p className="text-[9px] font-bold uppercase tracking-widest text-[#2563EB] dark:text-brand-accent">
                      Passkey Protocol Restore
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setShowRecoveryModal(false);
                    setTimeout(() => {
                      setRecoveryStage("request");
                      setRecoveryOtp("");
                      setNewPassword("");
                      setConfirmNewPassword("");
                      setRecoveryError(null);
                    }, 300);
                  }}
                  className="p-1 px-2 rounded-lg bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700/80 text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-300 transition-colors cursor-pointer"
                >
                  Close
                </button>
              </div>

              {recoveryStage === "request" && (
                <form onSubmit={handleRecoveryRequest} className="space-y-4">
                  <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed font-semibold">
                    To initiate the secure protocol restore, enter your
                    registered <strong>Access ID (Username)</strong> below. We
                    will match the credentials and dispatch an OTP code via
                    Gmail.
                  </p>

                  <div className="space-y-1.5">
                    <label className="block text-[10px] font-black text-slate-700 dark:text-slate-300 uppercase tracking-widest ml-1">
                      Access ID (Username)
                    </label>
                    <div className="relative">
                      <User
                        className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                        size={16}
                      />
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
                      className="p-3 rounded-xl bg-red-50 dark:bg-red-955 border border-red-200 dark:border-red-900/30 text-[11px] font-bold text-red-600 dark:text-red-400 flex gap-2 items-start"
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
                        "Send OTP Code"
                      )}
                    </button>
                  </div>
                </form>
              )}

              {recoveryStage === "verify" && (
                <form onSubmit={handleRecoveryVerify} className="space-y-4">
                  <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed font-semibold">
                    A secure authentication code has been dispatched to your
                    backup destination:{" "}
                    <strong className="text-blue-500">
                      {obscureEmail(recoveryEmail)}
                    </strong>
                    . Enter the 6-digit code below:
                  </p>

                  <div className="space-y-1.5">
                    <label className="block text-[10px] font-black text-slate-700 dark:text-slate-300 uppercase tracking-widest ml-1">
                      6-Digit Secure Code
                    </label>
                    <div className="relative">
                      <Key
                        className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                        size={16}
                      />
                      <input
                        type="text"
                        maxLength={6}
                        value={recoveryOtp}
                        onChange={(e) =>
                          setRecoveryOtp(e.target.value.replace(/\D/g, ""))
                        }
                        placeholder="e.g. 123456"
                        className={cn(
                          inputClasses,
                          "py-2.5 text-center font-mono tracking-[0.3em] text-lg font-bold pl-4",
                        )}
                        required
                        disabled={isRecovering}
                      />
                    </div>
                  </div>

                  {recoveryError && (
                    <motion.div
                      initial={{ opacity: 0, y: -5 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="p-3 rounded-xl bg-red-50 dark:bg-red-955 border border-red-200 dark:border-red-900/30 text-[11px] font-bold text-red-600 dark:text-red-400 flex gap-2 items-start"
                    >
                      <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                      <span>{recoveryError}</span>
                    </motion.div>
                  )}

                  <div className="pt-2 flex gap-3">
                    <button
                      type="button"
                      onClick={() => setRecoveryStage("request")}
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
                        "Verify Code"
                      )}
                    </button>
                  </div>
                </form>
              )}

              {recoveryStage === "reset" && (
                <form onSubmit={handleRecoveryReset} className="space-y-4">
                  <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed font-semibold">
                    Establish your new security configurations for access ID{" "}
                    <strong>{recoveryUsername}</strong>.
                  </p>

                  <div className="space-y-1.5">
                    <label className="block text-[10px] font-black text-slate-700 dark:text-slate-300 uppercase tracking-widest ml-1">
                      New Secure Passcode
                    </label>
                    <div className="relative">
                      <Lock
                        className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                        size={16}
                      />
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
                    <label className="block text-[10px] font-black text-slate-700 dark:text-slate-300 uppercase tracking-widest ml-1">
                      Confirm Secure Passcode
                    </label>
                    <div className="relative">
                      <Lock
                        className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                        size={16}
                      />
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
                      className="p-3 rounded-xl bg-red-50 dark:bg-red-955 border border-red-200 dark:border-red-900/30 text-[11px] font-bold text-red-600 dark:text-red-400 flex gap-2 items-start"
                    >
                      <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                      <span>{recoveryError}</span>
                    </motion.div>
                  )}

                  <div className="pt-2 flex gap-3">
                    <button
                      type="button"
                      onClick={() => setRecoveryStage("verify")}
                      className="flex-1 py-3 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-xl text-[10.5px] font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 transition-all border border-slate-200/50 dark:border-slate-700/50"
                    >
                      Back
                    </button>
                    <button
                      type="submit"
                      disabled={
                        isRecovering || !newPassword || !confirmNewPassword
                      }
                      className="flex-1 py-3 bg-emerald-600 text-white rounded-xl text-[10.5px] font-black uppercase tracking-wider shadow-lg shadow-emerald-500/10 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {isRecovering ? (
                        <>
                          <Loader2 size={14} className="animate-spin" />
                          Finalizing...
                        </>
                      ) : (
                        "Save Passcode"
                      )}
                    </button>
                  </div>
                </form>
              )}

              {recoveryStage === "success" && (
                <div className="space-y-4 text-center py-2 animate-fadeIn">
                  <div className="w-12 h-12 rounded-full bg-emerald-500/15 text-emerald-500 flex items-center justify-center mx-auto mb-2 font-black text-xl">
                    ✓
                  </div>
                  <h4 className="text-sm font-black uppercase tracking-tight text-emerald-600 dark:text-emerald-400 leading-none">
                    Security Updated
                  </h4>
                  <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed font-bold p-3 bg-slate-50 dark:bg-[#0b0f19] rounded-2xl border border-slate-100 dark:border-slate-800/50 text-left">
                    {recoverySuccess}
                  </p>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-relaxed">
                    Your security nodes have successfully registered the new
                    credentials. You can now sign in with your updated passcode.
                  </p>
                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        setShowRecoveryModal(false);
                        setRecoveryStage("request");
                        setRecoveryOtp("");
                        setNewPassword("");
                        setConfirmNewPassword("");
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

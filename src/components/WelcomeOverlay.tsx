import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ShieldCheck, Cpu, Database, Terminal, CheckSquare, Sparkles } from 'lucide-react';

interface WelcomeOverlayProps {
  username: string;
  fullName?: string;
  profilePicture?: string;
  onComplete: () => void;
}

const LOG_STEPS = [
  { id: 0, text: "Configuring secure terminal protocol...", icon: Terminal },
  { id: 1, text: "Resolving active core Node connections...", icon: Cpu },
  { id: 2, text: "Synchronizing operations cache & registry...", icon: Database },
  { id: 3, text: "Authorization verified. Launching workspace...", icon: ShieldCheck }
];

export default function WelcomeOverlay({ 
  username, 
  fullName, 
  profilePicture, 
  onComplete 
}: WelcomeOverlayProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [greeting, setGreeting] = useState("Welcome Back");

  useEffect(() => {
    // Dynamic time-of-day greeting
    const hours = new Date().getHours();
    if (hours < 12) setGreeting("Good Morning");
    else if (hours < 18) setGreeting("Good Afternoon");
    else setGreeting("Good Evening");
  }, []);

  useEffect(() => {
    // Sequence the terminal log steps beautifully
    const stepIntervals = [600, 1300, 2000, 2700];
    const timers = stepIntervals.map((delay, index) => {
      return setTimeout(() => {
        setCurrentStep(index + 1);
      }, delay);
    });

    // Final callback to exit the welcoming overlay
    const completeTimer = setTimeout(() => {
      onComplete();
    }, 3400);

    return () => {
      timers.forEach(clearTimeout);
      clearTimeout(completeTimer);
    };
  }, [onComplete]);

  // Get user initials for backup avatar
  const displayName = fullName || username;
  const initials = displayName
    .split(' ')
    .map(n => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() || 'U';

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 1.05 }}
      transition={{ duration: 0.5, ease: "easeInOut" }}
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-slate-950/98 backdrop-blur-xl overflow-hidden select-none"
    >
      {/* Decorative High-End Cyber Ambiance Blobs */}
      <motion.div 
        animate={{ 
          scale: [1, 1.2, 0.9, 1.1, 1],
          x: [0, 40, -30, 20, 0],
          y: [0, -30, 40, -20, 0]
        }}
        transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
        className="absolute top-[-10%] left-[-10%] w-[50vw] h-[50vh] bg-emerald-500/10 rounded-full blur-[120px] pointer-events-none"
      />
      <motion.div 
        animate={{ 
          scale: [1, 0.9, 1.2, 1, 1.1],
          x: [0, -50, 20, -10, 0],
          y: [0, 40, -20, 50, 0]
        }}
        transition={{ duration: 18, repeat: Infinity, ease: "linear" }}
        className="absolute bottom-[-10%] right-[-10%] w-[55vw] h-[55vh] bg-blue-500/10 rounded-full blur-[140px] pointer-events-none"
      />

      {/* Futuristic Background Circles */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-30">
        <div className="w-[800px] h-[800px] border border-slate-900 rounded-full flex items-center justify-center">
          <div className="w-[600px] h-[600px] border border-slate-900/50 rounded-full flex items-center justify-center">
            <div className="w-[450px] h-[450px] border border-emerald-500/5 rounded-full" />
          </div>
        </div>
      </div>

      {/* Main Glassmorphism Console Body */}
      <motion.div 
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.6, type: "spring", damping: 25 }}
        className="relative z-10 flex flex-col items-center justify-center p-8 md:p-12 w-full max-w-xl mx-4"
      >
        {/* Holographic Interactive Avatar Frame */}
        <div className="relative flex items-center justify-center w-36 h-36 mb-8">
          {/* Animated decorative spinning rings */}
          <div className="absolute inset-0 border border-dashed border-emerald-500/30 rounded-full animate-[spin_16s_linear_infinite]" />
          <div className="absolute inset-1 border border-emerald-500/10 rounded-full" />
          <div className="absolute inset-2 border-2 border-transparent border-t-emerald-500/40 border-b-cyan-500/40 rounded-full animate-[spin_6s_linear_infinite]" />
          <div className="absolute inset-4 bg-slate-950/80 rounded-full shadow-[inset_0_0_20px_rgba(16,185,129,0.15)] backdrop-blur-md" />

          {/* User Profile avatar or dynamic initials */}
          <motion.div 
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.3, type: "spring", stiffness: 120 }}
            className="absolute inset-[18px] rounded-full overflow-hidden flex items-center justify-center border-2 border-emerald-500/30 shadow-[0_0_15px_rgba(16,185,129,0.2)] bg-gradient-to-br from-slate-900 to-emerald-950"
          >
            {profilePicture ? (
              <img 
                src={profilePicture} 
                alt={username} 
                className="w-full h-full object-cover" 
                referrerPolicy="no-referrer"
              />
            ) : (
              <span className="text-3xl font-black bg-gradient-to-r from-emerald-400 to-teal-200 bg-clip-text text-transparent tracking-wider">
                {initials}
              </span>
            )}
          </motion.div>

          {/* Micro pulsing online node anchor */}
          <div className="absolute bottom-1 right-1 flex h-4 w-4">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-4 w-4 bg-emerald-500 border-2 border-slate-950"></span>
          </div>
        </div>

        {/* Access badge & system info */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="inline-flex items-center gap-2 px-3 py-1 mb-3 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[10px] font-black tracking-[0.2em] text-emerald-400 uppercase"
        >
          <Sparkles size={10} className="animate-pulse text-emerald-300" />
          ISP ADMINISTRATIVE SHELL V4.0
        </motion.div>

        {/* Dynamic Greeting */}
        <div className="text-center space-y-1 mb-8">
          <motion.h2 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="text-white text-base font-medium tracking-[0.25em] text-slate-400 uppercase"
          >
            {greeting}
          </motion.h2>
          
          <motion.h1 
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6, type: "spring", damping: 15 }}
            className="text-4xl md:text-5xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-white via-emerald-100 to-emerald-400"
          >
            {displayName}
          </motion.h1>
        </div>

        {/* System Simulation Core Terminal Console */}
        <div className="w-full bg-slate-900/60 border border-slate-800/80 rounded-xl p-4 md:p-5 font-mono text-xs text-left shadow-2xl relative backdrop-blur-md overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-emerald-500/20 to-transparent" />
          
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-2 mb-3">
            <span className="text-slate-500 text-[10px] uppercase tracking-wider flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-ping" />
              SYSTEM CONSOLE BOOTLOG
            </span>
            <span className="text-emerald-500/60 text-[10px]">LOCAL://SYS.AUTH</span>
          </div>

          {/* Sequenced list of actions with smooth entrances */}
          <div className="space-y-2.5">
            {LOG_STEPS.map((step) => {
              const Icon = step.icon;
              const isDone = currentStep > step.id;
              const isActive = currentStep === step.id;
              
              return (
                <div 
                  key={step.id} 
                  className={`flex items-start gap-3 transition-all duration-300 ${
                    isDone ? 'text-emerald-400 font-medium' : isActive ? 'text-slate-200' : 'text-slate-600'
                  }`}
                >
                  <div className="mt-0.5 flex-shrink-0">
                    {isDone ? (
                      <CheckSquare size={13} className="text-emerald-400 fill-emerald-500/10" />
                    ) : isActive ? (
                      <motion.div 
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                      >
                        <Icon size={13} className="text-emerald-500" />
                      </motion.div>
                    ) : (
                      <div className="w-3.5 h-3.5 border border-slate-800 rounded-sm" />
                    )}
                  </div>
                  
                  <div className="flex-1 flex flex-col">
                    <span className="leading-tight">{step.text}</span>
                    {isActive && (
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: "100%" }}
                        transition={{ duration: 0.6 }}
                        className="h-[1px] bg-gradient-to-r from-emerald-500/30 to-transparent mt-1"
                      />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Global sleek progressive footer loading indicator bar */}
        <div className="w-full mt-8">
          <div className="flex items-center justify-between text-[10px] font-mono mb-1.5 text-slate-500">
            <span>ENVIRONMENT PREPARATION</span>
            <span>{Math.min(100, Math.floor((currentStep / LOG_STEPS.length) * 100))}%</span>
          </div>
          <div className="w-full h-1 bg-slate-900 rounded-full overflow-hidden">
            <motion.div 
              initial={{ width: "0%" }}
              animate={{ width: `${(currentStep / LOG_STEPS.length) * 100}%` }}
              transition={{ ease: "easeInOut", duration: 0.3 }}
              className="h-full bg-gradient-to-r from-emerald-500 to-cyan-400 rounded-full shadow-[0_0_8px_rgba(16,185,129,0.5)]"
            />
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

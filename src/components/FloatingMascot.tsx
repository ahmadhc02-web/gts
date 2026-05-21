import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { MessageSquare, Sparkles, Bell, Briefcase, Map as MapIcon } from 'lucide-react';
import { cn } from '../lib/utils';
import { BrandingConfig } from '../types';

interface FloatingMascotProps {
  onOpenChat: () => void;
  onNotificationClick: () => void;
  onServicesClick: () => void;
  onMapClick?: () => void;
  unseenMessages?: number;
  latestNotification?: string | null;
  branding?: BrandingConfig;
}

const FloatingMascot: React.FC<FloatingMascotProps> = ({ 
  onOpenChat, 
  onNotificationClick,
  onServicesClick,
  onMapClick,
  unseenMessages = 0,
  latestNotification = null,
  branding
}) => {
  // Position it on the left side, vertically centered
  const [position, setPosition] = useState({ x: -25, y: 50 }); // Start partially off-screen
  const [isMobile, setIsMobile] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth < 640;
      setIsMobile(mobile);
      // Center-left side
      setPosition({ x: -20, y: 50 });
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);
  const [speech, setSpeech] = useState<string | null>(null);
  const [isTalking, setIsTalking] = useState(false);
  const [showLatestNotif, setShowLatestNotif] = useState(false);
  const [showMenu, setShowMenu] = useState(false);

  // Sync talking with speech and handle 10s timeout for notifications
  useEffect(() => {
    if (latestNotification) {
      setShowLatestNotif(true);
      const timer = setTimeout(() => setShowLatestNotif(false), 10000); // Only show for 10 seconds
      return () => clearTimeout(timer);
    }
  }, [latestNotification]);

  useEffect(() => {
    if (speech || (showLatestNotif && latestNotification) || unseenMessages > 0) {
      setIsTalking(true);
      const timer = setTimeout(() => setIsTalking(false), 4000);
      return () => clearTimeout(timer);
    } else {
      setIsTalking(false);
    }
  }, [speech, latestNotification, showLatestNotif, unseenMessages]);

  // Random speech logic (Bot style)
  useEffect(() => {
    const messages = [
      "Links Optimized",
      "Network Stable",
      "GTS Online",
      "Standing by...",
      "Status: Excellent",
    ];

    const speechInterval = setInterval(() => {
      if (Math.random() > 0.7 && !showLatestNotif && unseenMessages === 0) {
        setSpeech(messages[Math.floor(Math.random() * messages.length)]);
        setTimeout(() => setSpeech(null), 10000); // 10 seconds duration for speech too
      }
    }, 15000);

    return () => clearInterval(speechInterval);
  }, [showLatestNotif, unseenMessages]);

  const displayMessage = (showLatestNotif && latestNotification) ? latestNotification : (unseenMessages > 0 ? `${unseenMessages} Unread Messages` : speech);

  if (branding?.hideBot) return null;

  const handleBubbleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (showLatestNotif && latestNotification) {
      onNotificationClick?.();
      setShowLatestNotif(false);
    } else if (unseenMessages > 0 || speech) {
      onOpenChat?.();
    }
  };

  return (
    <div className="fixed inset-0 pointer-events-none z-[9999] overflow-hidden">
      <motion.div
        animate={{ 
          left: 0, 
          top: `${position.y}%`,
          x: -20, // Peeking from the left wall
          scale: isHovered ? 1.15 : 1.1 
        }}
        transition={{ type: 'spring', stiffness: 300, damping: 25 }}
        className={cn(
          "absolute pointer-events-auto cursor-pointer group flex items-center",
          "origin-left"
        )}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onClick={() => setShowMenu(!showMenu)}
      >
        {/* Quick Actions Menu - Radial Style */}
        <AnimatePresence>
          {showMenu && (
            <motion.div
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.5 }}
              className="absolute left-4 w-32 h-32 flex items-center justify-center z-20 pointer-events-none"
            >
              {[
                { id: 'chat', label: 'Chat', icon: MessageSquare, color: 'from-blue-500 to-blue-600', action: onOpenChat, angle: -65 },
                { id: 'map', label: 'Map', icon: MapIcon, color: 'from-rose-500 to-orange-600', action: onMapClick, angle: -25 },
                { id: 'notif', label: 'Alerts', icon: Bell, color: 'from-emerald-500 to-teal-600', action: onNotificationClick, angle: 15 },
                { id: 'services', label: 'Services', icon: Briefcase, color: 'from-brand-accent to-blue-700', action: onServicesClick, angle: 55 }
              ].map((item, idx) => {
                const radius = 50; 
                const rad = (item.angle * Math.PI) / 180;
                const x = Math.cos(rad) * radius;
                const y = Math.sin(rad) * radius;

                return (
                  <motion.button
                    key={item.id}
                    initial={{ opacity: 0, x: 0, y: 0 }}
                    animate={{ opacity: 1, x, y }}
                    transition={{ 
                      type: 'spring', 
                      stiffness: 400, 
                      damping: 18,
                      delay: idx * 0.05 
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      item.action?.();
                      setShowMenu(false);
                    }}
                    className="absolute pointer-events-auto group/item flex flex-col items-center"
                  >
                    <div className={cn(
                      "w-10 h-10 rounded-full flex items-center justify-center text-white shadow-2xl transition-all",
                      "bg-gradient-to-br border border-white/40 backdrop-blur-md",
                      "group-hover/item:scale-110 group-hover/item:shadow-[0_0_15px_rgba(255,255,255,0.4)]",
                      item.color
                    )}>
                      <item.icon size={20} strokeWidth={2.5} />
                    </div>
                  </motion.button>
                );
              })}
            </motion.div>
          )}
        </AnimatePresence>

        {/* The AI Bot character Peeking */}
        <motion.div
          animate={{ 
            rotate: isHovered ? [0, 5, 0] : [0, 2, 0],
            x: isHovered ? 5 : 0
          }}
          transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
          className="relative flex items-center h-[60px]"
        >
          {/* Glowing Aura */}
          <div className="absolute left-0 w-20 h-20 bg-blue-500/10 blur-2xl rounded-full -translate-x-1/2" />

          {/* AI Bot Head (Peeking) */}
          <motion.div 
            className="relative z-20"
          >
            <div className="w-[50px] h-[45px] bg-white rounded-r-[2rem] rounded-l-[1rem] shadow-xl border-y border-r border-slate-100 flex items-center justify-center relative overflow-hidden">
              {/* Face Screen - Slightly angled */}
              <div className={cn(
                "w-[85%] h-[80%] bg-[#1A114E] rounded-r-[1.5rem] rounded-l-[0.5rem] flex flex-col items-center justify-center gap-1 border border-white/10 shadow-inner ml-[-5px]",
                latestNotification ? "bg-emerald-950" : ""
              )}>
                <div className="flex gap-2">
                  <motion.div 
                    animate={{ 
                      scale: isTalking ? [1, 1.3, 1] : [1, 1.1, 1], 
                    }} 
                    transition={{ duration: isTalking ? 0.3 : 3, repeat: Infinity }}
                    className={cn(
                      "w-1.5 h-1.5 rounded-full shadow-[0_0_8px_currentColor]",
                      latestNotification ? "text-emerald-300 bg-emerald-300" : "text-blue-300 bg-blue-300"
                    )} 
                  />
                  <motion.div 
                    animate={{ 
                      scale: isTalking ? [1, 1.3, 1] : [1, 1.1, 1], 
                    }} 
                    transition={{ duration: isTalking ? 0.3 : 3, repeat: Infinity, delay: 0.1 }}
                    className={cn(
                      "w-1.5 h-1.5 rounded-full shadow-[0_0_8px_currentColor]",
                      latestNotification ? "text-emerald-300 bg-emerald-300" : "text-blue-300 bg-blue-300"
                    )} 
                  />
                </div>
                {/* Mouth acting */}
                <motion.div 
                  animate={{ 
                    height: isTalking ? [2, 4, 2] : 1,
                    width: isTalking ? [5, 7, 5] : 3,
                  }}
                  className={cn(
                    "rounded-full bg-blue-300/50 mt-0.5",
                    latestNotification ? "bg-emerald-300/50" : ""
                  )} 
                />
              </div>
            </div>
            
            {/* Small Antenna peaking out */}
            <div className="absolute -top-1 -right-1 w-2 h-4 bg-white rounded-full rotate-[15deg] border-r border-slate-200" />
          </motion.div>

          {/* Chat indicator pinned to the head */}
          {unseenMessages > 0 && (
            <motion.div 
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="absolute -top-2 -right-2 z-30"
            >
              <div className="bg-rose-500 text-white w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold border-2 border-white shadow-lg">
                {unseenMessages}
              </div>
            </motion.div>
          )}
        </motion.div>

      </motion.div>
    </div>
  );
};

export default FloatingMascot;

import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause, Volume2 } from 'lucide-react';
import { cn } from '../lib/utils';
import { motion } from 'motion/react';

interface VoiceMsgPlayerProps {
  audioUrl: string;
  duration: number;
  isMe: boolean;
  isAudioMuted?: boolean;
}

export default function VoiceMsgPlayer({ audioUrl, duration, isMe, isAudioMuted = false }: VoiceMsgPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const audio = new Audio(audioUrl);
    audioRef.current = audio;

    audio.onended = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    audio.ontimeupdate = () => {
      setCurrentTime(audio.currentTime);
    };

    return () => {
      audio.pause();
      audioRef.current = null;
    };
  }, [audioUrl]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.muted = isAudioMuted;
    }
  }, [isAudioMuted]);

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex items-center gap-4 min-w-[200px] py-1">
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={togglePlay}
        className={cn(
          "w-11 h-11 rounded-2xl flex items-center justify-center transition-all shadow-md border active:shadow-inner",
          isMe 
            ? "bg-white/10 hover:bg-white/15 text-white border-white/20" 
            : "bg-blue-600/5 hover:bg-blue-600/10 text-blue-600 border-blue-600/10"
        )}
      >
        {isPlaying ? <Pause size={20} fill="currentColor" /> : <Play size={20} className="ml-1" fill="currentColor" />}
      </motion.button>
      
      <div className="flex-1">
        <div className="flex items-end gap-[3px] h-6 mb-2 px-1">
          {[...Array(24)].map((_, i) => {
            const progress = (currentTime / duration) * 24;
            const isActive = i <= progress;
            // More dynamic wave pattern
            const height = 15 + Math.abs(Math.sin(i * 0.7 + (isPlaying ? Date.now() / 200 : 0))) * 70; 
            return (
              <motion.div 
                key={'vmp-'+i} 
                animate={{ height: `${height}%` }}
                className={cn(
                  "flex-1 rounded-full transition-colors duration-200",
                  isActive 
                    ? (isMe ? "bg-white" : "bg-blue-600") 
                    : (isMe ? "bg-white/20" : "bg-slate-200 dark:bg-slate-800")
                )} 
              />
            );
          })}
        </div>
        <div className={cn(
          "flex justify-between text-[8px] font-black uppercase tracking-[0.25em] font-mono",
          isMe ? "text-white/50" : "text-slate-400 dark:text-slate-500"
        )}>
          <span className="tabular-nums">{formatTime(currentTime)}</span>
          <div className="flex items-center gap-1.5 opacity-50">
            <span className={cn(
              "w-1 h-1 rounded-full",
              isPlaying ? "bg-emerald-500 animate-ping" : (isMe ? "bg-white/40" : "bg-slate-400")
            )} />
            <span className="hidden xs:inline">DATA_STREAM</span>
          </div>
          <span className="tabular-nums">{formatTime(duration)}</span>
        </div>
      </div>
      
      <div className={cn(
        "p-2 rounded-xl border shrink-0",
        isMe ? "bg-white/5 border-white/10" : "bg-slate-50/50 dark:bg-slate-800/30 border-slate-200/50 dark:border-slate-800/50"
      )}>
        <Volume2 size={12} className={cn(isMe ? "text-white/30" : "text-slate-400")} />
      </div>
    </div>
  );
}


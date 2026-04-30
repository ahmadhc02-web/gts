import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause, Volume2 } from 'lucide-react';
import { cn } from '../lib/utils';

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
    <div className="flex items-center gap-3 min-w-[160px] py-1">
      <button
        onClick={togglePlay}
        className={cn(
          "w-8 h-8 rounded-full flex items-center justify-center transition-all",
          isMe 
            ? "bg-white/20 hover:bg-white/30 text-white" 
            : "bg-blue-600/10 hover:bg-blue-600/20 text-blue-600"
        )}
      >
        {isPlaying ? <Pause size={16} /> : <Play size={16} className="ml-0.5" />}
      </button>
      
      <div className="flex-1 space-y-1">
        <div className="flex items-center gap-1">
          <div className="flex-1 h-1 bg-current opacity-20 rounded-full overflow-hidden">
            <div 
              className="h-full bg-current" 
              style={{ width: `${(currentTime / duration) * 100}%`, opacity: 1 }}
            />
          </div>
        </div>
        <div className={cn(
          "flex justify-between text-[8px] font-black uppercase tracking-widest",
          isMe ? "text-white/70" : "text-slate-400"
        )}>
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>

      <Volume2 size={12} className={cn(isMe ? "text-white/50" : "text-slate-300")} />
    </div>
  );
}

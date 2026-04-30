import React, { useEffect, useRef, useState } from 'react';
import { Activity } from 'lucide-react';

interface MicVisualizerProps {
  isMuted: boolean;
  isAuthorized: boolean;
}

export default function MicVisualizer({ isMuted, isAuthorized }: MicVisualizerProps) {
  const [volume, setVolume] = useState(0);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationRef = useRef<number | null>(null);

  useEffect(() => {
    if (isAuthorized && !isMuted) {
      startVisualizer();
    } else {
      stopVisualizer();
    }

    return () => stopVisualizer();
  }, [isAuthorized, isMuted]);

  const startVisualizer = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      audioContextRef.current = audioContext;
      
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      analyserRef.current = analyser;
      
      const source = audioContext.createMediaStreamSource(stream);
      source.connect(analyser);
      
      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      
      const updateVolume = () => {
        if (!analyserRef.current) return;
        analyserRef.current.getByteFrequencyData(dataArray);
        
        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
          sum += dataArray[i];
        }
        const average = sum / bufferLength;
        setVolume(average);
        
        animationRef.current = requestAnimationFrame(updateVolume);
      };
      
      updateVolume();
    } catch (err) {
      console.error("Visualizer failed:", err);
    }
  };

  const stopVisualizer = () => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {});
    }
    setVolume(0);
  };

  if (!isAuthorized) return null;

  return (
    <div className="flex flex-col gap-2 mt-2">
      <div className="flex items-center justify-between">
        <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Signal Strength</span>
        <span className="text-[9px] font-mono text-slate-500">{Math.round((volume / 128) * 100)}%</span>
      </div>
      <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
        <div 
          className="h-full bg-blue-500 transition-all duration-75"
          style={{ width: `${Math.min(100, (volume / 128) * 100)}%` }}
        />
      </div>
    </div>
  );
}

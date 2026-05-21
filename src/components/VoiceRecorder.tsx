import React, { useState, useRef, useEffect } from 'react';
import { Mic, Square, Trash2, Send, Play, Pause } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { toast } from 'sonner';

interface VoiceRecorderProps {
  onSend: (audioBase64: string, duration: number) => void;
  onCancel: () => void;
  isAudioMuted?: boolean;
  isMicMuted?: boolean;
}

export default function VoiceRecorder({ onSend, onCancel, isAudioMuted = false, isMicMuted = false }: VoiceRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackTime, setPlaybackTime] = useState(0);
  const [visualizerData, setVisualizerData] = useState<number[]>(new Array(30).fill(4));
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      stopInternal();
    };
  }, []);

  const stopInternal = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    if (audioContextRef.current) audioContextRef.current.close();
  };

  const startRecording = async () => {
    if (isMicMuted) {
      toast.error("Microphone is currently deactivated in security settings.");
      onCancel();
      return;
    }
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Media Devices API not supported');
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // Setup Audio Visualizer
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 64;
      source.connect(analyser);
      
      audioContextRef.current = audioContext;
      analyserRef.current = analyser;

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      const updateVisualizer = () => {
        if (!analyserRef.current) return;
        analyserRef.current.getByteFrequencyData(dataArray);
        
        // Map frequency data to 30 bars
        const newData = Array.from(dataArray).slice(0, 30).map(val => Math.max(4, val / 4));
        setVisualizerData(newData);
        animationFrameRef.current = requestAnimationFrame(updateVisualizer);
      };
      updateVisualizer();

      // Determine supported mime type
      const mimeType = MediaRecorder.isTypeSupported('audio/webm') 
        ? 'audio/webm' 
        : MediaRecorder.isTypeSupported('audio/ogg') 
          ? 'audio/ogg' 
          : 'audio/mp4';

      const mediaRecorder = new MediaRecorder(stream, { 
        mimeType,
        audioBitsPerSecond: 32000 
      });
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          chunksRef.current.push(e.data);
          // console.log('Chunk received:', e.data.size);
        }
      };

      mediaRecorder.onstop = () => {
        // console.log('Recording stopped, total chunks:', chunksRef.current.length);
        if (chunksRef.current.length > 0) {
          const blob = new Blob(chunksRef.current, { type: mimeType });
          // console.log('Blob created:', blob.size, blob.type);
          setAudioBlob(blob);
        } else {
          console.error('No chunks collected during recording');
        }
        setIsRecording(false);
        if (timerRef.current) clearInterval(timerRef.current);
        stream.getTracks().forEach(track => track.stop());
        if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
        if (audioContextRef.current) audioContextRef.current.close();
      };

      mediaRecorder.start(1000); // Collect data every second
      setIsRecording(true);
      setRecordingTime(0);
      setAudioBlob(null);

      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    } catch (err: any) {
      console.error('Failed to start recording:', err instanceof Error ? err.message : String(err));
      let msg = 'Microphone access denied or hardware not found.';
      
      const errorString = err.toString().toLowerCase();
      const isNotFoundError = err.name === 'NotFoundError' || errorString.includes('notfounderror') || errorString.includes('requested device not found');
      const isNotAllowedError = err.name === 'NotAllowedError' || errorString.includes('notallowederror') || errorString.includes('permission denied');

      if (isNotFoundError) {
        msg = 'No microphone detected. Please connect a recording device and ensure it is enabled in your system settings.';
      } else if (isNotAllowedError) {
        msg = 'Microphone permission denied. Please allow access to your microphone in your browser settings to record voice messages.';
      } else {
        msg = `Could not start recording: ${err.message || 'Unknown error'}. Please check your microphone settings.`;
      }
      
      toast.error(msg);
      onCancel();
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
    }
  };

  const handleSend = () => {
    if (!audioBlob) {
      toast.error("No audio recorded.");
      return;
    }

    if (audioBlob.size > 800 * 1024) {
      toast.error("Voice message is too long (max ~1 min). Please try a shorter message.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const base64data = reader.result as string;
      onSend(base64data, recordingTime);
    };
    reader.onerror = () => {
      console.error("FileReader error");
      toast.error("Failed to process audio.");
    };
    reader.readAsDataURL(audioBlob);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const togglePlayback = () => {
    if (!audioBlob) return;
    
    if (!audioRef.current) {
      const url = URL.createObjectURL(audioBlob);
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onended = () => {
        setIsPlaying(false);
        setPlaybackTime(0);
      };
      audio.ontimeupdate = () => {
        setPlaybackTime(Math.floor(audio.currentTime));
      };
      
      // Inherit global mute state
      audio.muted = isAudioMuted;
    }

    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  useEffect(() => {
    startRecording();
  }, []);

  return (
    <motion.div 
      initial={{ y: 20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800"
    >
      <div className="flex-1 flex items-center gap-4 bg-white dark:bg-slate-950 rounded-xl px-4 py-2 border border-slate-200 dark:border-slate-800">
        {isRecording ? (
          <>
            <motion.div 
              animate={{ scale: [1, 1.2, 1], opacity: [1, 0.5, 1] }} 
              transition={{ repeat: Infinity, duration: 1 }}
              className="w-2.5 h-2.5 rounded-full bg-rose-500"
            />
            <span className="text-xs font-black font-mono text-slate-900 dark:text-white tabular-nums">
              {formatTime(recordingTime)}
            </span>
            <div className="flex-1 overflow-hidden h-8 flex items-center justify-center gap-0.5 px-2">
              {visualizerData.map((val, i) => (
                <div 
                  key={'vr-'+i}
                  style={{ height: `${val}px` }}
                  className="w-1 bg-blue-500 rounded-full transition-all duration-75"
                />
              ))}
            </div>
            <button 
              onClick={stopRecording}
              className="p-2 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-lg transition-all"
            >
              <Square size={18} fill="currentColor" />
            </button>
          </>
        ) : (
          <>
            <button 
              onClick={togglePlayback}
              className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-all"
            >
              {isPlaying ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" className="ml-0.5" />}
            </button>
            <span className="text-xs font-black font-mono text-slate-900 dark:text-white tabular-nums">
              {formatTime(isPlaying ? playbackTime : recordingTime)}
            </span>
            <div className="flex-1 relative h-1 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
               <div 
                 className="absolute top-0 left-0 h-full bg-blue-500 transition-all duration-100" 
                 style={{ width: `${(playbackTime / (recordingTime || 1)) * 100}%` }}
               />
            </div>
          </>
        )}
      </div>

      <div className="flex items-center gap-2">
        <button 
          onClick={onCancel}
          className="p-3 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-xl transition-all"
          title="Discard"
        >
          <Trash2 size={20} />
        </button>
        {!isRecording && audioBlob && (
          <button 
            onClick={handleSend}
            className="p-3 bg-blue-600 text-white rounded-xl shadow-lg shadow-blue-600/20 hover:bg-blue-700 transition-all active:scale-95"
            title="Send Tactical Audio"
          >
            <Send size={20} fill="currentColor" />
          </button>
        )}
      </div>
    </motion.div>
  );
}

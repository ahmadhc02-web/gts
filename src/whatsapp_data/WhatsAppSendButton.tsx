import React, { useState, useEffect, useMemo } from 'react';
import { MessageCircle, Loader2, Check, X, Clock } from 'lucide-react';
import { getStatus, getTemplate, sendMessage } from './whatsappApi';
import { buildReminderMessage } from './messageBuilder';
import { useReminderCooldown, startReminderCooldown, REMINDER_COOLDOWN_SECONDS } from './reminderCooldown';
import { cn } from '../lib/utils';
import { toast } from 'sonner';

interface Props {
  name: string;
  mobileNumber: string;
  totalAmount?: number | string;
  baseAmount?: number | string;
  paymentStatus: string;
  username: string;
  area: string;
  reminderSentAt?: string | number | null;
  reminderSentCount?: number;
  onReminderSent?: (newCount: number, sentAtIso: string) => void;
  onSent?: () => void;
}

// Simple in-memory cache to avoid refetching template and status on every button render
let cachedTemplate: string | null = null;
let cachedStatus: boolean | null = null;

export default function WhatsAppSendButton({
  name,
  mobileNumber,
  totalAmount,
  baseAmount,
  paymentStatus,
  username,
  area,
  reminderSentAt,
  reminderSentCount = 0,
  onReminderSent,
  onSent
}: Props) {
  const [isSending, setIsSending] = useState(false);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [isReady, setIsReady] = useState(cachedStatus === true);

  // Unique trigger key for this specific row button
  const buttonKey = `${username || ''}_${mobileNumber || ''}_${name || ''}`;
  const { remainingSec, isCooldownActive, isCurrentTrigger } = useReminderCooldown(buttonKey);

  // Permanent local tracking to ensure immediate and permanent blue color on click
  const localSentKey = `gts_wa_reminder_sent_${buttonKey}`;
  const localCountKey = `gts_wa_reminder_count_${buttonKey}`;

  const [localSentAt, setLocalSentAt] = useState<number | null>(() => {
    try {
      const saved = localStorage.getItem(localSentKey);
      if (saved) {
        const t = parseInt(saved, 10);
        if (!isNaN(t) && t > 0) return t;
      }
    } catch (e) {}
    return null;
  });

  const [localCount, setLocalCount] = useState<number>(() => {
    try {
      const saved = localStorage.getItem(localCountKey);
      if (saved) {
        const c = parseInt(saved, 10);
        if (!isNaN(c) && c > 0) return c;
      }
    } catch (e) {}
    return 0;
  });

  // Calculate permanent reminded state and permanent count badge
  const isReminded = useMemo(() => {
    return Number(reminderSentCount || 0) > 0 || Boolean(reminderSentAt) || Boolean(localSentAt) || localCount > 0;
  }, [reminderSentCount, reminderSentAt, localSentAt, localCount]);

  const displayCount = useMemo(() => {
    const dbCount = Number(reminderSentCount || 0);
    const locCount = Number(localCount || 0);
    const highestCount = Math.max(dbCount, locCount);
    if (highestCount > 0) return highestCount;
    if (localSentAt || reminderSentAt) return 1;
    return 0;
  }, [reminderSentCount, localCount, localSentAt, reminderSentAt]);

  useEffect(() => {
    // Check if connected when component mounts if we don't know yet
    if (cachedStatus === null) {
      getStatus().then(data => {
        cachedStatus = data.connected;
        setIsReady(data.connected);
      }).catch(() => {});
    }
    if (cachedTemplate === null) {
      getTemplate().then(data => {
        cachedTemplate = data.template;
      }).catch(() => {});
    }

    let intervalId: ReturnType<typeof setInterval>;
    if (cachedStatus !== true) {
      intervalId = setInterval(() => {
        getStatus().then(data => {
          if (data.connected) {
            cachedStatus = true;
            setIsReady(true);
            clearInterval(intervalId);
          }
        }).catch(() => {});
      }, 15000);
    }

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, []);

  const handleSend = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isCooldownActive) {
      toast.warning(`Please wait ${remainingSec}s before sending another reminder.`);
      return;
    }
    if (!mobileNumber) {
      toast.error('No mobile number available for this client');
      return;
    }
    if (!cachedStatus) {
      toast.error('WhatsApp is not connected. Please connect it from the top menu first.');
      return;
    }

    setIsSending(true);
    setStatus('idle');
    // Start global 60-second cooldown immediately across all rows
    startReminderCooldown(buttonKey, REMINDER_COOLDOWN_SECONDS);

    // Turn button permanently blue and increment count immediately
    const nowMs = Date.now();
    const newCount = Math.max(Number(reminderSentCount || 0), Number(localCount || 0)) + 1;
    try {
      localStorage.setItem(localSentKey, nowMs.toString());
      localStorage.setItem(localCountKey, newCount.toString());
    } catch (err) {}
    setLocalSentAt(nowMs);
    setLocalCount(newCount);

    try {
      // Ensure we have the template
      if (!cachedTemplate) {
        const data = await getTemplate();
        cachedTemplate = data.template;
      }

      // Build message using shared helper
      const message = buildReminderMessage(cachedTemplate || '', {
        name,
        totalAmount,
        baseAmount,
        username,
        paymentStatus,
        area
      });

      await sendMessage(mobileNumber, message);
      
      const nowIso = new Date(nowMs).toISOString();
      setStatus('success');
      toast.success(`Message sent to ${name} (Reminder button permanently marked blue)`);
      onReminderSent?.(newCount, nowIso);
      onSent?.();
    } catch (err: any) {
      console.error('Failed to send WhatsApp message', err);
      setStatus('error');
      toast.error(`Failed: ${err.message || 'Unknown error'}`);
    } finally {
      setIsSending(false);
      setTimeout(() => setStatus('idle'), 2500);
    }
  };

  // Cooldown active on a different row: Blur this row's send button completely
  if (isCooldownActive && !isCurrentTrigger) {
    return (
      <div
        className="relative inline-flex items-center justify-center cursor-not-allowed select-none"
        title={`Cooldown active: Please wait ${remainingSec}s before sending next WhatsApp reminder.`}
      >
        <button
          type="button"
          disabled={true}
          tabIndex={-1}
          className={cn(
            "p-1 rounded filter blur-[1.5px] opacity-30 pointer-events-none select-none transition-all duration-300 relative flex items-center justify-center border",
            isReminded
              ? "text-blue-600 dark:text-blue-400 bg-blue-100/90 dark:bg-blue-950/70 border-blue-400/80 dark:border-blue-600/80"
              : "text-slate-400 dark:text-slate-600 bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800"
          )}
        >
          <MessageCircle size={14} />
          {displayCount > 0 && (
            <span className="absolute -top-1 -right-1 min-w-[13px] h-[13px] px-0.5 text-[8.5px] font-black leading-none flex items-center justify-center rounded-full text-white shadow-xs pointer-events-none select-none bg-blue-600">
              {displayCount}
            </span>
          )}
        </button>
      </div>
    );
  }

  // Cooldown active on THIS row: show active countdown timer & status
  if (isCurrentTrigger && remainingSec > 0) {
    return (
      <button
        type="button"
        disabled={true}
        className="px-1.5 py-0.5 rounded-md transition-all relative flex items-center justify-center gap-1 text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/80 border border-blue-400 dark:border-blue-600 shadow-xs cursor-wait select-none ring-1 ring-blue-500/30"
        title={`Reminder dispatched. Cooldown active: ${remainingSec}s remaining before next send.`}
      >
        {isSending ? (
          <Loader2 size={12} className="animate-spin text-blue-600 dark:text-blue-400 shrink-0" />
        ) : status === 'success' ? (
          <Check size={12} className="text-emerald-500 shrink-0" />
        ) : status === 'error' ? (
          <X size={12} className="text-rose-500 shrink-0" />
        ) : (
          <Clock size={11} className="animate-spin text-blue-500 shrink-0" style={{ animationDuration: '4s' }} />
        )}
        <span className="text-[9.5px] font-black font-mono leading-none tracking-tight">
          {remainingSec}s
        </span>
      </button>
    );
  }

  if (!isReady && status === 'idle') {
    return (
      <button
        type="button"
        title="WhatsApp not connected"
        onClick={(e) => {
          e.stopPropagation();
          toast.info('Please connect WhatsApp from the top menu first.');
        }}
        className={cn(
          "p-1 rounded cursor-not-allowed transition-colors relative border",
          isReminded
            ? "text-blue-400 dark:text-blue-600 bg-blue-50/50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-900"
            : "text-slate-300 dark:text-slate-600 border-transparent"
        )}
      >
        <MessageCircle size={14} />
      </button>
    );
  }

  return (
    <button
      type="button"
      disabled={isSending || status !== 'idle'}
      onClick={handleSend}
      className={cn(
        "p-1 rounded transition-all duration-300 disabled:opacity-80 relative flex items-center justify-center border",
        status === 'success' ? 'text-emerald-500 bg-emerald-50 dark:bg-emerald-500/10 border-emerald-300 dark:border-emerald-700' :
        status === 'error' ? 'text-rose-500 bg-rose-50 dark:bg-rose-500/10 border-rose-300 dark:border-rose-700' :
        isReminded
          ? 'text-blue-600 dark:text-blue-300 bg-blue-100/90 dark:bg-blue-900/40 hover:bg-blue-200 dark:hover:bg-blue-800/60 border-blue-400 dark:border-blue-600 shadow-xs ring-1 ring-blue-500/30'
          : 'text-emerald-600 dark:text-emerald-400 bg-emerald-50/80 dark:bg-emerald-500/10 hover:bg-emerald-100 dark:hover:bg-emerald-500/20 border-emerald-200/80 dark:border-emerald-800/60'
      )}
      title={isReminded ? `Reminder sent (${displayCount} times)` : "Send WhatsApp Reminder"}
    >
      {isSending ? (
        <Loader2 size={14} className="animate-spin" />
      ) : status === 'success' ? (
        <Check size={14} />
      ) : status === 'error' ? (
        <X size={14} />
      ) : (
        <MessageCircle size={14} />
      )}

      {displayCount > 0 && (
        <span className="absolute -top-1 -right-1 min-w-[13px] h-[13px] px-0.5 text-[8.5px] font-black leading-none flex items-center justify-center rounded-full text-white shadow-xs ring-1 ring-white dark:ring-slate-900 pointer-events-none select-none bg-blue-600">
          {displayCount}
        </span>
      )}
    </button>
  );
}

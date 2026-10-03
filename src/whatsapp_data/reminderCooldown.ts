import { useState, useEffect } from 'react';

const COOLDOWN_KEY = 'gts_wa_reminder_cooldown_until';
const TRIGGER_KEY = 'gts_wa_reminder_active_key';
export const REMINDER_COOLDOWN_SECONDS = 60; // 60 seconds cooldown to protect WhatsApp accounts

type CooldownListener = (state: { remainingSec: number; activeTriggerKey: string | null }) => void;
const listeners = new Set<CooldownListener>();
let timerInterval: any = null;

function getStoredCooldown(): { remainingSec: number; activeTriggerKey: string | null } {
  try {
    const storedUntil = localStorage.getItem(COOLDOWN_KEY);
    const triggerKey = localStorage.getItem(TRIGGER_KEY);
    if (storedUntil) {
      const until = parseInt(storedUntil, 10);
      const remaining = Math.max(0, Math.ceil((until - Date.now()) / 1000));
      if (remaining > 0) {
        return { remainingSec: remaining, activeTriggerKey: triggerKey };
      }
    }
  } catch (e) {}
  return { remainingSec: 0, activeTriggerKey: null };
}

function notifyListeners() {
  const state = getStoredCooldown();
  listeners.forEach((cb) => {
    try {
      cb(state);
    } catch (e) {}
  });

  if (state.remainingSec <= 0 && timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
    try {
      localStorage.removeItem(COOLDOWN_KEY);
      localStorage.removeItem(TRIGGER_KEY);
    } catch (e) {}
  }
}

function startTimerIfNeeded() {
  if (timerInterval) return;
  const state = getStoredCooldown();
  if (state.remainingSec > 0) {
    timerInterval = setInterval(() => {
      notifyListeners();
    }, 1000);
  }
}

export function startReminderCooldown(triggerKey: string, seconds: number = REMINDER_COOLDOWN_SECONDS) {
  const until = Date.now() + seconds * 1000;
  try {
    localStorage.setItem(COOLDOWN_KEY, until.toString());
    localStorage.setItem(TRIGGER_KEY, triggerKey);
  } catch (e) {}
  startTimerIfNeeded();
  notifyListeners();
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('wa-cooldown-changed'));
  }
}

export function useReminderCooldown(currentKey?: string) {
  const [cooldown, setCooldown] = useState(() => getStoredCooldown());

  useEffect(() => {
    startTimerIfNeeded();
    const handleUpdate = (state: { remainingSec: number; activeTriggerKey: string | null }) => {
      setCooldown(state);
    };
    listeners.add(handleUpdate);

    const handleStorage = (e: StorageEvent) => {
      if (e.key === COOLDOWN_KEY || e.key === TRIGGER_KEY) {
        setCooldown(getStoredCooldown());
        startTimerIfNeeded();
      }
    };

    const handleCustom = () => {
      setCooldown(getStoredCooldown());
      startTimerIfNeeded();
    };

    window.addEventListener('storage', handleStorage);
    window.addEventListener('wa-cooldown-changed', handleCustom);

    return () => {
      listeners.delete(handleUpdate);
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('wa-cooldown-changed', handleCustom);
    };
  }, []);

  const isCooldownActive = cooldown.remainingSec > 0;
  const isCurrentTrigger = Boolean(currentKey && cooldown.activeTriggerKey === currentKey);

  return {
    remainingSec: cooldown.remainingSec,
    isCooldownActive,
    isCurrentTrigger,
    activeTriggerKey: cooldown.activeTriggerKey
  };
}

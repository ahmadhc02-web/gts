import { CACHE_MAX_AGE_MS } from '../../lib/supabaseService';

type StorageKind = 'local' | 'session';

interface PendingWriteEntry {
  key: string;
  valueOrFactory: string | (() => string);
  withMeta?: boolean;
  storage: StorageKind;
  timer: ReturnType<typeof setTimeout>;
}

const STORAGE_DEBOUNCE_MS = 400;
const pendingWrites = new Map<string, PendingWriteEntry>();
let listenersRegistered = false;
let cachedPerfEnabled: boolean | null = null;

function getStorage(kind: StorageKind): Storage | null {
  if (typeof window === 'undefined') return null;
  try {
    return kind === 'session' ? window.sessionStorage : window.localStorage;
  } catch {
    return null;
  }
}

export function safeGetStorageItem(key: string, kind: StorageKind = 'local'): string | null {
  const storage = getStorage(kind);
  if (!storage) return null;
  try {
    return storage.getItem(key);
  } catch {
    return null;
  }
}

export function safeSetStorageItem(key: string, value: string, kind: StorageKind = 'local'): void {
  const storage = getStorage(kind);
  if (!storage) return;
  try {
    storage.setItem(key, value);
  } catch {
    // ignore quota or privacy-mode errors
  }
}

export function safeRemoveStorageItem(key: string, kind: StorageKind = 'local'): void {
  const pendingKey = `${kind}:${key}`;
  const pending = pendingWrites.get(pendingKey);
  if (pending) {
    clearTimeout(pending.timer);
    pendingWrites.delete(pendingKey);
  }
  const storage = getStorage(kind);
  if (!storage) return;
  try {
    storage.removeItem(key);
  } catch {
    // ignore storage errors
  }
}

export function getValidCacheItem(key: string): string | null {
  try {
    const meta = safeGetStorageItem(`gts_cache_meta_${key}`);
    if (!meta) return null;
    const metaTime = Number(meta);
    if (!metaTime || isNaN(metaTime) || Date.now() - metaTime > CACHE_MAX_AGE_MS) {
      return null;
    }
    return safeGetStorageItem(key);
  } catch {
    return null;
  }
}

function executePendingWrite(entry: PendingWriteEntry): void {
  try {
    const resolved =
      typeof entry.valueOrFactory === 'function'
        ? entry.valueOrFactory()
        : entry.valueOrFactory;
    safeSetStorageItem(entry.key, resolved, entry.storage);
    if (entry.withMeta) {
      safeSetStorageItem(`gts_cache_meta_${entry.key}`, String(Date.now()), entry.storage);
    }
  } catch {
    // ignore serialization / storage errors
  }
}

export function registerStorageFlushListeners(): void {
  if (listenersRegistered || typeof window === 'undefined') return;
  listenersRegistered = true;
  const onUnload = () => {
    flushPendingStorageWrites();
  };
  try {
    window.addEventListener('beforeunload', onUnload);
    window.addEventListener('pagehide', onUnload);
  } catch {
    // ignore
  }
}

export function flushPendingStorageWrites(): void {
  if (pendingWrites.size === 0) return;
  const entries = Array.from(pendingWrites.entries());
  pendingWrites.clear();
  for (const [, entry] of entries) {
    clearTimeout(entry.timer);
    executePendingWrite(entry);
  }
}

export function debouncedSetStorageItem(
  key: string,
  valueOrFactory: string | (() => string),
  kind: StorageKind = 'local',
  delayMs: number = STORAGE_DEBOUNCE_MS
): void {
  registerStorageFlushListeners();
  const pendingKey = `${kind}:${key}`;
  const existing = pendingWrites.get(pendingKey);
  if (existing) {
    clearTimeout(existing.timer);
  }
  const timer = setTimeout(() => {
    const current = pendingWrites.get(pendingKey);
    if (current) {
      pendingWrites.delete(pendingKey);
      executePendingWrite(current);
    }
  }, delayMs);

  pendingWrites.set(pendingKey, {
    key,
    valueOrFactory,
    withMeta: false,
    storage: kind,
    timer,
  });
}

export function setCachedItemWithMeta(
  key: string,
  valueOrFactory: string | (() => string),
  delayMs: number = STORAGE_DEBOUNCE_MS
): void {
  registerStorageFlushListeners();
  const pendingKey = `local:${key}`;
  const existing = pendingWrites.get(pendingKey);
  if (existing) {
    clearTimeout(existing.timer);
  }
  const timer = setTimeout(() => {
    const current = pendingWrites.get(pendingKey);
    if (current) {
      pendingWrites.delete(pendingKey);
      executePendingWrite(current);
    }
  }, delayMs);

  pendingWrites.set(pendingKey, {
    key,
    valueOrFactory,
    withMeta: true,
    storage: 'local',
    timer,
  });
}

export function logPerf(label: string, startMs: number): void {
  if (typeof window === 'undefined') return;
  if (cachedPerfEnabled === null) {
    cachedPerfEnabled = safeGetStorageItem('gts_perf') === '1';
  }
  if (cachedPerfEnabled) {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const ms = (performance.now() - startMs).toFixed(1);
        console.log(`[EntrySheet perf] ${label} ${ms}ms`);
      });
    });
  }
}

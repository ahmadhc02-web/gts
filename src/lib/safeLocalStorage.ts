// safeLocalStorage.ts: A resilient in-memory fallback for localStorage in sandboxed environments (like Hugging Face Space iframes)

const inMemoryStore: Record<string, string> = {};

export const safeLocalStorage = {
  getItem: (key: string): string | null => {
    try {
      if (typeof window !== 'undefined' && 'localStorage' in window) {
        return window.localStorage.getItem(key);
      }
    } catch (e) {
      console.warn(`[SafeStorage] Read failed for key "${key}" under sandboxing, using in-memory:`, e);
    }
    return inMemoryStore[key] !== undefined ? inMemoryStore[key] : null;
  },

  setItem: (key: string, value: string): void => {
    try {
      if (typeof window !== 'undefined' && 'localStorage' in window) {
        window.localStorage.setItem(key, value);
        return;
      }
    } catch (e) {
      console.warn(`[SafeStorage] Write failed for key "${key}" under sandboxing, using in-memory:`, e);
    }
    inMemoryStore[key] = String(value);
  },

  removeItem: (key: string): void => {
    try {
      if (typeof window !== 'undefined' && 'localStorage' in window) {
        window.localStorage.removeItem(key);
        return;
      }
    } catch (e) {
      console.warn(`[SafeStorage] Delete failed for key "${key}" under sandboxing, using in-memory:`, e);
    }
    delete inMemoryStore[key];
  },

  clear: (): void => {
    try {
      if (typeof window !== 'undefined' && 'localStorage' in window) {
        window.localStorage.clear();
        return;
      }
    } catch (e) {
      console.warn("[SafeStorage] Clear failed under sandboxing, using in-memory:", e);
    }
    for (const key in inMemoryStore) {
      delete inMemoryStore[key];
    }
  }
};

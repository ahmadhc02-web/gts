// safeLocalStorage.ts: A resilient multi-tier persistence layer (localStorage + document.cookie + in-memory) for sandboxed Hugging Face Space iframes

const inMemoryStore: Record<string, string> = {};

function getCookie(name: string): string | null {
  try {
    if (typeof document === 'undefined') return null;
    const match = document.cookie.match(new RegExp('(^| )' + encodeURIComponent(name) + '=([^;]+)'));
    return match ? decodeURIComponent(match[2]) : null;
  } catch (e) {
    return null;
  }
}

function setCookie(name: string, value: string, days: number = 365): void {
  try {
    if (typeof document === 'undefined') return;
    const expires = new Date(Date.now() + days * 864e5).toUTCString();
    document.cookie = `${encodeURIComponent(name)}=${encodeURIComponent(value)}; expires=${expires}; path=/; SameSite=Lax`;
  } catch (e) {}
}

function removeCookie(name: string): void {
  try {
    if (typeof document === 'undefined') return;
    document.cookie = `${encodeURIComponent(name)}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; SameSite=Lax`;
  } catch (e) {}
}

export const safeLocalStorage = {
  getItem: (key: string): string | null => {
    try {
      if (typeof window !== 'undefined' && 'localStorage' in window) {
        const val = window.localStorage.getItem(key);
        if (val !== null) return val;
      }
    } catch (e) {
      console.warn(`[SafeStorage] Read failed for key "${key}" under sandboxing:`, e);
    }
    // Fallback 1: Cookie
    const cookieVal = getCookie(key);
    if (cookieVal !== null) return cookieVal;

    // Fallback 2: Memory
    return inMemoryStore[key] !== undefined ? inMemoryStore[key] : null;
  },

  setItem: (key: string, value: string): void => {
    const strVal = String(value);
    inMemoryStore[key] = strVal;
    setCookie(key, strVal, 365);

    try {
      if (typeof window !== 'undefined' && 'localStorage' in window) {
        window.localStorage.setItem(key, strVal);
      }
    } catch (e) {
      console.warn(`[SafeStorage] Write failed for key "${key}" under sandboxing:`, e);
    }
  },

  removeItem: (key: string): void => {
    delete inMemoryStore[key];
    removeCookie(key);

    try {
      if (typeof window !== 'undefined' && 'localStorage' in window) {
        window.localStorage.removeItem(key);
      }
    } catch (e) {
      console.warn(`[SafeStorage] Delete failed for key "${key}" under sandboxing:`, e);
    }
  },

  clear: (): void => {
    for (const key in inMemoryStore) {
      delete inMemoryStore[key];
    }
    try {
      if (typeof window !== 'undefined' && 'localStorage' in window) {
        window.localStorage.clear();
      }
    } catch (e) {
      console.warn("[SafeStorage] Clear failed under sandboxing:", e);
    }
  }
};

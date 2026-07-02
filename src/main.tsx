import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';

// Globals polyfill for sandboxed iframe environments (like Hugging Face)
if (typeof window !== 'undefined') {
  const checkStorage = (type: 'localStorage' | 'sessionStorage') => {
    try {
      const storage = window[type];
      if (storage) {
        storage.getItem('__test_sandbox__');
      }
    } catch (e) {
      console.warn(`[Sandbox Polyfill] ${type} is blocked by browser policies. Activating resilient in-memory fallback.`, e);
      try {
        const fallbackStore: Record<string, string> = {};
        const fallbackStorage = {
          getItem: (key: string): string | null => {
            return fallbackStore[key] !== undefined ? fallbackStore[key] : null;
          },
          setItem: (key: string, value: string): void => {
            fallbackStore[key] = String(value);
          },
          removeItem: (key: string): void => {
            delete fallbackStore[key];
          },
          clear: (): void => {
            for (const key in fallbackStore) {
              delete fallbackStore[key];
            }
          },
          key: (index: number): string | null => {
            const keys = Object.keys(fallbackStore);
            return keys[index] || null;
          },
          get length(): number {
            return Object.keys(fallbackStore).length;
          }
        };

        Object.defineProperty(window, type, {
          value: fallbackStorage,
          writable: true,
          configurable: true,
          enumerable: true
        });
      } catch (err) {
        console.error(`[Sandbox Polyfill] Failed to redefine window.${type}:`, err);
      }
    }
  };

  checkStorage('localStorage');
  checkStorage('sessionStorage');
}

import App from './App.tsx';
import './index.css';

// Safely format objects with circular references to prevent framework crashes
const safeFormat = (arg: any): any => {
  if (arg === undefined || arg === null) return arg;
  if (typeof arg !== 'object') return arg;
  if (arg instanceof Error) {
    return {
      name: arg.name,
      message: arg.message,
      stack: arg.stack,
    };
  }
  const seen = new WeakSet();
  try {
    return JSON.parse(
      JSON.stringify(arg, (key, value) => {
        if (typeof value === 'object' && value !== null) {
          if (seen.has(value)) return '[Circular]';
          seen.add(value);
        }
        return value;
      })
    );
  } catch (e) {
    return '[Unserializable Object]';
  }
};

const patchConsole = (method: 'log' | 'warn' | 'error' | 'info') => {
  const original = console[method];
  if (original) {
    console[method] = function (...args: any[]) {
      const sanitized = args.map(arg => {
        try {
          return safeFormat(arg);
        } catch (e) {
          return '[Formatting Error]';
        }
      });
      original.apply(console, sanitized);
    };
  }
};

patchConsole('log');
patchConsole('warn');
patchConsole('error');
patchConsole('info');

import {safeLocalStorage} from './lib/safeLocalStorage';

// Force clear stale service worker cache once to bypass previous OAuth popup interception issue
if (typeof window !== 'undefined' && typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
  const isSwFixed = safeLocalStorage.getItem('gts_sw_v2_fixed');
  if (!isSwFixed) {
    navigator.serviceWorker.getRegistrations().then(registrations => {
      if (registrations.length > 0) {
        for (const registration of registrations) {
          registration.unregister();
        }
        safeLocalStorage.setItem('gts_sw_v2_fixed', 'true');
        console.log("Stale Service Worker successfully unregistered for API bypass.");
        window.location.reload();
      } else {
        safeLocalStorage.setItem('gts_sw_v2_fixed', 'true');
      }
    }).catch(err => {
      console.error("Service worker unregistration error:", err);
    });
  }
}

import { registerSW } from 'virtual:pwa-register';

// Register Service Worker with automatic updates
const updateSW = registerSW({
  onNeedRefresh() {
    console.log('New content available, please refresh.');
  },
  onOfflineReady() {
    console.log('Application ready for offline use.');
  },
});

let shouldRender = true;
if (typeof window !== 'undefined') {
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('google_oauth_success') === 'true') {
    shouldRender = false;
    const tokensStr = urlParams.get('tokens');
    if (tokensStr) {
      try {
        const tokens = JSON.parse(decodeURIComponent(tokensStr));
        safeLocalStorage.setItem('gts_sync_google_tokens_direct', JSON.stringify(tokens));
        if (window.opener) {
          window.opener.postMessage({ type: 'google-oauth-success', tokens: tokens }, '*');
        }
        console.log("OAuth credentials captured from URL state on client origin.");
      } catch (err) {
        console.error("Popup token parsing error:", err);
      }
    }
    try {
      window.close();
    } catch (e) {}
  }
}

if (shouldRender) {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}

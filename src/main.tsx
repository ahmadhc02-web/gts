import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import { toast } from 'sonner';
import { getActiveTheme, applyThemeToDOM } from './hooks/useTheme.ts';
import App from './App.tsx';
import './index.css';

// Ensure active theme is applied to DOM before render
try {
  applyThemeToDOM(getActiveTheme());
} catch (e) {}

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

// Force clear stale old-format cache keys (without line_code) to fix data isolation flicker
if (typeof window !== 'undefined' && typeof window.localStorage !== 'undefined') {
  const isLineCodeCacheMigrated = window.localStorage.getItem('gts_cache_v3_linecode_migration_done');
  if (!isLineCodeCacheMigrated) {
    try {
      const keysToRemove: string[] = [];
      for (let i = 0; i < window.localStorage.length; i++) {
        const key = window.localStorage.key(i);
        if (key && key.startsWith('gts_cache_v3_')) {
          // If the key doesn't clearly end with a known line code marker (we can just clear all of them safely to force a fresh fetch)
          // Since this runs before the app renders, any gts_cache_v3_ key here is from a previous version.
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(k => window.localStorage.removeItem(k));
      window.localStorage.setItem('gts_cache_v3_linecode_migration_done', 'true');
      console.log(`Cleared ${keysToRemove.length} old cache keys for line_code isolation migration.`);
    } catch (e) {
      console.error("Cache migration error:", e);
    }
  }
}


// Ensure complete service worker bypass and cache purge in development mode
if (typeof window !== 'undefined' && typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
  try {
    navigator.serviceWorker.register = () => {
      return Promise.reject(new Error('Service Worker registration disabled in development mode.'));
    };
  } catch (e) {}

  navigator.serviceWorker.getRegistrations().then(registrations => {
    for (const registration of registrations) {
      registration.unregister();
    }
  }).catch(() => {});

  if ('caches' in window) {
    caches.keys().then(keys => {
      for (const key of keys) {
        caches.delete(key);
      }
    }).catch(() => {});
  }
}

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

import { BrowserRouter } from 'react-router-dom';
import { LoadingProvider } from './contexts/LoadingContext.tsx';

if (shouldRender) {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <BrowserRouter>
        <LoadingProvider>
          <App />
        </LoadingProvider>
      </BrowserRouter>
    </StrictMode>,
  );
}

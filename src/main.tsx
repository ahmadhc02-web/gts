import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
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

// Force clear stale service worker and caches once to migrate to prompt-mode PWA
if (typeof window !== 'undefined' && typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
  const isSwPromptMigrated = safeLocalStorage.getItem('gts_sw_v3_prompt_migration_done');
  if (!isSwPromptMigrated) {
    navigator.serviceWorker.getRegistrations().then(registrations => {
      if (registrations.length > 0) {
        const unregisterPromises = registrations.map(registration => registration.unregister());
        Promise.all(unregisterPromises).then(() => {
          if ('caches' in window) {
            caches.keys().then(keys => {
              Promise.all(keys.map(key => caches.delete(key))).then(() => {
                safeLocalStorage.setItem('gts_sw_v3_prompt_migration_done', 'true');
                console.log("Stale Service Worker and caches fully purged for prompt migration.");
                window.location.reload();
              });
            });
          } else {
            safeLocalStorage.setItem('gts_sw_v3_prompt_migration_done', 'true');
            (window as any).location.reload();
          }
        });
      } else {
        safeLocalStorage.setItem('gts_sw_v3_prompt_migration_done', 'true');
      }
    }).catch(err => {
      console.error("Service worker v3 migration error:", err);
    });
  }
}

// Register Service Worker with prompt updates
const updateSW = registerSW({
  onNeedRefresh() {
    toast('New version available', {
      description: 'A new version of the app is available.',
      duration: 100000,
      action: {
        label: 'Update now',
        onClick: () => {
          updateSW(true);
        },
      },
    });
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

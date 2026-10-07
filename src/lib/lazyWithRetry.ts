import { lazy, ComponentType } from 'react';

/**
 * Robust lazy loading wrapper with automatic retry and stale-chunk recovery.
 * If a chunk fails to load due to a deployment/rebuild or temporary network hiccup,
 * it retries and reloads the page once to pull the fresh index and asset manifest.
 */
export function lazyWithRetry<T extends ComponentType<any>>(
  importFn: () => Promise<{ default: T }>,
  retries = 2,
  interval = 500
) {
  return lazy(async () => {
    let lastError: any;
    for (let i = 0; i <= retries; i++) {
      try {
        return await importFn();
      } catch (err: any) {
        lastError = err;
        console.warn(`[LazyRetry] Dynamic chunk import failed (attempt ${i + 1}/${retries + 1}):`, err?.message || err);
        if (i < retries) {
          await new Promise((res) => setTimeout(res, interval));
        }
      }
    }

    // If repeated dynamic import fails (e.g. chunk hash mismatch after a new build),
    // reload the page once so the browser fetches the new index.html with up-to-date chunk hashes.
    if (typeof window !== 'undefined') {
      const reloadKey = 'chunk_reload_' + (window.location.pathname || 'root');
      const lastReload = sessionStorage.getItem(reloadKey);
      const now = Date.now();
      if (!lastReload || now - Number(lastReload) > 12000) {
        sessionStorage.setItem(reloadKey, String(now));
        console.log('[LazyRetry] Reloading page to fetch updated application assets...');
        window.location.reload();
        // Return a non-resolving promise so React doesn't render an unhandled crash while reloading
        return new Promise<{ default: T }>(() => {});
      }
    }

    throw lastError;
  });
}

import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
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

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

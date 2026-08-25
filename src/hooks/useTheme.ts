import { useState, useEffect } from 'react';
import { safeLocalStorage } from '../lib/safeLocalStorage';

export type Theme = 'light' | 'dark';

export function getActiveTheme(): Theme {
  if (typeof window !== 'undefined') {
    const saved = safeLocalStorage.getItem('theme') as Theme;
    if (saved === 'dark' || saved === 'light') return saved;
    if (document.documentElement.classList.contains('dark')) return 'dark';
    if (document.documentElement.classList.contains('light')) return 'light';
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return 'dark';
}

export function applyThemeToDOM(theme: Theme) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  if (theme === 'dark') {
    root.classList.remove('light');
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
    root.classList.add('light');
  }
}

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(() => {
    const initial = getActiveTheme();
    applyThemeToDOM(initial);
    return initial;
  });

  useEffect(() => {
    // Ensure DOM is in sync with active theme
    const active = getActiveTheme();
    applyThemeToDOM(active);
    setThemeState(active);

    // Observe changes to <html class="...">
    const observer = new MutationObserver(() => {
      const isDark = document.documentElement.classList.contains('dark');
      const current = isDark ? 'dark' : 'light';
      setThemeState(current);
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    });

    const handleThemeEvent = (e: Event) => {
      const customEvent = e as CustomEvent<Theme>;
      if (customEvent.detail) {
        setThemeState(customEvent.detail);
        applyThemeToDOM(customEvent.detail);
      } else {
        const current = getActiveTheme();
        setThemeState(current);
        applyThemeToDOM(current);
      }
    };

    window.addEventListener('gts-theme-change', handleThemeEvent);

    return () => {
      observer.disconnect();
      window.removeEventListener('gts-theme-change', handleThemeEvent);
    };
  }, []);

  const setTheme = (newTheme: Theme) => {
    applyThemeToDOM(newTheme);
    safeLocalStorage.setItem('theme', newTheme);
    setThemeState(newTheme);
    window.dispatchEvent(new CustomEvent('gts-theme-change', { detail: newTheme }));
  };

  const toggleTheme = () => {
    const currentTheme = getActiveTheme();
    const nextTheme: Theme = currentTheme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
  };

  return { theme, toggleTheme, setTheme };
}

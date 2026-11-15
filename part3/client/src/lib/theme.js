// Light / dark / system theme. The choice is stored per browser and applied
// as <html data-theme="light|dark|system">; tokens.css and Tailwind's dark:
// variant read that attribute ("system" follows the operating system).
//
//   const { theme, setTheme } = useTheme();   // theme: 'light' | 'dark' | 'system'
import { useSyncExternalStore } from 'react';

const THEMES = ['light', 'dark', 'system'];

function read() {
  const t = document.documentElement.dataset.theme;
  return THEMES.includes(t) ? t : 'system';
}

function subscribe(onChange) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  return () => observer.disconnect();
}

export function setTheme(next) {
  if (!THEMES.includes(next)) return;
  const apply = () => { document.documentElement.dataset.theme = next; };
  try { localStorage.setItem('theme', next); } catch { /* private window: keep it for this visit only */ }
  const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!calm && document.startViewTransition) document.startViewTransition(apply);
  else apply();
}

export function useTheme() {
  const theme = useSyncExternalStore(subscribe, read, () => 'system');
  return { theme, setTheme };
}

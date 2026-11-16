// 'light' | 'dark' after resolving "system" against the OS setting.
import { useSyncExternalStore } from 'react';

const query = () => window.matchMedia('(prefers-color-scheme: dark)');

function read() {
  const t = document.documentElement.dataset.theme;
  if (t === 'light' || t === 'dark') return t;
  return query().matches ? 'dark' : 'light';
}

function subscribe(onChange) {
  const mo = new MutationObserver(onChange);
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  const mq = query();
  mq.addEventListener('change', onChange);
  return () => {
    mo.disconnect();
    mq.removeEventListener('change', onChange);
  };
}

export default function useResolvedTheme() {
  return useSyncExternalStore(subscribe, read, () => 'light');
}

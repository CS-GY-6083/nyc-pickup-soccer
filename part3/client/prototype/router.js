// Tiny hash router for the prototype: #/path?query
import { useSyncExternalStore } from 'react';

function subscribe(onChange) {
  window.addEventListener('hashchange', onChange);
  return () => window.removeEventListener('hashchange', onChange);
}
const readHash = () => window.location.hash || '#/';

export function useRoute() {
  const hash = useSyncExternalStore(subscribe, readHash, () => '#/');
  const [path, query = ''] = hash.slice(1).split('?');
  return { path: path || '/', query: new URLSearchParams(query), hash };
}

export function navigate(to) {
  window.location.hash = to.startsWith('#') ? to.slice(1) : to;
}

/** Keep page state (filters, tabs) in the hash without adding history entries. */
export function replaceQuery(path, params) {
  const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v !== '' && v != null)).toString();
  window.history.replaceState(window.history.state, '', `#${path}${qs ? `?${qs}` : ''}`);
}

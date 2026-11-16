// The field map: borough-coloured pins (focusable buttons with names) with an
// upcoming-games badge, clustering at low zoom, hover/selection sync with the
// list, the "you are here" dot and radius circle, and a callback when the
// user moves the map (for "Search this area"). Reduced motion: no fly-to.
import { useEffect, useRef, useState } from 'react';
import { WifiOff } from 'lucide-react';
import { cn } from '@/lib/utils.js';
import { boroughInfo } from '../boroughs.js';
import Icon from '../Icon.jsx';
import { circlePolygon, prefersReducedMotion, tokenColor } from './maplibre.js';
import useMapLibre from './useMapLibre.js';

const CLUSTER_PX = 42;
const CLUSTER_UNTIL_ZOOM = 13;

function clusterize(map, fields) {
  const zoom = map.getZoom();
  const groups = [];
  for (const f of fields) {
    const p = map.project([f.longitude, f.latitude]);
    const g = zoom < CLUSTER_UNTIL_ZOOM ? groups.find((x) => Math.hypot(x.p.x - p.x, x.p.y - p.y) < CLUSTER_PX) : null;
    if (g) g.members.push(f);
    else groups.push({ p, members: [f] });
  }
  return groups;
}

function pinElement(f, onSelect, onHover) {
  const { code, color } = boroughInfo(f.borough);
  const el = document.createElement('button');
  el.type = 'button';
  el.className = 'map-pin';
  el.dataset.id = String(f.field_id);
  el.style.setProperty('--pin', color);
  const games = f.upcoming_games ?? 0;
  el.setAttribute('aria-label', `${f.name}, ${f.borough}. ${games} upcoming ${games === 1 ? 'game' : 'games'}. Show details`);
  const body = document.createElement('span');
  body.className = 'map-pin-body';
  body.textContent = code;
  el.append(body);
  if (games > 0) {
    const badge = document.createElement('span');
    badge.className = 'map-pin-badge';
    badge.textContent = String(games);
    badge.setAttribute('aria-hidden', 'true');
    el.append(badge);
  }
  el.addEventListener('click', (e) => {
    e.stopPropagation();
    onSelect(f.field_id);
  });
  el.addEventListener('mouseenter', () => onHover(f.field_id));
  el.addEventListener('mouseleave', () => onHover(null));
  el.addEventListener('focus', () => onHover(f.field_id));
  el.addEventListener('blur', () => onHover(null));
  return el;
}

function clusterElement(members, onZoom) {
  const el = document.createElement('button');
  el.type = 'button';
  el.className = 'map-cluster';
  el.textContent = String(members.length);
  el.setAttribute('aria-label', `${members.length} fields close together: ${members.map((m) => m.name).join(', ')}. Zoom in`);
  el.addEventListener('click', (e) => {
    e.stopPropagation();
    onZoom(members);
  });
  return el;
}

export default function FieldMapCanvas({
  fields,
  selectedId,
  hoverId,
  onSelect,
  onHover,
  near,
  radiusKm,
  fitKey,
  onUserMove,
  className,
  children,
}) {
  const ref = useRef(null);
  const { map, lib, status, styleTick } = useMapLibre(ref);
  const [zoomTick, setZoomTick] = useState(0);
  const els = useRef(new Map());
  const cb = useRef({ onSelect, onHover, onUserMove });
  cb.current = { onSelect, onHover, onUserMove };

  // Zoom changes regroup the clusters; user moves offer "Search this area".
  useEffect(() => {
    if (!map) return undefined;
    const onZoom = () => setZoomTick((t) => t + 1);
    const onMove = (e) => {
      if (e.originalEvent) cb.current.onUserMove?.(map.getBounds());
    };
    map.on('zoomend', onZoom);
    map.on('moveend', onMove);
    return () => {
      map.off('zoomend', onZoom);
      map.off('moveend', onMove);
    };
  }, [map]);

  // Pins and clusters.
  useEffect(() => {
    if (!map || !lib || status !== 'ready') return undefined;
    const markers = [];
    els.current = new Map();
    const motion = prefersReducedMotion() ? 0 : 500;
    for (const g of clusterize(map, fields)) {
      if (g.members.length === 1) {
        const f = g.members[0];
        const el = pinElement(f, (id) => cb.current.onSelect(id), (id) => cb.current.onHover(id));
        els.current.set(f.field_id, el);
        markers.push(new lib.Marker({ element: el }).setLngLat([f.longitude, f.latitude]).addTo(map));
      } else {
        const lng = g.members.reduce((s, m) => s + m.longitude, 0) / g.members.length;
        const lat = g.members.reduce((s, m) => s + m.latitude, 0) / g.members.length;
        const el = clusterElement(g.members, (members) => {
          const b = new lib.LngLatBounds();
          for (const m of members) b.extend([m.longitude, m.latitude]);
          map.fitBounds(b, { padding: 90, maxZoom: 15, duration: motion });
        });
        for (const m of g.members) els.current.set(m.field_id, el);
        markers.push(new lib.Marker({ element: el }).setLngLat([lng, lat]).addTo(map));
      }
    }
    return () => markers.forEach((m) => m.remove());
  }, [map, lib, status, fields, zoomTick]);

  // Hover and selection states on the pins.
  useEffect(() => {
    for (const [id, el] of els.current) {
      el.toggleAttribute('data-hover', id === hoverId);
      el.toggleAttribute('data-selected', id === selectedId);
      if (el.classList.contains('map-pin')) el.setAttribute('aria-pressed', String(id === selectedId));
    }
  }, [hoverId, selectedId, fields, zoomTick, status]);

  // Fit the results (or the starting point) when the result set changes.
  useEffect(() => {
    if (!map || !lib || status !== 'ready') return;
    const duration = prefersReducedMotion() ? 0 : 600;
    if (near && radiusKm) {
      const c = circlePolygon([near.lng, near.lat], radiusKm).geometry.coordinates[0];
      const b = new lib.LngLatBounds();
      c.forEach((p) => b.extend(p));
      map.fitBounds(b, { padding: 40, duration });
    } else if (fields.length) {
      const b = new lib.LngLatBounds();
      fields.forEach((f) => b.extend([f.longitude, f.latitude]));
      if (near) b.extend([near.lng, near.lat]);
      map.fitBounds(b, { padding: 70, maxZoom: 14, duration });
    }
  }, [map, lib, status, fitKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // Bring a selected field into view.
  useEffect(() => {
    if (!map || status !== 'ready' || !selectedId) return;
    const f = fields.find((x) => x.field_id === selectedId);
    if (!f) return;
    if (!map.getBounds().contains([f.longitude, f.latitude])) {
      map.easeTo({ center: [f.longitude, f.latitude], duration: prefersReducedMotion() ? 0 : 500 });
    }
  }, [map, status, selectedId]); // eslint-disable-line react-hooks/exhaustive-deps

  // "You are here" dot and the radius circle (re-added after a style switch).
  useEffect(() => {
    if (!map || !lib || status !== 'ready') return undefined;
    let me;
    const accent = tokenColor('--accent', '#2f7d4f');
    const src = 'near-radius';
    const clear = () => {
      for (const id of ['near-radius-fill', 'near-radius-line']) if (map.getLayer(id)) map.removeLayer(id);
      if (map.getSource(src)) map.removeSource(src);
    };
    clear();
    if (near) {
      if (radiusKm) {
        map.addSource(src, { type: 'geojson', data: circlePolygon([near.lng, near.lat], radiusKm) });
        map.addLayer({ id: 'near-radius-fill', type: 'fill', source: src, paint: { 'fill-color': accent, 'fill-opacity': 0.08 } });
        map.addLayer({ id: 'near-radius-line', type: 'line', source: src, paint: { 'line-color': accent, 'line-width': 1.5, 'line-dasharray': [2, 2] } });
      }
      const el = document.createElement('span');
      el.className = 'map-me';
      el.setAttribute('role', 'img');
      el.setAttribute('aria-label', 'Your starting point');
      me = new lib.Marker({ element: el }).setLngLat([near.lng, near.lat]).addTo(map);
    }
    return () => {
      me?.remove();
      if (map.getStyle()) clear();
    };
  }, [map, lib, status, styleTick, near?.lat, near?.lng, radiusKm]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className={cn('relative isolate overflow-hidden bg-surface-2 dark:bg-surface-3', className)}>
      <div ref={ref} role="region" aria-label="Field map. Each pin is a button; the list has the same fields." className="size-full" />
      {status === 'loading' && <div aria-hidden="true" className="absolute inset-0 animate-pulse bg-surface-2 motion-reduce:animate-none dark:bg-surface-3" />}
      {status === 'failed' && (
        <div role="status" className="absolute inset-0 grid place-items-center p-6 text-center">
          <div className="flex max-w-[34ch] flex-col items-center gap-2 rounded-xl border border-line bg-surface p-5 shadow-[var(--lift)] dark:bg-surface-2">
            <Icon icon={WifiOff} tone="label" size="22px" />
            <p className="font-display text-[18px] font-bold">Map needs internet</p>
            <p className="text-[14px] text-muted-foreground">The street map couldn&rsquo;t load. The list still works, with every field and its games.</p>
          </div>
        </div>
      )}
      {status === 'ready' && children}
    </div>
  );
}

// A small street map with one pin, for the field page. Needs internet; when
// the tiles can't load it says so, and the address links still work.
import { useEffect, useRef } from 'react';
import { WifiOff } from 'lucide-react';
import { cn } from '@/lib/utils.js';
import { boroughInfo } from '../boroughs.js';
import Icon from '../Icon.jsx';
import useMapLibre from './useMapLibre.js';

export default function MiniMap({ lat, lng, name, borough, className }) {
  const ref = useRef(null);
  const { map, lib, status } = useMapLibre(ref, { center: [lng, lat], zoom: 14.5, scrollZoom: false, compactAttribution: true });

  useEffect(() => {
    if (!map || !lib) return undefined;
    const el = document.createElement('span');
    el.className = 'map-pin is-static';
    el.style.setProperty('--pin', boroughInfo(borough).color);
    el.setAttribute('aria-hidden', 'true');
    const dot = document.createElement('span');
    dot.className = 'map-pin-body';
    dot.textContent = boroughInfo(borough).code;
    el.append(dot);
    const marker = new lib.Marker({ element: el }).setLngLat([lng, lat]).addTo(map);
    return () => marker.remove();
  }, [map, lib, lat, lng, borough]);

  return (
    <div className={cn('relative isolate overflow-hidden rounded-[12px] bg-surface-2 dark:bg-surface-3', className)}>
      <div ref={ref} role="region" aria-label={`Street map showing ${name}`} className="size-full" />
      {status === 'loading' && <div aria-hidden="true" className="absolute inset-0 animate-pulse bg-surface-2 motion-reduce:animate-none dark:bg-surface-3" />}
      {status === 'failed' && (
        <p role="status" className="absolute inset-0 grid place-items-center p-4 text-center text-[14px] text-muted-foreground">
          <span className="flex flex-col items-center gap-2">
            <Icon icon={WifiOff} tone="label" size="20px" />
            The map needs internet. The address and map links above still work.
          </span>
        </p>
      )}
    </div>
  );
}

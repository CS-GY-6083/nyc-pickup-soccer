// Address as text, plus keyless Google Maps and OpenStreetMap links (plain
// links, no embed) and a copy-address button with a blurred icon swap.
import { useEffect, useRef, useState } from 'react';
import { ArrowUpRight, Check, Copy, MapPin } from 'lucide-react';
import { googleMapsUrl, osmUrl } from '@/lib/maps.js';
import { cn } from '@/lib/utils.js';
import Button from './Button.jsx';
import Icon from './Icon.jsx';
import IconSwap from './IconSwap.jsx';

export default function MapLinks({ address, lat, lng, className }) {
  const [copied, setCopied] = useState(null); // null | 'ok' | 'fail'
  const timer = useRef();
  useEffect(() => () => clearTimeout(timer.current), []);

  async function copy() {
    try {
      await navigator.clipboard.writeText(address);
      setCopied('ok');
    } catch {
      setCopied('fail');
    }
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(null), 2400);
  }

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      <p className="flex items-start gap-2 text-[16px] leading-6 text-foreground">
        <Icon icon={MapPin} tone="body" size="20px" className="mt-0.5 text-accent-ink" />
        <span>{address}</span>
      </p>
      <div className="flex flex-wrap gap-2">
        <Button variant="primary" size="sm" href={googleMapsUrl({ lat, lng })} target="_blank" rel="noopener">
          Open in Google Maps
          <Icon icon={ArrowUpRight} tone="label" size="16px" />
          <span className="sr-only">(opens in a new tab)</span>
        </Button>
        <Button variant="secondary" size="sm" href={osmUrl({ lat, lng })} target="_blank" rel="noopener">
          OpenStreetMap
          <Icon icon={ArrowUpRight} tone="label" size="16px" />
          <span className="sr-only">(opens in a new tab)</span>
        </Button>
        <Button variant="quiet" size="sm" onClick={copy}>
          <IconSwap swapKey={copied === 'ok' ? 'ok' : 'copy'}>
            <Icon icon={copied === 'ok' ? Check : Copy} tone="label" size="16px" />
          </IconSwap>
          {copied === 'ok' ? 'Address copied' : 'Copy address'}
        </Button>
      </div>
      <p role="status" className="min-h-5 text-[13px] text-muted-foreground">
        {copied === 'fail' ? 'Couldn’t copy here. Select the address above and copy it.' : ''}
      </p>
    </div>
  );
}

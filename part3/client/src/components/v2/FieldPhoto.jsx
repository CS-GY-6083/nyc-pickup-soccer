// A field photo in its real colours, with a small credit (author, licence,
// source link; "Stock photo" first for generic stand-ins). Options:
//   mask   fade the bottom edge into the surface (craft rule 6)
//   scrim  neutral black-alpha gradient, only when text sits on the photo
//   <FieldPhoto photo={field.photo} size="large" mask className="h-80 rounded-2xl" />
import { useState } from 'react';
import { cn } from '@/lib/utils.js';
import PhotoCredit from './PhotoCredit.jsx';

export default function FieldPhoto({
  photo,
  size = 'small',
  mask = false,
  scrim = false,
  credit = 'chip',
  eager = false,
  className,
  imgClassName,
  creditClassName,
  children,
}) {
  const [failed, setFailed] = useState(false);
  const src = photo ? (size === 'large' ? photo.large : photo.small) : null;
  return (
    <figure className={cn('relative m-0 overflow-hidden bg-surface-2', className)}>
      <div className={cn('absolute inset-0 rounded-[inherit]', mask && 'mask-b')}>
        {src && !failed ? (
          <img
            src={src}
            alt={photo.alt}
            loading={eager ? 'eager' : 'lazy'}
            decoding="async"
            onError={() => setFailed(true)}
            className={cn('size-full object-cover', imgClassName)}
          />
        ) : (
          // Load error only: say what is missing, in words.
          <span className="grid size-full place-items-center p-3 text-center text-[12px] text-muted-foreground">
            {photo?.alt ?? 'Photo unavailable'}
          </span>
        )}
        {scrim && <span aria-hidden="true" className="scrim" />}
        {/* Neutral hairline so the photo edge never melts into the surface
            (inside the mask, so a faded bottom has no leftover frame). */}
        <span aria-hidden="true" className="pointer-events-none absolute inset-0 rounded-[inherit] shadow-[inset_0_0_0_1px_var(--line-soft)]" />
      </div>
      {children}
      {credit === 'chip' && photo && (
        <figcaption className={cn('absolute bottom-2 left-2 z-10 max-w-[calc(100%-16px)]', creditClassName)}>
          <PhotoCredit photo={photo} />
        </figcaption>
      )}
    </figure>
  );
}

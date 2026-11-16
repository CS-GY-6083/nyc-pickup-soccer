// Split-flap tiles for the board. Two-tone (lighter top half) with hinge
// notches on the left and right edges only; no line through the glyphs.
import { cn } from '@/lib/utils.js';

const SIZES = {
  xs: 'h-[24px] min-w-[16px] px-[3px] text-[14px] [--notch:2px]',
  sm: 'h-[26px] min-w-[18px] px-[3px] text-[15px]',
  md: 'h-[32px] min-w-[22px] px-1 text-[18px]',
  lg: 'h-[40px] min-w-[28px] px-1 text-[24px] [--notch:3px] sm:h-[52px] sm:min-w-[36px] sm:px-1.5 sm:text-[32px] sm:[--notch:3.5px]',
  xl: 'h-[64px] min-w-[44px] px-2 text-[40px] [--notch:4px]',
};

export function FlapTile({ children, size = 'md', className, ...rest }) {
  return (
    <span className={cn('flap font-display font-bold', SIZES[size], className)} {...rest}>
      {children}
    </span>
  );
}

/** A word on tiles, e.g. capacity "OPEN · 8" or "WED". */
export function FlapWord({ children, size = 'md', className, ...rest }) {
  const word = {
    xs: 'h-[24px] px-1.5 text-[10px] [--notch:2px]',
    sm: 'h-[26px] px-2 text-[11px]',
    md: 'h-[30px] px-2.5 text-[12px]',
    lg: 'h-[32px] px-2.5 text-[13px] [--notch:3px] sm:h-[40px] sm:px-3.5 sm:text-[15px]',
  }[size];
  return (
    <span className={cn('flap font-sans font-bold tracking-[0.06em] whitespace-nowrap uppercase', word, className)} {...rest}>
      {children}
    </span>
  );
}

function clock(timestamp) {
  const [, time = '00:00'] = String(timestamp).split(/[ T]/);
  const [h, m] = time.split(':').map(Number);
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return { hh: String(h12), mm: String(m).padStart(2, '0'), ampm: h < 12 ? 'AM' : 'PM' };
}

/** Kick-off time as digit tiles: [9]:[0][0] AM, [1][1]:[0][0] AM. No empty tiles. */
export function TimeTiles({ timestamp, size = 'md', className }) {
  const { hh, mm, ampm } = clock(timestamp);
  const spoken = `${hh}:${mm} ${ampm}`;
  const big = size === 'lg' || size === 'xl';
  return (
    <span className={cn('inline-flex items-center gap-[3px]', className)}>
      <span className="sr-only">{spoken}</span>
      <span aria-hidden="true" className="inline-flex items-center gap-[3px]">
        {[...hh].map((d, i) => (
          <FlapTile key={i} size={size}>
            {d}
          </FlapTile>
        ))}
        <span className={cn('font-display font-bold text-flap-muted', big ? 'px-0.5 text-[20px] sm:text-[28px]' : size === 'xs' ? 'text-[13px]' : 'text-[16px]')}>:</span>
        <FlapTile size={size}>{mm[0]}</FlapTile>
        <FlapTile size={size}>{mm[1]}</FlapTile>
        <FlapWord size={big ? 'lg' : size === 'xs' ? 'xs' : 'sm'} className="ml-[3px] text-flap-muted">
          {ampm}
        </FlapWord>
      </span>
    </span>
  );
}

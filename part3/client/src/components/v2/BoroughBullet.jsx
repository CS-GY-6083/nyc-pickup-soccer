// A borough mark: coloured disc with our two-letter code (MN, BK, QN, BX, SI).
// White on every borough colour passes AA (design/contrast-check.mjs).
import { cn } from '@/lib/utils.js';
import { boroughInfo } from './boroughs.js';

const SIZES = {
  xs: 'size-5 text-[9px]',
  sm: 'size-6 text-[10px]',
  md: 'size-8 text-[12px]',
  lg: 'size-11 text-[16px]',
  xl: 'size-14 text-[20px]',
};

export default function BoroughBullet({ borough, size = 'md', decorative = false, className }) {
  const { code, color } = boroughInfo(borough);
  return (
    <span
      role={decorative ? undefined : 'img'}
      aria-label={decorative ? undefined : borough}
      aria-hidden={decorative || undefined}
      title={decorative ? undefined : borough}
      className={cn(
        'inline-grid flex-none place-items-center rounded-full font-display font-extrabold leading-none tracking-[0.01em] text-white select-none',
        SIZES[size],
        className,
      )}
      style={{ backgroundColor: color, color: 'var(--borough-text)' }}
    >
      {code}
    </span>
  );
}

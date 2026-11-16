// Subway-inspired sign: black band, thin white rule across the top, white
// bold grotesk lettering and a borough bullet. Inspiration only: our own
// borough marks, no route letters, no agency marks.
//   <SignBand as="h1" borough="Brooklyn">Parade Ground Field 3</SignBand>
//   <SignBand as="h2" href="#/games/13">Next kick-off</SignBand>   (a link: shows the arrow)
// The arrow only appears on a sign that is a link, so it never promises a
// click that does nothing. `arrow` picks its direction (default right).
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils.js';
import BoroughBullet from './BoroughBullet.jsx';
import Icon from './Icon.jsx';

const SIZES = {
  sm: { band: 'min-h-12 gap-2.5 pl-2.5 pr-4 pt-3.5 pb-2.5 text-[17px]', bullet: 'sm', icon: '1.05em' },
  md: { band: 'min-h-16 gap-3 pl-3 pr-5 pt-[18px] pb-3 text-[22px] sm:text-[26px]', bullet: 'md', icon: '1em' },
  lg: { band: 'min-h-20 gap-3.5 pl-3.5 pr-6 pt-6 pb-4 text-[30px] sm:text-[44px] lg:text-[54px]', bullet: 'lg', icon: '0.9em' },
};

export default function SignBand({
  as: Tag = 'div',
  borough,
  bullets,
  href,
  arrow = 'right',
  size = 'md',
  meta,
  className,
  textClassName,
  bulletClassName,
  children,
  ...rest
}) {
  const s = SIZES[size];
  const marks = bullets ?? (borough ? [borough] : []);
  const Wrapper = href ? 'a' : 'div';
  const ArrowGlyph = arrow === 'left' ? ArrowLeft : ArrowRight;
  return (
    <Wrapper
      href={href}
      className={cn(
        'sign-band relative flex items-center overflow-hidden rounded-lg bg-sign text-sign-foreground',
        href && 'group/sign transition-[transform,background-color] duration-150 hover:bg-[var(--p-graphite-800)] active:scale-[0.995] motion-reduce:transition-none',
        s.band,
        className,
      )}
      {...rest}
    >
      <span aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-[5px] h-px bg-[var(--sign-rule)] opacity-90" />
      {href && arrow === 'left' && <Icon icon={ArrowGlyph} tone="sign" size={s.icon} className="-mr-0.5" />}
      {marks.length > 0 && (
        <span className="flex flex-none items-center gap-1">
          {marks.map((b) => (
            <BoroughBullet key={b} borough={b} size={s.bullet} className={bulletClassName} />
          ))}
        </span>
      )}
      <Tag className={cn('min-w-0 flex-1 font-display font-bold leading-[1.08] tracking-[-0.015em] text-balance', textClassName)}>{children}</Tag>
      {meta && <span className="flex-none text-[0.6em] font-semibold tracking-normal text-[var(--p-chalk-200)]">{meta}</span>}
      {href && arrow !== 'left' && (
        <Icon icon={ArrowGlyph} tone="sign" size={s.icon} className="transition-transform duration-150 group-hover/sign:translate-x-0.5 motion-reduce:transition-none" />
      )}
    </Wrapper>
  );
}

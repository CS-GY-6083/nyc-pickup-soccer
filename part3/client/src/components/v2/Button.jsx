// Pill buttons for v2 pages. Hover steps the colour, press scales to .97,
// primary glows in dark mode only. Renders a router <Link> when given `to`
// (in-app pages) and a plain <a> when given `href`.
import { Link } from 'react-router';
import { cn } from '@/lib/utils.js';

const BASE =
  'inline-flex items-center justify-center gap-2 rounded-full font-sans font-semibold whitespace-nowrap select-none ' +
  'transition-[transform,background-color,box-shadow,color,border-color] duration-150 ease-out active:scale-[0.97] ' +
  'disabled:cursor-not-allowed disabled:opacity-60 disabled:active:scale-100 aria-disabled:cursor-not-allowed aria-disabled:opacity-60 ' +
  'motion-reduce:transition-none motion-reduce:active:scale-100 cursor-pointer';

const VARIANTS = {
  primary:
    'bg-primary text-primary-foreground shadow-[var(--primary-glow)] hover:bg-[var(--p-green-800)] dark:hover:bg-[var(--p-green-300)]',
  secondary:
    'bg-surface text-foreground border border-line-strong shadow-[0_1px_2px_var(--shadow)] hover:bg-surface-2 hover:border-[color:var(--muted)] dark:bg-surface-3 dark:shadow-[inset_0_1px_0_var(--highlight)] dark:hover:bg-surface-4',
  quiet: 'bg-transparent text-accent-ink hover:bg-primary-soft',
  danger:
    'bg-surface text-destructive border border-[color:oklch(from_var(--danger)_l_c_h/0.45)] hover:bg-destructive-soft dark:bg-surface-3',
  sign: 'bg-sign text-sign-foreground hover:bg-[var(--p-graphite-800)]',
};

const SIZES = {
  sm: 'h-10 px-4 text-[14px]',
  md: 'h-11 px-5 text-[15px]',
  lg: 'h-12 px-6 text-[16px]',
};

export default function Button({ variant = 'primary', size = 'md', href, to, className, children, ...rest }) {
  const classes = cn(BASE, VARIANTS[variant], SIZES[size], className);
  if (to) {
    return (
      <Link to={to} className={cn(classes, 'no-underline')} {...rest}>
        {children}
      </Link>
    );
  }
  if (href) {
    return (
      <a href={href} className={classes} {...rest}>
        {children}
      </a>
    );
  }
  return (
    <button type="button" className={classes} {...rest}>
      {children}
    </button>
  );
}

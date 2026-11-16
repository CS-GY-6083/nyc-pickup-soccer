// Page and form pieces for v2 pages (public, admin, and teammates' pages).
//
//   <Page title="Pending field bookings" lede="…" actions={<Button/>}> … </Page>
//   <TextField label="Field name" value={v} onChange={(e) => …} required />
//   <SelectField label="Borough" value={b} onChange={…}><option>…</option></SelectField>
//   <Segmented legend="Look up by" value={mode} onChange={setMode} options={[['field', 'Field and date'], …]} />
//   <Notice type="error">That field is closed.</Notice>
//   <EmptyState title="Nothing waiting" action={<Button/>}>Every booking has been reviewed.</EmptyState>
//
// Every control has a visible label, a 48px target, and an error state
// (aria-invalid + aria-describedby) when `error` is given.
import { useEffect, useId } from 'react';
import { ChevronDown, CircleAlert, CircleCheck, Info, TriangleAlert, X } from 'lucide-react';
import { cn } from '@/lib/utils.js';
import Icon from './Icon.jsx';
import SignBand from './SignBand.jsx';
import { BOROUGH_NAMES } from './boroughs.js';

export const LABEL = 'text-[13px] font-semibold text-muted-foreground';
export const CONTROL =
  'h-12 w-full min-w-0 rounded-md border border-line-strong bg-surface px-3.5 text-[15px] text-foreground ' +
  'placeholder:text-muted-foreground transition-[border-color,background-color] duration-150 hover:border-[color:var(--muted)] ' +
  'aria-invalid:border-destructive disabled:cursor-not-allowed disabled:opacity-60 dark:bg-surface-2 motion-reduce:transition-none';
export const CARD = 'rounded-xl border border-line bg-surface p-5 shadow-[var(--lift)] dark:bg-surface-2';
export const H2 = 'font-display text-[22px] leading-tight font-bold tracking-[-0.02em] text-foreground sm:text-[24px]';

/** Sets the browser tab title: "<title> · NYC Pickup Soccer". */
export function usePageTitle(title) {
  useEffect(() => {
    if (title) document.title = `${title} · NYC Pickup Soccer`;
  }, [title]);
}

/** A page: sign-band title, a short lede, optional actions, then the content. */
export function Page({ title, lede, borough, actions, width = 'wide', className, children }) {
  usePageTitle(typeof title === 'string' ? title : undefined);
  return (
    <div data-ui className={cn('mx-auto w-full pb-10 font-sans text-[15px] leading-6 text-foreground', width === 'narrow' ? 'max-w-[560px]' : '', className)}>
      <header className="mb-6 flex flex-col gap-3">
        <SignBand as="h1" size="md" borough={borough}>
          {title}
        </SignBand>
        {(lede || actions) && (
          <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3 px-1">
            {lede && <p className="max-w-[68ch] text-muted-foreground">{lede}</p>}
            {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
          </div>
        )}
      </header>
      {children}
    </div>
  );
}

/** Section heading with an optional aside (a count, a link). */
export function SectionHeading({ id, children, aside, className, as: H = 'h2' }) {
  return (
    <div className={cn('mb-4 flex flex-wrap items-end justify-between gap-x-6 gap-y-2', className)}>
      <H id={id} className={H2}>
        {children}
      </H>
      {aside}
    </div>
  );
}

function Described({ id, hint, error }) {
  return (
    <>
      {hint && !error && (
        <span id={`${id}-hint`} className="text-[13px] text-muted-foreground">
          {hint}
        </span>
      )}
      {error && (
        <span id={`${id}-err`} className="text-[13px] font-medium text-destructive">
          {error}
        </span>
      )}
    </>
  );
}

function describedBy(id, hint, error) {
  if (error) return `${id}-err`;
  if (hint) return `${id}-hint`;
  return undefined;
}

export function TextField({ label, hint, error, className, inputClassName, id: given, ...input }) {
  const auto = useId();
  const id = given ?? auto;
  return (
    <label htmlFor={id} className={cn('flex min-w-0 flex-col gap-1.5', className)}>
      <span className={LABEL}>{label}</span>
      <input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, hint, error)}
        className={cn(CONTROL, inputClassName)}
        {...input}
      />
      <Described id={id} hint={hint} error={error} />
    </label>
  );
}

export function TextArea({ label, hint, error, className, rows = 3, id: given, ...input }) {
  const auto = useId();
  const id = given ?? auto;
  return (
    <label htmlFor={id} className={cn('flex min-w-0 flex-col gap-1.5', className)}>
      <span className={LABEL}>{label}</span>
      <textarea
        id={id}
        rows={rows}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, hint, error)}
        className={cn(CONTROL, 'h-auto min-h-24 py-3 leading-6')}
        {...input}
      />
      <Described id={id} hint={hint} error={error} />
    </label>
  );
}

export function SelectField({ label, hint, error, className, children, id: given, ...select }) {
  const auto = useId();
  const id = given ?? auto;
  return (
    <label htmlFor={id} className={cn('flex min-w-0 flex-col gap-1.5', className)}>
      <span className={LABEL}>{label}</span>
      <span className="relative">
        <select
          id={id}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy(id, hint, error)}
          className={cn(CONTROL, 'cursor-pointer appearance-none pr-10')}
          {...select}
        >
          {children}
        </select>
        <Icon icon={ChevronDown} tone="label" size="18px" className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-muted-foreground" />
      </span>
      <Described id={id} hint={hint} error={error} />
    </label>
  );
}

/**
 * <option>s for a <select> of fields, grouped by borough (A-Z inside each,
 * as the API sends them). Put your own first option before it:
 *   <SelectField label="Field" …><option value="">Choose a field…</option><FieldOptions fields={fields} /></SelectField>
 */
export function FieldOptions({ fields }) {
  return BOROUGH_NAMES.map((borough) => {
    const list = fields.filter((f) => f.borough === borough);
    if (list.length === 0) return null;
    return (
      <optgroup key={borough} label={`${borough} (${list.length})`}>
        {list.map((f) => (
          <option key={f.field_id} value={f.field_id}>
            {f.name}
          </option>
        ))}
      </optgroup>
    );
  });
}

/** Radio buttons drawn as a segmented control. options: [[value, label], …] */
export function Segmented({ legend, value, onChange, options, className, hideLegend = false }) {
  const name = useId();
  return (
    <fieldset className={cn('flex min-w-0 flex-col', className)}>
      <legend className={cn(LABEL, 'mb-1.5', hideLegend && 'sr-only')}>{legend}</legend>
      <div className="inline-flex h-12 w-full items-center gap-1 rounded-md border border-line-strong bg-surface-2 p-1 sm:w-auto dark:bg-surface-3">
        {options.map(([v, label]) => (
          <label key={v} className="relative flex-1 cursor-pointer sm:flex-none">
            <input type="radio" name={name} value={v} checked={value === v} onChange={() => onChange(v)} className="peer sr-only" />
            <span
              className={cn(
                'flex h-10 items-center justify-center rounded-[8px] px-3 text-[14px] font-semibold whitespace-nowrap text-muted-foreground',
                'transition-[background-color,color,box-shadow] duration-150 hover:text-foreground motion-reduce:transition-none',
                'peer-checked:bg-surface peer-checked:text-foreground peer-checked:shadow-[0_1px_2px_var(--shadow),0_0_0_1px_var(--line)]',
                'dark:peer-checked:bg-surface-4 dark:peer-checked:shadow-[inset_0_1px_0_var(--highlight)]',
                'peer-focus-visible:outline-2 peer-focus-visible:outline-offset-1 peer-focus-visible:outline-[color:var(--focus)]',
              )}
            >
              {label}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

const NOTICE = {
  success: {
    icon: CircleCheck,
    role: 'status',
    className: 'border-[color:oklch(from_var(--accent)_l_c_h/0.35)] bg-primary-soft text-accent-ink',
  },
  error: {
    icon: CircleAlert,
    role: 'alert',
    className: 'border-[color:oklch(from_var(--danger)_l_c_h/0.35)] bg-destructive-soft text-destructive',
  },
  warning: {
    icon: TriangleAlert,
    role: 'status',
    className: 'border-[color:oklch(from_var(--warn)_l_c_h/0.35)] bg-warning-soft text-warning',
  },
  info: {
    icon: Info,
    role: 'status',
    className: 'border-line bg-surface-2 text-foreground dark:bg-surface-3',
  },
};

/** A message box: success, error, warning or info. Icon + words, never colour alone. */
export function Notice({ type = 'info', children, onDismiss, className, ...rest }) {
  if (!children) return null;
  const n = NOTICE[type] ?? NOTICE.info;
  return (
    <div
      data-ui
      role={n.role}
      className={cn('flex items-start gap-3 rounded-xl border px-4 py-3.5 font-sans text-[15px] leading-6', n.className, className)}
      {...rest}
    >
      <Icon icon={n.icon} tone="label" size="20px" className="mt-0.5" />
      <div className="min-w-0 flex-1 font-medium">{children}</div>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss message"
          className="-m-2 grid size-10 flex-none cursor-pointer place-items-center rounded-full transition-colors duration-150 hover:bg-[var(--line-soft)]"
        >
          <Icon icon={X} tone="label" size="18px" />
        </button>
      )}
    </div>
  );
}

/** Nothing to show: a short headline, what to do next, and an action. */
export function EmptyState({ title, children, action, className }) {
  return (
    <div className={cn('flex flex-col items-start gap-3 rounded-2xl border border-dashed border-line-strong bg-surface p-6 sm:p-8 dark:bg-surface-2', className)}>
      <p className="font-display text-[22px] font-bold">{title}</p>
      {children && <p className="max-w-[60ch] text-muted-foreground">{children}</p>}
      {action}
    </div>
  );
}

/** Grey placeholder blocks while a page loads. */
export function Skeleton({ rows = 3, className, label = 'Loading' }) {
  return (
    <div aria-busy="true" aria-label={label} className={cn('flex flex-col gap-3', className)}>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="h-20 animate-pulse rounded-xl bg-surface-2 motion-reduce:animate-none dark:bg-surface-3" />
      ))}
    </div>
  );
}

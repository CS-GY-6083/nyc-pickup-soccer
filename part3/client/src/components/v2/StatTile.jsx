// One number with its label, for profile and activity pages.
//   <StatTile label="Hours on the pitch" value="15.5" unit="h" note="Oct–Nov 2026" />
import { cn } from '@/lib/utils.js';
import Icon from './Icon.jsx';

export default function StatTile({ label, value, unit, note, icon, children, className }) {
  return (
    <div
      className={cn(
        'flex min-h-[132px] flex-col rounded-xl border border-line bg-surface p-4 shadow-[var(--lift)] dark:bg-surface-2',
        className,
      )}
    >
      <dt className="flex items-center gap-1.5 text-[13px] font-semibold text-muted-foreground">
        {icon && <Icon icon={icon} tone="label" size="15px" />}
        {label}
      </dt>
      <dd className="mt-auto pt-3">
        <span className="font-display text-[40px] leading-none font-bold tracking-[-0.03em] text-foreground">{value}</span>
        {unit && <span className="ml-1 text-[16px] font-semibold text-muted-foreground">{unit}</span>}
        {children && <div className="mt-2">{children}</div>}
        {note && <p className="mt-1.5 text-[13px] leading-5 text-muted-foreground">{note}</p>}
      </dd>
    </div>
  );
}

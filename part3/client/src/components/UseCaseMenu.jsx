// Grid of links to a role's use cases, shown on each home page.
//   <UseCaseMenu items={[{ to: '/player/games', title: 'My games', text: '...', icon: CalendarDays, badge: '3 waiting' }]} />
// icon (a lucide icon) and badge (short text) are optional.
import { Link } from 'react-router';
import { ChevronRight } from 'lucide-react';
import Icon from './v2/Icon.jsx';

export default function UseCaseMenu({ items }) {
  return (
    <ul data-ui className="grid gap-3 font-sans sm:grid-cols-2 lg:grid-cols-3">
      {items.map((item) => (
        <li key={item.to} className="group relative">
          <div className="flex h-full items-start gap-3 rounded-xl border border-line bg-surface p-4 shadow-[var(--lift)] transition-[transform,box-shadow,border-color] duration-200 ease-out group-hover:-translate-y-0.5 group-hover:border-line-strong group-hover:shadow-[var(--lift-hover)] motion-reduce:transition-none dark:bg-surface-2">
            {item.icon && (
              <span className="grid size-11 flex-none place-items-center rounded-full bg-primary-soft text-accent-ink">
                <Icon icon={item.icon} tone="label" size="20px" />
              </span>
            )}
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <Link
                to={item.to}
                className="font-display text-[17px] leading-snug font-bold tracking-[-0.01em] text-foreground no-underline outline-none after:absolute after:inset-0 after:rounded-xl after:content-[''] group-hover:underline focus-visible:after:outline-2 focus-visible:after:outline-offset-2 focus-visible:after:outline-[color:var(--focus)]"
              >
                {item.title}
              </Link>
              <span className="text-[14px] leading-5 text-muted-foreground">{item.text}</span>
              {item.badge && (
                <span className="mt-1.5 inline-flex h-7 w-fit items-center rounded-full bg-warning-soft px-3 text-[13px] font-semibold text-warning">
                  {item.badge}
                </span>
              )}
            </div>
            <Icon
              icon={ChevronRight}
              tone="label"
              size="18px"
              className="mt-0.5 text-muted-foreground transition-transform duration-150 group-hover:translate-x-0.5 motion-reduce:transition-none"
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

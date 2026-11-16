// Admin home page: the numbers that need attention, the booking queue,
// then only the admin use cases. Actions on other admin pages come back
// here with a success or error message (shown by <Flash /> in App.jsx).
// Owners: Abhinav (bookings, fields, closures, games), Devash (reports)
import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { BarChart3, CalendarClock, CalendarX2, ClipboardCheck, MapPinned, Trophy } from 'lucide-react';
import { api } from '../../api.js';
import { useAuth } from '../../auth/AuthContext.jsx';
import UseCaseMenu from '../../components/UseCaseMenu.jsx';
import { BoroughBullet, Button, EmptyState, Notice, Page, SectionHeading, Skeleton, StatTile } from '../../components/v2/index.js';
import { formatDate, formatTime } from '../../format.js';
import { ConflictBadge } from './AdminBookings.jsx';

const ADMIN_USE_CASES = [
  { to: '/admin/bookings', icon: ClipboardCheck, title: 'Pending field bookings', text: 'Approve or reject game bookings. Overlaps, closures and opening hours are flagged.' },
  { to: '/admin/fields', icon: MapPinned, title: 'Fields', text: 'Add a field and its opening hours, and see every field.' },
  { to: '/admin/closures', icon: CalendarX2, title: 'Field closures', text: 'Close a field for repairs or events, and see which games it affects.' },
  { to: '/admin/games', icon: Trophy, title: 'All games', text: 'Every game and booking, past or upcoming, with rosters.' },
  { to: '/admin/reports', icon: BarChart3, title: 'Reports', text: 'Field usage (hours booked) last month and last year, bookings per month, and activity by borough and format.' },
];

export default function AdminHome() {
  const { user } = useAuth();
  const [summary, setSummary] = useState(null);
  const [queue, setQueue] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let live = true;
    Promise.all([api('/admin/summary'), api('/admin/bookings')])
      .then(([s, b]) => {
        if (!live) return;
        setSummary(s.summary);
        setQueue(b.bookings);
      })
      .catch((e) => live && setError(e.message));
    return () => {
      live = false;
    };
  }, []);

  const first = user.name.split(' ')[0];
  const waiting = summary?.pending_bookings ?? 0;
  const menu = ADMIN_USE_CASES.map((item) =>
    item.to === '/admin/bookings' && waiting ? { ...item, badge: `${waiting} waiting for review` } : item,
  );

  return (
    <Page title={`Welcome, ${first}`} lede="Review field bookings, keep fields and closures up to date, and look up any game.">
      {error && <Notice type="error">{error}</Notice>}

      {summary ? (
        <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatTile label="Bookings to review" value={summary.pending_bookings} icon={ClipboardCheck} note="Games waiting for a field" />
          <StatTile label="Upcoming games" value={summary.upcoming_games} icon={CalendarClock} note="Approved or waiting" />
          <StatTile label="Fields" value={summary.fields} icon={MapPinned} note="Across the five boroughs" />
          <StatTile label="Closures" value={summary.active_closures} icon={CalendarX2} note="Now or coming up" />
        </dl>
      ) : (
        !error && <Skeleton rows={1} label="Loading the numbers" />
      )}

      <section aria-labelledby="queue" className="mt-10">
        <SectionHeading
          id="queue"
          aside={
            queue?.length > 0 && (
              <Link to="/admin/bookings" className="text-[15px] font-semibold text-accent-ink underline-offset-4 hover:underline">
                Review all {queue.length}
              </Link>
            )
          }
        >
          Waiting for review
        </SectionHeading>
        {queue === null ? (
          !error && <Skeleton rows={2} label="Loading bookings" />
        ) : queue.length === 0 ? (
          <EmptyState title="All caught up.">Every field booking has been reviewed.</EmptyState>
        ) : (
          <ul className="flex flex-col divide-y divide-line-soft overflow-hidden rounded-xl border border-line bg-surface shadow-[var(--lift)] dark:bg-surface-2">
            {queue.slice(0, 4).map((b) => (
              <li key={b.reservation_id} className="group relative flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3.5 hover:bg-surface-2 dark:hover:bg-surface-3">
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <BoroughBullet borough={b.borough} size="sm" decorative />
                  <div className="min-w-0">
                    <Link
                      to={`/admin/bookings#booking-${b.reservation_id}`}
                      className="font-semibold text-foreground no-underline after:absolute after:inset-0 after:content-[''] group-hover:underline"
                    >
                      {b.field_name}
                    </Link>
                    <p className="text-[14px] text-muted-foreground tnum">
                      Game #{b.game_id} · {formatDate(b.start_time)}, {formatTime(b.start_time)} · {b.organizer_name}
                    </p>
                  </div>
                </div>
                <ConflictBadge conflict={b.conflict} />
              </li>
            ))}
          </ul>
        )}
        {queue?.length > 4 && (
          <Button to="/admin/bookings" variant="secondary" className="mt-3">
            See the other {queue.length - 4}
          </Button>
        )}
      </section>

      <section aria-labelledby="tools" className="mt-10">
        <SectionHeading id="tools">Admin tools</SectionHeading>
        <UseCaseMenu items={menu} />
      </section>
    </Page>
  );
}

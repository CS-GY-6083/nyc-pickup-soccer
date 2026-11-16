// #/fields/:id  Field page (public): photo hero with credit (or the borough
// plate), address with map links, surface, opening hours, closures, and the
// field's upcoming games board.
import { motion, useReducedMotion } from 'motion/react';
import { ArrowLeft, CalendarX2, Clock, Layers, Trees } from 'lucide-react';
import {
  Board,
  BoardRow,
  BoroughBullet,
  FieldPhoto,
  Icon,
  JoinButton,
  MapLinks,
  SignBand,
} from '@/components/v2';
import { formatDate, formatTime } from '@/format.js';
import { cn } from '@/lib/utils.js';
import { NOW, TODAY_DOW, fieldById, games } from '../data/index.js';
import { SectionHeading, WRAP, useAppState, usePageTitle } from '../ui.jsx';
import NotFound from './NotFound.jsx';

const CARD = 'rounded-xl border border-line bg-surface p-5 shadow-[var(--lift)] dark:bg-surface-2';

const SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** Collapse identical days: "Daily", "Every day except Monday", or a list. */
function summarizeHours(hours) {
  const groups = new Map();
  for (const h of hours) {
    const value = h.open ? `${h.open} – ${h.close}` : h.note;
    groups.set(value, [...(groups.get(value) ?? []), h]);
  }
  const rows = [...groups.entries()].map(([value, days]) => {
    let label;
    if (days.length === 7) label = 'Daily';
    else if (days.length === 6) label = `Every day except ${hours.find((h) => !days.includes(h)).day}`;
    else label = days.length === 1 ? days[0].day : days.map((d) => SHORT[d.dow]).join(', ');
    return { label, value, open: Boolean(days[0].open), size: days.length };
  });
  return rows.sort((x, y) => y.size - x.size);
}

function Hours({ hours }) {
  const today = hours.find((h) => h.dow === TODAY_DOW);
  return (
    <div className="flex flex-col gap-3">
      <dl className="flex flex-col">
        {summarizeHours(hours).map((r) => (
          <div key={r.label} className="flex items-baseline justify-between gap-4 border-b border-line-soft py-2.5 text-[15px] last:border-0">
            <dt className="font-medium">{r.label}</dt>
            <dd className={cn('text-right tnum', !r.open && 'text-muted-foreground')}>{r.value}</dd>
          </div>
        ))}
      </dl>
      <p className="rounded-md bg-primary-soft px-3 py-2 text-[14px] font-semibold text-accent-ink tnum">
        Today ({today.day}): {today.open ? `open ${today.open} – ${today.close}` : today.note}
      </p>
    </div>
  );
}

export default function Field({ params }) {
  const field = fieldById(params[0]);
  usePageTitle(field ? field.name : 'Field not found');
  const { joined, join, leave, adjust } = useAppState();
  const calm = useReducedMotion();
  if (!field) return <NotFound />;

  const recent = games
    .filter((g) => g.field_id === field.field_id && g.start_time < NOW)
    .sort((a, b) => b.start_time.localeCompare(a.start_time))
    .slice(0, 3);
  const upcomingGames = field.upcoming.map(adjust);
  const lit = field.surface_type === 'Synthetic Turf';

  const flip = (i) =>
    calm
      ? {}
      : {
          initial: { opacity: 0, rotateX: -78 },
          animate: { opacity: 1, rotateX: 0 },
          transition: { delay: 0.06 + i * 0.04, duration: 0.42, ease: [0.22, 1, 0.36, 1] },
          style: { transformPerspective: 900, transformOrigin: '50% 0%' },
        };

  return (
    <div className="pb-16">
      <div className={cn(WRAP, 'pt-4 sm:pt-6')}>
        <a
          href="#/"
          className="mb-3 inline-flex h-11 items-center gap-2 rounded-full pr-3 text-[15px] font-semibold text-accent-ink hover:underline"
        >
          <Icon icon={ArrowLeft} tone="label" size="18px" />
          All upcoming games
        </a>

        {/* Hero: the photo in its real colours, the sign over its faded foot */}
        <div className="relative sm:pb-8">
          <FieldPhoto
            photo={field.photo}
            size="large"
            mask
            eager
            className="h-[240px] rounded-2xl sm:h-[360px] lg:h-[440px] [--mask-solid:62%]"
            creditClassName="top-3 right-3 bottom-auto left-auto"
          />
          <div className="relative z-10 -mt-16 px-2 sm:-mt-24 sm:px-6">
            <SignBand as="h1" size="md" borough={field.borough} className="shadow-[0_18px_40px_-20px_var(--shadow)]">
              {field.name}
            </SignBand>
          </div>
        </div>
        {field.photo?.stock && (
          <p className="mt-3 px-2 text-[13px] text-muted-foreground sm:px-6">
            No free photo of this field yet, so this is a stock photo of another pitch.
          </p>
        )}
      </div>

      <div className={cn(WRAP, 'mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_380px] lg:grid-rows-[auto_1fr] lg:gap-x-10')}>
        {/* Mobile order: getting there, games, details. Desktop: games left, details right. */}
        <div className="min-w-0 lg:col-start-2 lg:row-start-1">
            <section aria-labelledby="field-where" className={CARD}>
            <h2 id="field-where" className="mb-3 font-display text-[20px] font-bold tracking-[-0.01em]">
              Getting there
            </h2>
            <MapLinks address={field.location} lat={field.lat} lng={field.lng} />
            </section>
        </div>

        {/* Main column */}
        <div className="flex min-w-0 flex-col gap-12 lg:col-start-1 lg:row-span-2 lg:row-start-1">
          <section aria-labelledby="field-games">
            <SectionHeading id="field-games" aside={<p className="text-[15px] text-muted-foreground tnum">{upcomingGames.length} coming up</p>}>
              Upcoming games here
            </SectionHeading>
            {upcomingGames.length ? (
              <Board label={`Upcoming games at ${field.name}`}>
                {upcomingGames.map((g, i) => (
                  <BoardRow
                    key={g.game_id}
                    as={motion.li}
                    {...flip(i)}
                    game={g}
                    photo={field.photo}
                    action={
                      <JoinButton size="sm" joined={joined.has(g.game_id)} onClick={() => (joined.has(g.game_id) ? leave(g) : join(g))} />
                    }
                  />
                ))}
              </Board>
            ) : (
              <div className={cn(CARD, 'flex flex-col items-start gap-3')}>
                <p className="text-muted-foreground">No games booked here yet. Organizers can book an open slot.</p>
                <a href="#/" className="font-semibold text-accent-ink underline underline-offset-4">
                  See games on other fields
                </a>
              </div>
            )}
          </section>

          {recent.length > 0 && (
            <section aria-labelledby="field-recent">
              <SectionHeading id="field-recent">Recently on this pitch</SectionHeading>
              <Board label={`Recent games at ${field.name}`}>
                {recent.map((g) => (
                  <BoardRow key={g.game_id} game={g} photo={field.photo} />
                ))}
              </Board>
            </section>
          )}
        </div>

        {/* Aside */}
        <aside className="flex min-w-0 flex-col gap-4 lg:col-start-2 lg:row-start-2" aria-label="Field details">

          <section aria-labelledby="field-facts" className={CARD}>
            <h2 id="field-facts" className="sr-only">
              Field facts
            </h2>
            <dl className="grid grid-cols-1 gap-4 text-[15px] sm:grid-cols-3 lg:grid-cols-1">
              <div className="flex items-center gap-3">
                <BoroughBullet borough={field.borough} size="lg" decorative />
                <div>
                  <dt className="text-[13px] font-semibold text-muted-foreground">Borough</dt>
                  <dd className="font-semibold">{field.borough}</dd>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="grid size-11 flex-none place-items-center rounded-full bg-surface-2 text-foreground dark:bg-surface-3">
                  <Icon icon={Layers} tone="label" size="20px" />
                </span>
                <div>
                  <dt className="text-[13px] font-semibold text-muted-foreground">Surface</dt>
                  <dd className="font-semibold">
                    {field.surface_type}
                    <span className="font-normal text-muted-foreground">{lit ? ' · lit for night games' : ' · daylight only'}</span>
                  </dd>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="grid size-11 flex-none place-items-center rounded-full bg-surface-2 text-foreground dark:bg-surface-3">
                  <Icon icon={Trees} tone="label" size="20px" />
                </span>
                <div>
                  <dt className="text-[13px] font-semibold text-muted-foreground">Park</dt>
                  <dd className="font-semibold">{field.park}</dd>
                </div>
              </div>
            </dl>
          </section>

          <section aria-labelledby="field-hours" className={CARD}>
            <h2 id="field-hours" className="mb-2 flex items-center gap-2 font-display text-[20px] font-bold tracking-[-0.01em]">
              <Icon icon={Clock} tone="label" size="20px" />
              Opening hours
            </h2>
            <Hours hours={field.hours} />
            <p className="mt-3 text-[13px] text-muted-foreground">New York time. Games must fit inside these hours.</p>
          </section>

          <section aria-labelledby="field-closures" className={CARD}>
            <h2 id="field-closures" className="mb-3 flex items-center gap-2 font-display text-[20px] font-bold tracking-[-0.01em]">
              <Icon icon={CalendarX2} tone="label" size="20px" />
              Closures
            </h2>
            {field.closures.length ? (
              <ul className="flex flex-col gap-2">
                {field.closures.map((c) => (
                  <li key={c.id} className="rounded-md bg-warning-soft px-3 py-2.5 text-[14px] text-warning">
                    <span className="font-semibold">{c.now ? 'Closed today: ' : ''}{c.reason}</span>
                    <span className="block tnum">
                      {formatDate(c.start)} {formatTime(c.start)} to {formatDate(c.end)} {formatTime(c.end)}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-muted-foreground">No closures coming up. The pitch keeps its usual hours.</p>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}

// /fields/:id  Field page (public), from GET /api/public/fields/:id:
// photo hero with credit, address with map links and a small street map,
// collapsed opening hours, closures, and the field's upcoming games.
// Owner: Abhinav
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';
import { ArrowLeft, CalendarX2, Clock, Layers, Map as MapIcon, Trees } from 'lucide-react';
import { api } from '../../api.js';
import { Board, BoardRow, BoroughBullet, FieldPhoto, Icon, MapLinks, SignBand } from '../../components/v2/index.js';
import MiniMap from '../../components/v2/map/MiniMap.jsx';
import { formatDate, formatTime } from '../../format.js';
import { fieldMeta, fieldPhoto } from '../../lib/fieldPhotos.js';
import { summarizeHours, todayHours } from '../../lib/hours.js';
import { cn } from '../../lib/utils.js';

const CARD = 'rounded-xl border border-line bg-surface p-5 shadow-[var(--lift)] dark:bg-surface-2';
const H2 = 'flex items-center gap-2 font-display text-[20px] font-bold tracking-[-0.01em] text-foreground';

function Skeleton() {
  return (
    <div aria-busy="true" aria-label="Loading the field" className="flex flex-col gap-4">
      <div className="h-[240px] animate-pulse rounded-2xl bg-surface-2 motion-reduce:animate-none sm:h-[360px] dark:bg-surface-3" />
      <div className="h-16 animate-pulse rounded-lg bg-surface-2 motion-reduce:animate-none dark:bg-surface-3" />
    </div>
  );
}

export default function FieldPage() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let live = true;
    setData(null);
    setError('');
    api(`/public/fields/${encodeURIComponent(id)}`)
      .then((d) => live && setData(d))
      .catch((e) => live && setError(e.message));
    return () => {
      live = false;
    };
  }, [id]);

  useEffect(() => {
    if (data) document.title = `${data.field.name} · NYC Pickup Soccer`;
  }, [data]);

  const back = (
    <Link to="/map" className="mb-3 inline-flex h-11 items-center gap-2 rounded-full pr-3 text-[15px] font-semibold text-accent-ink no-underline hover:underline">
      <Icon icon={ArrowLeft} tone="label" size="18px" />
      Field map
    </Link>
  );

  if (error) {
    return (
      <div data-ui className="font-sans text-foreground">
        {back}
        <div className={cn(CARD, 'flex flex-col items-start gap-3')} role="alert">
          <p className="font-display text-[22px] font-bold">{error}</p>
          <Link to="/map" className="font-semibold text-accent-ink underline underline-offset-4">
            Find a field on the map
          </Link>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div data-ui className="font-sans text-foreground">
        {back}
        <Skeleton />
      </div>
    );
  }

  const { field, hours, closures, games } = data;
  const meta = fieldMeta(field.field_id);
  const photo = fieldPhoto(field.field_id);
  const today = todayHours(hours);
  // Lit fields stay open into the evening (see db/seed.sql and the open-data import).
  const lit = hours.some((h) => h.close >= '21:00');

  return (
    <div data-ui className="pb-4 font-sans text-[15px] leading-6 text-foreground">
      {back}

      {/* Hero: the photo in its real colours, the sign over its faded foot */}
      <div className="relative sm:pb-8">
        <FieldPhoto
          photo={photo}
          size="large"
          mask
          eager
          className="h-[220px] rounded-2xl sm:h-[340px] lg:h-[400px] [--mask-solid:62%]"
          creditClassName="top-3 right-3 bottom-auto left-auto"
        />
        <div className="relative z-10 -mt-16 px-2 sm:-mt-24 sm:px-6">
          <SignBand as="h1" size="md" borough={field.borough} className="shadow-[0_18px_40px_-20px_var(--shadow)]">
            {field.name}
          </SignBand>
        </div>
      </div>
      {photo?.stock && <p className="mt-3 px-2 text-[13px] text-muted-foreground sm:px-6">No free photo of this field yet, so this is a stock photo of another pitch.</p>}

      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px] lg:grid-rows-[auto_1fr] lg:gap-x-8">
        {/* Getting there first on mobile; right column on desktop */}
        <section aria-labelledby="where" className={cn(CARD, 'flex flex-col gap-4 lg:col-start-2 lg:row-start-1')}>
          <h2 id="where" className={H2}>
            Getting there
          </h2>
          <MapLinks address={field.location} lat={field.latitude} lng={field.longitude} />
          <MiniMap lat={field.latitude} lng={field.longitude} name={field.name} borough={field.borough} className="h-48" />
          <Link
            to={`/map?sel=${field.field_id}`}
            className="inline-flex h-11 items-center gap-2 self-start rounded-full border border-line-strong px-4 text-[14px] font-semibold text-foreground no-underline hover:bg-surface-2 dark:hover:bg-surface-3"
          >
            <Icon icon={MapIcon} tone="label" size="16px" />
            See on the field map
          </Link>
        </section>

        <section aria-labelledby="games" className="min-w-0 lg:col-start-1 lg:row-span-2 lg:row-start-1">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
            <h2 id="games" className="font-display text-[24px] leading-tight font-bold tracking-[-0.02em] sm:text-[28px]">
              Upcoming games here
            </h2>
            <p className="text-[15px] text-muted-foreground">{games.length} coming up</p>
          </div>
          {games.length ? (
            <Board label={`Upcoming games at ${field.name}`}>
              {games.map((g) => (
                <BoardRow key={g.game_id} game={g} photo={photo} href={`/status?gameId=${g.game_id}`} linkComponent={Link} />
              ))}
            </Board>
          ) : (
            <div className={cn(CARD, 'flex flex-col items-start gap-3')}>
              <p className="text-muted-foreground">No games booked here yet. Organizers can book an open slot.</p>
              <Link to="/map" className="font-semibold text-accent-ink underline underline-offset-4">
                See fields with games
              </Link>
            </div>
          )}
        </section>

        <aside aria-label="Field details" className="flex min-w-0 flex-col gap-4 lg:col-start-2 lg:row-start-2">
          <section aria-label="Field facts" className={CARD}>
            <dl className="grid grid-cols-1 gap-4 sm:grid-cols-3 lg:grid-cols-1">
              <div className="flex items-center gap-3">
                <BoroughBullet borough={field.borough} size="lg" decorative />
                <div>
                  <dt className="text-[13px] font-semibold text-muted-foreground">Borough</dt>
                  <dd className="font-semibold">{field.borough}</dd>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="grid size-11 flex-none place-items-center rounded-full bg-surface-2 dark:bg-surface-3">
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
              {meta?.park && (
                <div className="flex items-center gap-3">
                  <span className="grid size-11 flex-none place-items-center rounded-full bg-surface-2 dark:bg-surface-3">
                    <Icon icon={Trees} tone="label" size="20px" />
                  </span>
                  <div>
                    <dt className="text-[13px] font-semibold text-muted-foreground">Park</dt>
                    <dd className="font-semibold">{meta.park}</dd>
                  </div>
                </div>
              )}
            </dl>
          </section>

          <section aria-labelledby="hours" className={CARD}>
            <h2 id="hours" className={cn(H2, 'mb-2')}>
              <Icon icon={Clock} tone="label" size="20px" />
              Opening hours
            </h2>
            <dl className="flex flex-col">
              {summarizeHours(hours).map((r) => (
                <div key={r.label} className="flex items-baseline justify-between gap-4 border-b border-line-soft py-2.5 last:border-0">
                  <dt className="font-medium">{r.label}</dt>
                  <dd className={cn('text-right tnum', !r.open && 'text-muted-foreground')}>{r.value}</dd>
                </div>
              ))}
            </dl>
            {today && (
              <p className="mt-2 rounded-md bg-primary-soft px-3 py-2 text-[14px] font-semibold text-accent-ink tnum">
                Today ({today.day}): {today.open ? `open ${today.value}` : 'closed'}
              </p>
            )}
            <p className="mt-3 text-[13px] text-muted-foreground">New York time. Games must fit inside these hours.</p>
          </section>

          <section aria-labelledby="closures" className={CARD}>
            <h2 id="closures" className={cn(H2, 'mb-3')}>
              <Icon icon={CalendarX2} tone="label" size="20px" />
              Closures
            </h2>
            {closures.length ? (
              <ul className="flex flex-col gap-2">
                {closures.map((c) => (
                  <li key={c.closure_id} className="rounded-md bg-warning-soft px-3 py-2.5 text-[14px] text-warning">
                    <span className="font-semibold">{c.reason}</span>
                    <span className="block tnum">
                      {formatDate(c.start_time)} {formatTime(c.start_time)} to {formatDate(c.end_time)} {formatTime(c.end_time)}
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

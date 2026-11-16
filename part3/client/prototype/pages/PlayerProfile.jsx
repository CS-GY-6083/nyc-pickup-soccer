// #/players/:id  Player profile (logged-in users only; names, never emails).
// Initials avatar in the player's main borough colour, stat tiles, games and
// hours by month, coming up, recent games. Computed from the seed sign-ups
// and ratings (no /api/players/:id yet), so marked as sample data.
import { CalendarCheck, Clock, Lock, MapPinned, Megaphone, Shirt, Star, Trophy } from 'lucide-react';
import { Board, BoardRow, BoroughBullet, Icon, StatTile, boroughInfo } from '@/components/v2';
import { formatMonth } from '@/format.js';
import { cn } from '@/lib/utils.js';
import { gameById, photoFor, profileOf } from '../data/index.js';
import { SampleBadge, SectionHeading, WRAP, usePageTitle, useRequireLogin } from '../ui.jsx';
import NotFound from './NotFound.jsx';

function initials(name) {
  return name
    .split(/\s+/)
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

function Stars({ value }) {
  const full = Math.round(value);
  return (
    <span className="inline-flex items-center gap-0.5 text-warning" aria-hidden="true">
      {[1, 2, 3, 4, 5].map((n) => (
        <Star key={n} strokeWidth={2} className={cn('size-4', n <= full ? 'fill-current' : 'opacity-40')} />
      ))}
    </span>
  );
}

function fmtHours(h) {
  return Number.isInteger(h) ? String(h) : h.toFixed(1);
}

export default function PlayerProfile({ params }) {
  const viewer = useRequireLogin(`/players/${params[0]}`, 'Player profiles are for logged-in players. Log in to see this one.');
  const p = profileOf(params[0]);
  usePageTitle(p ? p.name : 'Player not found');
  if (!viewer) return null;
  if (!p) return <NotFound text="There is no player with that number." />;

  const s = p.stats;
  const color = p.homeBorough ? boroughInfo(p.homeBorough).color : 'var(--p-graphite-800)';
  const isMe = viewer.user_id === p.user_id;
  const upcomingGames = p.upcomingIds.map(gameById);
  const byMonth = Object.entries(
    p.played.reduce((acc, g) => {
      const m = g.start_time.slice(0, 7);
      const h = (Date.parse(g.end_time.replace(' ', 'T')) - Date.parse(g.start_time.replace(' ', 'T'))) / 3.6e6;
      acc[m] = acc[m] ?? { games: 0, hours: 0 };
      acc[m].games += 1;
      acc[m].hours += h;
      return acc;
    }, {}),
  ).sort((a, b) => b[0].localeCompare(a[0]));

  return (
    <div className={cn(WRAP, 'pt-6 pb-16 sm:pt-10')}>
      {/* Header */}
      <section aria-labelledby="player-name" className="flex flex-col gap-5 rounded-2xl border border-line bg-surface p-5 shadow-[var(--lift)] sm:flex-row sm:items-center sm:gap-6 sm:p-6 dark:bg-surface-2">
        <span
          role="img"
          aria-label={`${p.name}'s initials`}
          className="grid size-24 flex-none place-items-center rounded-full font-display text-[36px] font-extrabold tracking-[-0.02em] sm:size-28 sm:text-[42px]"
          style={{ backgroundColor: color, color: 'var(--borough-text)' }}
        >
          {initials(p.name)}
        </span>
        <div className="min-w-0 flex-1">
          <h1 id="player-name" className="font-display text-[34px] leading-tight font-bold tracking-[-0.025em] sm:text-[44px]">
            {p.name}
          </h1>
          <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[15px] text-muted-foreground">
            <span className="font-semibold text-foreground capitalize">{p.role}</span>
            {p.homeBorough && (
              <>
                <span aria-hidden="true">·</span>
                <span className="inline-flex items-center gap-1.5">
                  Plays mostly in <BoroughBullet borough={p.homeBorough} size="xs" decorative /> {p.homeBorough}
                </span>
              </>
            )}
            {isMe && (
              <>
                <span aria-hidden="true">·</span>
                <span className="font-semibold text-accent-ink">This is you</span>
              </>
            )}
          </p>
        </div>
        <div className="flex flex-col items-start gap-2 sm:items-end">
          <SampleBadge>Sample data · from the seed</SampleBadge>
          <p className="inline-flex items-center gap-1.5 text-[13px] text-muted-foreground">
            <Icon icon={Lock} tone="body" size="14px" />
            Logged-in players only · no emails shown
          </p>
        </div>
      </section>

      {/* Stats */}
      <section aria-labelledby="player-stats" className="mt-10">
        <SectionHeading id="player-stats">On the pitch</SectionHeading>
        <dl className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          <StatTile icon={CalendarCheck} label="Games played" value={s.gamesPlayed} note="Kick-off passed, not called off" />
          <StatTile icon={Clock} label="Hours on the pitch" value={fmtHours(s.hours)} unit="h" note="From each game's booked time" />
          <StatTile icon={MapPinned} label="Boroughs played" value={s.boroughs.length} unit="of 5">
            <span className="flex flex-wrap gap-1">
              {s.boroughs.map((b) => (
                <BoroughBullet key={b} borough={b} size="sm" />
              ))}
            </span>
          </StatTile>
          <StatTile icon={Shirt} label="Favourite format" value={s.favFormat} note={s.favCount ? `${s.favCount} of ${s.gamesPlayed} games` : 'No games yet'} />
          {p.role === 'organizer' ? (
            <StatTile icon={Megaphone} label="Games organized" value={s.organized} note="Not counting called-off games" />
          ) : (
            <StatTile icon={Star} label="Ratings given" value={s.ratingsGiven} note="Stars on games played" />
          )}
          <StatTile icon={Trophy} label="Average game rating" value={s.avgRating ? s.avgRating.toFixed(1) : '—'} unit={s.avgRating ? '/ 5' : undefined}>
            {s.avgRating ? (
              <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-muted-foreground">
                <Stars value={s.avgRating} />
                <span className="whitespace-nowrap">{s.ratingsCount} ratings</span>
              </span>
            ) : (
              <span className="text-[13px] text-muted-foreground">No ratings yet</span>
            )}
          </StatTile>
        </dl>
      </section>

      {/* Activity by month (the "My activity" numbers as a table) */}
      {byMonth.length > 0 && (
        <section aria-labelledby="player-months" className="mt-10">
          <SectionHeading id="player-months">Games and hours by month</SectionHeading>
          <div className="overflow-hidden rounded-xl border border-line bg-surface shadow-[var(--lift)] dark:bg-surface-2">
            <table className="w-full text-[15px]">
              <thead>
                <tr className="text-left text-[13px] text-muted-foreground">
                  <th scope="col" className="px-5 py-3 font-semibold">
                    Month
                  </th>
                  <th scope="col" className="px-5 py-3 text-right font-semibold">
                    Games
                  </th>
                  <th scope="col" className="px-5 py-3 text-right font-semibold">
                    Hours
                  </th>
                </tr>
              </thead>
              <tbody>
                {byMonth.map(([m, v]) => (
                  <tr key={m} className="border-t border-line-soft">
                    <th scope="row" className="px-5 py-3 text-left font-medium">
                      {formatMonth(m)}
                    </th>
                    <td className="px-5 py-3 text-right tnum">{v.games}</td>
                    <td className="px-5 py-3 text-right tnum">{fmtHours(v.hours)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {upcomingGames.length > 0 && (
        <section aria-labelledby="player-next" className="mt-12">
          <SectionHeading id="player-next">Coming up</SectionHeading>
          <Board label={`${p.name}'s upcoming games`}>
            {upcomingGames.map((g) => (
              <BoardRow key={g.game_id} game={g} photo={photoFor(g.field_id)} />
            ))}
          </Board>
        </section>
      )}

      <section aria-labelledby="player-recent" className="mt-12">
        <SectionHeading id="player-recent">Recent games</SectionHeading>
        {p.recent.length ? (
          <Board label={`${p.name}'s recent games`}>
            {p.recent.map((g) => (
              <BoardRow
                key={g.game_id}
                game={g}
                photo={photoFor(g.field_id)}
                action={
                  p.myRatings[g.game_id] ? (
                    <span className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-flap-wait">
                      <Star strokeWidth={2} className="size-4 fill-current" aria-hidden="true" />
                      <span className="tnum">
                        {isMe ? 'You rated' : 'Rated'} {p.myRatings[g.game_id]} / 5
                      </span>
                    </span>
                  ) : isMe ? (
                    <a href="#/list?tab=past" className="inline-flex h-10 items-center gap-1.5 rounded-full border border-line-strong px-3.5 text-[13px] font-semibold text-flap-foreground hover:bg-[var(--line-soft)]">
                      <Star strokeWidth={2} className="size-4" aria-hidden="true" />
                      Rate game
                    </a>
                  ) : (
                    <span className="text-[13px] text-flap-muted">Not rated</span>
                  )
                }
              />
            ))}
          </Board>
        ) : (
          <p className="rounded-xl border border-dashed border-line-strong p-6 text-muted-foreground">No games played yet.</p>
        )}
      </section>
    </div>
  );
}

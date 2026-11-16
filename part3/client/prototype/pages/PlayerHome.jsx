// #/player  Player home (logged in): your next game first, then this role's
// use cases as platform signs.
import { ChartColumn, Check, ChevronRight, ListChecks, Lock, Search, Star } from 'lucide-react';
import { Board, BoardRow, GameCard, Icon, SignBand } from '@/components/v2';
import { cn } from '@/lib/utils.js';
import { gameById, isUpcomingAtNow, photoFor, profileOf } from '../data/index.js';
import { SectionHeading, WRAP, leaveLock, useAppState, usePageTitle, useRequireLogin } from '../ui.jsx';

// Same use cases and wording as src/pages/player/playerUseCases.js, as a
// compact row of links.
const useCases = (userId) => [
  { href: '#/list', title: 'My games', icon: ListChecks },
  { href: '#/', title: 'Find & join games', icon: Search },
  { href: '#/list?tab=past', title: 'Rate past games', icon: Star },
  { href: `#/players/${userId}`, title: 'My activity', icon: ChartColumn },
];

export default function PlayerHome() {
  usePageTitle('Player home');
  const user = useRequireLogin('/player', 'Log in to see your player home.');
  const { joined, adjust } = useAppState();
  if (!user) return null;

  const profile = profileOf(user.user_id);
  const mine = [...joined]
    .map(gameById)
    .filter((g) => g && (isUpcomingAtNow(g) || g.game_state === 'in_progress'))
    .sort((a, b) => a.start_time.localeCompare(b.start_time))
    .map(adjust);
  const [next, ...later] = mine;
  const lock = next ? leaveLock(next) : null;

  return (
    <div className={cn(WRAP, 'pt-6 pb-16 sm:pt-10')}>
      <SignBand as="h1" size="md" borough={profile?.homeBorough}>
        Welcome back, {user.name.split(' ')[0]}
      </SignBand>

      <nav aria-label="Player use cases" className="mt-5">
        <ul className="flex flex-wrap gap-2">
          {useCases(user.user_id).map((u) => (
            <li key={u.title}>
              <a
                href={u.href}
                className="inline-flex h-11 items-center gap-2 rounded-full border border-line-strong bg-surface pr-3 pl-4 text-[15px] font-semibold text-foreground transition-colors duration-150 hover:bg-surface-2 motion-reduce:transition-none dark:bg-surface-2 dark:hover:bg-surface-3"
              >
                <Icon icon={u.icon} tone="label" size="17px" className="text-accent-ink" />
                {u.title}
                <Icon icon={ChevronRight} tone="label" size="16px" className="text-muted-foreground" />
              </a>
            </li>
          ))}
        </ul>
      </nav>

      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <section aria-labelledby="next-game" className="min-w-0">
          <SectionHeading id="next-game">{next?.game_state === 'in_progress' ? 'Your game is on now' : 'Your next game'}</SectionHeading>
          {next ? (
            <GameCard
              game={next}
              photo={photoFor(next.field_id)}
              action={
                <span className="flex flex-col items-end gap-1 text-right">
                  <span className="inline-flex items-center gap-1.5 text-[14px] font-semibold text-accent-ink">
                    <Icon icon={Check} tone="label" size="16px" />
                    On the team sheet
                  </span>
                  {lock && (
                    <span className="inline-flex items-center gap-1 text-[12px] text-muted-foreground">
                      <Icon icon={Lock} tone="body" size="13px" />
                      Leaving locked
                    </span>
                  )}
                </span>
              }
            />
          ) : (
            <div className="flex flex-col items-start gap-3 rounded-xl border border-dashed border-line-strong p-6">
              <p className="font-display text-[20px] font-bold">No games on your list yet.</p>
              <a href="#/" className="font-semibold text-accent-ink underline underline-offset-4">
                Find a game to join
              </a>
            </div>
          )}
        </section>

        <section aria-labelledby="later" className="min-w-0">
          <SectionHeading id="later" aside={<a href="#/list" className="text-[15px] font-semibold text-accent-ink underline underline-offset-4">All my games</a>}>
            Coming up next
          </SectionHeading>
          {later.length > 0 ? (
            <Board label="Your other upcoming games" columns={false}>
              {later.map((g) => (
                <BoardRow key={g.game_id} game={g} photo={photoFor(g.field_id)} />
              ))}
            </Board>
          ) : (
            <p className="rounded-xl border border-dashed border-line-strong p-6 text-muted-foreground">
              Nothing else on your list.{' '}
              <a href="#/" className="font-semibold text-accent-ink underline underline-offset-4">
                Find another game
              </a>
              .
            </p>
          )}
        </section>
      </div>
    </div>
  );
}

// #/list  T1 list template, as "My games" (logged in). Upcoming and Past tabs
// (the tab lives in the hash). Leave is allowed until 24 hours before
// kick-off, with a confirm step; inside 24 hours it is locked and the reason
// is shown. Past games can be rated.
import { useEffect, useId, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Check, Lock, LogOut, Star } from 'lucide-react';
import { Board, BoardRow, Button, Icon, IconSwap, SignBand } from '@/components/v2';
import { cn } from '@/lib/utils.js';
import { gameById, hoursUntil, isUpcomingAtNow, photoFor, profileOf } from '../data/index.js';
import { replaceQuery } from '../router.js';
import { WRAP, leaveLock, useAppState, usePageTitle, useRequireLogin } from '../ui.jsx';

function LeaveAction({ game }) {
  const { leave } = useAppState();
  const [confirming, setConfirming] = useState(false);
  const lock = leaveLock(game);
  if (lock) {
    const h = hoursUntil(game.start_time);
    const short = game.game_state === 'in_progress' ? 'in play' : h < 1 ? 'kick-off in under 1 h' : `kick-off in ${Math.floor(h)} h`;
    return (
      <span title={lock} className="inline-flex items-center gap-1.5 text-[13px] font-semibold whitespace-nowrap text-flap-muted">
        <Icon icon={Lock} tone="label" size="14px" />
        Locked · {short}
        <span className="sr-only">. {lock}</span>
      </span>
    );
  }
  if (!confirming) {
    return (
      <Button variant="secondary" size="sm" onClick={() => setConfirming(true)}>
        <Icon icon={LogOut} tone="label" size="16px" />
        Leave game
      </Button>
    );
  }
  return (
    <div className="flex flex-wrap items-center justify-end gap-2" role="group" aria-label={`Leave game ${game.game_id}?`}>
      <Button variant="quiet" size="sm" onClick={() => setConfirming(false)} className="text-flap-foreground hover:bg-[var(--line)]">
        Keep my spot
      </Button>
      <Button variant="danger" size="sm" onClick={() => leave(game)} autoFocus>
        Yes, leave
      </Button>
    </div>
  );
}

function RateAction({ game, rated, onRate }) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(0);
  const [error, setError] = useState('');
  const name = useId();
  if (rated) {
    return (
      <span className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-flap-wait">
        <IconSwap swapKey="rated">
          <Icon icon={Check} tone="label" size="16px" />
        </IconSwap>
        <span className="tnum">Rated {rated} / 5</span>
      </span>
    );
  }
  if (!open) {
    return (
      <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
        <Icon icon={Star} tone="label" size="16px" />
        Rate game
      </Button>
    );
  }
  return (
    <form
      className="flex flex-wrap items-center justify-end gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (!value) setError('Pick 1 to 5 stars first.');
        else onRate(value);
      }}
    >
      <fieldset className="flex items-center">
        <legend className="sr-only">Stars for game {game.game_id}</legend>
        {[1, 2, 3, 4, 5].map((n) => (
          <label key={n} className="grid size-10 cursor-pointer place-items-center">
            <input
              type="radio"
              name={name}
              value={n}
              checked={value === n}
              onChange={() => {
                setValue(n);
                setError('');
              }}
              className="peer sr-only"
            />
            <Star
              aria-hidden="true"
              strokeWidth={2}
              className={cn(
                'size-6 rounded-sm text-flap-wait peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[color:var(--focus)]',
                n <= value ? 'fill-current' : 'opacity-60',
              )}
            />
            <span className="sr-only">
              {n} {n === 1 ? 'star' : 'stars'}
            </span>
          </label>
        ))}
      </fieldset>
      <Button type="submit" size="sm">
        Save rating
      </Button>
      {error && (
        <p role="alert" className="basis-full text-right text-[13px] font-medium text-flap-stop">
          {error}
        </p>
      )}
    </form>
  );
}

export default function MyGames({ query }) {
  usePageTitle('My games');
  const user = useRequireLogin('/list', 'Log in to see My games.');
  const { joined, adjust, notify } = useAppState();
  const [tab, setTab] = useState(query.get('tab') === 'past' ? 'past' : 'upcoming');
  const [ratings, setRatings] = useState(null);
  const calm = useReducedMotion();
  const tabName = useId();

  useEffect(() => {
    if (user) replaceQuery('/list', { tab: tab === 'past' ? 'past' : '' });
  }, [tab, user]);

  if (!user) return null;
  const profile = profileOf(user.user_id);
  const myRatings = ratings ?? profile.myRatings;

  const upcoming = [...joined]
    .map(gameById)
    .filter((g) => g && (isUpcomingAtNow(g) || g.game_state === 'in_progress'))
    .sort((a, b) => a.start_time.localeCompare(b.start_time))
    .map(adjust);
  const past = profile.played;
  const exit = calm ? { opacity: 0, transition: { duration: 0 } } : { opacity: 0, scale: 0.98, transition: { duration: 0.18 } };

  return (
    <div className={cn(WRAP, 'pt-6 pb-16 sm:pt-10')}>
      <SignBand as="h1" size="md">
        My games
      </SignBand>
      <p className="mt-4 max-w-[62ch] text-[17px] leading-7 text-muted-foreground">
        Your squad list. You can leave a game up to 24 hours before kick-off; after that it&rsquo;s locked. Rate games you played
        once they&rsquo;re over.
      </p>

      <div role="radiogroup" aria-label="Which games" className="mt-6 inline-flex h-12 items-center gap-1 rounded-full border border-line-strong bg-surface-2 p-1">
        {[
          ['upcoming', `Upcoming · ${upcoming.length}`],
          ['past', `Past · ${past.length}`],
        ].map(([v, label]) => (
          <label key={v} className="relative cursor-pointer">
            <input type="radio" name={tabName} value={v} checked={tab === v} onChange={() => setTab(v)} className="peer sr-only" />
            <span className="relative flex h-10 items-center rounded-full px-4 text-[14px] font-semibold text-muted-foreground transition-colors duration-150 peer-checked:text-primary-foreground peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[color:var(--focus)]">
              {tab === v && (
                <motion.span
                  layoutId="mygames-tab"
                  className="absolute inset-0 rounded-full bg-primary shadow-[var(--primary-glow)]"
                  transition={{ type: 'spring', stiffness: 520, damping: 38 }}
                />
              )}
              <span className="relative tnum">{label}</span>
            </span>
          </label>
        ))}
      </div>

      <div className="mt-5">
        {tab === 'upcoming' ? (
          upcoming.length ? (
            <Board label="Upcoming games you joined">
              <AnimatePresence initial={false}>
                {upcoming.map((g) => (
                  <BoardRow key={g.game_id} as={motion.li} exit={exit} game={g} photo={photoFor(g.field_id)} action={<LeaveAction game={g} />} />
                ))}
              </AnimatePresence>
            </Board>
          ) : (
            <div className="flex flex-col items-start gap-3 rounded-2xl border border-dashed border-line-strong p-6">
              <p className="font-display text-[22px] font-bold">No games on your list.</p>
              <p className="text-muted-foreground">Join one and it shows up here.</p>
              <Button href="#/" variant="secondary">
                Find a game
              </Button>
            </div>
          )
        ) : (
          <Board label="Games you played">
            {past.map((g) => (
              <BoardRow
                key={g.game_id}
                game={g}
                stackAction
                photo={photoFor(g.field_id)}
                action={
                  <RateAction
                    game={g}
                    rated={myRatings[g.game_id]}
                    onRate={(n) => {
                      setRatings({ ...myRatings, [g.game_id]: n });
                      notify({ type: 'success', text: `Rating saved: ${n} of 5 stars for game #${g.game_id}.` });
                    }}
                  />
                }
              />
            ))}
          </Board>
        )}
      </div>
    </div>
  );
}

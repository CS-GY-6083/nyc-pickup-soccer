// #/games/:id  Game detail. One title band, then one row of facts (when,
// status, format, spots). The field card owns the photo, address and map
// links; the team sheet lists who's in; the join panel holds the one action.
//  - Logged out: Join goes to Log in, which comes back here and finishes.
//  - Logged in: Join and Leave happen in place, with a message here.
import { useEffect, useRef } from 'react';
import { ArrowLeft, Check, Lock, LogOut, Trophy, Users } from 'lucide-react';
import {
  BoroughBullet,
  Button,
  FieldPhoto,
  Icon,
  IconSwap,
  JoinButton,
  MapLinks,
  SignBand,
  SpotsWord,
  StatusWords,
  TimeTiles,
  gameState,
} from '@/components/v2';
import { formatDate, formatTime } from '@/format.js';
import { cn } from '@/lib/utils.js';
import { DEMO_LOGIN, fieldById, gameById, isUpcomingAtNow, rosterIds, shortName, userById } from '../data/index.js';
import { Flash, SampleBadge, WRAP, joinBlock, leaveLock, useAppState, usePageTitle } from '../ui.jsx';
import NotFound from './NotFound.jsx';

const CARD = 'rounded-xl border border-line bg-surface p-5 shadow-[var(--lift)] dark:bg-surface-2';

function Facts({ game }) {
  return (
    <section aria-label="When and status" className="board flex flex-wrap items-center gap-x-8 gap-y-4 rounded-2xl p-3 sm:p-4">
      <div className="flex flex-col gap-1.5">
        <span className="pl-0.5 text-[15px] font-semibold text-flap-foreground tnum">{formatDate(game.start_time)}</span>
        <span className="flex items-center gap-2">
          <TimeTiles timestamp={game.start_time} size="md" />
          <span className="text-[14px] text-flap-muted tnum">to {formatTime(game.end_time)}</span>
        </span>
      </div>
      <StatusWords state={game.game_state} size="lg" />
      <div className="text-[15px]">
        <span className="font-semibold text-flap-foreground">{game.format}</span>
        <span className="text-flap-muted capitalize"> · {game.skill_level}</span>
        <span className="block text-[13px] text-flap-muted">{game.surface_type}</span>
      </div>
      <div className="flex items-center gap-2.5">
        <SpotsWord game={game} />
        <span className="text-[14px] text-flap-muted tnum">
          {game.signed_up} of {game.max_players} signed up
        </span>
      </div>
    </section>
  );
}

function Roster({ game, joinedByMe }) {
  const { user } = useAppState();
  let ids = rosterIds(game.game_id);
  // Follow this prototype's join / leave for the demo player.
  if (joinedByMe && !ids.includes(DEMO_LOGIN.user_id)) ids = [...ids, DEMO_LOGIN.user_id];
  if (!joinedByMe && ids.includes(DEMO_LOGIN.user_id)) ids = ids.filter((id) => id !== DEMO_LOGIN.user_id);
  const people = ids.map(userById).filter(Boolean);
  const organizer = userById(game.organizer_id);
  const nameLink = 'font-medium text-foreground underline decoration-[var(--line-strong)] underline-offset-4 hover:decoration-current';

  return (
    <section aria-labelledby="roster" className={CARD}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 id="roster" className="flex items-center gap-2 font-display text-[20px] font-bold tracking-[-0.01em]">
          <Icon icon={Users} tone="label" size="20px" />
          Team sheet
          <span className="text-[15px] font-semibold text-muted-foreground tnum">
            {people.length} / {game.max_players}
          </span>
        </h2>
        <SampleBadge>Seed sign-ups</SampleBadge>
      </div>
      <p className="mb-3 text-[14px] text-muted-foreground">
        Hosted by{' '}
        {user ? (
          <a href={`#/players/${organizer.user_id}`} className={cn(nameLink, 'font-semibold')}>
            {organizer.name}
          </a>
        ) : (
          <span className="font-semibold text-foreground">{shortName(organizer.name)}</span>
        )}
      </p>
      {people.length === 0 ? (
        <p className="text-muted-foreground">Nobody has signed up yet. Be the first on the team sheet.</p>
      ) : (
        <ol className="grid grid-cols-1 gap-x-4 sm:grid-cols-2">
          {people.map((p, i) => (
            <li key={p.user_id} className="flex min-h-11 items-center gap-3 border-b border-line-soft text-[15px]">
              <span className="w-6 text-right text-[13px] text-muted-foreground tnum">{i + 1}</span>
              {user ? (
                <a href={`#/players/${p.user_id}`} className={nameLink}>
                  {p.name}
                </a>
              ) : (
                <span className="font-medium">{shortName(p.name)}</span>
              )}
              {user && p.user_id === user.user_id && (
                <span className="rounded-full bg-primary-soft px-2 py-0.5 text-[12px] font-semibold text-accent-ink">You</span>
              )}
            </li>
          ))}
        </ol>
      )}
      {!user && (
        <p className="mt-4 text-[13px] text-muted-foreground">
          <a href="#/login" className="font-semibold text-accent-ink underline underline-offset-4">
            Log in
          </a>{' '}
          to see full names and player profiles.
        </p>
      )}
    </section>
  );
}

function JoinPanel({ game }) {
  const { user, joined, join, leave, gameNotes, noteGame } = useAppState();
  const isIn = joined.has(game.game_id);
  const note = gameNotes[game.game_id];
  const block = joinBlock(game);
  const lock = isIn ? leaveLock(game) : null;
  const statusRef = useRef(null);
  const was = useRef(isIn);
  // After joining in place, keep focus on the new state (the button is gone).
  useEffect(() => {
    if (isIn && !was.current) statusRef.current?.focus();
    was.current = isIn;
  }, [isIn]);

  return (
    <section aria-labelledby="join-title" className={cn(CARD, 'flex flex-col gap-4')}>
      <h2 id="join-title" className="font-display text-[20px] font-bold tracking-[-0.01em]">
        {isIn ? 'Your spot' : isUpcomingAtNow(game) ? 'Play in this game' : gameState(game.game_state).label}
      </h2>

      {note && (
        <Flash
          type={note.type}
          onDismiss={() => noteGame(game.game_id, null)}
          action={
            note.undo ? (
              <button
                type="button"
                onClick={() => {
                  note.undo.run();
                  noteGame(game.game_id, { type: 'success', text: `You’re back on the team sheet for game #${game.game_id}.` });
                }}
                className="ml-2 cursor-pointer font-semibold underline underline-offset-4"
              >
                {note.undo.label}
              </button>
            ) : null
          }
        >
          {note.text}
        </Flash>
      )}

      {(isIn || !block) && (
        <IconSwap swapKey={isIn ? 'in' : 'out'} className="w-full justify-items-stretch [&>*]:w-full [&>*]:justify-items-stretch">
          {isIn ? (
            <p ref={statusRef} tabIndex={-1} className="flex items-center gap-2 text-[16px] font-semibold text-accent-ink outline-none">
              <Icon icon={Check} tone="label" size="20px" />
              You&rsquo;re on the team sheet
            </p>
          ) : (
            <JoinButton joined={false} size="lg" className="w-full" label={user ? 'Join game' : 'Log in to join'} onClick={() => join(game, { inline: true })} />
          )}
        </IconSwap>
      )}

      {isIn ? (
        lock ? (
          <p className="flex items-start gap-2 text-[14px] text-muted-foreground">
            <Icon icon={Lock} tone="body" size="16px" className="mt-0.5" />
            <span>
              <span className="font-semibold text-foreground">Leaving is locked.</span> {lock}
            </span>
          </p>
        ) : (
          <Button variant="danger" size="md" onClick={() => leave(game, { inline: true })} className="w-full">
            <Icon icon={LogOut} tone="label" size="16px" />
            Leave game
          </Button>
        )
      ) : block ? (
        <p className="rounded-md bg-surface-2 px-3 py-2.5 text-[14px] text-muted-foreground dark:bg-surface-3">{block}</p>
      ) : (
        <p className="text-[13px] text-muted-foreground">
          {user ? 'You can leave up to 24 hours before kick-off.' : 'You’ll come straight back here after logging in.'}
        </p>
      )}
    </section>
  );
}

export default function GameDetail({ params }) {
  const { adjust, joined } = useAppState();
  const raw = gameById(params[0]);
  usePageTitle(raw ? `Game #${raw.game_id} at ${raw.field_name}` : 'Game not found');
  if (!raw) return <NotFound text="There is no game with that number. Check the number on the Game status page." />;

  const game = adjust(raw);
  const field = fieldById(game.field_id);
  const played = game.game_state === 'completed' || game.game_state === 'finished';

  return (
    <div className={cn(WRAP, 'pt-4 pb-16 sm:pt-6')}>
      <a href="#/" className="mb-3 inline-flex h-11 items-center gap-2 rounded-full pr-3 text-[15px] font-semibold text-accent-ink hover:underline">
        <Icon icon={ArrowLeft} tone="label" size="18px" />
        Upcoming games
      </a>

      <SignBand as="h1" size="md" borough={game.borough} meta={<span className="tnum">Game #{game.game_id}</span>}>
        {game.format} at {game.field_name}
      </SignBand>

      {/* Mobile order: facts, join, field, team sheet. Desktop: join panel sticks on the right. */}
      <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-x-8">
        <div className="min-w-0 lg:col-start-1 lg:row-start-1">
          <Facts game={game} />
        </div>

        <aside className="flex min-w-0 flex-col gap-4 lg:sticky lg:top-24 lg:col-start-2 lg:row-span-3 lg:row-start-1 lg:self-start" aria-label="Join or leave">
          <JoinPanel game={game} />
          {played && (
            <p className={cn(CARD, 'flex items-center gap-2 text-[14px] text-muted-foreground')}>
              <Icon icon={Trophy} tone="body" size="18px" />
              <span>
                Played this one? Rate it from{' '}
                <a href="#/list?tab=past" className="font-semibold text-accent-ink underline underline-offset-4">
                  My games
                </a>
                .
              </span>
            </p>
          )}
        </aside>

        <section aria-labelledby="where" className={cn(CARD, 'grid min-w-0 gap-4 p-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:col-start-1 lg:row-start-2')}>
          <FieldPhoto photo={field.photo} className="h-44 rounded-[12px] sm:h-full sm:min-h-52" />
          <div className="px-3 pt-1 pb-3 sm:px-2 sm:pt-3">
            <h2 id="where" className="font-display text-[20px] leading-tight font-bold tracking-[-0.01em]">
              <a href={`#/fields/${field.field_id}`} className="underline decoration-[var(--line-strong)] underline-offset-4 hover:decoration-current">
                {field.name}
              </a>
            </h2>
            <p className="mt-1 mb-3 flex items-center gap-1.5 text-[14px] text-muted-foreground">
              <BoroughBullet borough={field.borough} size="xs" decorative />
              {field.borough} · {field.park}
            </p>
            <MapLinks address={field.location} lat={field.lat} lng={field.lng} />
          </div>
        </section>

        <div className="min-w-0 lg:col-start-1 lg:row-start-3">
          <Roster game={game} joinedByMe={joined.has(game.game_id)} />
        </div>
      </div>
    </div>
  );
}

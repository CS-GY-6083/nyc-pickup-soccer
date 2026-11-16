// Prototype-only app state and small shared pieces: layout width, labels,
// form-control classes, flash/toast messages, and the join/leave rules
// (the same rules the server enforces, explained in words).
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { ArrowRight, CircleAlert, CircleCheck, FlaskConical, X } from 'lucide-react';
import { Icon } from '@/components/v2';
import { cn } from '@/lib/utils.js';
import { DEMO_LOGIN, hoursUntil, isUpcomingAtNow, signupsOf, userById } from './data/index.js';
import { navigate } from './router.js';

export const WRAP = 'mx-auto w-full max-w-[1240px] px-4 sm:px-6';
export const LABEL = 'text-[13px] font-semibold text-muted-foreground';
export const CONTROL =
  'h-12 w-full min-w-0 rounded-md border border-line-strong bg-surface px-3.5 text-[15px] text-foreground ' +
  'placeholder:text-muted-foreground transition-[border-color,background-color] duration-150 hover:border-[color:var(--muted)] ' +
  'aria-invalid:border-destructive dark:bg-surface-2 motion-reduce:transition-none';

// ---------------------------------------------------------------------
// Session storage (survives reloads and Back; safe in private windows)
// ---------------------------------------------------------------------
function load(key, fallback) {
  try {
    const raw = sessionStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}
function save(key, value) {
  try {
    sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* private window: keep it in memory only */
  }
}

const SEED_JOINED = new Set(signupsOf(DEMO_LOGIN.user_id));

/** Why a player can't leave this game right now, or null. */
export function leaveLock(game) {
  if (game.game_state === 'in_progress') return 'This game is in play. Leaving closed 24 hours before kick-off.';
  if (!isUpcomingAtNow(game)) return 'This game is over or called off.';
  const h = hoursUntil(game.start_time);
  if (h < 24) {
    const when = h < 1 ? 'less than an hour' : `${Math.floor(h)} ${Math.floor(h) === 1 ? 'hour' : 'hours'}`;
    return `Kick-off is in ${when}. You can leave a game up to 24 hours before kick-off.`;
  }
  return null;
}

/** Why nobody can join this game right now, or null. */
export function joinBlock(game) {
  if (game.game_state === 'in_progress') return 'This game has already kicked off, so it’s closed to new players.';
  if (game.game_state === 'cancelled') return 'This game was called off, so you can’t join it.';
  if (!isUpcomingAtNow(game)) return 'This game is over, so you can’t join it.';
  if (game.spots_left <= 0) return 'This game is full. Every spot is taken.';
  return null;
}

// ---------------------------------------------------------------------
// App state
// ---------------------------------------------------------------------
const State = createContext(null);

export function AppStateProvider({ children }) {
  const [userId, setUserId] = useState(() => load('proto.user', null));
  const [joinedList, setJoinedList] = useState(() => load('proto.joined', [...SEED_JOINED]));
  const [toasts, setToasts] = useState([]);
  const [gameNotes, setGameNotes] = useState({});
  const seq = useRef(0);

  useEffect(() => save('proto.user', userId), [userId]);
  useEffect(() => save('proto.joined', joinedList), [joinedList]);

  const user = userId ? userById(userId) : null;
  const joinedSet = useMemo(() => new Set(joinedList), [joinedList]);
  // What the logged-in player has joined (nothing when logged out).
  const joined = useMemo(() => (user ? joinedSet : new Set()), [user, joinedSet]);

  const notify = useCallback((toast) => {
    seq.current += 1;
    const id = seq.current;
    setToasts((list) => [...list.slice(-2), { id, ...toast }]);
    return id;
  }, []);
  const dismiss = useCallback((id) => setToasts((list) => list.filter((t) => t.id !== id)), []);
  const noteGame = useCallback((gameId, note) => setGameNotes((n) => ({ ...n, [gameId]: note })), []);

  // Signed-up counts follow this prototype's joins and leaves.
  const adjust = useCallback(
    (game) => {
      if (!game) return game;
      const delta = (joinedSet.has(game.game_id) ? 1 : 0) - (SEED_JOINED.has(game.game_id) ? 1 : 0);
      if (!delta) return game;
      const signed = game.signed_up + delta;
      return { ...game, signed_up: signed, spots_left: game.max_players - signed };
    },
    [joinedSet],
  );

  const setJoined = useCallback((gameId, on) => {
    setJoinedList((list) => (on ? [...new Set([...list, gameId])] : list.filter((g) => g !== gameId)));
  }, []);

  /** Join a game. Logged out: go to Log in, then come back and finish. */
  const join = useCallback(
    (game, { inline = false } = {}) => {
      if (!user) {
        navigate(`#/login?next=${encodeURIComponent(`/games/${game.game_id}`)}&join=${game.game_id}`);
        return;
      }
      const g = adjust(game);
      const block = joinBlock(g);
      const note = block
        ? { type: 'error', text: block }
        : { type: 'success', text: `You’re on the team sheet for game #${g.game_id}.` };
      if (!block) setJoined(g.game_id, true);
      if (inline) noteGame(g.game_id, note);
      else notify({ ...note, href: `#/games/${g.game_id}`, hrefLabel: 'View game' });
    },
    [user, adjust, setJoined, noteGame, notify],
  );

  /** Leave a game (only more than 24 hours before kick-off). */
  const leave = useCallback(
    (game, { inline = false } = {}) => {
      const lock = leaveLock(game);
      const note = lock
        ? { type: 'error', text: `You can’t leave game #${game.game_id}. ${lock}` }
        : { type: 'success', text: `You left game #${game.game_id}. Your spot is open for someone else.` };
      if (!lock) setJoined(game.game_id, false);
      const undo = lock ? undefined : { label: 'Undo, re-join', run: () => setJoined(game.game_id, true) };
      if (inline) noteGame(game.game_id, { ...note, undo });
      else notify({ ...note, undo });
    },
    [setJoined, noteGame, notify],
  );

  const logIn = useCallback((id) => setUserId(id), []);
  const logOut = useCallback(() => setUserId(null), []);

  const value = useMemo(
    () => ({ user, logIn, logOut, joined, adjust, join, leave, setJoined, notify, dismiss, toasts, gameNotes, noteGame }),
    [user, logIn, logOut, joined, adjust, join, leave, setJoined, notify, dismiss, toasts, gameNotes, noteGame],
  );
  return <State.Provider value={value}>{children}</State.Provider>;
}

export function useAppState() {
  return useContext(State);
}

export function usePageTitle(title) {
  useEffect(() => {
    document.title = `${title} · NYC Pickup Soccer prototype`;
  }, [title]);
}

/** Pages for logged-in users: send logged-out visitors to Log in, then back. */
export function useRequireLogin(path, why) {
  const { user } = useAppState();
  useEffect(() => {
    if (!user) window.location.replace(`#/login?next=${encodeURIComponent(path)}&why=${encodeURIComponent(why)}`);
  }, [user, path, why]);
  return user;
}

// ---------------------------------------------------------------------
// Messages
// ---------------------------------------------------------------------
export function Flash({ type = 'success', children, onDismiss, action, className }) {
  if (!children) return null;
  const ok = type === 'success';
  return (
    <div
      role={ok ? 'status' : 'alert'}
      className={cn(
        'flex items-start gap-3 rounded-xl border px-4 py-3.5 text-[15px] leading-6',
        ok
          ? 'border-[color:oklch(from_var(--accent)_l_c_h/0.35)] bg-primary-soft text-accent-ink'
          : 'border-[color:oklch(from_var(--danger)_l_c_h/0.35)] bg-destructive-soft text-destructive',
        className,
      )}
    >
      <Icon icon={ok ? CircleCheck : CircleAlert} tone="label" size="20px" className="mt-0.5" />
      <div className="min-w-0 flex-1 font-medium">
        {children}
        {action}
      </div>
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

function Toast({ toast, onClose }) {
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const t = setTimeout(() => close.current(), toast.type === 'error' ? 9000 : 6000);
    return () => clearTimeout(t);
  }, [toast.type]);
  const ok = toast.type === 'success';
  return (
    <div
      className={cn(
        'pointer-events-auto flex w-full items-start gap-3 rounded-xl border bg-surface px-4 py-3 text-[15px] leading-6 shadow-[0_2px_6px_var(--shadow),0_18px_44px_-16px_var(--shadow)] dark:bg-surface-4 dark:shadow-[inset_0_1px_0_var(--highlight)]',
        ok ? 'border-[color:oklch(from_var(--accent)_l_c_h/0.4)]' : 'border-[color:oklch(from_var(--danger)_l_c_h/0.45)]',
      )}
    >
      <Icon icon={ok ? CircleCheck : CircleAlert} tone="label" size="20px" className={cn('mt-0.5', ok ? 'text-accent-ink' : 'text-destructive')} />
      <div className="min-w-0 flex-1">
        <p className="font-medium text-foreground">{toast.text}</p>
        {(toast.href || toast.undo) && (
          <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1">
            {toast.href && (
              <a href={toast.href} onClick={onClose} className="inline-flex items-center gap-1 text-[14px] font-semibold text-accent-ink hover:underline">
                {toast.hrefLabel}
                <Icon icon={ArrowRight} tone="label" size="15px" />
              </a>
            )}
            {toast.undo && (
              <button
                type="button"
                onClick={() => {
                  toast.undo.run();
                  onClose();
                }}
                className="cursor-pointer text-[14px] font-semibold text-accent-ink hover:underline"
              >
                {toast.undo.label}
              </button>
            )}
          </div>
        )}
      </div>
      <button
        type="button"
        onClick={onClose}
        aria-label="Dismiss message"
        className="-m-2 grid size-10 flex-none cursor-pointer place-items-center rounded-full text-muted-foreground transition-colors duration-150 hover:bg-[var(--line-soft)] hover:text-foreground"
      >
        <Icon icon={X} tone="label" size="18px" />
      </button>
    </div>
  );
}

/** Toasts stack at the bottom, above the safe area. */
export function Toasts() {
  const { toasts, dismiss } = useAppState();
  const calm = useReducedMotion();
  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-[calc(80px+env(safe-area-inset-bottom))] z-50 mx-auto flex w-full max-w-[460px] flex-col gap-2 px-4 lg:bottom-[max(16px,env(safe-area-inset-bottom))]"
    >
      <AnimatePresence initial={false}>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            layout={!calm}
            initial={calm ? false : { opacity: 0, y: 12, filter: 'blur(4px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            exit={calm ? { opacity: 0, transition: { duration: 0 } } : { opacity: 0, y: 8, filter: 'blur(4px)', transition: { duration: 0.15 } }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
          >
            <Toast toast={t} onClose={() => dismiss(t.id)} />
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

/** "Sample data" marker for numbers that have no API yet. */
export function SampleBadge({ className, children = 'Sample data' }) {
  return (
    <span
      className={cn(
        'inline-flex h-7 items-center gap-1.5 rounded-full border border-dashed border-line-strong bg-surface-2 px-3 text-[12px] font-semibold text-muted-foreground',
        className,
      )}
    >
      <Icon icon={FlaskConical} tone="label" size="14px" />
      {children}
    </span>
  );
}

export function SectionHeading({ id, children, aside, className, as: H = 'h2' }) {
  return (
    <div className={cn('mb-4 flex flex-wrap items-end justify-between gap-x-6 gap-y-2', className)}>
      <H id={id} className="font-display text-[24px] leading-tight font-bold tracking-[-0.02em] text-foreground sm:text-[28px]">
        {children}
      </H>
      {aside}
    </div>
  );
}

// Status words for a game's game_state (server/src/lib/games.js) and the
// capacity word. Status is always words + icon, never colour alone.
import { CircleCheck, CircleSlash, Flag, Hourglass, Radio, Trophy, Ban, UserCheck, UserMinus } from 'lucide-react';

export const GAME_STATES = {
  confirmed: { label: 'Game on', detail: 'Field booking approved. The game is on.', tone: 'go', icon: CircleCheck },
  pending_field: { label: 'Waiting on the field', detail: 'The field booking is waiting for an admin to approve it.', tone: 'wait', icon: Hourglass },
  not_approved: { label: 'Field never approved', detail: 'Kick-off passed before the field booking was approved.', tone: 'stop', icon: CircleSlash },
  in_progress: { label: 'In play', detail: 'Kick-off has passed and the game is being played now.', tone: 'go', icon: Radio, live: true },
  finished: { label: 'Full time', detail: 'The game has been played, and players can rate it. The organizer has not marked it completed yet.', tone: 'info', icon: Flag },
  completed: { label: 'Completed', detail: 'Played and marked completed by the organizer.', tone: 'info', icon: Trophy },
  cancelled: { label: 'Called off', detail: 'The game was cancelled or its field booking was rejected.', tone: 'stop', icon: Ban },
};

export function gameState(state) {
  return GAME_STATES[state] ?? { label: state, detail: '', tone: 'info', icon: Flag };
}

/** Board text colour per tone (on the dark board). */
export const FLAP_TONE = {
  go: 'text-flap-go',
  wait: 'text-flap-wait',
  stop: 'text-flap-stop',
  info: 'text-flap-info',
};

/** Capacity as a word: OPEN · 8, LAST 3, FULL. Only for games still to come. */
export function capacity(game) {
  const left = Math.max(0, Number(game.spots_left ?? game.max_players - game.signed_up));
  if (left === 0) return { word: 'FULL', tone: 'stop', spoken: 'Full, no spots left' };
  if (left <= 3) return { word: `LAST ${left}`, tone: 'wait', spoken: `Last ${left} ${left === 1 ? 'spot' : 'spots'}` };
  return { word: `OPEN · ${left}`, tone: 'go', spoken: `Open, ${left} spots left` };
}

const UPCOMING = new Set(['confirmed', 'pending_field']);
export function isUpcoming(game) {
  return UPCOMING.has(game.game_state);
}

/**
 * The organizer's "delayed" flag (O3; spec: a flight's on-time/delayed
 * status). Only said while the game is still to come or being played;
 * once it is over or called off, its own status covers it.
 *   { label: 'Delayed', note, detail } or null
 */
const DELAY_SHOWN = new Set(['confirmed', 'pending_field', 'in_progress']);
export function delayInfo(game) {
  if (!game?.delayed || !DELAY_SHOWN.has(game.game_state)) return null;
  const note = game.delay_note || null;
  return {
    label: 'Delayed',
    note,
    detail: note ? `Note from the organizer: ${note}` : 'The organizer has marked this game as running late.',
  };
}

/**
 * The logged-in viewer's own place in a game: "You're in" or "You left".
 * Uses my_registration and leave_closed from the game list
 * (server/src/lib/games.js, gameListSql with viewerId). Returns null when
 * there is nothing personal to say: logged out, never signed up, or the
 * game is over or called off (its own status covers that).
 *   { label, qualifier, detail, tone: 'go' | 'muted', icon }
 */
export function myStatus(game) {
  const mine = game?.my_registration;
  const state = game?.game_state;
  if (mine === 'registered' && state === 'in_progress') {
    return { label: "You're in", qualifier: null, detail: "You're on the list for this game.", tone: 'go', icon: UserCheck };
  }
  if (mine === 'registered' && UPCOMING.has(state)) {
    const waiting = state === 'pending_field';
    const fieldNote = waiting ? ' The game goes ahead once an admin approves the field booking.' : '';
    if (game.leave_closed) {
      return {
        label: "You're in",
        qualifier: "can't leave now",
        detail: `You're on the list. Kick-off is less than 24 hours away, so you can no longer leave.${fieldNote}`,
        tone: 'go',
        icon: UserCheck,
      };
    }
    return {
      label: "You're in",
      qualifier: waiting ? 'waiting on the field' : null,
      detail: `You're on the list for this game.${fieldNote}`,
      tone: 'go',
      icon: UserCheck,
    };
  }
  if (mine === 'cancelled' && UPCOMING.has(state)) {
    const room = Number(game.spots_left) > 0;
    return {
      label: 'You left',
      qualifier: null,
      detail: room ? "You left this game. You can join again while there's room." : 'You left this game, and it is full now.',
      tone: 'muted',
      icon: UserMinus,
    };
  }
  return null;
}

/** Words for a screen reader, e.g. "You're in, can't leave now". */
export function myStatusText(game) {
  const s = myStatus(game);
  return s ? [s.label, s.qualifier].filter(Boolean).join(', ') : '';
}

// Status words for a game's game_state (server/src/lib/games.js) and the
// capacity word. Status is always words + icon, never colour alone.
import { CircleCheck, CircleSlash, Flag, Hourglass, Radio, Trophy, Ban } from 'lucide-react';

export const GAME_STATES = {
  confirmed: { label: 'Game on', detail: 'Field booking approved. The game is on.', tone: 'go', icon: CircleCheck },
  pending_field: { label: 'Waiting on the field', detail: 'The field booking is waiting for an admin to approve it.', tone: 'wait', icon: Hourglass },
  not_approved: { label: 'Field never approved', detail: 'Kick-off passed before the field booking was approved.', tone: 'stop', icon: CircleSlash },
  in_progress: { label: 'In play', detail: 'Kick-off has passed and the game is being played now.', tone: 'go', icon: Radio, live: true },
  finished: { label: 'Full time', detail: 'The game has been played. The organizer has not marked it completed yet.', tone: 'info', icon: Flag },
  completed: { label: 'Completed', detail: 'Played and marked completed by the organizer. Players can rate it.', tone: 'info', icon: Trophy },
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

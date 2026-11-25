// "Delayed" pill: the organizer's on-time/delayed flag (O3; spec: a
// flight's status). Same shape as MyStatus, in the "wait" tone.
//   <DelayedTag game={g} />                 on the departure board (default)
//   <DelayedTag game={g} surface="card" />  on a light/dark card
// Renders nothing when the game is on time or already over (delayInfo()).
// Words + icon, never colour alone.
import { Clock } from 'lucide-react';
import { cn } from '@/lib/utils.js';
import Icon from './Icon.jsx';
import { delayInfo } from './gameState.js';

const TONES = {
  board: 'text-flap-wait bg-[oklch(from_var(--flap-wait)_l_c_h/0.12)]',
  card: 'text-warning bg-warning-soft',
};

export default function DelayedTag({ game, surface = 'board', className }) {
  const delay = delayInfo(game);
  if (!delay) return null;
  return (
    <span
      className={cn(
        'inline-flex max-w-full items-center gap-1.5 rounded-full px-2.5 py-1 text-[12.5px] leading-none font-semibold',
        TONES[surface] ?? TONES.board,
        className,
      )}
    >
      <Icon icon={Clock} tone="label" size="14px" />
      <span className="truncate">{delay.label}</span>
    </span>
  );
}

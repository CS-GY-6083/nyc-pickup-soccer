// The logged-in viewer's own place in a game, as a small pill:
//   <MyStatus game={g} />                 on the departure board (default)
//   <MyStatus game={g} surface="card" />  on a light/dark card
// "You're in" (· can't leave now / · waiting on the field) or "You left".
// Renders nothing when there is nothing personal to say (see myStatus()).
// Words + icon, never colour alone.
import { cn } from '@/lib/utils.js';
import Icon from './Icon.jsx';
import { myStatus } from './gameState.js';

const TONES = {
  board: {
    go: 'text-flap-go bg-[oklch(from_var(--flap-go)_l_c_h/0.12)]',
    muted: 'text-flap-muted bg-[oklch(from_var(--flap-text)_l_c_h/0.06)]',
  },
  card: {
    go: 'text-accent-ink bg-primary-soft',
    muted: 'text-muted-foreground border border-line',
  },
};

export default function MyStatus({ game, surface = 'board', className }) {
  const s = myStatus(game);
  if (!s) return null;
  return (
    <span
      className={cn(
        'inline-flex max-w-full items-center gap-1.5 rounded-full px-2.5 py-1 text-[12.5px] leading-none font-semibold',
        TONES[surface]?.[s.tone] ?? TONES.board[s.tone],
        className,
      )}
    >
      <Icon icon={s.icon} tone="label" size="14px" />
      <span className="truncate">
        {s.label}
        {s.qualifier && <span className="font-medium"> · {s.qualifier}</span>}
      </span>
    </span>
  );
}

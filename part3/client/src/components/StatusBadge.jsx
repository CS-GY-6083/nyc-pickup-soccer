// Colored label for a game's game_state (computed in server/src/lib/games.js).
const LABELS = {
  confirmed: 'On · field confirmed',
  pending_field: 'Waiting for field approval',
  not_approved: 'Field never approved',
  in_progress: 'In progress',
  finished: 'Finished',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

export default function StatusBadge({ state }) {
  return <span className={`badge badge-${state}`}>{LABELS[state] ?? state}</span>;
}

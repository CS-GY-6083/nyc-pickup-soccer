// Organizer home page: organizer use cases, plus the player ones
// (organizers can play in other people's games too).
// Owner: Jason
import { useAuth } from '../../auth/AuthContext.jsx';
import UseCaseMenu from '../../components/UseCaseMenu.jsx';
import { PLAYER_USE_CASES } from '../player/playerUseCases.js';

const ORGANIZER_USE_CASES = [
  { to: '/organizer/games', title: 'My hosted games', text: 'Your games in the next 30 days, or any date range. See who signed up and mark games completed or cancelled.' },
  { to: '/organizer/games/new', title: 'Create a game', text: 'Pick a field and an open time slot, then post a game. An admin approves the field booking.' },
  { to: '/organizer/ratings', title: 'Game ratings', text: 'Average rating and every comment for each of your games.' },
  { to: '/organizer/players', title: 'Frequent players', text: 'Who played in your games most this year, and the games they played.' },
  { to: '/organizer/reports', title: 'Reports', text: 'Sign-ups for last month, last year or any date range, month by month.' },
];

export default function OrganizerHome() {
  const { user } = useAuth();
  return (
    <>
      <h1>Welcome, {user.name}</h1>
      <h2>Organize</h2>
      <UseCaseMenu items={ORGANIZER_USE_CASES} />
      <h2>Play</h2>
      <UseCaseMenu items={PLAYER_USE_CASES} />
    </>
  );
}

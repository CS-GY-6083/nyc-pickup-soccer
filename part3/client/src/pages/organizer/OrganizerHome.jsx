// Organizer home page: organizer use cases, plus the player ones
// (organizers can play in other people's games too).
// Owner: Jason
import { BarChart3, CalendarPlus, ClipboardList, Star, UsersRound } from 'lucide-react';
import { useAuth } from '../../auth/AuthContext.jsx';
import UseCaseMenu from '../../components/UseCaseMenu.jsx';
import { Page, SectionHeading } from '../../components/v2/index.js';
import { PLAYER_USE_CASES } from '../player/playerUseCases.js';

const ORGANIZER_USE_CASES = [
  { to: '/organizer/games', icon: ClipboardList, title: 'My hosted games', text: 'Your games in the next 30 days, or any date range. See who signed up and mark games completed or cancelled.' },
  { to: '/organizer/games/new', icon: CalendarPlus, title: 'Create a game', text: 'Pick a field and an open time slot, then post a game. An admin approves the field booking.' },
  { to: '/organizer/ratings', icon: Star, title: 'Game ratings', text: 'Average rating and every comment for each of your games.' },
  { to: '/organizer/players', icon: UsersRound, title: 'Frequent players', text: 'Who played in your games most this year, and the games they played.' },
  { to: '/organizer/reports', icon: BarChart3, title: 'Reports', text: 'Sign-ups for last month, last year or any date range, month by month.' },
];

export default function OrganizerHome() {
  const { user } = useAuth();
  return (
    <Page title={`Welcome, ${user.name.split(' ')[0]}`} lede="Run your games, then lace up for someone else's.">
      <section aria-labelledby="organize">
        <SectionHeading id="organize">Organize</SectionHeading>
        <UseCaseMenu items={ORGANIZER_USE_CASES} />
      </section>
      <section aria-labelledby="play" className="mt-10">
        <SectionHeading id="play">Play</SectionHeading>
        <UseCaseMenu items={PLAYER_USE_CASES} />
      </section>
    </Page>
  );
}

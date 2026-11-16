// Player menu entries. Shared with the organizer home page, since
// organizers can play too. Kept out of PlayerHome.jsx so React fast
// refresh works (a component file should only export components).
// `icon` is optional (a lucide-react icon shown on the menu card).
import { BarChart3, CalendarDays, Search, Star } from 'lucide-react';

export const PLAYER_USE_CASES = [
  { to: '/player/games', icon: CalendarDays, title: 'My games', text: 'Games you signed up for: upcoming and past. Leave a game up to 24 hours before kickoff.' },
  { to: '/player/search', icon: Search, title: 'Find & join games', text: 'Search upcoming games by borough, field, date, format and level, and join one.' },
  { to: '/player/ratings', icon: Star, title: 'Rate past games', text: 'Give stars and a comment on games you played.' },
  { to: '/player/activity', icon: BarChart3, title: 'My activity', text: 'Games and hours played per month, for the past year or any date range.' },
];

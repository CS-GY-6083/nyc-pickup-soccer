// Admin home page: only the admin use cases.
// Owners: Abhinav (bookings, fields, closures, games), Devash (reports)
import { useAuth } from '../../auth/AuthContext.jsx';
import UseCaseMenu from '../../components/UseCaseMenu.jsx';

const ADMIN_USE_CASES = [
  { to: '/admin/bookings', title: 'Pending field bookings', text: 'Approve or reject game bookings. Overlaps, closures and opening hours are flagged.' },
  { to: '/admin/fields', title: 'Fields', text: 'Add a field and its opening hours, and see every field.' },
  { to: '/admin/closures', title: 'Field closures', text: 'Close a field for repairs or events.' },
  { to: '/admin/games', title: 'All games', text: 'Every game and booking, past or upcoming, with rosters.' },
  { to: '/admin/reports', title: 'Reports', text: 'Field usage (hours booked) last month and last year, bookings per month, and activity by borough and format.' },
];

export default function AdminHome() {
  const { user } = useAuth();
  return (
    <>
      <h1>Welcome, {user.name}</h1>
      <UseCaseMenu items={ADMIN_USE_CASES} />
    </>
  );
}

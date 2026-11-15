// Every page of the app and who may open it.
//
// To build a use case: create the page component, import it here, and
// replace the <ComingSoon /> element on its route. The route guards
// (<RequireRole>) only decide what the UI shows; the server enforces
// the same rules on every API request.
import { Route, Routes } from 'react-router';
import RequireRole from './auth/RequireRole.jsx';
import NavBar from './components/NavBar.jsx';
import Flash from './components/Flash.jsx';
import ComingSoon from './pages/ComingSoon.jsx';
import Home from './pages/public/Home.jsx';
import GameStatus from './pages/public/GameStatus.jsx';
import Login from './pages/public/Login.jsx';
import Register from './pages/public/Register.jsx';
import Goodbye from './pages/public/Goodbye.jsx';
import Logout from './pages/public/Logout.jsx';
import PlayerHome from './pages/player/PlayerHome.jsx';
import OrganizerHome from './pages/organizer/OrganizerHome.jsx';
import AdminHome from './pages/admin/AdminHome.jsx';

const PLAYERS = ['player', 'organizer']; // organizers can play too
const ORGANIZERS = ['organizer'];
const ADMINS = ['admin'];

const guard = (roles, page) => <RequireRole roles={roles}>{page}</RequireRole>;

export default function App() {
  return (
    <>
      <NavBar />
      <main className="container">
        <Flash />
        <Routes>
          {/* Public (Abhinav) */}
          <Route path="/" element={<Home />} />
          <Route path="/status" element={<GameStatus />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/logout" element={<Logout />} />
          <Route path="/goodbye" element={<Goodbye />} />

          {/* Player (Devash) */}
          <Route path="/player" element={guard(['player'], <PlayerHome />)} />
          <Route path="/player/games" element={guard(PLAYERS, <ComingSoon title="My games" />)} />
          <Route path="/player/search" element={guard(PLAYERS, <ComingSoon title="Find & join games" />)} />
          <Route path="/player/ratings" element={guard(PLAYERS, <ComingSoon title="Rate past games" />)} />
          <Route path="/player/activity" element={guard(PLAYERS, <ComingSoon title="My activity" />)} />

          {/* Organizer (Jason) */}
          <Route path="/organizer" element={guard(ORGANIZERS, <OrganizerHome />)} />
          <Route path="/organizer/games" element={guard(ORGANIZERS, <ComingSoon title="My hosted games" />)} />
          <Route path="/organizer/games/new" element={guard(ORGANIZERS, <ComingSoon title="Create a game" />)} />
          <Route path="/organizer/ratings" element={guard(ORGANIZERS, <ComingSoon title="Game ratings" />)} />
          <Route path="/organizer/players" element={guard(ORGANIZERS, <ComingSoon title="Frequent players" />)} />
          <Route path="/organizer/reports" element={guard(ORGANIZERS, <ComingSoon title="Reports" />)} />

          {/* Admin (Abhinav; reports: Devash) */}
          <Route path="/admin" element={guard(ADMINS, <AdminHome />)} />
          <Route path="/admin/bookings" element={guard(ADMINS, <ComingSoon title="Pending field bookings" />)} />
          <Route path="/admin/fields" element={guard(ADMINS, <ComingSoon title="Fields" />)} />
          <Route path="/admin/closures" element={guard(ADMINS, <ComingSoon title="Field closures" />)} />
          <Route path="/admin/games" element={guard(ADMINS, <ComingSoon title="All games" />)} />
          <Route path="/admin/reports" element={guard(ADMINS, <ComingSoon title="Reports" />)} />

          <Route path="*" element={<ComingSoon title="Page not found" text="There is no page at this address." />} />
        </Routes>
      </main>
    </>
  );
}

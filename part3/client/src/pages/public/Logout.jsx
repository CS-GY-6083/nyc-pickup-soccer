// /logout: ends the session on the server, then shows the goodbye page.
//
// Logging out happens on this public page, not on the page the user
// was viewing. Otherwise clearing the user would make that page's
// <RequireRole> guard redirect to /login before /goodbye is reached.
// Owner: Abhinav
import { useEffect } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '../../auth/AuthContext.jsx';

export default function Logout() {
  const { logout } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    logout().then(
      () => navigate('/goodbye', { replace: true }),
      (err) => navigate('/', { replace: true, state: { flash: { type: 'error', text: `Could not log out: ${err.message}` } } }),
    );
  }, [logout, navigate]);

  return <p className="muted">Logging out…</p>;
}

// Wraps a page that only some roles may open:
//   <RequireRole roles={['admin']}><AdminHome /></RequireRole>
// Logged out -> login page (and back here after logging in).
// Wrong role -> their own home page with an error message.
import { Navigate, useLocation } from 'react-router';
import { homePath, useAuth } from './AuthContext.jsx';

export default function RequireRole({ roles, children }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <p className="muted">Loading…</p>;

  if (!user) {
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: location.pathname, flash: { type: 'error', text: 'Please log in to continue.' } }}
      />
    );
  }

  if (!roles.includes(user.role)) {
    return (
      <Navigate
        to={homePath(user.role)}
        replace
        state={{ flash: { type: 'error', text: 'That page is not available for your account.' } }}
      />
    );
  }

  return children;
}

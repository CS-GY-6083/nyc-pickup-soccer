// Top menu. Public links for everyone, then either login/register or
// the user's home page and a logout button.
import { NavLink, useNavigate } from 'react-router';
import { homePath, useAuth } from '../auth/AuthContext.jsx';
import ThemeToggle from './ThemeToggle.jsx';

export default function NavBar() {
  const { user } = useAuth();
  const navigate = useNavigate();

  return (
    <header className="navbar">
      <div className="navbar-inner">
        <NavLink to="/" className="brand">NYC Pickup Soccer</NavLink>
        <nav>
          <NavLink to="/" end>Find games</NavLink>
          <NavLink to="/status">Game status</NavLink>
          {user ? (
            <>
              <NavLink to={homePath(user.role)}>My home</NavLink>
              <span className="who">{user.name} · {user.role}</span>
              <button type="button" className="secondary small" onClick={() => navigate('/logout')}>Log out</button>
            </>
          ) : (
            <>
              <NavLink to="/login">Log in</NavLink>
              <NavLink to="/register">Register</NavLink>
            </>
          )}
          <ThemeToggle />
        </nav>
      </div>
    </header>
  );
}

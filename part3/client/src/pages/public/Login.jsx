// Login for every role (email is the username). The server checks
// password_hash = md5(password); see server/src/routes/auth.js.
// Owner: Abhinav
import { useState } from 'react';
import { Link, Navigate, useLocation } from 'react-router';
import { homePath, useAuth } from '../../auth/AuthContext.jsx';
import { Message } from '../../components/Flash.jsx';

export default function Login() {
  const { user, login } = useAuth();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  // Logged in (just now, or already): go back to the page that sent
  // them here, if any, else their home page. Done while rendering, so
  // it runs as soon as login() sets the user.
  if (user) return <Navigate to={location.state?.from ?? homePath(user.role)} replace />;

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      await login(email.trim(), password);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <div className="narrow">
      <h1>Log in</h1>
      <form className="card form-stack" onSubmit={submit}>
        <Message type="error">{error}</Message>
        <label>
          Email
          <input type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>
        <label>
          Password
          <input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </label>
        <button type="submit" disabled={busy}>{busy ? 'Logging in…' : 'Log in'}</button>
      </form>
      <p className="muted">New here? <Link to="/register">Create an account</Link>.</p>
    </div>
  );
}

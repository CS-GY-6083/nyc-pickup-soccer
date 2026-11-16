// Login for every role (email is the username). The server checks
// password_hash = md5(password); see server/src/routes/auth.js.
// After logging in: back to the page that sent the user here, if any,
// else their home page.
// Owner: Abhinav
import { useState } from 'react';
import { Link, Navigate, useLocation } from 'react-router';
import { Eye, EyeOff, LogIn } from 'lucide-react';
import { homePath, useAuth } from '../../auth/AuthContext.jsx';
import { Button, Icon, IconSwap, Notice, SignBand, TextField, usePageTitle } from '../../components/v2/index.js';

export default function Login() {
  usePageTitle('Log in');
  const { user, login } = useAuth();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  // Logged in (just now, or already): done while rendering, so it runs as
  // soon as login() sets the user.
  if (user) return <Navigate to={location.state?.from ?? homePath(user.role)} replace />;

  async function submit(event) {
    event.preventDefault();
    if (busy) return;
    setError('');
    if (!email.trim()) return setError('Email is required.');
    if (!password) return setError('Password is required.');
    setBusy(true);
    try {
      await login(email.trim(), password);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <div data-ui className="flex min-h-[min(680px,calc(100dvh-220px))] items-start justify-center py-4 font-sans text-[15px] leading-6 text-foreground sm:items-center sm:py-8">
      <div className="w-full max-w-[460px] rounded-2xl border border-line bg-surface p-2 shadow-[var(--lift)] dark:bg-surface-2">
        <SignBand as="h1" size="md">
          Log in
        </SignBand>
        <div className="px-3 pt-5 pb-4 sm:px-5">
          <p className="text-muted-foreground">Players, organizers and admins all log in here.</p>
          <form onSubmit={submit} noValidate className="mt-5 flex flex-col gap-4">
            {error && <Notice type="error" className="py-3">{error}</Notice>}
            <TextField
              label="Email"
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              aria-invalid={error ? true : undefined}
            />
            <div className="relative">
              <TextField
                label="Password"
                type={show ? 'text' : 'password'}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                inputClassName="pr-14"
                aria-invalid={error ? true : undefined}
              />
              <button
                type="button"
                onClick={() => setShow((v) => !v)}
                aria-pressed={show}
                aria-label={show ? 'Hide password' : 'Show password'}
                className="absolute right-1 bottom-1 grid size-10 cursor-pointer place-items-center rounded-[8px] text-muted-foreground transition-colors duration-150 hover:bg-surface-2 hover:text-foreground dark:hover:bg-surface-3"
              >
                <IconSwap swapKey={show ? 'hide' : 'show'}>
                  <Icon icon={show ? EyeOff : Eye} tone="label" size="18px" />
                </IconSwap>
              </button>
            </div>
            <Button type="submit" size="lg" aria-disabled={busy || undefined} className="mt-1 w-full">
              <Icon icon={LogIn} tone="label" size="18px" />
              {busy ? 'Logging in…' : 'Log in'}
            </Button>
          </form>
          <p className="mt-5 text-muted-foreground">
            New here?{' '}
            <Link to="/register" className="font-semibold text-accent-ink underline-offset-4 hover:underline">
              Create an account
            </Link>
            .
          </p>
        </div>
      </div>
    </div>
  );
}

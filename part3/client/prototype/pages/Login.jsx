// #/login  Log in (every role; email is the username).
//   ?next=/games/16&join=16  came from "Join game" while logged out: after
//                            logging in, finish the join and go back there.
//   ?next=/list&why=…        came from a page for logged-in players.
// Prototype: the seed player grace.kim@example.com / grace123 logs in; any
// other pair gets the server's exact error.
import { useId, useState } from 'react';
import { Eye, EyeOff, LogIn } from 'lucide-react';
import { Button, Icon, IconSwap, SignBand } from '@/components/v2';
import { cn } from '@/lib/utils.js';
import { DEMO_LOGIN, gameById } from '../data/index.js';
import { CONTROL, Flash, LABEL, WRAP, joinBlock, useAppState, usePageTitle } from '../ui.jsx';

export default function Login({ query }) {
  usePageTitle('Log in');
  const { user, logIn, setJoined, noteGame, notify, adjust } = useAppState();
  const next = query.get('next');
  const joinId = query.get('join');
  const why = query.get('why');
  const joinGame = joinId ? gameById(joinId) : null;
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const ids = { email: useId(), password: useId(), err: useId() };

  function finish() {
    logIn(DEMO_LOGIN.user_id);
    if (joinGame) {
      const g = adjust(joinGame);
      const block = joinBlock(g);
      if (block) noteGame(g.game_id, { type: 'error', text: `You’re logged in, but you couldn’t join game #${g.game_id}. ${block}` });
      else {
        setJoined(g.game_id, true);
        noteGame(g.game_id, { type: 'success', text: `You’re on the team sheet for game #${g.game_id}.` });
      }
    } else {
      notify({ type: 'success', text: 'You’re logged in. Welcome back, Grace.' });
    }
    // Replace the login page in history, so Back skips it.
    window.location.replace(`#${next && next.startsWith('/') ? next : '/player'}`);
  }

  function submit(event) {
    event.preventDefault();
    setError('');
    if (!email.trim()) return setError('Email is required.');
    if (!password) return setError('Password is required.');
    setBusy(true);
    window.setTimeout(() => {
      if (email.trim().toLowerCase() === DEMO_LOGIN.email && password === DEMO_LOGIN.password) finish();
      else {
        setError('Incorrect email or password.');
        setBusy(false);
      }
    }, 400);
  }

  return (
    <div className={cn(WRAP, 'flex min-h-[min(760px,calc(100dvh-140px))] items-start justify-center py-8 sm:items-center sm:py-12')}>
      <div className="w-full max-w-[460px] rounded-2xl border border-line bg-surface p-2 shadow-[var(--lift)] dark:bg-surface-2">
        <SignBand as="h1" size="md">
          Log in
        </SignBand>
        <div className="px-3 pt-5 pb-4 sm:px-5">
          {user ? (
            <Flash type="success">
              You’re already logged in as {user.name}.{' '}
              <a href="#/player" className="underline underline-offset-4">
                Go to your player home
              </a>
              .
            </Flash>
          ) : joinGame ? (
            <p className="rounded-md bg-surface-2 px-3.5 py-3 text-[15px] leading-6 dark:bg-surface-3">
              Log in to join <span className="font-semibold">game #{joinGame.game_id}</span> at {joinGame.field_name}. You&rsquo;ll go
              straight back to the game, already on the team sheet.
            </p>
          ) : why ? (
            <p className="rounded-md bg-surface-2 px-3.5 py-3 text-[15px] leading-6 dark:bg-surface-3">{why}</p>
          ) : (
            <p className="text-muted-foreground">Players, organizers and admins all log in here.</p>
          )}

          <form onSubmit={submit} noValidate className="mt-5 flex flex-col gap-4">
            {error && (
              <Flash type="error" className="py-3">
                <span id={ids.err}>{error}</span>
              </Flash>
            )}
            <label htmlFor={ids.email} className="flex flex-col gap-1.5">
              <span className={LABEL}>Email</span>
              <input
                id={ids.email}
                type="email"
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                aria-invalid={error ? true : undefined}
                aria-describedby={error ? ids.err : undefined}
                className={CONTROL}
              />
            </label>
            <label htmlFor={ids.password} className="flex flex-col gap-1.5">
              <span className={LABEL}>Password</span>
              <span className="relative">
                <input
                  id={ids.password}
                  type={show ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  aria-invalid={error ? true : undefined}
                  aria-describedby={error ? ids.err : undefined}
                  className={cn(CONTROL, 'pr-14')}
                />
                <button
                  type="button"
                  onClick={() => setShow((v) => !v)}
                  aria-pressed={show}
                  aria-label={show ? 'Hide password' : 'Show password'}
                  className="absolute top-1/2 right-1 grid size-10 -translate-y-1/2 cursor-pointer place-items-center rounded-[8px] text-muted-foreground transition-colors duration-150 hover:bg-surface-2 hover:text-foreground"
                >
                  <IconSwap swapKey={show ? 'hide' : 'show'}>
                    <Icon icon={show ? EyeOff : Eye} tone="label" size="18px" />
                  </IconSwap>
                </button>
              </span>
            </label>
            <Button type="submit" size="lg" aria-disabled={busy || undefined} className="mt-1 w-full">
              <Icon icon={LogIn} tone="label" size="18px" />
              {busy ? 'Logging in…' : joinGame ? 'Log in and join' : 'Log in'}
            </Button>
          </form>

          <p className="mt-5 rounded-md border border-dashed border-line-strong px-3.5 py-3 text-[13px] leading-5 text-muted-foreground">
            <span className="font-semibold text-foreground">Prototype login:</span> {DEMO_LOGIN.email} / {DEMO_LOGIN.password} (seed
            player Grace Kim). Any other pair shows the real error.
          </p>
        </div>
      </div>
    </div>
  );
}

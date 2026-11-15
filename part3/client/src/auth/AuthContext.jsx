// Who is logged in, shared with every page via useAuth().
//
//   const { user, login, logout } = useAuth();
//   user is null when logged out, else { id, name, email, role }.
//
// This only decides what the UI shows. The server re-checks the session
// and the user's role on every request, so hiding a link here is a
// convenience, not the security boundary.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../api.js';

const AuthContext = createContext(null);

/** Each role's home page. */
export function homePath(role) {
  return { player: '/player', organizer: '/organizer', admin: '/admin' }[role] ?? '/';
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  // Set once the user logs in, registers or logs out, so a slow answer
  // from the page-load /me check cannot overwrite that newer state.
  const changedByUser = useRef(false);

  // On page load, ask the server whether this browser has a session.
  useEffect(() => {
    api('/auth/me')
      .then((data) => { if (!changedByUser.current) setUser(data.user); })
      .catch(() => { if (!changedByUser.current) setUser(null); })
      .finally(() => setLoading(false));
  }, []);

  // api.js fires this when any request comes back 401.
  useEffect(() => {
    const onExpired = () => setUser(null);
    window.addEventListener('auth:expired', onExpired);
    return () => window.removeEventListener('auth:expired', onExpired);
  }, []);

  const login = useCallback(async (email, password) => {
    const data = await api('/auth/login', { method: 'POST', body: { email, password } });
    changedByUser.current = true;
    setUser(data.user);
    return data.user;
  }, []);

  const register = useCallback(async (form) => {
    const data = await api('/auth/register', { method: 'POST', body: form });
    changedByUser.current = true;
    setUser(data.user);
    return data.user;
  }, []);

  const logout = useCallback(async () => {
    try {
      await api('/auth/logout', { method: 'POST' });
    } finally {
      changedByUser.current = true;
      setUser(null);
    }
  }, []);

  const value = useMemo(() => ({ user, loading, login, register, logout }), [user, loading, login, register, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}

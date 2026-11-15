// Success / error banner.
//
// The spec says that after an action, control returns to the home page,
// which shows an error if the action failed. Pages do that with:
//
//   const goHome = useGoHome();
//   goHome('error', 'This game is full.');      // or goHome('success', 'You joined game #12.')
//
// <Flash /> (rendered once in App.jsx) shows the message passed along
// with the navigation. Pages can also render <Message> inline.
import { useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { homePath, useAuth } from '../auth/AuthContext.jsx';

export function Message({ type = 'info', children }) {
  if (!children) return null;
  return (
    <div className={`flash flash-${type}`} role={type === 'error' ? 'alert' : 'status'}>
      {children}
    </div>
  );
}

export default function Flash() {
  const location = useLocation();
  const flash = location.state?.flash;
  if (!flash) return null;
  return <Message type={flash.type}>{flash.text}</Message>;
}

/** Returns goHome(type, text): go to the user's home page showing a message. */
export function useGoHome() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const role = user?.role;
  return useCallback(
    (type, text) => navigate(homePath(role), { state: { flash: { type, text } } }),
    [navigate, role],
  );
}

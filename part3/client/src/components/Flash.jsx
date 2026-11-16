// Success / error banner.
//
// The spec says that after an action, control returns to the home page,
// which shows an error if the action failed. Pages do that with:
//
//   const goHome = useGoHome();
//   goHome('error', 'This game is full.');      // or goHome('success', 'You joined game #12.')
//
// <Flash /> (rendered once in App.jsx) shows the message passed along
// with the navigation, with a button to dismiss it. Pages can also render
// <Message type="error|success|warning|info"> inline.
import { useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { homePath, useAuth } from '../auth/AuthContext.jsx';
import { Notice } from './v2/forms.jsx';

export function Message({ type = 'info', children, onDismiss, className }) {
  return (
    <Notice type={type} onDismiss={onDismiss} className={className ?? 'my-3'}>
      {children}
    </Notice>
  );
}

export default function Flash() {
  const location = useLocation();
  const navigate = useNavigate();
  const flash = location.state?.flash;
  if (!flash) return null;
  // Dismissing replaces this history entry without the message, so Back
  // and a reload do not bring it back.
  const dismiss = () =>
    navigate(`${location.pathname}${location.search}${location.hash}`, {
      replace: true,
      state: { ...location.state, flash: undefined },
    });
  return (
    <Message type={flash.type} onDismiss={dismiss} className="mb-5">
      {flash.text}
    </Message>
  );
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

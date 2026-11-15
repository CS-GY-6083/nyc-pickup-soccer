// Placeholder for a use case that has not been built yet. Replace the
// <ComingSoon /> element for that route in App.jsx with the real page.
import { Link } from 'react-router';
import { homePath, useAuth } from '../auth/AuthContext.jsx';

export default function ComingSoon({ title, text = 'This page has not been built yet.' }) {
  const { user } = useAuth();
  return (
    <div className="narrow center">
      <h1>{title}</h1>
      <p className="muted">{text}</p>
      <p><Link to={homePath(user?.role)}>Back to my home page</Link></p>
    </div>
  );
}

// Shown after logging out (spec: "the session is destroyed and a
// goodbye page or the login page is displayed").
// Owner: Abhinav
import { Link } from 'react-router';

export default function Goodbye() {
  return (
    <div className="narrow center">
      <h1>Goodbye!</h1>
      <p>You have been logged out.</p>
      <p>
        <Link to="/login">Log in again</Link> · <Link to="/">Find games</Link>
      </p>
    </div>
  );
}

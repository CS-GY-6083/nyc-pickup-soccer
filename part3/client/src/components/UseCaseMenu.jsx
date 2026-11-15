// Grid of links to a role's use cases, shown on each home page.
//   <UseCaseMenu items={[{ to: '/player/games', title: 'My games', text: '...' }]} />
import { Link } from 'react-router';

export default function UseCaseMenu({ items }) {
  return (
    <div className="menu-grid">
      {items.map((item) => (
        <Link key={item.to} to={item.to} className="menu-card">
          <strong>{item.title}</strong>
          <span className="muted small">{item.text}</span>
        </Link>
      ))}
    </div>
  );
}

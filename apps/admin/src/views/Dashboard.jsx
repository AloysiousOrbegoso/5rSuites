import { api } from '../api.js';
import { useSession } from '../App.jsx';
import Icon from '../components/Icon.jsx';
import { ErrorNote, Loading, useLoad } from '../components/ui.jsx';
import { Link } from '../router.jsx';

const FORM_LABELS = { contact: 'contact', register_property: 'register property', careers: 'careers' };

export function timeAgo(sqlDate) {
  if (!sqlDate) return '—';
  const seconds = (Date.now() - new Date(`${sqlDate.replace(' ', 'T')}Z`).getTime()) / 1000;
  if (seconds < 60) return 'just now';
  const units = [[60, 'minute'], [3600, 'hour'], [86400, 'day'], [604800, 'week']];
  for (let i = units.length - 1; i >= 0; i--) {
    const [size, name] = units[i];
    if (seconds >= size) {
      const n = Math.floor(seconds / size);
      if (name === 'day' && n === 1) return 'yesterday';
      return `${n} ${name}${n === 1 ? '' : 's'} ago`;
    }
  }
  return '';
}

export default function Dashboard() {
  const { user } = useSession();
  const { data, error } = useLoad(() => api('/dashboard'), []);

  if (error) return <ErrorNote error={error} />;
  if (!data) return <Loading />;
  const unreadTotal = Object.values(data.unread).reduce((a, b) => a + b, 0);
  const firstName = (user.name || '').split(' ')[0];

  return (
    <div>
      <header className="page-head">
        <div>
          <h1>Dashboard</h1>
          <p className="subtitle">Welcome back{firstName ? `, ${firstName}` : ''}. Here’s what’s happening across the site.</p>
        </div>
        <Link to="/pages" className="btn primary">Edit a Page</Link>
      </header>

      <div className="stats">
        <Link to="/submissions" className="stat">
          <span className="stat-label">Unread Submissions</span>
          <strong>{unreadTotal}</strong>
          <span className={`stat-note${unreadTotal ? ' good' : ''}`}>
            {unreadTotal ? Object.entries(data.unread).map(([k, n]) => `${n} ${FORM_LABELS[k]}`).join(' · ') : 'All caught up'}
          </span>
        </Link>
        <Link to="/pages" className="stat">
          <span className="stat-label">Published Pages</span>
          <strong>{data.pages.count}</strong>
          <span className="stat-note">Last edit {timeAgo(data.pages.lastEdit)}{data.pages.lastEditor ? ` by ${data.pages.lastEditor}` : ''}</span>
        </Link>
        <Link to="/units" className="stat">
          <span className="stat-label">Units Listed</span>
          <strong>{data.units.count}</strong>
          <span className="stat-note">{data.units.active} shown on site · {data.units.count - data.units.active} hidden</span>
        </Link>
        {data.users && (
          <Link to="/staff" className="stat">
            <span className="stat-label">Staff Accounts</span>
            <strong>{data.users.owner + data.users.staff}</strong>
            <span className="stat-note">{data.users.owner} owner · {data.users.staff} staff</span>
          </Link>
        )}
      </div>

      <div className="dash-grid">
        <section className="panel">
          <h2 className="panel-title">Recent Activity</h2>
          {data.activity.length === 0 ? (
            <p className="muted panel-pad">Nothing yet. Edits and form submissions will show up here.</p>
          ) : (
            <ul className="activity">
              {data.activity.map((a, i) => (
                <li key={i}>
                  <Link to={a.link} className="activity-row">
                    <span>{a.kind === 'edit' ? <>{a.who} edited <strong>{a.what}</strong></> : a.who}</span>
                    <span className="muted-dark">{a.detail}</span>
                    <span className="muted when">{timeAgo(a.at)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className="panel panel-pad">
          <h2>Quick Links</h2>
          <div className="quick-links">
            <Link to="/pages"><Icon name="pages" />Edit Pages</Link>
            <Link to="/submissions"><Icon name="submissions" />View Submissions</Link>
            <Link to="/units"><Icon name="units" />Manage Units</Link>
            <Link to="/media"><Icon name="media" />Upload Photos</Link>
            {user.role === 'owner' && <Link to="/staff"><Icon name="staff" />Manage Staff</Link>}
          </div>
        </section>
      </div>
    </div>
  );
}

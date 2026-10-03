import { formLabel } from '@5rsuites/blocks';
import { useEffect, useState } from 'react';
import { dashboard } from '../resources.js';
import { useSession } from '../App.jsx';
import Icon from '../components/Icon.jsx';
import { ErrorNote, Loading, useLoad } from '../components/ui.jsx';
import { Link } from '../router.jsx';

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

// Counts up to its value once on mount; skips the motion for reduced-motion users.
function CountUp({ value }) {
  const [shown, setShown] = useState(0);
  useEffect(() => {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches || !value) { setShown(value); return undefined; }
    let raf;
    const start = performance.now();
    const tick = (now) => {
      const t = Math.min(1, (now - start) / 900);
      setShown(Math.round(value * (1 - (1 - t) ** 3)));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return shown.toLocaleString('en-US');
}

function Stat({ to, icon, label, value, note, good, attention, i }) {
  return (
    <Link to={to} className={`stat rise${attention ? ' attention' : ''}`} style={{ '--i': i + 1 }}>
      <span className="stat-top">
        <span className="stat-icon"><Icon name={icon} /></span>
        <Icon name="arrow" size={16} className="stat-arrow" />
      </span>
      <span className="stat-label">{label}</span>
      <strong><CountUp value={value} /></strong>
      <span className={`stat-note${good ? ' good' : ''}`}>{note}</span>
    </Link>
  );
}

function DashboardSkeleton() {
  return (
    <div className="dash" aria-busy="true">
      <div className="skeleton" style={{ minHeight: 150, borderRadius: 18 }} />
      <div className="stats">{[0, 1, 2, 3].map((n) => <div key={n} className="skeleton" />)}</div>
    </div>
  );
}

export default function Dashboard() {
  const { user } = useSession();
  const { data, error } = useLoad(dashboard.get, []);

  if (error) return <ErrorNote error={error} />;
  if (!data) return <DashboardSkeleton />;
  const unreadTotal = Object.values(data.unread).reduce((a, b) => a + b, 0);
  const firstName = (user.name || '').split(' ')[0];
  const today = new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });

  return (
    <div className="dash">
      <header className="hero rise">
        <div>
          <span className="hero-eyebrow"><i />{today}</span>
          <h1>Welcome back{firstName ? `, ${firstName}` : ''}.</h1>
          <p>
            {unreadTotal
              ? `You have ${unreadTotal} unread submission${unreadTotal === 1 ? '' : 's'} waiting. Here’s what’s happening across the site.`
              : 'You’re all caught up. Here’s what’s happening across the site.'}
          </p>
        </div>
        <div className="hero-actions">
          {unreadTotal > 0 && <Link to="/submissions" className="btn">Review submissions</Link>}
          <Link to="/pages" className="btn gold">Edit a Page</Link>
        </div>
      </header>

      <div className="stats">
        <Stat i={0} to="/analytics" icon="analytics" label="Visitors, last 7 days" value={data.visitors?.week ?? 0}
          note={data.visitors?.views ? `${data.visitors.views.toLocaleString('en-US')} page views · see Analytics` : 'Counting starts when the site is live'} />
        <Stat i={1} to="/submissions" icon="submissions" label="Unread Submissions" value={unreadTotal} attention={unreadTotal > 0} good={!unreadTotal}
          note={unreadTotal ? Object.entries(data.unread).map(([k, n]) => `${n} ${formLabel(k).toLowerCase()}`).join(' · ') : 'All caught up'} />
        <Stat i={2} to="/pages" icon="pages" label="Published Pages" value={data.pages.count}
          note={`Last edit ${timeAgo(data.pages.lastEdit)}${data.pages.lastEditor ? ` by ${data.pages.lastEditor}` : ''}`} />
        <Stat i={3} to="/units" icon="units" label="Units Listed" value={data.units.count}
          note={`${data.units.active} shown on site · ${data.units.count - data.units.active} hidden`} />
        {data.users && (
          <Stat i={4} to="/staff" icon="staff" label="Staff Accounts" value={data.users.owner + data.users.staff}
            note={`${data.users.owner} owner · ${data.users.staff} staff`} />
        )}
      </div>

      <div className="dash-grid">
        <section className="panel rise" style={{ '--i': 5 }}>
          <div className="panel-head-row"><h2>Recent Activity</h2></div>
          {data.activity.length === 0 ? (
            <p className="muted empty-pad">Nothing yet. Edits and form submissions will show up here.</p>
          ) : (
            <ul className="activity">
              {data.activity.map((a, i) => (
                <li key={i}>
                  <Link to={a.link} className="activity-row">
                    <span className={`activity-ico${a.kind === 'edit' ? '' : ' sub'}`}><Icon name={a.kind === 'edit' ? 'edit' : 'submissions'} size={16} /></span>
                    <span className="activity-text">
                      <span>{a.kind === 'edit' ? <>{a.who} edited <strong>{a.what}</strong></> : a.who}</span>
                      {a.detail && <span className="detail">{a.detail}</span>}
                    </span>
                    <span className="when">{timeAgo(a.at)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className="panel rise" style={{ '--i': 6 }}>
          <div className="panel-head-row"><h2>Quick Actions</h2></div>
          <div className="quick-links">
            <Link to="/pages"><span className="qi"><Icon name="pages" /></span>Edit Pages</Link>
            <Link to="/submissions"><span className="qi"><Icon name="submissions" /></span>View Submissions</Link>
            <Link to="/units"><span className="qi"><Icon name="units" /></span>Manage Units</Link>
            <Link to="/media"><span className="qi"><Icon name="media" /></span>Upload Photos</Link>
            {user.role === 'owner' && <Link to="/staff"><span className="qi"><Icon name="staff" /></span>Manage Staff</Link>}
          </div>
        </section>
      </div>
    </div>
  );
}

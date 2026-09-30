import { createContext, useContext, useEffect, useState } from 'react';
import { api, setUnauthorizedHandler } from './api.js';
import Icon from './components/Icon.jsx';
import { Loading } from './components/ui.jsx';
import { Link, match, navigate, useLocation } from './router.jsx';
import Account from './views/Account.jsx';
import Analytics from './views/Analytics.jsx';
import Dashboard from './views/Dashboard.jsx';
import Faq from './views/Faq.jsx';
import { Forgot, Login, Reset } from './views/Auth.jsx';
import History from './views/History.jsx';
import MediaLibrary from './views/MediaLibrary.jsx';
import PageEditor from './views/PageEditor.jsx';
import Settings from './views/Settings.jsx';
import Pages from './views/Pages.jsx';
import Submissions, { SubmissionDetail } from './views/Submissions.jsx';
import Team from './views/Team.jsx';
import Units from './views/Units.jsx';

const SessionContext = createContext(null);
export const useSession = () => useContext(SessionContext);

const PUBLIC_PATHS = ['/login', '/forgot', '/reset'];

const ROUTES = [
  ['/', Dashboard],
  ['/analytics', Analytics],
  ['/pages', Pages],
  ['/pages/:id', PageEditor],
  ['/pages/:id/history', History],
  ['/media', MediaLibrary],
  ['/faq', Faq],
  ['/units', Units],
  ['/submissions', Submissions],
  ['/submissions/:id', SubmissionDetail],
  ['/staff', Team, { ownerOnly: true }],
  ['/settings', Settings, { ownerOnly: true }],
  ['/account', Account],
];

export default function App() {
  const { path } = useLocation();
  const [session, setSession] = useState(undefined); // undefined = loading, null = signed out

  useEffect(() => {
    setUnauthorizedHandler(() => {
      setSession(null);
      navigate('/login', { replace: true });
    });
    api('/auth/me')
      .then((d) => setSession({ user: d.user, siteUrl: d.siteUrl }))
      .catch(() => setSession(null));
  }, []);

  const signedIn = (user) => {
    api('/auth/me').then((d) => setSession({ user: d.user, siteUrl: d.siteUrl }));
    setSession((s) => ({ ...(s || {}), user }));
    navigate('/', { replace: true });
  };

  if (PUBLIC_PATHS.includes(path)) {
    const View = { '/login': Login, '/forgot': Forgot, '/reset': Reset }[path];
    return <View onSignedIn={signedIn} />;
  }
  if (session === undefined) return <div className="center-screen"><Loading /></div>;
  if (session === null) return <Redirect to="/login" />;

  let content = <NotFound />;
  for (const [pattern, View, opts] of ROUTES) {
    const params = match(pattern, path);
    if (params) {
      content = opts?.ownerOnly && session.user.role !== 'owner' ? <NotFound /> : <View params={params} />;
      break;
    }
  }

  return (
    <SessionContext.Provider value={session}>
      <Shell path={path}>{content}</Shell>
    </SessionContext.Provider>
  );
}

const NAV = [
  ['Core', [['/', 'Dashboard', 'dashboard'], ['/analytics', 'Analytics', 'analytics'], ['/pages', 'Pages', 'pages']]],
  ['Content', [['/units', 'Units', 'units'], ['/faq', 'FAQ Items', 'faq'], ['/media', 'Media Library', 'media']]],
  ['Operational', [['/submissions', 'Submissions', 'submissions'], ['/staff', 'Staff', 'staff', true], ['/settings', 'Site Settings', 'settings', true], ['/account', 'Account', 'account']]],
];

const CRUMBS = { '/': 'Dashboard', '/analytics': 'Analytics', '/settings': 'Site Settings', '/pages': 'Pages', '/units': 'Units', '/faq': 'FAQ Items', '/media': 'Media Library', '/submissions': 'Submissions', '/staff': 'Staff', '/account': 'Account' };

// Views can set a more specific breadcrumb (e.g. "Pages / Home") with useCrumb().
const CrumbContext = createContext(() => {});
export function useCrumb(crumb) {
  const set = useContext(CrumbContext);
  useEffect(() => {
    set(crumb);
    return () => set(null);
  }, [crumb, set]);
}

export function initials(user) {
  const src = (user.name || user.email || '?').trim();
  const parts = src.split(/\s+/);
  return ((parts[0]?.[0] || '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
}

function Shell({ path, children }) {
  const { user, siteUrl } = useSession();
  const [menuOpen, setMenuOpen] = useState(false);
  const [crumb, setCrumb] = useState(null);
  const active = (to) => (to === '/' ? path === '/' : path === to || path.startsWith(`${to}/`));
  const section = '/' + (path.split('/')[1] || '');

  const logout = async () => {
    await api('/auth/logout', { method: 'POST' }).catch(() => {});
    location.href = '/login';
  };

  return (
    <CrumbContext.Provider value={setCrumb}>
      <div className={`shell${menuOpen ? ' menu-open' : ''}`}>
        <aside className="sidebar">
          <div className="sidebar-brand">
            <img className="brand-logo" src="/logo.png" alt="" width="40" height="40" />
            <span>5R Suites Admin</span>
          </div>
          <nav onClick={() => setMenuOpen(false)}>
            {NAV.map(([group, items]) => (
              <div key={group} className="nav-group">
                <div className="nav-label">{group}</div>
                {items
                  .filter(([, , , ownerOnly]) => !ownerOnly || user.role === 'owner')
                  .map(([to, label, icon]) => (
                    <Link key={to} to={to} className={active(to) ? 'active' : ''}>
                      <Icon name={icon} />
                      {label}
                    </Link>
                  ))}
              </div>
            ))}
          </nav>
          <div className="sidebar-user">
            <span className="avatar">{initials(user)}</span>
            <div className="who">
              <strong>{user.name || user.email}</strong>
              <span>{user.role === 'owner' ? 'Owner' : 'Staff'}</span>
            </div>
            <button type="button" className="icon-btn" onClick={logout} title="Sign out" aria-label="Sign out"><Icon name="logout" /></button>
          </div>
        </aside>
        <div className="backdrop" onClick={() => setMenuOpen(false)} />
        <div className="workspace">
          <header className="topbar">
            <button type="button" className="square-btn menu-btn" onClick={() => setMenuOpen((o) => !o)} aria-label="Menu"><Icon name="menu" /></button>
            <div className="crumbs">
              {crumb ? (
                <><Link to={section}>{CRUMBS[section]}</Link><span>/</span>{crumb}</>
              ) : (
                CRUMBS[section] || ''
              )}
            </div>
            <div className="topbar-right">
              {siteUrl && <a className="btn ghost small" href={siteUrl} target="_blank" rel="noopener"><Icon name="external" size={16} />View site</a>}
              <Link to="/account" className="avatar" title="Account">{initials(user)}</Link>
            </div>
          </header>
          <main className="main">{children}</main>
        </div>
      </div>
    </CrumbContext.Provider>
  );
}

function Redirect({ to }) {
  useEffect(() => navigate(to, { replace: true }), [to]);
  return null;
}

function NotFound() {
  return (
    <div>
      <h1>Not found</h1>
      <p><Link to="/">Back to the dashboard</Link></p>
    </div>
  );
}

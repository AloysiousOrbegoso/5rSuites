import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { ErrorNote, Loading } from '../components/ui.jsx';
import { Link } from '../router.jsx';

function AuthCard({ title, children }) {
  return (
    <div className="auth">
      <aside className="auth-hero">
        <div className="auth-brand"><span className="brand-tile"><img className="brand-logo" src="/logo.png" alt="" width="28" height="28" /></span><span>5R Suites<small className="brand-sub">Admin</small></span></div>
        <div className="auth-pitch">
          <span className="auth-eyebrow"><i />Welcome back</span>
          <h2>Run every suite from one place.</h2>
          <p>Update pages, answer guest inquiries and keep your listings fresh, all in one calm workspace.</p>
          <ul className="auth-points">
            <li><strong>Pages</strong><span>Edit live</span></li>
            <li><strong>Units</strong><span>Always current</span></li>
            <li><strong>Inbox</strong><span>Never miss a guest</span></li>
          </ul>
        </div>
      </aside>
      <main className="auth-form">
        <div className="auth-card">
          <h1>{title}</h1>
          {children}
          <p className="auth-foot"><i />Secure staff area. Authorized users only.</p>
        </div>
      </main>
    </div>
  );
}

export function Login({ onSignedIn }) {
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true);
    setError(null);
    try {
      const d = await api('/auth/login', { method: 'POST', body: { email: f.get('email'), password: f.get('password') } });
      onSignedIn(d.user);
    } catch (err) {
      setError(err);
      setBusy(false);
    }
  };

  return (
    <AuthCard title="Sign in">
      <p className="muted auth-sub">Enter your details to open the dashboard.</p>
      <form onSubmit={submit} className="stack">
        <label className="field">Email<input name="email" type="email" autoComplete="username" required autoFocus /></label>
        <label className="field">Password<input name="password" type="password" autoComplete="current-password" required /></label>
        <Link to="/forgot" className="small auth-forgot">Forgot your password?</Link>
        <ErrorNote error={error} />
        <button className="btn primary" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
      </form>
    </AuthCard>
  );
}

export function Forgot() {
  const [done, setDone] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const d = await api('/auth/forgot', { method: 'POST', body: { email: new FormData(e.currentTarget).get('email') } });
      setDone(d.message);
    } catch (err) {
      setError(err);
    }
    setBusy(false);
  };

  return (
    <AuthCard title="Reset your password">
      {done ? (
        <p>{done}</p>
      ) : (
        <form onSubmit={submit} className="stack">
          <p className="muted">Enter your email and we’ll send you a link to choose a new password.</p>
          <label className="field">Email<input name="email" type="email" required autoFocus /></label>
          <ErrorNote error={error} />
          <button className="btn primary" disabled={busy}>Send reset link</button>
        </form>
      )}
      <Link to="/login" className="small">Back to sign in</Link>
    </AuthCard>
  );
}

// Handles both password reset links and staff invite links.
export function Reset({ onSignedIn }) {
  const token = new URLSearchParams(location.search).get('token') || '';
  const [info, setInfo] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api(`/auth/token?token=${encodeURIComponent(token)}`).then(setInfo).catch(() => setInfo({ valid: false }));
  }, [token]);

  const submit = async (e) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    if (f.get('password') !== f.get('confirm')) {
      setError(new Error('Passwords don’t match.'));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const d = await api('/auth/reset', { method: 'POST', body: { token, password: f.get('password') } });
      history.replaceState(null, '', '/');
      onSignedIn(d.user);
    } catch (err) {
      setError(err);
      setBusy(false);
    }
  };

  if (!info) return <AuthCard title="One moment"><Loading /></AuthCard>;
  if (!info.valid) {
    return (
      <AuthCard title="Link expired">
        <p>This link is invalid, already used, or expired.</p>
        <Link to="/forgot">Request a new reset link</Link>
      </AuthCard>
    );
  }

  const invite = info.purpose === 'invite';
  return (
    <AuthCard title={invite ? 'Set up your login' : 'Choose a new password'}>
      <p className="muted">{info.email}</p>
      <form onSubmit={submit} className="stack">
        <label className="field">New password<input name="password" type="password" autoComplete="new-password" minLength={10} required autoFocus /></label>
        <label className="field">Confirm password<input name="confirm" type="password" autoComplete="new-password" minLength={10} required /></label>
        <p className="muted small">At least 10 characters.{!invite && ' Other devices will be signed out.'}</p>
        <ErrorNote error={error} />
        <button className="btn primary" disabled={busy}>{invite ? 'Create login' : 'Save password'}</button>
      </form>
    </AuthCard>
  );
}

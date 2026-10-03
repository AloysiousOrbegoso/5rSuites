import { useState } from 'react';
import { account } from '../resources.js';
import { initials, useSession } from '../App.jsx';
import { ErrorNote, useToast } from '../components/ui.jsx';

export default function Account() {
  const { user } = useSession();
  const toast = useToast();
  const [nameError, setNameError] = useState(null);
  const [pwError, setPwError] = useState(null);
  const [busy, setBusy] = useState(false);

  const saveName = async (e) => {
    e.preventDefault();
    setNameError(null);
    try {
      await account.rename(new FormData(e.currentTarget).get('name'));
      toast('Name updated.');
      setTimeout(() => location.reload(), 600);
    } catch (err) {
      setNameError(err);
    }
  };

  const savePassword = async (e) => {
    e.preventDefault();
    const form = e.currentTarget;
    const f = new FormData(form);
    setPwError(null);
    if (f.get('password') !== f.get('confirm')) {
      setPwError(new Error('New passwords don’t match.'));
      return;
    }
    setBusy(true);
    try {
      await account.changePassword(f.get('current'), f.get('password'));
      form.reset();
      toast('Password changed. Your other devices were signed out.');
    } catch (err) {
      setPwError(err);
    }
    setBusy(false);
  };

  return (
    <div>
      <header className="page-head">
        <div>
          <h1>Account</h1>
          <p className="subtitle">Your profile and sign-in details.</p>
        </div>
      </header>
      <div className="account-grid">
        <section className="panel panel-pad">
          <div className="profile">
            <span className="avatar large">{initials(user)}</span>
            <div>
              <strong>{user.name || user.email}</strong>
              <div className="muted">{user.email} · {user.role === 'owner' ? 'Owner' : 'Staff'}</div>
            </div>
          </div>
          <form className="stack" onSubmit={saveName}>
            <label className="field">Display name<input name="name" defaultValue={user.name} required maxLength={120} /></label>
            <ErrorNote error={nameError} />
            <div className="row-end"><button className="btn primary">Save name</button></div>
          </form>
        </section>
        <section className="panel panel-pad">
          <h2>Change password</h2>
          <form className="stack" onSubmit={savePassword}>
            <label className="field">Current password<input name="current" type="password" autoComplete="current-password" required /></label>
            <label className="field">New password<input name="password" type="password" autoComplete="new-password" minLength={10} required /></label>
            <label className="field">Confirm new password<input name="confirm" type="password" autoComplete="new-password" minLength={10} required /></label>
            <p className="hint">At least 10 characters. You’ll stay signed in here; other devices will be signed out.</p>
            <ErrorNote error={pwError} />
            <div className="row-end"><button className="btn primary" disabled={busy}>{busy ? 'Saving…' : 'Change password'}</button></div>
          </form>
        </section>
      </div>
    </div>
  );
}

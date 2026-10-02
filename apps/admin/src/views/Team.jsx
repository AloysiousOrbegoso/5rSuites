import { useState } from 'react';
import { api } from '../api.js';
import { useSession } from '../App.jsx';
import { ErrorNote, Loading, Modal, formatDate, useLoad, useToast } from '../components/ui.jsx';

export default function Team() {
  const { user } = useSession();
  const { data, error, reload } = useLoad(() => api('/users'), []);
  const [inviting, setInviting] = useState(false);
  const toast = useToast();

  if (error) return <ErrorNote error={error} />;
  if (!data) return <Loading />;

  const remove = async (u) => {
    if (!confirm(`Remove ${u.email}? They’ll be signed out immediately.`)) return;
    try {
      await api(`/users/${u.id}`, { method: 'DELETE' });
      toast('Login removed.');
      reload();
    } catch (err) {
      toast(err.message, 'error');
    }
  };

  return (
    <div>
      <header className="page-head">
        <div>
          <h1>Team</h1>
          <p className="subtitle">Who can sign in to this admin.</p>
        </div>
        <button className="btn primary" onClick={() => setInviting(true)}>Invite someone</button>
      </header>
      <p className="muted small">Staff can edit sections and restore history. Only owners can create or delete pages, change URLs and manage logins.</p>
      <table className="table">
        <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Last sign-in</th><th /></tr></thead>
        <tbody>
          {data.users.map((u) => (
            <tr key={u.id}>
              <td>{u.name || '—'}</td>
              <td>{u.email}</td>
              <td>{u.role === 'owner' ? 'Owner' : 'Staff'}{u.pending ? <span className="badge warn">Invite pending</span> : null}</td>
              <td className="muted">{formatDate(u.last_login_at)}</td>
              <td>{u.id !== user.id && <button className="btn small danger" onClick={() => remove(u)}>Remove</button>}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {inviting && <Invite onClose={() => setInviting(false)} onDone={() => { setInviting(false); reload(); }} />}
    </div>
  );
}

function Invite({ onClose, onDone }) {
  const [error, setError] = useState(null);
  const [link, setLink] = useState(null);
  const toast = useToast();

  const submit = async (e) => {
    e.preventDefault();
    try {
      const d = await api('/users', { method: 'POST', body: Object.fromEntries(new FormData(e.currentTarget)) });
      if (d.emailed) {
        toast('Invite sent.');
        onDone();
      } else {
        setLink(d.link);
      }
    } catch (err) {
      setError(err);
    }
  };

  if (link) {
    return (
      <Modal title="Invite created" onClose={onDone}>
        <p>The invite email couldn’t be sent (email may not be set up yet). Send this link to them yourself — it works once and expires in 3 days:</p>
        <input className="mono" readOnly value={link} onFocus={(e) => e.target.select()} />
        <div className="row-end"><button className="btn primary" onClick={onDone}>Done</button></div>
      </Modal>
    );
  }

  return (
    <Modal title="Invite someone" onClose={onClose}>
      <form className="stack" onSubmit={submit}>
        <label className="field">Name<input name="name" maxLength={120} autoFocus /></label>
        <label className="field">Email<input name="email" type="email" required /></label>
        <label className="field">Role
          <select name="role" defaultValue="staff">
            <option value="staff">Staff — edit content</option>
            <option value="owner">Owner — full control</option>
          </select>
        </label>
        <ErrorNote error={error} />
        <div className="row-end"><button type="button" className="btn" onClick={onClose}>Cancel</button><button className="btn primary">Send invite</button></div>
      </form>
    </Modal>
  );
}

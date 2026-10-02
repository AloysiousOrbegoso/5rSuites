import { useState } from 'react';
import { api } from '../api.js';
import { useSession } from '../App.jsx';
import { ErrorNote, Loading, Modal, formatDate, useLoad, useSaveToast } from '../components/ui.jsx';
import { Link, navigate } from '../router.jsx';

export default function Pages() {
  const { user, siteUrl } = useSession();
  const { data, error, loading } = useLoad(() => api('/pages'), []);
  const [creating, setCreating] = useState(false);

  return (
    <div>
      <header className="page-head">
        <div>
          <h1>Pages</h1>
          <p className="subtitle">Every page on the public site. Open one to edit its sections.</p>
        </div>
        {user.role === 'owner' && <button className="btn primary" onClick={() => setCreating(true)}>New page</button>}
      </header>
      <ErrorNote error={error} />
      {loading && !data ? <Loading /> : (
        <table className="table">
          <thead>
            <tr><th>Page</th><th>URL</th><th>Sections</th><th>Last edited</th></tr>
          </thead>
          <tbody>
            {data?.pages.map((p) => (
              <tr key={p.id}>
                <td>
                  <Link to={`/pages/${p.id}`} className="strong">{p.title}</Link>
                  {!p.show_in_nav && p.slug !== 'home' && <span className="badge">Hidden from menu</span>}
                </td>
                <td><a href={`${siteUrl}/${p.slug === 'home' ? '' : p.slug}`} target="_blank" rel="noopener" className="mono">/{p.slug === 'home' ? '' : p.slug}</a></td>
                <td>{p.section_count}</td>
                <td className="muted">{formatDate(p.updated_at)}{p.updated_by_name ? ` · ${p.updated_by_name}` : ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {creating && <NewPage onClose={() => setCreating(false)} />}
    </div>
  );
}

function NewPage({ onClose }) {
  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [slugEdited, setSlugEdited] = useState(false);
  const [error, setError] = useState(null);
  const saveToast = useSaveToast();

  const slugify = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80);

  const submit = async (e) => {
    e.preventDefault();
    try {
      const d = await api('/pages', { method: 'POST', body: { title, slug, show_in_nav: new FormData(e.currentTarget).get('nav') === 'on' } });
      saveToast(d, 'Page created.');
      navigate(`/pages/${d.id}`);
    } catch (err) {
      setError(err);
    }
  };

  return (
    <Modal title="New page" onClose={onClose}>
      <form className="stack" onSubmit={submit}>
        <label className="field">Title
          <input value={title} required maxLength={120} autoFocus onChange={(e) => { setTitle(e.target.value); if (!slugEdited) setSlug(slugify(e.target.value)); }} />
        </label>
        <label className="field">URL slug
          <div className="input-prefix"><span>/</span><input value={slug} required pattern="[a-z0-9][a-z0-9\-]*" onChange={(e) => { setSlugEdited(true); setSlug(e.target.value); }} /></div>
        </label>
        <label className="check"><input type="checkbox" name="nav" defaultChecked /> Show in the site menu</label>
        <ErrorNote error={error} />
        <div className="row-end"><button type="button" className="btn" onClick={onClose}>Cancel</button><button className="btn primary">Create page</button></div>
      </form>
    </Modal>
  );
}

import { useState } from 'react';
import { api } from '../api.js';
import { ImageField, Thumb, useMedia } from '../components/media.jsx';
import { ErrorNote, Loading, Modal, useLoad, useSaveToast, useToast } from '../components/ui.jsx';

export default function Units() {
  const { data, error, reload } = useLoad(() => api('/units'), []);
  const { byId } = useMedia();
  const [editing, setEditing] = useState(null);
  const saveToast = useSaveToast();
  const toast = useToast();

  if (error) return <ErrorNote error={error} />;
  if (!data) return <Loading />;

  const del = async (u) => {
    if (!confirm(`Delete “${u.name}”?`)) return;
    try {
      saveToast(await api(`/units/${u.id}`, { method: 'DELETE' }), 'Unit deleted.');
      reload();
    } catch (err) {
      toast(err.message, 'error');
    }
  };

  return (
    <div>
      <header className="page-head">
        <div>
          <h1>Units</h1>
          <p className="subtitle">Shown wherever a page has a “Unit grid” section. Booking happens on the external reservation site.</p>
        </div>
        <button className="btn primary" onClick={() => setEditing({ is_active: 1, bedrooms: 1, bathrooms: 1, sleeps: 2, position: 0 })}>Add unit</button>
      </header>
      <table className="table">
        <thead><tr><th /><th>Unit</th><th>Location</th><th>Beds / baths / sleeps</th><th>Status</th><th /></tr></thead>
        <tbody>
          {data.units.map((u) => (
            <tr key={u.id}>
              <td><Thumb media={byId(u.image_id)} size={48} /></td>
              <td><button className="link-btn strong" onClick={() => setEditing(u)}>{u.name}</button></td>
              <td>{[u.neighborhood, u.city].filter(Boolean).join(', ')}</td>
              <td>{u.bedrooms} / {u.bathrooms} / {u.sleeps}</td>
              <td>{u.is_active ? <span className="badge ok">Shown</span> : <span className="badge">Hidden</span>}</td>
              <td><button className="icon-btn danger" onClick={() => del(u)} aria-label="Delete">🗑</button></td>
            </tr>
          ))}
          {data.units.length === 0 && <tr><td colSpan={6} className="muted">No units yet.</td></tr>}
        </tbody>
      </table>
      {editing && <UnitForm unit={editing} onClose={() => setEditing(null)} onSaved={(d) => { saveToast(d); setEditing(null); reload(); }} />}
    </div>
  );
}

function UnitForm({ unit, onClose, onSaved }) {
  const [imageId, setImageId] = useState(unit.image_id ?? null);
  const [error, setError] = useState(null);

  const submit = async (e) => {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.currentTarget));
    const body = { ...f, image_id: imageId, is_active: f.is_active === 'on' };
    try {
      onSaved(await api(unit.id ? `/units/${unit.id}` : '/units', { method: unit.id ? 'PUT' : 'POST', body }));
    } catch (err) {
      setError(err);
    }
  };

  return (
    <Modal title={unit.id ? 'Edit unit' : 'Add unit'} onClose={onClose} wide>
      <form className="stack" onSubmit={submit}>
        <div className="grid-2">
          <label className="field">Name<input name="name" defaultValue={unit.name} required maxLength={120} autoFocus /></label>
          <label className="field">Booking link<input name="booking_url" defaultValue={unit.booking_url} placeholder="https://5rsuites.holidayfuture.com/…" maxLength={500} /></label>
          <label className="field">City<input name="city" defaultValue={unit.city} maxLength={80} /></label>
          <label className="field">Neighborhood<input name="neighborhood" defaultValue={unit.neighborhood} maxLength={80} /></label>
        </div>
        <div className="grid-4">
          <label className="field">Bedrooms<input name="bedrooms" type="number" min="0" max="20" defaultValue={unit.bedrooms} /></label>
          <label className="field">Bathrooms<input name="bathrooms" type="number" min="0" max="20" step="0.5" defaultValue={unit.bathrooms} /></label>
          <label className="field">Sleeps<input name="sleeps" type="number" min="1" max="40" defaultValue={unit.sleeps} /></label>
          <label className="field">Sort order<input name="position" type="number" defaultValue={unit.position} /></label>
        </div>
        <label className="field">Description<textarea name="description" defaultValue={unit.description} rows={4} maxLength={2000} /></label>
        <div className="field"><span className="field-label">Photo</span><ImageField value={imageId} onChange={setImageId} /></div>
        <label className="check"><input type="checkbox" name="is_active" defaultChecked={!!unit.is_active} /> Show on the site</label>
        <ErrorNote error={error} />
        <div className="row-end"><button type="button" className="btn" onClick={onClose}>Cancel</button><button className="btn primary">Save & publish</button></div>
      </form>
    </Modal>
  );
}

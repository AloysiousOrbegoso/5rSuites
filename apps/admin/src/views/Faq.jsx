import { useState } from 'react';
import { api } from '../api.js';
import { ErrorNote, Loading, Modal, useLoad, useSaveToast, useToast } from '../components/ui.jsx';

export default function Faq() {
  const { data, error, reload, setData } = useLoad(() => api('/faq'), []);
  const [editing, setEditing] = useState(null);
  const saveToast = useSaveToast();
  const toast = useToast();

  if (error) return <ErrorNote error={error} />;
  if (!data) return <Loading />;
  const items = data.items;

  const move = async (i, d) => {
    const next = [...items];
    [next[i], next[i + d]] = [next[i + d], next[i]];
    setData({ items: next });
    try {
      saveToast(await api('/faq/reorder', { method: 'POST', body: { order: next.map((x) => x.id) } }), 'Order saved.');
    } catch (err) {
      toast(err.message, 'error');
      reload();
    }
  };

  const del = async (item) => {
    if (!confirm(`Delete “${item.question}”?`)) return;
    try {
      saveToast(await api(`/faq/${item.id}`, { method: 'DELETE' }), 'Question deleted.');
      reload();
    } catch (err) {
      toast(err.message, 'error');
    }
  };

  return (
    <div>
      <header className="page-head">
        <div>
          <h1>FAQ</h1>
          <p className="subtitle">Questions guests ask most, shown wherever a page has an FAQ list.</p>
        </div>
        <button className="btn primary" onClick={() => setEditing({})}>Add question</button>
      </header>
      <p className="muted small">These appear wherever a page has an “FAQ list” section. Use a category to show a subset on a particular page.</p>
      <div className="stack">
        {items.map((item, i) => (
          <div className="section-card" key={item.id}>
            <div className="section-card-head">
              <button type="button" className="section-toggle" onClick={() => setEditing(item)}>
                {item.category && <span className="badge">{item.category}</span>}
                <span>{item.question}</span>
              </button>
              <div className="row">
                <button className="icon-btn" disabled={i === 0} onClick={() => move(i, -1)} aria-label="Move up">↑</button>
                <button className="icon-btn" disabled={i === items.length - 1} onClick={() => move(i, 1)} aria-label="Move down">↓</button>
                <button className="icon-btn danger" onClick={() => del(item)} aria-label="Delete">🗑</button>
              </div>
            </div>
          </div>
        ))}
        {items.length === 0 && <p className="muted">No questions yet.</p>}
      </div>
      {editing && <FaqForm item={editing} onClose={() => setEditing(null)} onSaved={(d) => { saveToast(d); setEditing(null); reload(); }} />}
    </div>
  );
}

function FaqForm({ item, onClose, onSaved }) {
  const [error, setError] = useState(null);
  const submit = async (e) => {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.currentTarget));
    try {
      onSaved(await api(item.id ? `/faq/${item.id}` : '/faq', { method: item.id ? 'PUT' : 'POST', body: f }));
    } catch (err) {
      setError(err);
    }
  };
  return (
    <Modal title={item.id ? 'Edit question' : 'Add question'} onClose={onClose}>
      <form className="stack" onSubmit={submit}>
        <label className="field">Question<input name="question" defaultValue={item.question} required maxLength={300} autoFocus /></label>
        <label className="field">Answer<textarea name="answer" defaultValue={item.answer} required maxLength={5000} rows={6} /></label>
        <label className="field">Category (optional)<input name="category" defaultValue={item.category} maxLength={80} /></label>
        <ErrorNote error={error} />
        <div className="row-end"><button type="button" className="btn" onClick={onClose}>Cancel</button><button className="btn primary">Save & publish</button></div>
      </form>
    </Modal>
  );
}

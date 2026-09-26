import { BLOCKS, BLOCK_TYPES, defaultData } from '@5rsuites/blocks';
import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { useCrumb, useSession } from '../App.jsx';
import Icon from '../components/Icon.jsx';
import SectionForm, { sectionSummary } from '../components/SectionForm.jsx';
import { ErrorNote, Loading, Modal, useLoad, useSaveToast, useToast } from '../components/ui.jsx';
import { Link, navigate } from '../router.jsx';
import { timeAgo } from './Dashboard.jsx';

export default function PageEditor({ params }) {
  const { siteUrl } = useSession();
  const { data, error, setData } = useLoad(() => api(`/pages/${params.id}`), [params.id]);
  const [openId, setOpenId] = useState(null);
  const [settings, setSettings] = useState(false);
  const [dragId, setDragId] = useState(null);
  const [overId, setOverId] = useState(null);
  const saveToast = useSaveToast();
  const toast = useToast();
  useCrumb(data?.page.title ?? null);

  if (error) return <ErrorNote error={error} />;
  if (!data) return <Loading />;
  const page = data.page;
  const sections = page.sections;
  const path = page.slug === 'home' ? '/' : `/${page.slug}`;

  const apply = (d, message) => {
    setData({ page: d.page });
    saveToast(d, message);
  };

  const reorder = async (order) => {
    // Optimistic: show the new order immediately.
    setData({ page: { ...page, sections: order.map((id) => sections.find((s) => s.id === id)) } });
    try {
      apply(await api(`/pages/${page.id}/sections/reorder`, { method: 'POST', body: { order } }), 'Order saved — live on the site.');
    } catch (err) {
      toast(err.message, 'error');
      setData({ page });
    }
  };

  const move = (index, delta) => {
    const order = sections.map((s) => s.id);
    [order[index], order[index + delta]] = [order[index + delta], order[index]];
    reorder(order);
  };

  const drop = (targetId) => {
    if (!dragId || dragId === targetId) return;
    const order = sections.map((s) => s.id).filter((id) => id !== dragId);
    order.splice(order.indexOf(targetId), 0, dragId);
    reorder(order);
  };

  const remove = async (section) => {
    if (!confirm(`Delete this ${BLOCKS[section.type].label} section? You can bring it back from History.`)) return;
    try {
      apply(await api(`/pages/${page.id}/sections/${section.id}`, { method: 'DELETE' }), 'Section deleted.');
    } catch (err) {
      toast(err.message, 'error');
    }
  };

  const add = async (type) => {
    try {
      const d = await api(`/pages/${page.id}/sections`, { method: 'POST', body: { type, data: blankFor(type) } });
      apply(d, 'Section added at the bottom. Fill it in and save.');
      setOpenId(d.page.sections[d.page.sections.length - 1]?.id ?? null);
    } catch (err) {
      toast(err.message, 'error');
    }
  };

  return (
    <div className="editor">
      <header className="page-head">
        <div>
          <h1>Editing: {page.title}</h1>
          <p className="subtitle">
            <span className="mono">{path}</span> · {sections.length} section{sections.length === 1 ? '' : 's'} · last saved {timeAgo(page.updated_at)}
          </p>
        </div>
        <div className="row">
          <Link to={`/pages/${page.id}/history`} className="btn"><Icon name="history" size={16} />History</Link>
          <button className="btn" onClick={() => setSettings(true)}>Settings</button>
          <a href={`${siteUrl}${path}`} target="_blank" rel="noopener" className="btn primary">View Live</a>
        </div>
      </header>
      <p className="hint editor-hint">Changes go live as soon as you save a section. Drag the handle to reorder. Every save is kept in History.</p>

      <div className="section-list">
        {sections.map((s, i) => (
          <SectionCard
            key={s.id}
            section={s}
            open={openId === s.id}
            onToggle={() => setOpenId(openId === s.id ? null : s.id)}
            first={i === 0}
            last={i === sections.length - 1}
            onMove={(d) => move(i, d)}
            onDelete={() => remove(s)}
            onSaved={(d) => apply(d)}
            pageId={page.id}
            dragging={dragId === s.id}
            over={overId === s.id && dragId !== s.id}
            dragProps={{
              onDragStart: (e) => { setDragId(s.id); e.dataTransfer.effectAllowed = 'move'; },
              onDragEnd: () => { setDragId(null); setOverId(null); },
            }}
            dropProps={{
              onDragOver: (e) => { if (dragId) { e.preventDefault(); setOverId(s.id); } },
              onDrop: (e) => { e.preventDefault(); drop(s.id); setDragId(null); setOverId(null); },
            }}
          />
        ))}
        {sections.length === 0 && <div className="empty-state">This page has no sections yet. Add one below.</div>}
      </div>

      <section className="panel panel-pad add-panel">
        <h2>Add a Section</h2>
        <p className="muted small">Choose a block type to add it to the end of this page.</p>
        <div className="chips">
          {BLOCK_TYPES.map((t) => (
            <button type="button" key={t} className="chip" title={BLOCKS[t].description} onClick={() => add(t)}>{BLOCKS[t].label}</button>
          ))}
        </div>
      </section>

      {settings && <PageSettings page={page} onClose={() => setSettings(false)} onSaved={(d) => { apply(d); setSettings(false); }} />}
    </div>
  );
}

// New sections need their required fields filled to pass validation; use a visible placeholder.
function blankFor(type) {
  const data = defaultData(type);
  for (const f of BLOCKS[type].fields) {
    if (f.required && ['text', 'textarea', 'markdown'].includes(f.kind)) data[f.name] = `New ${BLOCKS[type].label.toLowerCase()}`;
  }
  return data;
}

function SectionCard({ section, open, onToggle, first, last, onMove, onDelete, onSaved, pageId, dragging, over, dragProps, dropProps }) {
  const [draft, setDraft] = useState(section.data);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const dirty = JSON.stringify(draft) !== JSON.stringify(section.data);

  useEffect(() => setDraft(section.data), [section.data]);

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      onSaved(await api(`/pages/${pageId}/sections/${section.id}`, { method: 'PUT', body: { data: draft } }));
    } catch (err) {
      setError(err);
    }
    setSaving(false);
  };

  return (
    <div className={`section-card${open ? ' open' : ''}${dragging ? ' dragging' : ''}${over ? ' drop-target' : ''}`} {...dropProps}>
      <div className="section-card-head">
        <span className="drag-handle" draggable {...dragProps} title="Drag to reorder" aria-hidden="true"><Icon name="drag" /></span>
        <button type="button" className="section-toggle" onClick={onToggle} aria-expanded={open}>
          <span className="type-badge">{BLOCKS[section.type].label}</span>
          <span className="summary">{sectionSummary(section.type, section.data)}</span>
          {dirty && <span className="badge warn">Unsaved</span>}
        </button>
        <div className="row card-actions">
          <button type="button" className="icon-btn" disabled={first} onClick={() => onMove(-1)} aria-label="Move up" title="Move up"><Icon name="up" size={16} /></button>
          <button type="button" className="icon-btn" disabled={last} onClick={() => onMove(1)} aria-label="Move down" title="Move down"><Icon name="down" size={16} /></button>
          <button type="button" className="btn small" onClick={onToggle}>{open ? 'Collapse' : 'Edit'}</button>
          <button type="button" className="btn small" onClick={onDelete}>Delete</button>
        </div>
      </div>
      {open && (
        <form className="section-card-body" onSubmit={save}>
          <SectionForm type={section.type} data={draft} onChange={setDraft} />
          <ErrorNote error={error} />
          <div className="row-end sticky-actions">
            <button type="button" className="btn" disabled={!dirty || saving} onClick={() => setDraft(section.data)}>Discard changes</button>
            <button className="btn primary" disabled={!dirty || saving}>{saving ? 'Saving…' : 'Save & publish'}</button>
          </div>
        </form>
      )}
    </div>
  );
}

function PageSettings({ page, onClose, onSaved }) {
  const { user } = useSession();
  const owner = user.role === 'owner';
  const [error, setError] = useState(null);
  const toast = useToast();

  const submit = async (e) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const body = { title: f.get('title'), meta_description: f.get('meta_description') };
    if (owner) Object.assign(body, { slug: f.get('slug'), show_in_nav: f.get('show_in_nav') === 'on', nav_order: Number(f.get('nav_order')) });
    if (owner && body.slug !== page.slug && !confirm('Changing the URL breaks existing links and search results pointing at the old address. Continue?')) return;
    try {
      onSaved(await api(`/pages/${page.id}`, { method: 'PATCH', body }));
    } catch (err) {
      setError(err);
    }
  };

  const del = async () => {
    if (!confirm(`Permanently delete “${page.title}” and all its history? This can’t be undone.`)) return;
    try {
      await api(`/pages/${page.id}`, { method: 'DELETE' });
      toast('Page deleted.');
      navigate('/pages');
    } catch (err) {
      setError(err);
    }
  };

  const isHome = page.slug === 'home';
  return (
    <Modal title="Page settings" onClose={onClose}>
      <form className="stack" onSubmit={submit}>
        <label className="field">Title<input name="title" defaultValue={page.title} required maxLength={120} /></label>
        <label className="field">Search description
          <textarea name="meta_description" defaultValue={page.meta_description} maxLength={300} rows={3} />
          <span className="hint">Shown under the title in Google results. About 150 characters.</span>
        </label>
        {owner ? (
          <>
            <label className="field">URL slug
              <div className="input-prefix"><span>/</span><input name="slug" defaultValue={page.slug} disabled={isHome} required /></div>
              {isHome && <input type="hidden" name="slug" value="home" />}
            </label>
            {!isHome && <label className="check"><input type="checkbox" name="show_in_nav" defaultChecked={!!page.show_in_nav} /> Show in the site menu</label>}
            {isHome && <input type="hidden" name="show_in_nav" value={page.show_in_nav ? 'on' : ''} />}
            <label className="field narrow">Menu order<input name="nav_order" type="number" defaultValue={page.nav_order} /></label>
          </>
        ) : (
          <p className="muted small">Only the owner can change the URL or menu settings.</p>
        )}
        <ErrorNote error={error} />
        <div className="row-between">
          {owner && !isHome ? <button type="button" className="btn danger" onClick={del}>Delete page</button> : <span />}
          <div className="row"><button type="button" className="btn" onClick={onClose}>Cancel</button><button className="btn primary">Save</button></div>
        </div>
      </form>
    </Modal>
  );
}

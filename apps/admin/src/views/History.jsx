import { BLOCKS } from '@5rsuites/blocks';
import { useState } from 'react';
import { api } from '../api.js';
import { sectionSummary } from '../components/SectionForm.jsx';
import { ErrorNote, Loading, Modal, formatDate, useLoad, useSaveToast } from '../components/ui.jsx';
import { Link, navigate } from '../router.jsx';

export default function History({ params }) {
  const { data, error, loading } = useLoad(
    () => Promise.all([api(`/pages/${params.id}`), api(`/pages/${params.id}/revisions`)]),
    [params.id],
  );
  const [viewing, setViewing] = useState(null);

  if (error) return <ErrorNote error={error} />;
  if (loading && !data) return <Loading />;
  const [{ page }, { revisions }] = data;

  return (
    <div>
      <header className="page-head">
        <div>
          <Link to={`/pages/${page.id}`} className="muted small">← {page.title}</Link>
          <h1>History</h1>
        </div>
      </header>
      <p className="muted small">The last 20 versions of this page are kept. Restoring adds a new version — nothing is ever overwritten.</p>
      <table className="table">
        <thead><tr><th>When</th><th>Change</th><th>By</th><th>Sections</th><th /></tr></thead>
        <tbody>
          {revisions.map((r, i) => (
            <tr key={r.id}>
              <td>{formatDate(r.created_at)}{i === 0 && <span className="badge">Current</span>}</td>
              <td>{r.note}</td>
              <td className="muted">{r.created_by_name || r.created_by_email || (/Wix import/.test(r.note || '') ? 'Wix import' : '—')}</td>
              <td>{r.section_count}</td>
              <td><button className="btn small" onClick={() => setViewing(r.id)}>View</button></td>
            </tr>
          ))}
          {revisions.length === 0 && <tr><td colSpan={5} className="muted">No history yet. It starts with the first save.</td></tr>}
        </tbody>
      </table>
      {viewing && <RevisionView pageId={page.id} revisionId={viewing} isCurrent={viewing === revisions[0]?.id} onClose={() => setViewing(null)} />}
    </div>
  );
}

function RevisionView({ pageId, revisionId, isCurrent, onClose }) {
  const { data, error } = useLoad(() => api(`/pages/${pageId}/revisions/${revisionId}`), [revisionId]);
  const [busy, setBusy] = useState(false);
  const [restoreError, setRestoreError] = useState(null);
  const saveToast = useSaveToast();

  const restore = async () => {
    if (!confirm('Restore this version? The current page will be replaced, and the change is recorded as a new version.')) return;
    setBusy(true);
    try {
      const d = await api(`/pages/${pageId}/revisions/${revisionId}/restore`, { method: 'POST' });
      saveToast(d, 'Version restored — live on the site.');
      navigate(`/pages/${pageId}`);
    } catch (err) {
      setRestoreError(err);
      setBusy(false);
    }
  };

  return (
    <Modal title="Saved version" onClose={onClose} wide>
      <ErrorNote error={error} />
      {!data ? <Loading /> : (
        <div className="stack">
          <p><strong>{data.revision.snapshot.page.title}</strong> · {formatDate(data.revision.created_at)} · {data.revision.note}</p>
          <ol className="revision-sections">
            {data.revision.snapshot.sections.map((s, i) => (
              <li key={i}><span className="badge">{BLOCKS[s.type]?.label || s.type}</span> {sectionSummary(s.type, s.data)}</li>
            ))}
          </ol>
          <ErrorNote error={restoreError} />
          <div className="row-end">
            <button className="btn" onClick={onClose}>Close</button>
            {!isCurrent && <button className="btn primary" disabled={busy} onClick={restore}>{busy ? 'Restoring…' : 'Restore this version'}</button>}
          </div>
        </div>
      )}
    </Modal>
  );
}

import { useState } from 'react';
import { api } from '../api.js';
import { ErrorNote, Loading, formatDate, useLoad, useToast } from '../components/ui.jsx';
import { Link } from '../router.jsx';

const money = (n) => (typeof n === 'number' ? n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }) : '—');
const percent = (n) => (typeof n === 'number' ? `${Math.round(n * 100)}%` : '—');

const TYPE_LABELS = { contact: 'Contact', register_property: 'Register Property', careers: 'Careers' };
const REPORT_LABELS = {
  pending: 'Report generating',
  sent: 'Report sent',
  held: 'Report held — needs review',
  failed: 'Report failed',
};

export default function Submissions() {
  const [type, setType] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(0);
  const qs = new URLSearchParams({ ...(type && { type }), ...(status && { status }), page: String(page) });
  const { data, error } = useLoad(() => api(`/submissions?${qs}`), [qs.toString()]);

  return (
    <div>
      <header className="page-head"><h1>Form submissions</h1></header>
      <div className="row filters">
        <select value={type} onChange={(e) => { setType(e.target.value); setPage(0); }}>
          <option value="">All forms</option>
          {Object.entries(TYPE_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}{data?.newCounts?.[k] ? ` (${data.newCounts[k]} new)` : ''}</option>
          ))}
        </select>
        <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(0); }}>
          <option value="">Inbox (new + read)</option>
          <option value="new">New</option>
          <option value="read">Read</option>
          <option value="archived">Archived</option>
        </select>
      </div>
      <ErrorNote error={error} />
      {!data ? <Loading /> : (
        <>
          <table className="table">
            <thead><tr><th>Received</th><th>Form</th><th>From</th><th>Status</th></tr></thead>
            <tbody>
              {data.submissions.map((s) => (
                <tr key={s.id} className={s.status === 'new' ? 'unread' : ''}>
                  <td>{formatDate(s.created_at)}</td>
                  <td>{TYPE_LABELS[s.form_type]}{s.has_attachment ? ' 📎' : ''}</td>
                  <td><Link to={`/submissions/${s.id}`}>{s.name || s.email || '(no name)'}</Link><div className="muted small">{s.email}</div></td>
                  <td>
                    <span className={`badge${s.status === 'new' ? ' accent' : ''}`}>{s.status}</span>
                    {s.notify_status === 'failed' && <span className="badge warn">Email failed</span>}
                    {s.report_status && <span className={`badge${s.report_status === 'sent' ? ' ok' : s.report_status === 'pending' ? '' : ' warn'}`}>{REPORT_LABELS[s.report_status]}</span>}
                  </td>
                </tr>
              ))}
              {data.submissions.length === 0 && <tr><td colSpan={4} className="muted">Nothing here.</td></tr>}
            </tbody>
          </table>
          <div className="row">
            {page > 0 && <button className="btn small" onClick={() => setPage(page - 1)}>← Newer</button>}
            {data.hasMore && <button className="btn small" onClick={() => setPage(page + 1)}>Older →</button>}
          </div>
        </>
      )}
    </div>
  );
}

export function SubmissionDetail({ params }) {
  const { data, error, reload } = useLoad(async () => {
    const d = await api(`/submissions/${params.id}`);
    if (d.submission.status === 'new') {
      await api(`/submissions/${params.id}`, { method: 'PATCH', body: { status: 'read' } });
      d.submission.status = 'read';
    }
    return d;
  }, [params.id]);
  const toast = useToast();

  if (error) return <ErrorNote error={error} />;
  if (!data) return <Loading />;
  const s = data.submission;

  const setStatus = async (status) => {
    await api(`/submissions/${s.id}`, { method: 'PATCH', body: { status } }).catch((e) => toast(e.message, 'error'));
    reload();
  };

  return (
    <div>
      <header className="page-head">
        <div>
          <Link to="/submissions" className="muted small">← Submissions</Link>
          <h1>{TYPE_LABELS[s.form_type]} · {s.name || s.email}</h1>
          <p className="muted small">{formatDate(s.created_at)}</p>
        </div>
        <div className="row">
          {s.email && <a className="btn" href={`mailto:${s.email}`}>Reply by email</a>}
          {s.status !== 'archived' ? <button className="btn" onClick={() => setStatus('archived')}>Archive</button> : <button className="btn" onClick={() => setStatus('read')}>Unarchive</button>}
        </div>
      </header>

      <dl className="detail-list">
        {Object.entries(s.data).map(([k, v]) => (
          <div key={k}><dt>{k.replace(/_/g, ' ')}</dt><dd>{String(v) || '—'}</dd></div>
        ))}
      </dl>

      {s.attachment_key && <p><a className="btn" href={`/api/submissions/${s.id}/attachment`}>Download attachment</a></p>}

      {s.notify_status === 'failed' && (
        <p className="warn-box">The notification email for this submission failed to send ({s.notify_error}). The submission itself was saved.</p>
      )}

      {s.form_type === 'register_property' && (
        <section className="card-box">
          <h2>Market report</h2>
          <p><span className="badge">{REPORT_LABELS[s.report_status] || 'Not generated'}</span></p>
          {s.report_error && <p className="warn-text">{s.report_error}</p>}
          {s.report_data?.metrics && (
            <>
              <h3 className="small muted">Your property (AirROI Estimate Listing Revenue Potential)</h3>
              <dl className="detail-list">
                <div><dt>Annual revenue</dt><dd>{money(s.report_data.metrics.revenue)}</dd></div>
                <div><dt>Occupancy</dt><dd>{percent(s.report_data.metrics.occupancy)}</dd></div>
                <div><dt>ADR</dt><dd>{money(s.report_data.metrics.adr)}</dd></div>
                <div><dt>RevPAR</dt><dd>{money(s.report_data.metrics.revpar)}</dd></div>
                <div><dt>Comparables</dt><dd>{s.report_data.metrics.comps ?? '—'}</dd></div>
              </dl>
            </>
          )}
          {s.report_data?.city && (
            <>
              <h3 className="small muted">{s.report_data.city.name} average (AirROI Get Market Summary{s.report_data.city.cached ? ', from cache' : ''})</h3>
              <dl className="detail-list">
                <div><dt>Occupancy</dt><dd>{percent(s.report_data.city.occupancy)}</dd></div>
                <div><dt>ADR</dt><dd>{money(s.report_data.city.adr)}</dd></div>
                <div><dt>RevPAR</dt><dd>{money(s.report_data.city.revpar)}</dd></div>
                <div><dt>Annual revenue</dt><dd>{money(s.report_data.city.revenue)}</dd></div>
                <div><dt>Active listings</dt><dd>{s.report_data.city.activeListings ?? '—'}</dd></div>
              </dl>
            </>
          )}
        </section>
      )}
    </div>
  );
}

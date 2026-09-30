import { useEffect, useRef, useState } from 'react';
import { api } from '../api.js';
import { ErrorNote, Loading, useLoad } from '../components/ui.jsx';

// Site traffic from the public site's own first-party counter (no cookies, no Google):
// visitors, visits, page views, where people came from, what they looked at, and how many
// sent a form. Numbers start when the new site goes live — Wix's history doesn't carry over.

const RANGES = [[7, 'Last 7 days'], [30, 'Last 30 days'], [90, 'Last 90 days'], [365, 'Last 12 months']];
const SOURCE_LABELS = { direct: 'Direct (typed in / bookmark)', search: 'Search engines', social: 'Social media', referral: 'Other websites', campaign: 'Campaign links (utm)' };
const DEVICE_LABELS = { desktop: 'Desktop', tablet: 'Tablet', mobile: 'Mobile' };
const FORM_LABELS = { contact: 'Contact', register_property: 'Register Property', careers: 'Careers' };

const fmt = (n) => Number(n || 0).toLocaleString('en-US');
const compact = (n) => (n >= 10000 ? `${(n / 1000).toFixed(n >= 100000 ? 0 : 1)}K` : fmt(n));
const dayLabel = (d, opts = { month: 'short', day: 'numeric' }) => new Date(`${d}T12:00:00Z`).toLocaleDateString('en-US', { timeZone: 'UTC', ...opts });
let regionNames;
const countryName = (code) => {
  try {
    regionNames ??= new Intl.DisplayNames(['en'], { type: 'region' });
    return regionNames.of(code) || code;
  } catch {
    return code;
  }
};

export default function Analytics() {
  const [days, setDays] = useState(30);
  const { data, error, loading } = useLoad(() => api(`/analytics?days=${days}`), [days]);
  const [shown, setShown] = useState(null);
  // Refetch keeps the previous numbers on screen (dimmed) instead of flashing a loader.
  useEffect(() => {
    if (data) setShown(data);
  }, [data]);
  const d = shown;

  return (
    <div className="analytics">
      <header className="page-head">
        <div>
          <h1>Analytics</h1>
          <p className="subtitle">Who’s visiting the website, where they come from and what they look at. Counted by the site itself — no cookies, nothing personal stored.</p>
        </div>
      </header>

      <div className="range-row" role="group" aria-label="Date range">
        {RANGES.map(([n, label]) => (
          <button key={n} type="button" className={`range-btn${days === n ? ' active' : ''}`} aria-pressed={days === n} onClick={() => setDays(n)}>{label}</button>
        ))}
      </div>

      <ErrorNote error={error} />
      {!d ? <Loading /> : (
        <div className={loading ? 'refetching' : ''}>
          {!d.tracking && (
            <div className="panel panel-pad notice">
              <strong>No visits recorded yet.</strong> Counting starts once the new website is live at www.5rsuites.com — the Wix site’s past numbers don’t carry over. Form submissions below are already real.
            </div>
          )}

          <div className="stats">
            <Stat label="Visitors" value={d.totals.visitors} prev={d.previous.visitors} days={d.range.days} note="Unique people per day" />
            <Stat label="Visits" value={d.totals.visits} prev={d.previous.visits} days={d.range.days} note="Times someone arrived on the site" />
            <Stat label="Page views" value={d.totals.views} prev={d.previous.views} days={d.range.days} note={d.totals.visits ? `${(d.totals.views / d.totals.visits).toFixed(1)} pages per visit` : 'Pages opened'} />
            <Stat label="Form submissions" value={d.totals.submissions} prev={d.previous.submissions} days={d.range.days}
              note={d.totals.visits ? `${((d.totals.submissions / d.totals.visits) * 100).toFixed(1)}% of visits` : Object.entries(d.forms).map(([k, n]) => `${n} ${FORM_LABELS[k]}`).join(' · ') || 'None yet'} />
          </div>

          <section className="panel chart-panel">
            <div className="panel-head">
              <h2>Visitors per day</h2>
              <span className="muted small">{dayLabel(d.range.start, { month: 'short', day: 'numeric', year: 'numeric' })} – {dayLabel(d.range.end, { month: 'short', day: 'numeric', year: 'numeric' })}</span>
            </div>
            <TrendChart series={d.series} />
            <details className="table-toggle">
              <summary>Show as a table</summary>
              <table className="table compact">
                <thead><tr><th>Day</th><th className="num">Visitors</th><th className="num">Visits</th><th className="num">Page views</th></tr></thead>
                <tbody>
                  {[...d.series].reverse().map((r) => (
                    <tr key={r.day}><td>{dayLabel(r.day, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}</td><td className="num">{fmt(r.visitors)}</td><td className="num">{fmt(r.visits)}</td><td className="num">{fmt(r.views)}</td></tr>
                  ))}
                </tbody>
              </table>
            </details>
          </section>

          <div className="breakdowns">
            <Breakdown title="Top pages" unit="views" rows={d.pages.map((p) => ({ key: p.path, label: p.title || p.path, sub: p.title ? p.path : null, value: p.views }))} empty="No page views yet." />
            <Breakdown title="How people found the site" unit="visits" rows={d.sources.map((s) => ({ key: s.source, label: SOURCE_LABELS[s.source] || s.source, value: s.visits }))} empty="No visits yet." />
            <Breakdown title="Referring websites" unit="visits" rows={d.referrers.map((r) => ({ key: r.referrer, label: r.referrer, value: r.visits }))} empty="No visits from other websites yet." />
            <Breakdown title="Devices" unit="visitors" rows={d.devices.map((r) => ({ key: r.device, label: DEVICE_LABELS[r.device] || r.device, value: r.visitors }))} empty="No visitors yet." />
            <Breakdown title="Locations" unit="visitors" rows={d.countries.map((r) => ({ key: r.country, label: countryName(r.country), value: r.visitors }))} empty="No visitors yet." />
            <Breakdown title="Form submissions" unit="submissions" rows={Object.entries(d.forms).map(([k, n]) => ({ key: k, label: FORM_LABELS[k] || k, value: n }))} empty="No form submissions in this period." />
          </div>
        </div>
      )}
    </div>
  );
}

// A headline number with its change against the previous period of the same length.
function Stat({ label, value, prev, days, note }) {
  const change = prev > 0 ? Math.round(((value - prev) / prev) * 100) : null;
  const period = days === 365 ? 'previous 12 months' : `previous ${days} days`;
  return (
    <div className="stat">
      <span className="stat-label">{label}</span>
      <strong>{compact(value)}</strong>
      {change !== null ? (
        <span className={`stat-delta ${change > 0 ? 'up' : change < 0 ? 'down' : ''}`}>
          <span aria-hidden="true">{change > 0 ? '▲' : change < 0 ? '▼' : '■'}</span> {change > 0 ? '+' : ''}{change}% vs {period}
        </span>
      ) : (
        <span className="stat-delta">No data for the {period}</span>
      )}
      <span className="stat-note">{note}</span>
    </div>
  );
}

// Horizontal bars, one hue, value at the tip; the list is its own table view.
function Breakdown({ title, rows, unit, empty }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  const total = rows.reduce((a, r) => a + r.value, 0);
  return (
    <section className="panel breakdown">
      <div className="panel-head"><h2>{title}</h2><span className="muted small">{unit}</span></div>
      {rows.length === 0 ? <p className="muted small panel-pad">{empty}</p> : (
        <ul className="bars">
          {rows.map((r) => (
            <li key={r.key} title={`${r.label}: ${fmt(r.value)} ${unit}${total ? ` (${Math.round((r.value / total) * 100)}%)` : ''}`}>
              <div className="bar-label"><span className="truncate">{r.label}</span>{r.sub && <span className="muted small truncate">{r.sub}</span>}</div>
              <span className="bar-value">{fmt(r.value)}</span>
              <span className="bar-track"><span className="bar-fill" style={{ width: `${(r.value / max) * 100}%` }} /></span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

// Clean axis maximum: 4 gridline steps of 1/2/5 × 10^n.
function niceMax(v) {
  const rough = Math.max(1, v) / 4;
  const mag = 10 ** Math.floor(Math.log10(rough));
  const step = [1, 2, 5, 10].find((m) => m * mag >= rough) * mag;
  return { max: step * 4, step };
}

// Single-series line (visitors) with a crosshair that snaps to the nearest day; the tooltip
// also reads out visits and page views for that day.
function TrendChart({ series }) {
  const wrap = useRef(null);
  const [width, setWidth] = useState(720);
  const [hover, setHover] = useState(null);
  useEffect(() => {
    const ro = new ResizeObserver(([e]) => setWidth(Math.max(280, e.contentRect.width)));
    ro.observe(wrap.current);
    return () => ro.disconnect();
  }, []);

  const H = 240;
  const pad = { l: 44, r: 16, t: 14, b: 30 };
  const iw = width - pad.l - pad.r;
  const ih = H - pad.t - pad.b;
  const n = series.length;
  const { max, step } = niceMax(Math.max(...series.map((d) => d.visitors)));
  const x = (i) => pad.l + (n === 1 ? iw / 2 : (i * iw) / (n - 1));
  const y = (v) => pad.t + ih - (v / max) * ih;
  const line = series.map((d, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(d.visitors).toFixed(1)}`).join('');
  const area = `${line}L${x(n - 1).toFixed(1)},${y(0)}L${x(0).toFixed(1)},${y(0)}Z`;
  const ticks = [0, 1, 2, 3, 4].map((k) => k * step);
  const labelEvery = Math.max(1, Math.ceil(n / Math.max(2, Math.floor(iw / 90))));

  const pick = (clientX) => {
    const rect = wrap.current.getBoundingClientRect();
    const i = Math.round(((clientX - rect.left - pad.l) / iw) * (n - 1));
    setHover(Math.min(n - 1, Math.max(0, i)));
  };
  const onKey = (e) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      e.preventDefault();
      setHover((h) => Math.min(n - 1, Math.max(0, (h ?? n - 1) + (e.key === 'ArrowRight' ? 1 : -1))));
    }
  };
  const h = hover === null ? null : series[hover];

  return (
    <div className="trend" ref={wrap}>
      <svg width={width} height={H} role="img" aria-label="Visitors per day" tabIndex={0}
        onPointerMove={(e) => pick(e.clientX)} onPointerLeave={() => setHover(null)} onFocus={() => setHover(n - 1)} onBlur={() => setHover(null)} onKeyDown={onKey}>
        {ticks.map((t) => (
          <g key={t}>
            <line className="grid" x1={pad.l} x2={width - pad.r} y1={y(t)} y2={y(t)} />
            <text className="axis" x={pad.l - 8} y={y(t) + 4} textAnchor="end">{compact(t)}</text>
          </g>
        ))}
        {series.map((d, i) => (i % labelEvery === 0 || i === n - 1) && (i === n - 1 || n - 1 - i >= labelEvery / 2) && (
          <text key={d.day} className="axis" x={x(i)} y={H - 8} textAnchor={i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle'}>{dayLabel(d.day)}</text>
        ))}
        <path className="area" d={area} />
        <path className="line" d={line} />
        {h && (
          <g>
            <line className="crosshair" x1={x(hover)} x2={x(hover)} y1={pad.t} y2={pad.t + ih} />
            <circle className="dot" cx={x(hover)} cy={y(h.visitors)} r={4} />
          </g>
        )}
        {n <= 45 && !h && <circle className="dot" cx={x(n - 1)} cy={y(series[n - 1].visitors)} r={4} />}
      </svg>
      {h && (
        <div className="tooltip" style={{ left: Math.min(width - 170, Math.max(0, x(hover) + 12)), top: 8 }} role="status">
          <span className="tt-day">{dayLabel(h.day, { weekday: 'short', month: 'short', day: 'numeric' })}</span>
          <span><i className="key" /><strong>{fmt(h.visitors)}</strong> visitors</span>
          <span><strong>{fmt(h.visits)}</strong> visits</span>
          <span><strong>{fmt(h.views)}</strong> page views</span>
        </div>
      )}
    </div>
  );
}

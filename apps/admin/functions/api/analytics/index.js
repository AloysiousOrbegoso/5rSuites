import { json } from '../../lib/http.js';

// Visit numbers for the Analytics screen, from the public site's own page_views table
// (first-party, no cookies — see apps/site/src/lib/analytics.js).
//
//   visitors  unique visitors per day, summed over the range (the visitor id rotates daily)
//   visits    arrivals from outside the site (a new visit / session)
//   views     page views
//
// Days are the site's local days (America/Los_Angeles), the same ones the beacon records.

const TZ = 'America/Los_Angeles';
const RANGES = new Set([7, 30, 90, 365]);

const localDay = (date) => new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
const addDays = (day, n) => new Date(Date.parse(`${day}T12:00:00Z`) + n * 86400000).toISOString().slice(0, 10);

// UTC 'YYYY-MM-DD HH:MM:SS' for local midnight at the start of `day` (form_submissions stores UTC).
function localMidnightUtc(day) {
  const guess = new Date(`${day}T00:00:00Z`);
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', { timeZone: TZ, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
      .formatToParts(guess)
      .map((p) => [p.type, p.value]),
  );
  const shownAsUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute);
  const offset = shownAsUtc - guess.getTime(); // local = utc + offset
  return new Date(guess.getTime() - offset).toISOString().replace('T', ' ').slice(0, 19);
}

export async function onRequestGet({ request, env }) {
  const days = RANGES.has(Number(new URL(request.url).searchParams.get('days'))) ? Number(new URL(request.url).searchParams.get('days')) : 30;
  const end = localDay(new Date());
  const start = addDays(end, -(days - 1));
  const prevEnd = addDays(start, -1);
  const prevStart = addDays(prevEnd, -(days - 1));
  const db = env.DB;
  const range = 'day BETWEEN ? AND ?';
  const totalsSql = `SELECT COUNT(*) AS views, COUNT(DISTINCT day || visitor) AS visitors, COALESCE(SUM(entry), 0) AS visits FROM page_views WHERE ${range}`;
  const formsSql = `SELECT form_type, COUNT(*) AS n FROM form_submissions WHERE created_at >= ? AND created_at < ? GROUP BY form_type`;

  const [totals, prev, daily, pages, sources, referrers, devices, countries, forms, prevForms, titles] = await db.batch([
    db.prepare(totalsSql).bind(start, end),
    db.prepare(totalsSql).bind(prevStart, prevEnd),
    db.prepare(`SELECT day, COUNT(*) AS views, COUNT(DISTINCT visitor) AS visitors, SUM(entry) AS visits FROM page_views WHERE ${range} GROUP BY day`).bind(start, end),
    db.prepare(`SELECT path, COUNT(*) AS views, COUNT(DISTINCT day || visitor) AS visitors FROM page_views WHERE ${range} GROUP BY path ORDER BY views DESC LIMIT 10`).bind(start, end),
    db.prepare(`SELECT source, COUNT(*) AS visits FROM page_views WHERE ${range} AND entry = 1 GROUP BY source ORDER BY visits DESC`).bind(start, end),
    db.prepare(`SELECT referrer, source, COUNT(*) AS visits FROM page_views WHERE ${range} AND entry = 1 AND referrer != '' GROUP BY referrer ORDER BY visits DESC LIMIT 10`).bind(start, end),
    db.prepare(`SELECT device, COUNT(DISTINCT day || visitor) AS visitors FROM page_views WHERE ${range} GROUP BY device ORDER BY visitors DESC`).bind(start, end),
    db.prepare(`SELECT country, COUNT(DISTINCT day || visitor) AS visitors FROM page_views WHERE ${range} AND country != '' GROUP BY country ORDER BY visitors DESC LIMIT 10`).bind(start, end),
    db.prepare(formsSql).bind(localMidnightUtc(start), localMidnightUtc(addDays(end, 1))),
    db.prepare(formsSql).bind(localMidnightUtc(prevStart), localMidnightUtc(start)),
    db.prepare('SELECT slug, title FROM pages'),
  ]);

  // One row per day, zeros included, so the chart has no gaps.
  const byDay = Object.fromEntries(daily.results.map((r) => [r.day, r]));
  const series = [];
  for (let d = start; d <= end; d = addDays(d, 1)) {
    const r = byDay[d];
    series.push({ day: d, visitors: r?.visitors ?? 0, visits: r?.visits ?? 0, views: r?.views ?? 0 });
  }

  const pageTitle = Object.fromEntries(titles.results.map((p) => [p.slug === 'home' ? '/' : `/${p.slug}`, p.title]));
  const formCount = (res) => Object.fromEntries(res.results.map((r) => [r.form_type, r.n]));
  const sum = (o) => Object.values(o).reduce((a, b) => a + b, 0);
  const current = formCount(forms);
  const previous = formCount(prevForms);

  return json({
    range: { days, start, end },
    totals: { ...totals.results[0], submissions: sum(current) },
    previous: { ...prev.results[0], submissions: sum(previous) },
    series,
    pages: pages.results.map((p) => ({ ...p, title: pageTitle[p.path] || null })),
    sources: sources.results,
    referrers: referrers.results,
    devices: devices.results,
    countries: countries.results,
    forms: current,
    // Whether anything has ever been recorded (to explain an empty screen before launch).
    tracking: (await db.prepare('SELECT EXISTS (SELECT 1 FROM page_views) AS any').first()).any === 1,
  });
}

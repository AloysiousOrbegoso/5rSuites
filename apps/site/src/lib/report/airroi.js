// AirROI short-term rental data (https://www.airroi.com/api). Only three endpoints are used:
//
//   Estimate Listing Revenue Potential  GET  /calculator/estimate   $0.20  every report
//   Find Market by Coordinates          GET  /markets/lookup        $0.01  once per city (cached)
//   Get Market Summary                  POST /markets/summary       $0.10  once per city (cached)
//
// Auth: X-API-KEY header (AIRROI_API_KEY secret). Everything AirROI-specific lives in this file;
// the rest of the pipeline only sees the normalized shapes returned by the functions below.
//
// ⚠ Confirm the exact response field names with a first test call. The normalizers accept the
// documented names plus a few likely variants; if a figure can't be found it comes back null,
// and the quality check in template.js holds the report instead of sending a broken one.

const BASE = 'https://api.airroi.com';

async function call(env, method, path, { query, body } = {}) {
  if (!env.AIRROI_API_KEY) throw new Error('AIRROI_API_KEY is not configured.');
  const url = `${BASE}${path}${query ? `?${new URLSearchParams(query)}` : ''}`;
  const res = await fetch(url, {
    method,
    headers: {
      'X-API-KEY': env.AIRROI_API_KEY,
      Accept: 'application/json',
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`AirROI ${path} ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return res.json();
}

// ---- helpers --------------------------------------------------------------------------

const num = (v) => {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v))) return Number(v);
  return null;
};

// First value found among dot-separated paths.
function pick(obj, ...paths) {
  for (const path of paths) {
    const v = path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);
    if (v !== undefined && v !== null) return v;
  }
  return null;
}

// A metric may be a plain number or an object of stats ({ avg, p50, ... }).
function metric(v) {
  if (v && typeof v === 'object' && !Array.isArray(v)) return num(v.avg ?? v.mean ?? v.p50 ?? v.median ?? v.value);
  return num(v);
}

// Occupancy may come back as 0–1 or 0–100.
const ratio = (v) => (v === null ? null : v > 1 ? v / 100 : v);

// ---- Estimate Listing Revenue Potential ---------------------------------------------

// → { revenue, occupancy (0–1), adr, revpar, comps }
export function normalizeEstimate(raw) {
  const d = raw?.data ?? raw ?? {};
  const revenue = metric(pick(d, 'revenue', 'annual_revenue', 'ttm_revenue', 'percentiles.revenue.p50'));
  const occupancy = ratio(metric(pick(d, 'occupancy', 'occupancy_rate', 'percentiles.occupancy.p50')));
  const adr = metric(pick(d, 'average_daily_rate', 'adr', 'percentiles.average_daily_rate.p50', 'percentiles.adr.p50'));
  const revpar = adr !== null && occupancy !== null ? adr * occupancy : null;
  const list = pick(d, 'comparable_listings', 'comparables', 'comps');
  const comps = Array.isArray(list) ? list.length : num(pick(d, 'comparable_count', 'comps_count'));
  return { revenue, occupancy, adr, revpar, comps };
}

export async function estimateProperty(env, { lat, lng, bedrooms, baths, guests }) {
  const raw = await call(env, 'GET', '/calculator/estimate', {
    query: { lat, lng, bedrooms, baths, guests, currency: 'usd' },
  });
  return normalizeEstimate(raw);
}

// ---- Find Market by Coordinates + Get Market Summary --------------------------------

// The market object from /markets/lookup is passed back to /markets/summary as-is.
export function normalizeMarket(raw) {
  const m = raw?.market ?? raw?.data ?? raw;
  if (!m || typeof m !== 'object') return null;
  const name = pick(m, 'locality', 'city', 'name', 'district', 'region') || '';
  return { market: m, name: String(name) };
}

// → { occupancy (0–1), adr, revpar, revenue, activeListings, bookingLeadTime, lengthOfStay }
export function normalizeSummary(raw) {
  const d = raw?.data ?? raw?.summary ?? raw ?? {};
  const occupancy = ratio(metric(pick(d, 'occupancy', 'occupancy_rate')));
  const adr = metric(pick(d, 'average_daily_rate', 'adr'));
  let revpar = metric(pick(d, 'rev_par', 'revpar'));
  if (revpar === null && adr !== null && occupancy !== null) revpar = adr * occupancy;
  return {
    occupancy,
    adr,
    revpar,
    revenue: metric(pick(d, 'revenue')),
    activeListings: metric(pick(d, 'active_listings_count', 'active_listings')),
    bookingLeadTime: metric(pick(d, 'booking_lead_time')),
    lengthOfStay: metric(pick(d, 'length_of_stay')),
  };
}

async function fetchMarket(env, { lat, lng }) {
  const found = normalizeMarket(await call(env, 'GET', '/markets/lookup', { query: { lat, lng } }));
  if (!found) throw new Error('AirROI could not find a market for this location.');
  const summary = normalizeSummary(await call(env, 'POST', '/markets/summary', { body: { market: found.market, currency: 'usd' } }));
  return { market: found.market, name: found.name, summary };
}

export const cityKey = (city, state) =>
  `${String(city).trim().toLowerCase().replace(/\s+/g, ' ')}|${String(state).trim().toLowerCase()}`;

// City figures, from the D1 cache when fresh (default: 365 days), otherwise from AirROI.
// → { name, summary, cached }
export async function getCityMarket(env, { city, state, lat, lng }) {
  const key = cityKey(city, state);
  const maxAgeDays = Number(env.MARKET_CACHE_DAYS) || 365;
  const row = await env.DB.prepare(
    `SELECT market, summary FROM market_cache WHERE city_key = ? AND fetched_at > datetime('now', ?)`,
  )
    .bind(key, `-${maxAgeDays} days`)
    .first();
  if (row) {
    const market = JSON.parse(row.market);
    return { name: normalizeMarket(market)?.name || city, summary: JSON.parse(row.summary), cached: true };
  }

  const fresh = await fetchMarket(env, { lat, lng });
  await env.DB.prepare(
    `INSERT INTO market_cache (city_key, market, summary, fetched_at) VALUES (?, ?, ?, datetime('now'))
     ON CONFLICT(city_key) DO UPDATE SET market = excluded.market, summary = excluded.summary, fetched_at = excluded.fetched_at`,
  )
    .bind(key, JSON.stringify(fresh.market), JSON.stringify(fresh.summary))
    .run();
  return { name: fresh.name || city, summary: fresh.summary, cached: false };
}

// Form values ("Studio", "5+", "2.5") → numbers for the Calculator.
export function parseRooms(value) {
  if (value === 'Studio') return 0;
  const n = parseFloat(String(value).replace('+', ''));
  return Number.isFinite(n) ? n : null;
}

// The form doesn't ask for guest count; assume 2 per bedroom (studios sleep 2).
export const guestsFor = (bedrooms) => Math.max(2, Math.round((bedrooms || 0) * 2));

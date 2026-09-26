// AirDNA market data for a single address.
//
// ⚠ VERIFY BEFORE LAUNCH: the request and response shapes below follow AirDNA's
// Rentalizer-style "estimate by address" API, but must be checked against the API
// documentation that comes with the client's AirDNA contract. Everything AirDNA-specific
// lives in this file: if their API differs, only `requestEstimate` and `normalize` change.
//
// If the response doesn't match what `normalize` expects, the metrics come back null and the
// quality check in pipeline.js HOLDS the report instead of emailing a broken one.

const DEFAULT_URL = 'https://api.airdna.co/api/enterprise/v2/rentalizer/estimate';

async function requestEstimate(env, property) {
  const res = await fetch(env.AIRDNA_API_URL || DEFAULT_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.AIRDNA_API_KEY}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      address: property.address,
      bedrooms: property.bedrooms,
      bathrooms: property.bathrooms,
      currency: 'usd',
    }),
  });
  if (!res.ok) throw new Error(`AirDNA ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return res.json();
}

const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v)) ? Number(v) : null);

// Pull a value from the first path that exists. Paths are dot-separated.
function pick(obj, ...paths) {
  for (const path of paths) {
    const v = path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);
    if (v !== undefined && v !== null) return v;
  }
  return null;
}

// → { revenue, occupancy (0–1), adr, revpar, comps }
export function normalize(raw) {
  const d = raw?.payload ?? raw?.data ?? raw ?? {};
  const revenue = num(pick(d, 'property_statistics.revenue.ltm', 'stats.revenue', 'revenue'));
  let occupancy = num(pick(d, 'property_statistics.occupancy.ltm', 'stats.occupancy', 'occupancy'));
  if (occupancy !== null && occupancy > 1) occupancy /= 100; // accept 0–100 as well as 0–1
  const adr = num(pick(d, 'property_statistics.adr.ltm', 'stats.adr', 'adr'));
  let revpar = num(pick(d, 'property_statistics.revpar.ltm', 'stats.revpar', 'revpar'));
  if (revpar === null && adr !== null && occupancy !== null) revpar = adr * occupancy;
  const compsList = pick(d, 'comps', 'comparables');
  const comps = Array.isArray(compsList) ? compsList.length : num(pick(d, 'comps_count', 'comparable_count'));
  return { revenue, occupancy, adr, revpar, comps };
}

export async function fetchMarketStats(env, property) {
  if (!env.AIRDNA_API_KEY) throw new Error('AIRDNA_API_KEY is not configured.');
  return normalize(await requestEstimate(env, property));
}

// Bedrooms/bathrooms come from the form as labels ("Studio", "5+", "2.5").
export function parseRooms(value) {
  if (value === 'Studio') return 0;
  const n = parseFloat(String(value).replace('+', ''));
  return Number.isFinite(n) ? n : null;
}

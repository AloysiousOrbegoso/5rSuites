import { test } from 'node:test';
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { PDFDocument } from 'pdf-lib';
import { cityKey, getCityMarket, guestsFor, normalizeEstimate, normalizeMarket, normalizeSummary, parseRooms } from '../src/lib/report/airroi.js';
import { parseGeocode } from '../src/lib/report/geocode.js';
import { runRegisterPropertyPipeline } from '../src/lib/report/pipeline.js';
import { pdfSafe, renderReportPdf } from '../src/lib/report/pdf.js';
import { assessQuality, buildReport, compare } from '../src/lib/report/template.js';
import { FORMS, validateForm } from '../src/lib/form-specs.js';

const good = { revenue: 48250, occupancy: 0.71, adr: 186, revpar: 132.06, comps: 24 };
const data = { name: 'José Álvarez', email: 'j@example.com', street: '12 Main St', city: 'Austin', state: 'TX', zip: '78701', bedrooms: '2' };

test('normalizeEstimate reads Calculator responses (plain and percentile shapes)', () => {
  const m = normalizeEstimate({ revenue: 50000, occupancy: 68, average_daily_rate: 200, comparable_listings: new Array(12).fill({}) });
  assert.deepEqual({ ...m, revpar: Math.round(m.revpar) }, { revenue: 50000, occupancy: 0.68, adr: 200, revpar: 136, comps: 12 });
  const p = normalizeEstimate({ percentiles: { revenue: { p50: 41000 }, occupancy: { p50: 0.6 }, average_daily_rate: { p50: 190 } }, comparable_listings: [{}, {}] });
  assert.equal(p.revenue, 41000);
  assert.equal(p.occupancy, 0.6);
  assert.equal(p.comps, 2);
});

test('unexpected Calculator shape yields nulls, which the quality gate holds', () => {
  const m = normalizeEstimate({ something: 'else' });
  assert.deepEqual(m, { revenue: null, occupancy: null, adr: null, revpar: null, comps: null });
  assert.equal(assessQuality(m).ok, false);
});

test('normalizeSummary reads Get Market Summary fields', () => {
  const s = normalizeSummary({ occupancy: 0.68, average_daily_rate: 172, rev_par: 117, revenue: 39000, active_listings_count: 1200, booking_lead_time: 21, length_of_stay: 4.2 });
  assert.deepEqual(s, { occupancy: 0.68, adr: 172, revpar: 117, revenue: 39000, activeListings: 1200, bookingLeadTime: 21, lengthOfStay: 4.2 });
  assert.equal(normalizeSummary({ occupancy: { avg: 70 }, average_daily_rate: { avg: 150 } }).revpar, 105);
  assert.equal(normalizeMarket({ locality: 'Tacoma', region: 'Washington' }).name, 'Tacoma');
});

test('parseGeocode reads Census responses', () => {
  const body = { result: { addressMatches: [{ matchedAddress: '1 MAIN ST, TACOMA, WA, 98402', coordinates: { x: -122.44, y: 47.25 } }] } };
  assert.deepEqual(parseGeocode(body), { lat: 47.25, lng: -122.44, matched: '1 MAIN ST, TACOMA, WA, 98402' });
  assert.equal(parseGeocode({ result: { addressMatches: [] } }), null);
});

// Minimal stand-in for D1: just enough for market_cache and form_submissions updates.
function fakeDb() {
  const cache = new Map();
  const updates = [];
  return {
    cache, updates,
    prepare(sql) {
      return {
        bind: (...args) => ({
          first: async () => (sql.includes('FROM market_cache') ? cache.get(args[0]) ?? null : null),
          run: async () => {
            if (sql.includes('INSERT INTO market_cache')) cache.set(args[0], { market: args[1], summary: args[2] });
            if (sql.includes('UPDATE form_submissions')) updates.push(args);
            return { meta: { changes: 1 } };
          },
        }),
      };
    },
  };
}

// Mock fetch for the Census geocoder, AirROI and Resend; records which paid endpoints ran.
function mockFetch({ comps = 20 } = {}) {
  const calls = [];
  globalThis.fetch = async (url, init = {}) => {
    const u = String(url);
    const json = (b) => new Response(JSON.stringify(b), { status: 200, headers: { 'Content-Type': 'application/json' } });
    if (u.includes('geocoding.geo.census.gov')) return json({ result: { addressMatches: [{ coordinates: { x: -122.44, y: 47.25 } }] } });
    if (u.startsWith('https://api.airroi.com')) {
      calls.push(new URL(u).pathname);
      assert.equal(init.headers['X-API-KEY'], 'test-key');
      if (u.includes('/calculator/estimate')) return json({ revenue: 48250, occupancy: 0.71, average_daily_rate: 186, comparable_listings: new Array(comps).fill({}) });
      if (u.includes('/markets/lookup')) return json({ locality: 'Tacoma', region: 'Washington', country: 'United States' });
      if (u.includes('/markets/summary')) return json({ occupancy: 0.68, average_daily_rate: 172, rev_par: 117, revenue: 39000 });
    }
    if (u.startsWith('https://api.resend.com')) { calls.push('resend'); return json({ id: 'x' }); }
    throw new Error(`unexpected fetch ${u}`);
  };
  return calls;
}

test('pipeline: first lead from a city makes 3 AirROI calls, the next only 1', async () => {
  const realFetch = globalThis.fetch;
  try {
    const DB = fakeDb();
    const env = { DB, AIRROI_API_KEY: 'test-key', RESEND_API_KEY: 'r', SCHEDULING_URL: 'https://cal.example/5r' };
    const lead = { name: 'Olga Owner', email: 'o@example.com', street: '1 Main St', city: 'Tacoma', state: 'WA', zip: '98402', bedrooms: '2', bathrooms: '1' };

    let calls = mockFetch();
    await runRegisterPropertyPipeline(env, { id: 1, data: lead });
    assert.deepEqual(calls.filter((c) => c !== 'resend'), ['/calculator/estimate', '/markets/lookup', '/markets/summary']);
    assert.equal(DB.updates[0][0], 'sent');
    const saved = JSON.parse(DB.updates[0][1]);
    assert.equal(saved.city.name, 'Tacoma');
    assert.equal(saved.city.cached, false);
    assert.ok(DB.cache.has(cityKey('Tacoma', 'WA')));

    calls = mockFetch();
    await runRegisterPropertyPipeline(env, { id: 2, data: { ...lead, city: ' tacoma ', street: '9 Other Ave' } });
    assert.deepEqual(calls.filter((c) => c !== 'resend'), ['/calculator/estimate']);
    assert.equal(JSON.parse(DB.updates[1][1]).city.cached, true);
  } finally {
    globalThis.fetch = realFetch;
  }
});

test('pipeline: thin comps are held, not emailed as a report', async () => {
  const realFetch = globalThis.fetch;
  try {
    const DB = fakeDb();
    mockFetch({ comps: 2 });
    await runRegisterPropertyPipeline({ DB, AIRROI_API_KEY: 'test-key' }, { id: 3, data: { name: 'A', email: 'a@x.co', street: '1 Rural Rd', city: 'Nowhere', state: 'WA', zip: '98000', bedrooms: '3', bathrooms: '2' } });
    assert.equal(DB.updates[0][0], 'held');
    assert.match(DB.updates[0][2], /only 2 comparable/);
  } finally {
    globalThis.fetch = realFetch;
  }
});

test('quality gate: thin or implausible data is held', () => {
  assert.equal(assessQuality(good).ok, true);
  assert.match(assessQuality({ ...good, comps: 2 }).reasons.join(), /only 2 comparable/);
  assert.match(assessQuality({ ...good, occupancy: 0.01 }).reasons.join(), /occupancy/);
  assert.match(assessQuality({ ...good, adr: 9000 }).reasons.join(), /nightly rate/);
});

test('parseRooms', () => {
  assert.equal(parseRooms('Studio'), 0);
  assert.equal(parseRooms('5+'), 5);
  assert.equal(parseRooms('2.5'), 2.5);
  assert.equal(guestsFor(0), 2);
  assert.equal(guestsFor(3), 6);
});

test('template uses fixed sentences with formatted numbers', () => {
  const r = buildReport({ data, metrics: good, schedulingUrl: 'https://cal.example/5r', date: new Date('2026-09-24') });
  assert.equal(r.tiles[0].value, '$48,250');
  assert.equal(r.tiles[1].value, '71%');
  assert.match(r.paragraphs[0], /^Comparable 2-bedroom rentals near 12 Main St, Austin, TX 78701 earned an estimated \$48,250/);
  assert.match(r.paragraphs.at(-1), /24 comparable listings/);
});

test('city comparison sentences and outlier check', () => {
  const city = { name: 'Tacoma', summary: { occupancy: 0.68, adr: 172, revpar: 117, revenue: 39000 } };
  const r = buildReport({ data, metrics: good, city, schedulingUrl: '' });
  assert.match(r.paragraphs[2], /^Across Tacoma, short-term rentals averaged 68% occupancy at \$172 a night \(RevPAR \$117\)\.$/);
  assert.match(r.paragraphs[3], /projected nightly rate is 8% above the Tacoma average/);
  assert.equal(r.cityTiles.length, 4);
  assert.equal(compare(100, 100.5), 'in line with');
  assert.equal(compare(88, 100), '12% below');
  assert.equal(buildReport({ data, metrics: good, schedulingUrl: '' }).cityTiles, null); // property-only fallback
  assert.match(assessQuality({ ...good, adr: 900 }, { city }).reasons.join(), /far from the Tacoma average/);
});

test('PDF renders one page, survives non-Latin text', async () => {
  const r = buildReport({ data: { ...data, street: '12 Rue de l’Église — 東京' }, metrics: good, city: { name: 'Tacoma', summary: { occupancy: 0.68, adr: 172, revpar: 117, revenue: 39000 } }, schedulingUrl: 'https://cal.example/5r' });
  const bytes = await renderReportPdf(r);
  const doc = await PDFDocument.load(bytes);
  assert.equal(doc.getPageCount(), 1);
  assert.ok(bytes.length > 1000);
  if (process.env.WRITE_SAMPLE_PDF) await writeFile(process.env.WRITE_SAMPLE_PDF, bytes);
  assert.equal(pdfSafe('Café “quoted” — 東'), 'Cafe "quoted" - ?');
});

test('form validation', () => {
  const fd = (o) => ({ get: (k) => (Array.isArray(o[k]) ? o[k][0] : o[k] ?? null), getAll: (k) => [].concat(o[k] ?? []) });
  const contact = { first_name: 'Ana', last_name: 'Lee', phone: '555', email: 'a@b.co', message: 'hi' };
  const ok = validateForm('contact', fd(contact));
  assert.equal(ok.error, undefined);
  assert.equal(ok.data.name, 'Ana Lee');
  assert.equal(ok.data.sms_consent, 'No');
  assert.match(validateForm('contact', fd({ ...contact, email: 'nope' })).error, /valid email/);
  assert.match(validateForm('contact', fd({ ...contact, message: '' })).error, /Message is required/);

  const reg = { ...contact, street: '1 Main', city: 'Tacoma', state: 'WA', zip: '98402', property_type: 'Condo',
    bedrooms: '2', bathrooms: '1', pets_allowed: 'No', amenities: ['Balcony', 'Hacked'], monthly_rent: '2400' };
  const r = validateForm('register_property', fd(reg));
  assert.equal(r.error, undefined);
  assert.equal(r.data.amenities, 'Balcony'); // unknown options dropped
  assert.match(validateForm('register_property', fd({ ...reg, pets_allowed: '' })).error, /Pets Allowed is required/);
  assert.match(validateForm('register_property', fd({ ...reg, monthly_rent: 'lots' })).error, /number/);
  assert.ok(FORMS.careers.fields.some((f) => f.type === 'file' && f.required));
});

// Site settings edited in the admin (owner-only Settings screen) and read by the public site.
// Stored as key/value rows in D1 `settings` (seeded by migration 0005). A key with no row
// falls back to the matching wrangler.jsonc var; a row always wins, even a blank one.

export const SETTINGS = [
  { key: 'contact_phone', label: 'Phone number', group: 'Contact details', kind: 'text', max: 40, env: 'CONTACT_PHONE' },
  { key: 'contact_email', label: 'Email address', group: 'Contact details', kind: 'email', max: 120, env: 'CONTACT_EMAIL' },
  { key: 'mailing_address', label: 'Mailing address', group: 'Contact details', kind: 'text', max: 200, env: 'MAILING_ADDRESS' },
  { key: 'booking_url', label: '“Book Now” link (booking system)', group: 'Links', kind: 'url', max: 500, env: 'BOOKING_URL', fallback: 'https://5rsuites.holidayfuture.com' },
  { key: 'scheduling_url', label: '“Book a call” link sent with market reports', group: 'Links', kind: 'url', max: 500, env: 'SCHEDULING_URL' },
  { key: 'privacy_url', label: 'Privacy Policy link (footer)', group: 'Links', kind: 'url', max: 500, env: 'PRIVACY_URL' },
  { key: 'terms_url', label: 'Terms & Conditions link (footer)', group: 'Links', kind: 'url', max: 500, env: 'TERMS_URL' },
  { key: 'facebook_url', label: 'Facebook', group: 'Social media', kind: 'url', max: 500, env: 'FACEBOOK_URL' },
  { key: 'instagram_url', label: 'Instagram', group: 'Social media', kind: 'url', max: 500, env: 'INSTAGRAM_URL' },
  { key: 'youtube_url', label: 'YouTube', group: 'Social media', kind: 'url', max: 500, env: 'YOUTUBE_URL' },
  { key: 'share_image', label: 'Default share image (when a page has none of its own)', group: 'Sharing', kind: 'image' },
];

export const SETTING_KEYS = new Set(SETTINGS.map((s) => s.key));

// Stored values merged over the env fallbacks → { contact_phone: '…', share_image: 12 | null, … }
export async function loadSettings(db, env = {}) {
  const { results } = await db.prepare('SELECT key, value FROM settings').all();
  const stored = Object.fromEntries(results.map((r) => [r.key, r.value]));
  const out = {};
  for (const s of SETTINGS) {
    const v = stored[s.key];
    if (s.kind === 'image') out[s.key] = Number.isInteger(Number(v)) && Number(v) > 0 ? Number(v) : null;
    else out[s.key] = v !== undefined ? v : (s.env && env[s.env]) || s.fallback || '';
  }
  return out;
}

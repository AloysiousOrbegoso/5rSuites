// First-party visit counting for the admin's Analytics screen. No cookies, no third party,
// nothing personal stored: each view keeps the page, a traffic source, a device class, a
// country code and a visitor hash that changes every day (IP + browser, keyed to the date),
// so unique visitors can be counted per day without following anyone over time.

export const SITE_TIME_ZONE = 'America/Los_Angeles';

const BOT = /bot|crawl|spider|slurp|facebookexternalhit|embedly|preview|headless|lighthouse|pingdom|uptime|monitor|curl|wget|python|java\/|go-http/i;
export const isBot = (ua) => !ua || BOT.test(ua);

const SEARCH = /(^|\.)(google|bing|duckduckgo|yahoo|ecosia|baidu|yandex|brave|startpage)\./i;
const SOCIAL = /(^|\.)(facebook|fb|instagram|t\.co|twitter|x|linkedin|lnkd|youtube|youtu|pinterest|reddit|tiktok|nextdoor)\.|^(t\.co|lnkd\.in|youtu\.be|fb\.me)$/i;

// Where a visit came from, from the referrer and any ?utm_source=. Views that come from
// another page of this site aren't new visits (entry = false).
export function classifySource({ referrer, search, siteHost, siteHosts = [siteHost] }) {
  const utm = new URLSearchParams(search || '').get('utm_source');
  if (utm) return { entry: true, source: 'campaign', referrer: utm.trim().toLowerCase().slice(0, 60) };
  let host = '';
  try {
    host = referrer ? new URL(referrer).hostname.toLowerCase().replace(/^www\./, '') : '';
  } catch {
    host = '';
  }
  const own = siteHosts.filter(Boolean).map((h) => String(h).toLowerCase().replace(/^www\./, ''));
  if (host && own.some((o) => host === o || host.endsWith(`.${o}`))) return { entry: false, source: '', referrer: '' };
  if (!host) return { entry: true, source: 'direct', referrer: '' };
  if (SEARCH.test(host)) return { entry: true, source: 'search', referrer: host };
  if (SOCIAL.test(host)) return { entry: true, source: 'social', referrer: host };
  return { entry: true, source: 'referral', referrer: host };
}

// Screen width first (what the page actually rendered at), user agent as a fallback.
export function classifyDevice(width, ua = '') {
  const w = Number(width);
  if (w > 0) return w < 768 ? 'mobile' : w < 1024 ? 'tablet' : 'desktop';
  if (/ipad|tablet/i.test(ua)) return 'tablet';
  return /mobi|iphone|android/i.test(ua) ? 'mobile' : 'desktop';
}

// 'YYYY-MM-DD' in the site's time zone, so "today" matches the business day.
export function localDay(date = new Date(), timeZone = SITE_TIME_ZONE) {
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}

// Only store clean site paths: no query string, no hash, bounded length.
export function cleanPath(p) {
  const path = String(p || '/').split(/[?#]/)[0];
  if (!path.startsWith('/') || path.startsWith('//')) return null;
  return path.replace(/\/+$/, '') || '/';
}

// Daily visitor id: HMAC of the day + IP + browser. The key is a server secret, and the day
// is part of the message, so ids can't be linked across days.
export async function visitorId(secret, day, ip, ua) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode(secret || '5r-analytics'), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(`${day}|${ip}|${ua}`)));
  return [...sig.slice(0, 10)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

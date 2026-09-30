import { env } from 'cloudflare:workers';
import { classifyDevice, classifySource, cleanPath, isBot, localDay, visitorId } from '../../lib/analytics.js';

// Page-view beacon from Base.astro. Always answers 204 so it never affects the page; bad or
// bot requests are simply not recorded.
const done = () => new Response(null, { status: 204, headers: { 'Cache-Control': 'no-store' } });

export async function POST({ request }) {
  try {
    const ua = request.headers.get('User-Agent') || '';
    if (isBot(ua)) return done();
    const body = await request.json().catch(() => null);
    const path = cleanPath(body?.p);
    if (!path || path.length > 200) return done();

    // "Internal" = the referrer is this site: its production address, or the address the page
    // was actually served from as reported by the beacon (preview deployments, local dev —
    // proxies there can rewrite the request URL and Origin header).
    const host = (u) => { try { return new URL(u).hostname; } catch { return null; } };
    const siteHosts = [host(env.SITE_URL), host(request.url), host(`https://${String(body.h || '').slice(0, 100)}`)];
    const { entry, source, referrer } = classifySource({ referrer: String(body.r || '').slice(0, 500), search: String(body.q || '').slice(0, 500), siteHosts });
    const day = localDay(new Date(), env.ANALYTICS_TIME_ZONE || undefined);
    const ip = request.headers.get('CF-Connecting-IP') || '';
    const visitor = await visitorId(env.ANALYTICS_SECRET || env.PURGE_SECRET, day, ip, ua);
    const country = String(request.cf?.country || request.headers.get('CF-IPCountry') || '').slice(0, 2).toUpperCase().replace(/[^A-Z]/g, '');

    const writes = [
      env.DB.prepare(
        'INSERT INTO page_views (day, path, visitor, entry, source, referrer, device, country) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      ).bind(day, path, visitor, entry ? 1 : 0, source, referrer, classifyDevice(body.w, ua), country),
    ];
    // Keep about 13 months; prune on roughly one hit in 200 so it costs nothing noticeable.
    if (Math.random() < 0.005) writes.push(env.DB.prepare(`DELETE FROM page_views WHERE day < date('now', '-400 days')`));
    await env.DB.batch(writes);
  } catch (err) {
    console.error('[hit]', err);
  }
  return done();
}

import { env } from 'cloudflare:workers';
import { setEdgeCache } from '../lib/cache.js';
import { getSitemapPages } from '../lib/content.js';

// Built from D1 at request time (pages are created in the CMS, so a build-time sitemap
// would go stale). Submit https://www.5rsuites.com/sitemap.xml in Search Console.
export async function GET() {
  const pages = await getSitemapPages(env.DB);
  const base = env.SITE_URL || 'https://www.5rsuites.com';
  const urls = pages
    .map((p) => {
      const loc = p.slug === 'home' ? `${base}/` : `${base}/${p.slug}`;
      const lastmod = p.updated_at ? p.updated_at.slice(0, 10) : '';
      return `  <url><loc>${loc}</loc>${lastmod ? `<lastmod>${lastmod}</lastmod>` : ''}</url>`;
    })
    .join('\n');
  const headers = new Headers({ 'Content-Type': 'application/xml; charset=utf-8' });
  setEdgeCache(headers, ['all']);
  return new Response(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`, { headers });
}

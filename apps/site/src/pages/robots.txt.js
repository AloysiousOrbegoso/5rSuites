import { env } from 'cloudflare:workers';

export function GET() {
  const base = env.SITE_URL || 'https://www.5rsuites.com';
  // Only production is indexable; preview deployments are kept out of search results.
  const production = new URL(base).hostname === 'www.5rsuites.com';
  const body = production
    ? `User-agent: *\nDisallow: /api/\nSitemap: ${base}/sitemap.xml\n`
    : 'User-agent: *\nDisallow: /\n';
  return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
}

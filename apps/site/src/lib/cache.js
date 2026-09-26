// Edge caching: cache + purge-on-write (NOT a short TTL, NOT zero caching).
//
// Every HTML page is cached at the edge indefinitely and tagged. When staff save in the
// admin, the admin calls POST /api/internal/purge with the affected tags and those pages
// are re-rendered from D1 on the next request. Browsers always revalidate with the edge,
// so an edit is visible on the next page load.
//
// Tags (must match apps/admin/functions/lib/content.js):
//   all          every page — nav and footer appear everywhere
//   page-<id>    one page
//   faq          pages with a faq_list block
//   units        pages with a unit_grid block

const EDGE_TTL = 60 * 60 * 24 * 30; // 30 days; purges make this safe

export function cacheTagsFor(page, sections) {
  const tags = ['all', `page-${page.id}`];
  const types = new Set(sections.map((s) => s.type));
  if (types.has('faq_list')) tags.push('faq');
  if (types.has('unit_grid')) tags.push('units');
  return tags;
}

export function setEdgeCache(headers, tags) {
  headers.set('Cloudflare-CDN-Cache-Control', `public, max-age=${EDGE_TTL}`);
  headers.set('Cache-Control', 'public, max-age=0, must-revalidate');
  headers.set('Cache-Tag', tags.join(','));
}

export function setNoStore(headers) {
  headers.set('Cache-Control', 'no-store');
  headers.set('Cloudflare-CDN-Cache-Control', 'no-store');
}

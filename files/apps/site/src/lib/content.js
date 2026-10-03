// Read-only content queries for the public site. The admin is the only writer.

import { collectImageIds } from '@5rsuites/blocks';

export async function getNav(db) {
  const { results } = await db
    .prepare(`SELECT slug, title FROM pages WHERE show_in_nav = 1 ORDER BY nav_order, title`)
    .all();
  return results.map((p) => ({ href: p.slug === 'home' ? '/' : `/${p.slug}`, title: p.title, slug: p.slug }));
}

// Everything needed to render one page, in as few round trips as possible.
export async function getPage(db, slug) {
  const page = await db
    .prepare('SELECT id, slug, title, meta_description, share_image, updated_at FROM pages WHERE slug = ?')
    .bind(slug)
    .first();
  if (!page) return null;

  const { results } = await db
    .prepare('SELECT id, type, data FROM sections WHERE page_id = ? ORDER BY position')
    .bind(page.id)
    .all();
  const sections = results.map((s) => ({ ...s, data: safeParse(s.data) }));

  const types = new Set(sections.map((s) => s.type));
  const imageIds = new Set();
  sections.forEach((s) => collectImageIds(s.type, s.data).forEach((id) => imageIds.add(id)));

  const [faqs, units] = await Promise.all([
    types.has('faq_list') ? db.prepare('SELECT id, question, answer, category FROM faq_items ORDER BY position, id').all() : null,
    types.has('unit_grid')
      ? db
          .prepare(
            `SELECT u.*, m.r2_key AS image_key, m.alt AS image_alt, m.width AS image_width, m.height AS image_height
               FROM units u LEFT JOIN media m ON m.id = u.image_id
              WHERE u.is_active = 1 ORDER BY u.position, u.name`,
          )
          .all()
      : null,
  ]);

  let media = new Map();
  if (imageIds.size) {
    const ids = [...imageIds];
    const { results: rows } = await db
      .prepare(`SELECT id, r2_key, alt, width, height FROM media WHERE id IN (${ids.map(() => '?').join(',')})`)
      .bind(...ids)
      .all();
    media = new Map(rows.map((m) => [m.id, m]));
  }

  return {
    page,
    sections,
    media,
    faqs: faqs?.results ?? [],
    units: units?.results ?? [],
  };
}

export async function getSitemapPages(db) {
  const { results } = await db.prepare('SELECT slug, updated_at FROM pages ORDER BY nav_order').all();
  return results;
}

function safeParse(json) {
  try {
    return JSON.parse(json);
  } catch {
    return {};
  }
}

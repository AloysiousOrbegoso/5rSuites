import { collectImageIds } from '@5rsuites/blocks';

export function pagesUsingImage(sectionRows, id) {
  const pages = new Map();
  for (const row of sectionRows) {
    if (collectImageIds(row.type, JSON.parse(row.data)).has(id)) pages.set(row.page_id, row.title);
  }
  return [...pages].map(([pageId, title]) => ({ id: pageId, title }));
}

export async function mediaUsage(db, id) {
  const [sections, units, shared, siteDefault] = await db.batch([
    db.prepare('SELECT s.type, s.data, p.id AS page_id, p.title FROM sections s JOIN pages p ON p.id = s.page_id'),
    db.prepare('SELECT COUNT(*) AS n FROM units WHERE image_id = ?').bind(id),
    db.prepare('SELECT id, title FROM pages WHERE share_image = ?').bind(id),
    db.prepare(`SELECT 1 FROM settings WHERE key = 'share_image' AND value = ?`).bind(String(id)),
  ]);
  const pages = pagesUsingImage(sections.results, id);
  for (const p of shared.results) {
    if (!pages.some((u) => u.id === p.id)) pages.push({ id: p.id, title: `${p.title} (share image)` });
  }
  return { pages, units: units.results[0].n, siteDefault: siteDefault.results.length > 0 };
}

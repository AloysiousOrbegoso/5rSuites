import { purgeSite, snapshotStatements } from '../../lib/content.js';
import { cleanSlug, cleanString, json, readJson, requireOwner } from '../../lib/http.js';

export async function onRequestGet({ env }) {
  const { results } = await env.DB.prepare(
    `SELECT p.id, p.slug, p.title, p.show_in_nav, p.nav_order, p.updated_at, u.name AS updated_by_name,
            (SELECT COUNT(*) FROM sections s WHERE s.page_id = p.id) AS section_count
       FROM pages p LEFT JOIN users u ON u.id = p.updated_by
      ORDER BY p.slug = 'home' DESC, p.nav_order, p.title`,
  ).all();
  return json({ pages: results });
}

// Owner only: create a page.
export async function onRequestPost({ request, env, data }) {
  requireOwner(data.user);
  const db = env.DB;
  const body = await readJson(request);
  const title = cleanString(body.title, { max: 120, required: true, label: 'Title' });
  const slug = cleanSlug(body.slug);
  const showInNav = body.show_in_nav ? 1 : 0;

  const { max } = await db.prepare('SELECT COALESCE(MAX(nav_order), 0) AS max FROM pages').first();
  const inserted = await db
    .prepare('INSERT INTO pages (title, slug, show_in_nav, nav_order, updated_by) VALUES (?, ?, ?, ?, ?) RETURNING id')
    .bind(title, slug, showInNav, max + 10, data.user.id)
    .first();
  await db.batch(snapshotStatements(db, inserted.id, data.user.id, 'Page created'));
  const purge = await purgeSite(env, ['all']);
  return json({ id: inserted.id, ...purge }, { status: 201 });
}

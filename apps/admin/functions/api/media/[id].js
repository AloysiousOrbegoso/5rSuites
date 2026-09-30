import { purgeSite } from '../../lib/content.js';
import { HttpError, cleanString, intParam, json, readJson } from '../../lib/http.js';

// Media ids are referenced from section JSON; find pages that still use one.
async function pagesUsing(db, id) {
  const { results } = await db
    .prepare(
      // Every image field in packages/blocks is named "image".
      `SELECT DISTINCT p.id, p.title
         FROM sections s JOIN pages p ON p.id = s.page_id, json_tree(s.data) t
        WHERE t.key = 'image' AND t.type = 'integer' AND t.value = ?`,
    )
    .bind(id)
    .all();
  const units = await db.prepare('SELECT COUNT(*) AS n FROM units WHERE image_id = ?').bind(id).first();
  // Also counts as "in use": a page's share image, or the site default in Settings.
  const shared = await db.prepare('SELECT id, title FROM pages WHERE share_image = ?').bind(id).all();
  const siteDefault = await db.prepare(`SELECT 1 FROM settings WHERE key = 'share_image' AND value = ?`).bind(String(id)).first();
  const pages = [...results, ...shared.results.filter((s) => !results.some((r) => r.id === s.id)).map((s) => ({ ...s, title: `${s.title} (share image)` }))];
  return { pages, units: units.n, siteDefault: !!siteDefault };
}

export async function onRequestPatch({ request, env, params }) {
  const id = intParam(params.id);
  const body = await readJson(request);
  const alt = cleanString(body.alt, { max: 300, label: 'Alt text' });
  const res = await env.DB.prepare('UPDATE media SET alt = ? WHERE id = ?').bind(alt, id).run();
  if (!res.meta.changes) throw new HttpError(404, 'Image not found.');
  const purge = await purgeSite(env, ['all']);
  return json({ ok: true, ...purge });
}

export async function onRequestDelete({ env, params }) {
  const id = intParam(params.id);
  const row = await env.DB.prepare('SELECT r2_key FROM media WHERE id = ?').bind(id).first();
  if (!row) throw new HttpError(404, 'Image not found.');

  const usage = await pagesUsing(env.DB, id);
  if (usage.pages.length || usage.units || usage.siteDefault) {
    const where = [...usage.pages.map((p) => `“${p.title}”`), usage.units ? `${usage.units} unit(s)` : null, usage.siteDefault ? 'Settings (default share image)' : null].filter(Boolean);
    throw new HttpError(409, `This image is still used on ${where.join(', ')}. Remove it there first.`);
  }

  await env.DB.prepare('DELETE FROM media WHERE id = ?').bind(id).run();
  await env.BUCKET.delete(row.r2_key);
  return json({ ok: true });
}

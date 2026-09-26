import { BLOCKS, validateSection } from '@5rsuites/blocks';
import { loadPage, pageTag, purgeSite, snapshotStatements } from '../../../../lib/content.js';
import { HttpError, intParam, json, readJson } from '../../../../lib/http.js';

// Add a section. Optional `position` inserts before the section currently at that index.
export async function onRequestPost({ request, env, params, data }) {
  const db = env.DB;
  const pageId = intParam(params.id);
  const body = await readJson(request);
  if (!BLOCKS[body.type]) throw new HttpError(400, 'Unknown section type.');
  const clean = validateSection(body.type, body.data);

  const page = await db.prepare('SELECT id FROM pages WHERE id = ?').bind(pageId).first();
  if (!page) throw new HttpError(404, 'Page not found.');
  const { n } = await db.prepare('SELECT COUNT(*) AS n FROM sections WHERE page_id = ?').bind(pageId).first();
  const position = Number.isInteger(body.position) && body.position >= 0 && body.position < n ? body.position : n;

  await db.batch([
    db.prepare('UPDATE sections SET position = position + 1 WHERE page_id = ? AND position >= ?').bind(pageId, position),
    db
      .prepare('INSERT INTO sections (page_id, position, type, data, updated_by) VALUES (?, ?, ?, ?, ?)')
      .bind(pageId, position, body.type, JSON.stringify(clean), data.user.id),
    ...snapshotStatements(db, pageId, data.user.id, `Added ${BLOCKS[body.type].label} section`),
  ]);

  const purge = await purgeSite(env, [pageTag(pageId)]);
  return json({ page: await loadPage(db, pageId), ...purge }, { status: 201 });
}

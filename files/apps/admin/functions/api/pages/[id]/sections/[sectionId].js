import { BLOCKS, validateSection } from '@5rsuites/blocks';
import { pageTag, publishedPage, snapshotStatements } from '../../../../lib/content.js';
import { HttpError, intParam, readJson } from '../../../../lib/http.js';

async function findSection(db, params) {
  const pageId = intParam(params.id);
  const sectionId = intParam(params.sectionId, 'section id');
  const section = await db
    .prepare('SELECT id, type, position FROM sections WHERE id = ? AND page_id = ?')
    .bind(sectionId, pageId)
    .first();
  if (!section) throw new HttpError(404, 'Section not found.');
  return { pageId, section };
}

export async function onRequestPut({ request, env, params, data }) {
  const db = env.DB;
  const { pageId, section } = await findSection(db, params);
  const body = await readJson(request);
  const clean = validateSection(section.type, body.data);

  await db.batch([
    db
      .prepare(`UPDATE sections SET data = ?, updated_at = datetime('now'), updated_by = ? WHERE id = ?`)
      .bind(JSON.stringify(clean), data.user.id, section.id),
    ...snapshotStatements(db, pageId, data.user.id, `Edited ${BLOCKS[section.type].label} section`),
  ]);

  return publishedPage(env, pageId, [pageTag(pageId)]);
}

export async function onRequestDelete({ env, params, data }) {
  const db = env.DB;
  const { pageId, section } = await findSection(db, params);

  await db.batch([
    db.prepare('DELETE FROM sections WHERE id = ?').bind(section.id),
    db.prepare('UPDATE sections SET position = position - 1 WHERE page_id = ? AND position > ?').bind(pageId, section.position),
    ...snapshotStatements(db, pageId, data.user.id, `Deleted ${BLOCKS[section.type].label} section`),
  ]);

  return publishedPage(env, pageId, [pageTag(pageId)]);
}

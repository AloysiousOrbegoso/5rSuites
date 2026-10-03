import { pageTag, publishedPage, snapshotStatements } from '../../../../lib/content.js';
import { HttpError, intParam, readJson } from '../../../../lib/http.js';

// Body: { order: [sectionId, ...] } — must list every section on the page exactly once.
export async function onRequestPost({ request, env, params, data }) {
  const db = env.DB;
  const pageId = intParam(params.id);
  const { order } = await readJson(request);

  const { results } = await db.prepare('SELECT id FROM sections WHERE page_id = ?').bind(pageId).all();
  const current = new Set(results.map((r) => r.id));
  if (!Array.isArray(order) || order.length !== current.size || new Set(order).size !== order.length || !order.every((id) => current.has(id))) {
    throw new HttpError(409, 'The page changed since you loaded it. Refresh and try again.');
  }

  await db.batch([
    ...order.map((id, position) => db.prepare('UPDATE sections SET position = ? WHERE id = ?').bind(position, id)),
    ...snapshotStatements(db, pageId, data.user.id, 'Reordered sections'),
  ]);

  return publishedPage(env, pageId, [pageTag(pageId)]);
}

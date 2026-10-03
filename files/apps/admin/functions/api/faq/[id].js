import { published } from '../../lib/content.js';
import { HttpError, intParam, readJson } from '../../lib/http.js';
import { cleanFaq } from './index.js';

export async function onRequestPut({ request, env, params }) {
  const f = cleanFaq(await readJson(request));
  const row = await env.DB.prepare(
    `UPDATE faq_items SET question = ?, answer = ?, category = ?, updated_at = datetime('now') WHERE id = ? RETURNING *`,
  )
    .bind(f.question, f.answer, f.category, intParam(params.id))
    .first();
  if (!row) throw new HttpError(404, 'Question not found.');
  return published(env, ['faq'], { item: row });
}

export async function onRequestDelete({ env, params }) {
  await env.DB.prepare('DELETE FROM faq_items WHERE id = ?').bind(intParam(params.id)).run();
  return published(env, ['faq'], { ok: true });
}

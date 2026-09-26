import { purgeSite } from '../../lib/content.js';
import { HttpError, json, readJson } from '../../lib/http.js';

export async function onRequestPost({ request, env }) {
  const { order } = await readJson(request);
  if (!Array.isArray(order) || !order.every(Number.isInteger)) throw new HttpError(400, 'Invalid order.');
  await env.DB.batch(order.map((id, i) => env.DB.prepare('UPDATE faq_items SET position = ? WHERE id = ?').bind(i, id)));
  const purge = await purgeSite(env, ['faq']);
  return json({ ok: true, ...purge });
}

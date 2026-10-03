import { published } from '../../lib/content.js';
import { HttpError, intParam, readJson } from '../../lib/http.js';
import { COLUMNS, cleanUnit } from './index.js';

export async function onRequestPut({ request, env, params }) {
  const u = cleanUnit(await readJson(request));
  const row = await env.DB.prepare(
    `UPDATE units SET ${COLUMNS.map((c) => `${c} = ?`).join(', ')}, updated_at = datetime('now') WHERE id = ? RETURNING *`,
  )
    .bind(...COLUMNS.map((c) => u[c]), intParam(params.id))
    .first();
  if (!row) throw new HttpError(404, 'Unit not found.');
  return published(env, ['units'], { unit: row });
}

export async function onRequestDelete({ env, params }) {
  await env.DB.prepare('DELETE FROM units WHERE id = ?').bind(intParam(params.id)).run();
  return published(env, ['units'], { ok: true });
}

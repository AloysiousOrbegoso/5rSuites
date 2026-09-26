import { HttpError, intParam, json } from '../../../../../lib/http.js';

export async function onRequestGet({ env, params }) {
  const row = await env.DB.prepare('SELECT id, note, created_at, snapshot FROM page_revisions WHERE id = ? AND page_id = ?')
    .bind(intParam(params.revisionId, 'revision id'), intParam(params.id))
    .first();
  if (!row) throw new HttpError(404, 'Revision not found.');
  return json({ revision: { ...row, snapshot: JSON.parse(row.snapshot) } });
}

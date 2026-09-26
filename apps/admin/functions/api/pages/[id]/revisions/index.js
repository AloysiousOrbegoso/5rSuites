import { intParam, json } from '../../../../lib/http.js';

export async function onRequestGet({ env, params }) {
  const { results } = await env.DB.prepare(
    `SELECT r.id, r.note, r.created_at, u.name AS created_by_name, u.email AS created_by_email,
            json_array_length(r.snapshot, '$.sections') AS section_count
       FROM page_revisions r LEFT JOIN users u ON u.id = r.created_by
      WHERE r.page_id = ? ORDER BY r.id DESC`,
  )
    .bind(intParam(params.id))
    .all();
  return json({ revisions: results });
}

import { HttpError, intParam, json, readJson } from '../../../lib/http.js';
import { SUBMISSION_STATUSES } from '../../../lib/submissions.js';

export async function onRequestGet({ env, params }) {
  const row = await env.DB.prepare('SELECT * FROM form_submissions WHERE id = ?').bind(intParam(params.id)).first();
  if (!row) throw new HttpError(404, 'Submission not found.');
  row.data = JSON.parse(row.data);
  row.report_data = row.report_data ? JSON.parse(row.report_data) : null;
  return json({ submission: row });
}

export async function onRequestPatch({ request, env, params }) {
  const { status } = await readJson(request);
  if (!SUBMISSION_STATUSES.includes(status)) throw new HttpError(400, 'Invalid status.');
  const res = await env.DB.prepare('UPDATE form_submissions SET status = ? WHERE id = ?').bind(status, intParam(params.id)).run();
  if (!res.meta.changes) throw new HttpError(404, 'Submission not found.');
  return json({ ok: true });
}

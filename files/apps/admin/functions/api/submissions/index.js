import { json } from '../../lib/http.js';
import { submissionFilter } from '../../lib/submissions.js';

const PAGE_SIZE = 50;

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const page = Math.max(0, Number(url.searchParams.get('page')) | 0);
  const { clause, binds } = submissionFilter(url.searchParams);

  const { results } = await env.DB.prepare(
    `SELECT id, form_type, name, email, status, notify_status, report_status, attachment_key IS NOT NULL AS has_attachment, created_at
       FROM form_submissions ${clause} ORDER BY id DESC LIMIT ${PAGE_SIZE + 1} OFFSET ${page * PAGE_SIZE}`,
  )
    .bind(...binds)
    .all();
  const counts = await env.DB.prepare(`SELECT form_type, COUNT(*) AS n FROM form_submissions WHERE status = 'new' GROUP BY form_type`).all();

  return json({
    submissions: results.slice(0, PAGE_SIZE),
    hasMore: results.length > PAGE_SIZE,
    newCounts: Object.fromEntries(counts.results.map((r) => [r.form_type, r.n])),
  });
}

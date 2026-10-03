import { formLabel } from '@5rsuites/blocks';
import { toCsv } from '../../lib/csv.js';
import { submissionFilter } from '../../lib/submissions.js';

// Form submissions as a CSV download, with the same filters as the Submissions list
// (see lib/submissions.js).

export async function onRequestGet({ request, env }) {
  const { type, clause, binds } = submissionFilter(new URL(request.url).searchParams);
  const { results } = await env.DB.prepare(
    `SELECT id, form_type, name, email, data, status, report_status, attachment_key, created_at
       FROM form_submissions ${clause} ORDER BY id DESC`,
  )
    .bind(...binds)
    .all();

  // Fixed columns first, then every form field that appears, in first-seen order.
  const rows = results.map((r) => ({ ...r, fields: JSON.parse(r.data || '{}') }));
  const fieldNames = [...new Set(rows.flatMap((r) => Object.keys(r.fields)))].filter((k) => !['name', 'email'].includes(k));
  const header = ['ID', 'Received (UTC)', 'Form', 'Status', 'Name', 'Email', ...fieldNames, 'Market report', 'Attachment'];
  const body = rows.map((r) => [
    r.id,
    r.created_at,
    formLabel(r.form_type),
    r.status,
    r.name,
    r.email,
    ...fieldNames.map((k) => (Array.isArray(r.fields[k]) ? r.fields[k].join('; ') : r.fields[k] ?? '')),
    r.report_status || '',
    r.attachment_key ? 'yes' : '',
  ]);

  const name = `5r-submissions-${type ? `${type}-` : ''}${new Date().toISOString().slice(0, 10)}.csv`;
  return new Response(toCsv([header, ...body]), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${name}"`,
      'Cache-Control': 'no-store',
    },
  });
}

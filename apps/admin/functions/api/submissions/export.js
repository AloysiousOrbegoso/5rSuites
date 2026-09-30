import { toCsv } from '../../lib/csv.js';

// Form submissions as a CSV download, with the same filters as the Submissions list
// (?type=contact|register_property|careers, ?status=new|read|archived|all).
const TYPES = new Set(['contact', 'register_property', 'careers']);
const STATUSES = new Set(['new', 'read', 'archived']);
const LABELS = { contact: 'Contact', register_property: 'Register Property', careers: 'Careers' };

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const type = url.searchParams.get('type');
  const status = url.searchParams.get('status');
  const where = [];
  const binds = [];
  if (TYPES.has(type)) {
    where.push('form_type = ?');
    binds.push(type);
  }
  if (STATUSES.has(status)) {
    where.push('status = ?');
    binds.push(status);
  } else if (status !== 'all') {
    where.push(`status != 'archived'`);
  }
  const { results } = await env.DB.prepare(
    `SELECT id, form_type, name, email, data, status, report_status, attachment_key, created_at
       FROM form_submissions ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY id DESC`,
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
    LABELS[r.form_type] || r.form_type,
    r.status,
    r.name,
    r.email,
    ...fieldNames.map((k) => (Array.isArray(r.fields[k]) ? r.fields[k].join('; ') : r.fields[k] ?? '')),
    r.report_status || '',
    r.attachment_key ? 'yes' : '',
  ]);

  const name = `5r-submissions-${type && TYPES.has(type) ? `${type}-` : ''}${new Date().toISOString().slice(0, 10)}.csv`;
  return new Response(toCsv([header, ...body]), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${name}"`,
      'Cache-Control': 'no-store',
    },
  });
}

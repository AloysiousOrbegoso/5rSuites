import { HttpError, intParam } from '../../../lib/http.js';

// Careers attachments are private: stored under attachments/ in R2 and only served here,
// behind the admin session (the public site refuses anything outside media/).
export async function onRequestGet({ env, params }) {
  const row = await env.DB.prepare('SELECT attachment_key FROM form_submissions WHERE id = ?').bind(intParam(params.id)).first();
  if (!row?.attachment_key) throw new HttpError(404, 'No attachment.');
  const obj = await env.BUCKET.get(row.attachment_key);
  if (!obj) throw new HttpError(404, 'Attachment file is missing.');
  const filename = row.attachment_key.split('/').pop().replace(/^[0-9a-f-]{36}-/, '');
  return new Response(obj.body, {
    headers: {
      'Content-Type': obj.httpMetadata?.contentType || 'application/octet-stream',
      'Content-Disposition': `attachment; filename="${filename.replace(/"/g, '')}"`,
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

import { countRecent, recordHit } from '@5rsuites/server/ratelimit';
import { env } from 'cloudflare:workers';
import { notifyTeam } from '../../../lib/notify.js';
import { ATTACHMENT_MAX_BYTES, ATTACHMENT_TYPES, FORMS, fileField, validateForm } from '../../../lib/form-specs.js';
import { runRegisterPropertyPipeline } from '../../../lib/report/pipeline.js';
import { verifyTurnstile } from '../../../lib/turnstile.js';

// Handles Contact, Register Property and Careers.
// Order: honeypot → Turnstile → validate → store in D1 → (background) email + report.
// The D1 write always happens before any email; email failure never loses a submission.

const MAX_PER_WINDOW = 8;
const WINDOW_MINUTES = 10;

export async function POST({ params, request, locals }) {
  const type = params.form;
  const spec = FORMS[type];
  if (!spec) return new Response('Not found', { status: 404 });

  // Works with JS (fetch → JSON) and without (plain form post → small HTML page).
  // No redirect-with-query-string: pages are edge-cached and query strings would fragment the cache.
  const wantsJson = (request.headers.get('Accept') || '').includes('application/json');
  const reply = (ok, message, status = ok ? 200 : 400) =>
    wantsJson ? Response.json(ok ? { ok, message } : { ok, error: message }, { status }) : htmlReply(ok, message, status);

  let form;
  try {
    form = await request.formData();
  } catch {
    return reply(false, 'Something went wrong reading the form. Please try again.');
  }

  // Honeypot: real people never see this field. Pretend it worked.
  if (String(form.get('website') || '').trim()) return reply(true, spec.success);

  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  if (!(await verifyTurnstile(env, form.get('cf-turnstile-response'), ip))) {
    return reply(false, 'We couldn’t verify you’re human. Please try again.');
  }
  if ((await countRecent(env.DB, 'form', ip, WINDOW_MINUTES)) >= MAX_PER_WINDOW) {
    return reply(false, 'Too many submissions. Please wait a few minutes and try again.', 429);
  }

  const { data, error } = validateForm(type, form);
  if (error) return reply(false, error);

  // File upload (careers résumé, register-property documents) → private R2 prefix.
  let attachmentKey = null;
  let attachment = null;
  const ff = fileField(type);
  if (ff) {
    const file = form.get(ff.name);
    const present = file && typeof file !== 'string' && file.size > 0;
    if (ff.required && !present) return reply(false, `Please attach a file (${ff.label}).`);
    if (present) {
      if (!ATTACHMENT_TYPES[file.type]) return reply(false, 'Files must be PDF, Word, JPEG, PNG or WebP.');
      if (file.size > ATTACHMENT_MAX_BYTES) return reply(false, 'Files must be 10 MB or smaller.');
      const safeName = file.name.replace(/[^\w.-]+/g, '_').slice(-100) || `upload.${ATTACHMENT_TYPES[file.type]}`;
      attachmentKey = `attachments/${type}/${crypto.randomUUID()}-${safeName}`;
      await env.BUCKET.put(attachmentKey, file.stream(), { httpMetadata: { contentType: file.type } });
      attachment = { filename: safeName, size: file.size };
    }
  }

  const row = await env.DB.prepare(
    `INSERT INTO form_submissions (form_type, name, email, data, attachment_key, report_status, ip, user_agent)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`,
  )
    .bind(
      type,
      data.name || '',
      data.email || '',
      JSON.stringify(data),
      attachmentKey,
      type === 'register_property' ? 'pending' : null,
      ip,
      (request.headers.get('User-Agent') || '').slice(0, 300),
    )
    .first();
  await recordHit(env.DB, 'form', ip).run();

  const background = (async () => {
    await notifyTeam(env, { id: row.id, type, data, attachment });
    if (type === 'register_property') await runRegisterPropertyPipeline(env, { id: row.id, data });
  })().catch((err) => console.error('[forms] background task failed', row.id, err));

  if (locals.cfContext?.waitUntil) locals.cfContext.waitUntil(background);
  else await background;

  return reply(true, spec.success);
}

function htmlReply(ok, message, status) {
  const esc = (t) => t.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const body = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${ok ? 'Thank you' : 'Please try again'} | 5R Suites</title></head>
<body style="font-family:system-ui,sans-serif;max-width:560px;margin:15vh auto;padding:0 1rem;color:#14213d">
<h1 style="font-family:Georgia,serif">${ok ? 'Thank you' : 'Something needs fixing'}</h1><p>${esc(message)}</p>
<p><a href="javascript:history.back()">${ok ? 'Back to the site' : 'Go back and try again'}</a></p></body></html>`;
  return new Response(body, { status, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } });
}

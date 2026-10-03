// Transactional email via Resend. Callers decide whether a failure matters; this never throws.

// attachments: [{ filename, content (base64) }]
export async function sendEmail(env, { to, subject, html, replyTo, attachments }) {
  if (!env.RESEND_API_KEY) {
    console.warn(`[email] RESEND_API_KEY not set; skipped "${subject}" to ${to}`);
    return { ok: false, error: 'RESEND_API_KEY not configured' };
  }
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: env.EMAIL_FROM || '5R Suites <no-reply@5rsuites.com>',
        to: Array.isArray(to) ? to : [to],
        subject,
        html,
        reply_to: replyTo,
        attachments,
      }),
    });
    if (!res.ok) return { ok: false, error: `Resend ${res.status}: ${(await res.text()).slice(0, 300)}` };
    return { ok: true };
  } catch (err) {
    return { ok: false, error: String(err?.message || err) };
  }
}

export function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

export function simpleEmailHtml(heading, paragraphs, button) {
  const body = paragraphs.map((p) => `<p style="margin:0 0 16px">${escapeHtml(p)}</p>`).join('');
  const btn = button
    ? `<p style="margin:24px 0"><a href="${escapeHtml(button.url)}" style="background:#1d3557;color:#fff;padding:12px 20px;border-radius:999px;text-decoration:none;font-weight:600">${escapeHtml(button.label)}</a></p>`
    : '';
  return `<div style="font-family:system-ui,sans-serif;color:#14213d;max-width:560px;margin:0 auto;padding:24px">
<h2 style="font-family:Georgia,serif">${escapeHtml(heading)}</h2>${body}${btn}
<p style="color:#6b7690;font-size:13px">5R Suites</p></div>`;
}

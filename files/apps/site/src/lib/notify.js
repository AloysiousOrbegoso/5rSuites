import { formLabel } from '@5rsuites/blocks';
import { escapeHtml, sendEmail } from '@5rsuites/server/email';
import { FORMS } from './form-specs.js';

// Emails the team about a new submission and records whether that worked.
// The submission is already in D1; this is a convenience notification on top.
export async function notifyTeam(env, { id, type, data, attachment }) {
  const to = env.FORM_NOTIFY_EMAIL || env.TEAM_ALERT_EMAIL;
  const labelFor = Object.fromEntries(FORMS[type].fields.map((f) => [f.name, f.label]));
  const rows = Object.entries(data)
    .filter(([, v]) => v)
    .map(([k, v]) => `<tr><td style="padding:6px 12px 6px 0;color:#6b7690;vertical-align:top">${escapeHtml(labelFor[k] || k)}</td><td style="padding:6px 0;white-space:pre-wrap">${escapeHtml(v)}</td></tr>`)
    .join('');

  const result = to
    ? await sendEmail(env, {
        to,
        replyTo: data.email || undefined,
        subject: `New ${formLabel(type)} submission — ${data.name || data.email}`,
        html: `<div style="font-family:system-ui,sans-serif;color:#14213d">
<h2 style="font-family:Georgia,serif">New ${formLabel(type)} submission</h2>
<table style="border-collapse:collapse">${rows}</table>
${attachment ? `<p>Résumé attached in the admin: ${escapeHtml(attachment.filename)}</p>` : ''}
<p style="color:#6b7690;font-size:13px">Submission #${id}. View it in the admin under Submissions. Reply to this email to answer ${escapeHtml(data.name || 'them')} directly.</p></div>`,
      })
    : { ok: false, error: 'FORM_NOTIFY_EMAIL / TEAM_ALERT_EMAIL not configured' };

  await env.DB.prepare('UPDATE form_submissions SET notify_status = ?, notify_error = ? WHERE id = ?')
    .bind(result.ok ? 'sent' : 'failed', result.ok ? null : String(result.error).slice(0, 500), id)
    .run();
  return result;
}

import { sendEmail, simpleEmailHtml } from '@5rsuites/server/email';
import { hashPassword, validateNewPassword, verifyPassword } from '../../lib/auth.js';
import { HttpError, json, readJson } from '../../lib/http.js';

// Change password while signed in. Requires the current password; signs out every
// other session for the account (this one stays signed in).
export async function onRequestPost({ request, env, data, waitUntil }) {
  const db = env.DB;
  const body = await readJson(request);
  const row = await db.prepare('SELECT password_hash FROM users WHERE id = ?').bind(data.user.id).first();
  if (!(await verifyPassword(String(body.current || ''), row?.password_hash))) {
    throw new HttpError(400, 'Your current password is incorrect.');
  }
  const problem = validateNewPassword(body.password);
  if (problem) throw new HttpError(400, problem);

  await db.batch([
    db.prepare(`UPDATE users SET password_hash = ?, updated_at = datetime('now') WHERE id = ?`).bind(await hashPassword(body.password), data.user.id),
    db.prepare('DELETE FROM sessions WHERE user_id = ? AND id != ?').bind(data.user.id, data.user.session_id),
  ]);
  waitUntil(
    sendEmail(env, {
      to: data.user.email,
      subject: 'Your 5R Suites admin password was changed',
      html: simpleEmailHtml('Password changed', [
        'The password for your 5R Suites admin account was just changed, and your other devices were signed out.',
        'If this wasn’t you, reset your password immediately and contact the site owner.',
      ]),
    }),
  );
  return json({ ok: true });
}

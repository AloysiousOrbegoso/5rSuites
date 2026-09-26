import { hashPassword, newSession, sessionCookie, sha256, validateNewPassword } from '../../lib/auth.js';
import { sendEmail, simpleEmailHtml } from '@5rsuites/server/email';
import { HttpError, json, readJson } from '../../lib/http.js';

// Completes both password resets and staff invites. Tokens are single-use.
// A successful reset signs out every other session for the account.
export async function onRequestPost({ request, env, waitUntil }) {
  const db = env.DB;
  const body = await readJson(request);
  const problem = validateNewPassword(body.password);
  if (problem) throw new HttpError(400, problem);

  const tokenHash = await sha256(String(body.token || ''));
  const row = await db
    .prepare(
      `SELECT r.user_id, r.purpose, u.email, u.name, u.role FROM password_resets r JOIN users u ON u.id = r.user_id
        WHERE r.token_hash = ? AND r.used_at IS NULL AND r.expires_at > datetime('now')`,
    )
    .bind(tokenHash)
    .first();
  if (!row) throw new HttpError(400, 'This link is invalid or has expired. Request a new one.');

  const passwordHash = await hashPassword(body.password);
  const { token, statement } = await newSession(db, row.user_id, request);

  // The used_at guard makes the token single-use even if two requests race.
  const claim = await db
    .prepare(`UPDATE password_resets SET used_at = datetime('now') WHERE token_hash = ? AND used_at IS NULL`)
    .bind(tokenHash)
    .run();
  if (claim.meta.changes !== 1) throw new HttpError(400, 'This link has already been used.');

  await db.batch([
    db.prepare(`UPDATE users SET password_hash = ?, updated_at = datetime('now') WHERE id = ?`).bind(passwordHash, row.user_id),
    db.prepare(`UPDATE password_resets SET used_at = datetime('now') WHERE user_id = ? AND used_at IS NULL`).bind(row.user_id),
    db.prepare('DELETE FROM sessions WHERE user_id = ?').bind(row.user_id),
    statement,
  ]);

  if (row.purpose === 'reset') {
    waitUntil(
      sendEmail(env, {
        to: row.email,
        subject: 'Your 5R Suites admin password was changed',
        html: simpleEmailHtml('Password changed', [
          'The password for your 5R Suites admin account was just changed and all other sessions were signed out.',
          'If this wasn’t you, contact the site owner immediately.',
        ]),
      }),
    );
  }

  return json(
    { user: { id: row.user_id, email: row.email, name: row.name, role: row.role } },
    { headers: { 'Set-Cookie': sessionCookie(token) } },
  );
}

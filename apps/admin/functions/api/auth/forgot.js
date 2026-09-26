import { expiresIn, randomToken, sha256 } from '../../lib/auth.js';
import { sendEmail, simpleEmailHtml } from '@5rsuites/server/email';
import { clientIp, json, readJson } from '../../lib/http.js';
import { countRecent, recordHit } from '@5rsuites/server/ratelimit';

const RESET_TTL_SECONDS = 60 * 60; // 1 hour

// Always answers the same way whether or not the email exists.
export async function onRequestPost({ request, env, waitUntil }) {
  const db = env.DB;
  const ip = clientIp(request);
  const body = await readJson(request);
  const email = String(body.email || '').trim().toLowerCase();
  const reply = json({ ok: true, message: 'If that email has an account, a reset link is on its way.' });

  // Limit reset emails per IP so this can't be used to spam an inbox.
  if ((await countRecent(db, 'forgot', ip, 60)) >= 5) return reply;
  await recordHit(db, 'forgot', ip).run();

  const user = email
    ? await db.prepare('SELECT id, email, name FROM users WHERE email = ? AND password_hash IS NOT NULL').bind(email).first()
    : null;
  if (!user) return reply;

  const token = randomToken();
  await db.batch([
    // Only the newest link works.
    db.prepare(`UPDATE password_resets SET used_at = datetime('now') WHERE user_id = ? AND used_at IS NULL`).bind(user.id),
    db
      .prepare(`INSERT INTO password_resets (token_hash, user_id, purpose, expires_at) VALUES (?, ?, 'reset', ?)`)
      .bind(await sha256(token), user.id, expiresIn(RESET_TTL_SECONDS)),
  ]);

  const link = new URL(`/reset?token=${token}`, request.url).toString();
  waitUntil(
    sendEmail(env, {
      to: user.email,
      subject: 'Reset your 5R Suites admin password',
      html: simpleEmailHtml('Reset your password', [
        `Hi ${user.name || 'there'}, someone asked to reset the password for this admin account.`,
        'The link works once and expires in 1 hour. If this wasn’t you, you can ignore this email.',
      ], { label: 'Choose a new password', url: link }),
    }),
  );
  return reply;
}

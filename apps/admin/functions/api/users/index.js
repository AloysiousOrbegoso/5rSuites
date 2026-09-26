import { expiresIn, randomToken, sha256 } from '../../lib/auth.js';
import { sendEmail, simpleEmailHtml } from '@5rsuites/server/email';
import { HttpError, cleanString, json, readJson, requireOwner } from '../../lib/http.js';

const INVITE_TTL_SECONDS = 60 * 60 * 72; // 3 days

export async function onRequestGet({ env, data }) {
  requireOwner(data.user);
  const { results } = await env.DB.prepare(
    `SELECT id, email, name, role, created_at, last_login_at, password_hash IS NULL AS pending FROM users ORDER BY role DESC, name`,
  ).all();
  return json({ users: results });
}

// Owner only: invite a login. The invitee sets their own password from the emailed link.
export async function onRequestPost({ request, env, data, waitUntil }) {
  requireOwner(data.user);
  const db = env.DB;
  const body = await readJson(request);
  const email = cleanString(body.email, { max: 200, required: true, label: 'Email' }).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new HttpError(400, 'Enter a valid email address.');
  const name = cleanString(body.name, { max: 120, label: 'Name' });
  const role = body.role === 'owner' ? 'owner' : 'staff';

  const existing = await db.prepare('SELECT id, password_hash FROM users WHERE email = ?').bind(email).first();
  if (existing?.password_hash) throw new HttpError(409, 'That person already has a login.');

  // Re-inviting a pending user just issues a fresh link.
  const user = existing
    ? await db.prepare('UPDATE users SET name = ?, role = ? WHERE id = ? RETURNING id').bind(name, role, existing.id).first()
    : await db.prepare('INSERT INTO users (email, name, role) VALUES (?, ?, ?) RETURNING id').bind(email, name, role).first();

  const token = randomToken();
  await db.batch([
    db.prepare(`UPDATE password_resets SET used_at = datetime('now') WHERE user_id = ? AND used_at IS NULL`).bind(user.id),
    db
      .prepare(`INSERT INTO password_resets (token_hash, user_id, purpose, expires_at) VALUES (?, ?, 'invite', ?)`)
      .bind(await sha256(token), user.id, expiresIn(INVITE_TTL_SECONDS)),
  ]);

  const link = new URL(`/reset?token=${token}`, request.url).toString();
  const sent = await sendEmail(env, {
    to: email,
    subject: 'You’ve been invited to the 5R Suites admin',
    html: simpleEmailHtml('You’re invited', [
      `${data.user.name || data.user.email} invited you to edit the 5R Suites website.`,
      'Choose a password to activate your login. This link expires in 3 days.',
    ], { label: 'Set up my login', url: link }),
  });
  if (!sent.ok) console.error('[invite] email failed', sent.error);

  // The owner can copy the link manually if email isn't configured yet.
  return json({ ok: true, emailed: sent.ok, link: sent.ok ? undefined : link }, { status: 201 });
}

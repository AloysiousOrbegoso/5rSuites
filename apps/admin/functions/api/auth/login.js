import { newSession, sessionCookie, verifyDummy, verifyPassword } from '../../lib/auth.js';
import { sendEmail, simpleEmailHtml } from '@5rsuites/server/email';
import { HttpError, clientIp, json, readJson } from '../../lib/http.js';
import { clearHits, countRecent, pruneOld, recordHit } from '@5rsuites/server/ratelimit';

// 10 failed attempts / 15 minutes / IP. Hitting the limit emails TEAM_ALERT_EMAIL.
const MAX_FAILURES = 10;
const WINDOW_MINUTES = 15;

export async function onRequestPost({ request, env, waitUntil }) {
  const db = env.DB;
  const ip = clientIp(request);

  if ((await countRecent(db, 'login_fail', ip, WINDOW_MINUTES)) >= MAX_FAILURES) {
    throw new HttpError(429, 'Too many failed sign-in attempts. Try again in 15 minutes.');
  }

  const body = await readJson(request);
  const email = String(body.email || '').trim().toLowerCase();
  const password = String(body.password || '');

  const user = email
    ? await db.prepare('SELECT id, email, name, role, password_hash FROM users WHERE email = ?').bind(email).first()
    : null;
  const ok = user?.password_hash ? await verifyPassword(password, user.password_hash) : await verifyDummy(password);

  if (!ok) {
    await db.batch([recordHit(db, 'login_fail', ip), pruneOld(db)]);
    const failures = await countRecent(db, 'login_fail', ip, WINDOW_MINUTES);
    if (failures === MAX_FAILURES && env.TEAM_ALERT_EMAIL) {
      waitUntil(
        sendEmail(env, {
          to: env.TEAM_ALERT_EMAIL,
          subject: '5R Suites admin: sign-in rate limit triggered',
          html: simpleEmailHtml('Sign-in rate limit triggered', [
            `${MAX_FAILURES} failed admin sign-in attempts in ${WINDOW_MINUTES} minutes from IP ${ip}.`,
            `Last email tried: ${email || '(blank)'}`,
            'Sign-ins from this IP are blocked for 15 minutes. No action is needed unless this keeps happening.',
          ]),
        }),
      );
    }
    throw new HttpError(401, 'Email or password is incorrect.');
  }

  const { token, statement } = await newSession(db, user.id, request);
  await db.batch([
    statement,
    db.prepare(`UPDATE users SET last_login_at = datetime('now') WHERE id = ?`).bind(user.id),
    db.prepare(`DELETE FROM sessions WHERE expires_at < datetime('now')`),
    clearHits(db, 'login_fail', ip),
  ]);

  return json(
    { user: { id: user.id, email: user.email, name: user.name, role: user.role } },
    { headers: { 'Set-Cookie': sessionCookie(token) } },
  );
}

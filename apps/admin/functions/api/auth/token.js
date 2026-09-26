import { sha256 } from '../../lib/auth.js';
import { json } from '../../lib/http.js';

// Lets the reset/invite screen show who the link is for before a password is chosen.
export async function onRequestGet({ request, env }) {
  const token = new URL(request.url).searchParams.get('token') || '';
  const row = token
    ? await env.DB.prepare(
        `SELECT r.purpose, u.email, u.name FROM password_resets r JOIN users u ON u.id = r.user_id
          WHERE r.token_hash = ? AND r.used_at IS NULL AND r.expires_at > datetime('now')`,
      )
        .bind(await sha256(token))
        .first()
    : null;
  if (!row) return json({ valid: false });
  return json({ valid: true, purpose: row.purpose, email: row.email, name: row.name });
}

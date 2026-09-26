import { clearSessionCookie } from '../../lib/auth.js';
import { json } from '../../lib/http.js';

export async function onRequestPost({ env, data }) {
  await env.DB.prepare('DELETE FROM sessions WHERE id = ?').bind(data.user.session_id).run();
  return json({ ok: true }, { headers: { 'Set-Cookie': clearSessionCookie() } });
}

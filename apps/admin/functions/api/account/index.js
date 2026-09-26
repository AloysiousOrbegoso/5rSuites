import { cleanString, json, readJson } from '../../lib/http.js';

// Any signed-in user can change their own display name.
export async function onRequestPatch({ request, env, data }) {
  const body = await readJson(request);
  const name = cleanString(body.name, { max: 120, required: true, label: 'Name' });
  await env.DB.prepare(`UPDATE users SET name = ?, updated_at = datetime('now') WHERE id = ?`).bind(name, data.user.id).run();
  return json({ user: { ...data.user, session_id: undefined, name } });
}

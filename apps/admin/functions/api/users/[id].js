import { HttpError, intParam, json, requireOwner } from '../../lib/http.js';

// Owner only. Deleting a user cascades to their sessions and reset tokens.
export async function onRequestDelete({ env, params, data }) {
  requireOwner(data.user);
  const id = intParam(params.id);
  if (id === data.user.id) throw new HttpError(400, 'You can’t remove your own login.');
  const target = await env.DB.prepare('SELECT role FROM users WHERE id = ?').bind(id).first();
  if (!target) throw new HttpError(404, 'User not found.');
  if (target.role === 'owner') {
    const { n } = await env.DB.prepare(`SELECT COUNT(*) AS n FROM users WHERE role = 'owner'`).first();
    if (n <= 1) throw new HttpError(400, 'There must always be at least one owner.');
  }
  await env.DB.prepare('DELETE FROM users WHERE id = ?').bind(id).run();
  return json({ ok: true });
}

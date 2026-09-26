import { json } from '../../lib/http.js';

export function onRequestGet({ data, env }) {
  const { id, email, name, role } = data.user;
  return json({ user: { id, email, name, role }, siteUrl: env.SITE_URL || '' });
}

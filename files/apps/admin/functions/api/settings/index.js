import { isSafeUrl } from '@5rsuites/blocks';
import { SETTINGS, loadSettings } from '@5rsuites/server/settings';
import { published } from '../../lib/content.js';
import { HttpError, cleanString, json, readJson, requireOwner } from '../../lib/http.js';

// Site settings (contact details, links, social media, default share image). Anyone signed in
// can read them (the page editor shows the default share image); only the owner can change them.
export async function onRequestGet({ env }) {
  return json({ settings: await loadSettings(env.DB, env), fields: SETTINGS.map(({ env: _e, ...f }) => f) });
}

export async function onRequestPut({ request, env, data }) {
  requireOwner(data.user);
  const body = await readJson(request);
  const writes = [];
  for (const s of SETTINGS) {
    if (!(s.key in body)) continue;
    let value;
    if (s.kind === 'image') {
      const id = body[s.key] == null || body[s.key] === '' ? null : Number(body[s.key]);
      if (id !== null) {
        if (!Number.isInteger(id) || id <= 0) throw new HttpError(400, `${s.label} is not a valid image.`);
        if (!(await env.DB.prepare('SELECT 1 FROM media WHERE id = ?').bind(id).first())) throw new HttpError(400, `${s.label}: that image no longer exists.`);
      }
      value = id === null ? '' : String(id);
    } else {
      value = cleanString(body[s.key], { max: s.max, label: s.label });
      if (value && s.kind === 'url' && !isSafeUrl(value)) throw new HttpError(400, `${s.label} must be a full https:// link or a site path like /privacy-policy.`);
      if (value && s.kind === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) throw new HttpError(400, `${s.label} doesn’t look like an email address.`);
    }
    writes.push(
      env.DB.prepare(
        `INSERT INTO settings (key, value, updated_at, updated_by) VALUES (?, ?, datetime('now'), ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at, updated_by = excluded.updated_by`,
      ).bind(s.key, value, data.user.id),
    );
  }
  if (writes.length) await env.DB.batch(writes);
  // Contact details and links appear on every page.
  return published(env, ['all'], { settings: await loadSettings(env.DB, env) });
}

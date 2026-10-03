import { published } from '../../lib/content.js';
import { mediaUsage } from '../../lib/media.js';
import { HttpError, cleanString, intParam, json, readJson } from '../../lib/http.js';

export async function onRequestPatch({ request, env, params }) {
  const id = intParam(params.id);
  const body = await readJson(request);
  const alt = cleanString(body.alt, { max: 300, label: 'Alt text' });
  const res = await env.DB.prepare('UPDATE media SET alt = ? WHERE id = ?').bind(alt, id).run();
  if (!res.meta.changes) throw new HttpError(404, 'Image not found.');
  return published(env, ['all'], { ok: true });
}

export async function onRequestDelete({ env, params }) {
  const id = intParam(params.id);
  const row = await env.DB.prepare('SELECT r2_key FROM media WHERE id = ?').bind(id).first();
  if (!row) throw new HttpError(404, 'Image not found.');

  const usage = await mediaUsage(env.DB, id);
  if (usage.pages.length || usage.units || usage.siteDefault) {
    const where = [...usage.pages.map((p) => `“${p.title}”`), usage.units ? `${usage.units} unit(s)` : null, usage.siteDefault ? 'Settings (default share image)' : null].filter(Boolean);
    throw new HttpError(409, `This image is still used on ${where.join(', ')}. Remove it there first.`);
  }

  await env.DB.prepare('DELETE FROM media WHERE id = ?').bind(id).run();
  await env.BUCKET.delete(row.r2_key);
  return json({ ok: true });
}

import { loadPage, purgeSite, snapshotStatements } from '../../../lib/content.js';
import { HttpError, cleanSlug, cleanString, intParam, json, readJson, requireOwner } from '../../../lib/http.js';

export async function onRequestGet({ env, params }) {
  const page = await loadPage(env.DB, intParam(params.id));
  if (!page) throw new HttpError(404, 'Page not found.');
  return json({ page });
}

// Staff may edit title and meta description. Slug and navigation are owner-only.
export async function onRequestPatch({ request, env, params, data }) {
  const db = env.DB;
  const id = intParam(params.id);
  const page = await db.prepare('SELECT * FROM pages WHERE id = ?').bind(id).first();
  if (!page) throw new HttpError(404, 'Page not found.');
  const body = await readJson(request);

  const next = {
    title: body.title === undefined ? page.title : cleanString(body.title, { max: 120, required: true, label: 'Title' }),
    meta_description:
      body.meta_description === undefined
        ? page.meta_description
        : cleanString(body.meta_description, { max: 300, label: 'Meta description' }),
    slug: body.slug === undefined ? page.slug : cleanSlug(body.slug),
    show_in_nav: body.show_in_nav === undefined ? page.show_in_nav : body.show_in_nav ? 1 : 0,
    nav_order: body.nav_order === undefined ? page.nav_order : Number(body.nav_order) | 0,
  };

  const structural = next.slug !== page.slug || next.show_in_nav !== page.show_in_nav || next.nav_order !== page.nav_order;
  if (structural) requireOwner(data.user);
  if (page.slug === 'home' && next.slug !== 'home') throw new HttpError(400, 'The home page slug can’t be changed.');

  await db.batch([
    db
      .prepare('UPDATE pages SET title = ?, meta_description = ?, slug = ?, show_in_nav = ?, nav_order = ? WHERE id = ?')
      .bind(next.title, next.meta_description, next.slug, next.show_in_nav, next.nav_order, id),
    ...snapshotStatements(db, id, data.user.id, 'Page settings updated'),
  ]);

  // Titles and slugs appear in the nav on every page.
  const purge = await purgeSite(env, ['all']);
  return json({ page: await loadPage(db, id), ...purge });
}

// Owner only. The home page can't be deleted.
export async function onRequestDelete({ env, params, data }) {
  requireOwner(data.user);
  const id = intParam(params.id);
  const page = await env.DB.prepare('SELECT slug FROM pages WHERE id = ?').bind(id).first();
  if (!page) throw new HttpError(404, 'Page not found.');
  if (page.slug === 'home') throw new HttpError(400, 'The home page can’t be deleted.');
  await env.DB.prepare('DELETE FROM pages WHERE id = ?').bind(id).run();
  const purge = await purgeSite(env, ['all']);
  return json({ ok: true, ...purge });
}

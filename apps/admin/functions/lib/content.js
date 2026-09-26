// Page revisions and public-site cache purging.

export const MAX_REVISIONS = 20;

// Snapshot the page's *current* state (as of the end of the batch it runs in).
// Built entirely in SQL so it can run inside the same atomic db.batch() as the edit.
export function snapshotStatements(db, pageId, userId, note) {
  return [
    db
      .prepare(
        `INSERT INTO page_revisions (page_id, snapshot, note, created_by)
         SELECT p.id,
                json_object(
                  'page', json_object('title', p.title, 'slug', p.slug, 'meta_description', p.meta_description),
                  'sections', (SELECT json_group_array(json_object('type', s.type, 'data', json(s.data)))
                                 FROM (SELECT type, data FROM sections WHERE page_id = p.id ORDER BY position) s)
                ),
                ?, ?
           FROM pages p WHERE p.id = ?`,
      )
      .bind(note.slice(0, 200), userId, pageId),
    db
      .prepare(
        `DELETE FROM page_revisions
          WHERE page_id = ? AND id NOT IN (
            SELECT id FROM page_revisions WHERE page_id = ? ORDER BY id DESC LIMIT ${MAX_REVISIONS})`,
      )
      .bind(pageId, pageId),
    db.prepare(`UPDATE pages SET updated_at = datetime('now'), updated_by = ? WHERE id = ?`).bind(userId, pageId),
  ];
}

// Cache tags set by the public site on every HTML response (see apps/site/src/lib/cache.js):
//   all          every page (nav/footer appear everywhere)
//   page-<id>    one page
//   faq, units   pages containing a faq_list / unit_grid block
export const pageTag = (id) => `page-${id}`;

// Ask the public site to purge its edge cache for these tags. The save has already
// succeeded, so a purge failure is reported back to the editor rather than thrown.
export async function purgeSite(env, tags) {
  if (!env.SITE_URL || !env.PURGE_SECRET) {
    console.warn('[purge] SITE_URL or PURGE_SECRET not set; skipping purge', tags);
    return { purged: false, purgeError: 'Cache purge is not configured.' };
  }
  try {
    const res = await fetch(new URL('/api/internal/purge', env.SITE_URL), {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.PURGE_SECRET}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ tags }),
    });
    if (!res.ok) return { purged: false, purgeError: `Purge failed (${res.status}).` };
    return { purged: true };
  } catch (err) {
    return { purged: false, purgeError: `Purge failed: ${err?.message || err}` };
  }
}

export async function loadPage(db, pageId) {
  const page = await db.prepare('SELECT * FROM pages WHERE id = ?').bind(pageId).first();
  if (!page) return null;
  const { results } = await db
    .prepare('SELECT id, position, type, data, updated_at FROM sections WHERE page_id = ? ORDER BY position')
    .bind(pageId)
    .all();
  page.sections = results.map((s) => ({ ...s, data: JSON.parse(s.data) }));
  return page;
}

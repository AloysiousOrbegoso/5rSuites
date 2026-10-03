import { publishedPage, restorableSections, snapshotStatements } from '../../../../../lib/content.js';
import { HttpError, intParam } from '../../../../../lib/http.js';

// Restoring never deletes history: it writes the old content back and records that as a
// brand-new revision. Slug and navigation are not restored (those are owner-only settings).
// If any saved section no longer passes validation the restore is refused outright: a partial
// restore would silently drop content, and writing it as-is would bypass the validator.
export async function onRequestPost({ env, params, data }) {
  const db = env.DB;
  const pageId = intParam(params.id);
  const revisionId = intParam(params.revisionId, 'revision id');
  const row = await db.prepare('SELECT snapshot, created_at FROM page_revisions WHERE id = ? AND page_id = ?').bind(revisionId, pageId).first();
  if (!row) throw new HttpError(404, 'Revision not found.');

  const snapshot = JSON.parse(row.snapshot);
  const { sections, problems } = restorableSections(snapshot);
  if (problems.length) {
    throw new HttpError(422, `This version can’t be restored as is. ${problems.join(' ')}`);
  }

  await db.batch([
    db.prepare('DELETE FROM sections WHERE page_id = ?').bind(pageId),
    ...sections.map((s, position) =>
      db
        .prepare('INSERT INTO sections (page_id, position, type, data, updated_by) VALUES (?, ?, ?, ?, ?)')
        .bind(pageId, position, s.type, JSON.stringify(s.data), data.user.id),
    ),
    db
      .prepare('UPDATE pages SET title = ?, meta_description = ? WHERE id = ?')
      .bind(snapshot.page.title, snapshot.page.meta_description ?? '', pageId),
    ...snapshotStatements(db, pageId, data.user.id, `Restored version from ${row.created_at} UTC`),
  ]);

  // Title may have changed, and it appears in the nav everywhere.
  return publishedPage(env, pageId, ['all']);
}

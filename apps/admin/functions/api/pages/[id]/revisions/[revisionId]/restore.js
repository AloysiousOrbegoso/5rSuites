import { BLOCKS, validateSection } from '@5rsuites/blocks';
import { loadPage, pageTag, purgeSite, snapshotStatements } from '../../../../../lib/content.js';
import { HttpError, intParam, json } from '../../../../../lib/http.js';

// Restoring never deletes history: it writes the old content back and records that as a
// brand-new revision. Slug and navigation are not restored (those are owner-only settings).
export async function onRequestPost({ env, params, data }) {
  const db = env.DB;
  const pageId = intParam(params.id);
  const revisionId = intParam(params.revisionId, 'revision id');
  const row = await db.prepare('SELECT snapshot, created_at FROM page_revisions WHERE id = ? AND page_id = ?').bind(revisionId, pageId).first();
  if (!row) throw new HttpError(404, 'Revision not found.');

  const snapshot = JSON.parse(row.snapshot);
  // Skip anything that no longer validates (e.g. a block type retired since the snapshot).
  const sections = snapshot.sections.filter((s) => BLOCKS[s.type]).map((s) => {
    try {
      return { type: s.type, data: validateSection(s.type, s.data) };
    } catch {
      return { type: s.type, data: s.data };
    }
  });

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
  const purge = await purgeSite(env, ['all']);
  return json({ page: await loadPage(db, pageId), ...purge });
}

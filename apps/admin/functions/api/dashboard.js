import { json } from '../lib/http.js';

// Summary numbers and recent activity for the admin home screen.
export async function onRequestGet({ env, data }) {
  const db = env.DB;
  const [subs, pages, units, users, edits, recentSubs] = await db.batch([
    db.prepare(`SELECT form_type, COUNT(*) AS n FROM form_submissions WHERE status = 'new' GROUP BY form_type`),
    db.prepare(
      `SELECT COUNT(*) AS n, MAX(p.updated_at) AS last_edit,
              (SELECT u.name FROM pages p2 LEFT JOIN users u ON u.id = p2.updated_by ORDER BY p2.updated_at DESC LIMIT 1) AS last_editor
         FROM pages p`,
    ),
    db.prepare(`SELECT COUNT(*) AS n, SUM(is_active) AS active FROM units`),
    db.prepare(`SELECT role, COUNT(*) AS n FROM users GROUP BY role`),
    db.prepare(
      `SELECT r.id, r.note, r.created_at, p.id AS page_id, p.title AS page_title, u.name AS user_name, u.email AS user_email
         FROM page_revisions r JOIN pages p ON p.id = r.page_id LEFT JOIN users u ON u.id = r.created_by
        ORDER BY r.id DESC LIMIT 8`,
    ),
    db.prepare(`SELECT id, form_type, name, email, created_at FROM form_submissions ORDER BY id DESC LIMIT 8`),
  ]);

  const activity = [
    ...edits.results.map((r) => ({
      kind: 'edit',
      at: r.created_at,
      who: r.user_name || r.user_email || 'Someone',
      what: r.page_title,
      detail: r.note,
      link: `/pages/${r.page_id}`,
    })),
    ...recentSubs.results.map((s) => ({
      kind: 'submission',
      at: s.created_at,
      who: 'New submission',
      what: '',
      detail: `${{ contact: 'Contact', register_property: 'Register Property', careers: 'Careers' }[s.form_type]} form · ${s.name || s.email}`,
      link: `/submissions/${s.id}`,
    })),
  ]
    .sort((a, b) => (a.at < b.at ? 1 : -1))
    .slice(0, 8);

  const roleCounts = Object.fromEntries(users.results.map((r) => [r.role, r.n]));
  return json({
    unread: Object.fromEntries(subs.results.map((r) => [r.form_type, r.n])),
    pages: { count: pages.results[0].n, lastEdit: pages.results[0].last_edit, lastEditor: pages.results[0].last_editor },
    units: { count: units.results[0].n, active: units.results[0].active ?? 0 },
    // Staff counts are only shown to owners.
    users: data.user.role === 'owner' ? { owner: roleCounts.owner ?? 0, staff: roleCounts.staff ?? 0 } : null,
    activity,
  });
}

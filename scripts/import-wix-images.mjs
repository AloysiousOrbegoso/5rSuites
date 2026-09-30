#!/usr/bin/env node
// Carries the old Wix site's photos, content and layout settings over into the CMS, per
// scripts/wix-import/map.json: uploads the photos to the media library and places them,
// sets section options (heading sizes, banner heights, card lists...) to match Wix, adds
// the photo collages, replaces the placeholder FAQ with the Wix questions and answers, and
// creates the Privacy Policy / Terms pages the footer links to. Run the migrations first
// (`npm run db:migrate:local`, or :remote) so the database knows every section type.
//
//   npm run import-wix-images                 # local database + storage (.wrangler/state)
//   npm run import-wix-images -- --remote     # production D1 + R2
//
// Sections are matched by page, block type and heading (case-insensitive), so a section that
// was renamed or deleted in the admin is skipped and reported rather than guessed at. Each
// touched page gets a "Before Wix import" revision first, so the change can be undone from
// the admin's page history. Safe to re-run.
//
// For --remote, set PURGE_SECRET (same value as the site's) to purge the public site's cache
// afterwards; otherwise the changes appear once each page's cache is next purged.

import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { purgeSite, snapshotStatements } from '../apps/admin/functions/lib/content.js';

const remote = process.argv.includes('--remote');
const importDir = fileURLToPath(new URL('./wix-import/', import.meta.url));
const adminDir = fileURLToPath(new URL('../apps/admin/', import.meta.url));
const { media, placements, faq = [], pages: newPages = [] } = JSON.parse(readFileSync(join(importDir, 'map.json'), 'utf8'));
const BUCKET = '5rsuites-media';
const where = remote ? ['--remote'] : ['--local', '--persist-to', '../../.wrangler/state'];
const keyOf = (file) => `media/wix/${file}`;
const typeOf = (file) => (file.endsWith('.png') ? 'image/png' : 'image/jpeg');

// npx is npx.cmd on Windows, which needs a shell, and the shell splits arguments on spaces,
// so quote anything that isn't a plain word there.
const win = process.platform === 'win32';
const arg = (a) => (win && /[^\w\-.:=/\\]/.test(a) ? `"${a.replace(/"/g, '""')}"` : a);

function wrangler(args, opts = {}) {
  return execFileSync('npx', ['wrangler', ...args].map(arg), {
    cwd: adminDir,
    stdio: opts.capture ? ['ignore', 'pipe', 'inherit'] : 'inherit',
    shell: win,
    encoding: 'utf8',
  });
}

function runSql(sql, opts) {
  const dir = mkdtempSync(join(tmpdir(), '5r-wix-'));
  const file = join(dir, 'import.sql');
  writeFileSync(file, sql);
  try {
    return wrangler(['d1', 'execute', '5rsuites', ...where, `--file=${file}`, ...(opts?.json ? ['--json'] : [])], { capture: opts?.json });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

// ---- SQL building. Everything comes from map.json, but quote it properly anyway.
const q = (v) => (v === null || v === undefined ? 'NULL' : typeof v === 'number' ? String(v) : `'${String(v).replace(/'/g, "''")}'`);
const mediaId = (file) => `(SELECT id FROM media WHERE r2_key = ${q(keyOf(file))})`;
const pageId = (slug) => `(SELECT id FROM pages WHERE slug = ${q(slug)})`;
// A JSON value as a SQL expression; {"$image": "file.jpg"} becomes that photo's media id.
function sqlJson(v) {
  if (Array.isArray(v)) return `json_array(${v.map(sqlJson).join(', ')})`;
  if (v && typeof v === 'object') {
    if (v.$image) return mediaId(v.$image);
    return `json_object(${Object.entries(v).map(([k, x]) => `${q(k)}, ${sqlJson(x)}`).join(', ')})`;
  }
  if (typeof v === 'boolean') return v ? 'json(\'true\')' : 'json(\'false\')';
  return q(v);
}
const byHeading = (page, type, heading) =>
  `page_id = ${pageId(page)} AND type = ${q(type)} AND lower(json_extract(data, '$.heading')) = lower(${q(heading)})`;
// Sections without a heading to go by (inserted collages, forms, a page's only quote) are the
// page's first section of that type.
const firstOfType = (page, type) => `id = (SELECT id FROM sections WHERE page_id = ${pageId(page)} AND type = ${q(type)} ORDER BY position LIMIT 1)`;
const match = (p) => (p.insert_after || p.heading == null ? firstOfType(p.page, p.type) : byHeading(p.page, p.type, p.heading));

// Reuse the admin's revision SQL; it's written for D1 prepared statements, so inline the binds.
function snapshotSql(slug, note) {
  const fakeDb = { prepare: (sql) => ({ bind: (...args) => ({ sql, args }) }) };
  return snapshotStatements(fakeDb, '__PAGE__', null, note).map(({ sql, args }) => {
    let i = 0;
    return sql.replace(/\?/g, () => (args[i] === '__PAGE__' ? (i++, pageId(slug)) : q(args[i++]))) + ';';
  });
}

function placementSql(p) {
  const set = (expr) => `UPDATE sections SET data = ${expr}, updated_at = datetime('now') WHERE ${match(p)};`;
  const out = [];
  if (p.insert_after) {
    // Add the section once, right after its anchor, shifting the sections below it down.
    const a = p.insert_after;
    const anchor = `(SELECT position FROM sections WHERE ${byHeading(p.page, a.type, a.heading)} LIMIT 1)`;
    const absent = `NOT EXISTS (SELECT 1 FROM sections WHERE page_id = ${pageId(p.page)} AND type = ${q(p.type)})`;
    out.push(
      `UPDATE sections SET position = position + 1 WHERE page_id = ${pageId(p.page)} AND position > ${anchor} AND ${absent};`,
      `INSERT INTO sections (page_id, position, type, data) SELECT ${pageId(p.page)}, ${anchor} + 1, ${q(p.type)}, '{}' WHERE ${anchor} IS NOT NULL AND ${absent};`,
    );
  }
  // Other fields first; a "heading" change must come last so the photo updates below still
  // find the section by its current heading (matching is case-insensitive either way).
  const entries = Object.entries(p.set || {}).sort(([a], [b]) => (a === 'heading') - (b === 'heading'));
  const fields = entries.map(([k, v]) => set(`json_set(data, ${q(`$.${k}`)}, ${sqlJson(v)})`));
  const heading = entries.length && entries.at(-1)[0] === 'heading' ? fields.pop() : null;
  out.push(...fields);
  if (p.image) out.push(set(`json_set(data, '$.image', ${mediaId(p.image)})`));
  if (p.photos) out.push(set(`json_set(data, '$.photos', ${sqlJson(p.photos.map((f) => ({ image: { $image: f } })))})`));
  if (p.gallery) {
    const alt = (file) => media.find((m) => m.file === file)?.alt || '';
    out.push(set(`json_set(data, '$.images', ${sqlJson(p.gallery.map((f) => ({ image: { $image: f }, caption: alt(f), link: '' })))})`));
  }
  if (heading) out.push(heading);
  return out;
}

// FAQ: drop the seeded "Answer coming soon" placeholders and add the Wix questions that
// aren't there yet (matched case-insensitively, so edited answers are left alone).
function faqSql() {
  if (!faq.length) return [];
  return [
    `DELETE FROM faq_items WHERE answer LIKE 'Answer coming soon%';`,
    ...faq.map((f, i) => `INSERT INTO faq_items (question, answer, category, position)
      SELECT ${q(f.question)}, ${q(f.answer)}, ${q(f.category)}, ${i}
      WHERE NOT EXISTS (SELECT 1 FROM faq_items WHERE lower(question) = lower(${q(f.question)}));`),
  ];
}

// Pages that don't exist yet (e.g. Privacy Policy). Hidden from the nav; the footer links them.
function pagesSql() {
  return newPages.flatMap((pg) => [
    `INSERT INTO pages (slug, title, meta_description, show_in_nav, nav_order)
      SELECT ${q(pg.slug)}, ${q(pg.title)}, ${q(pg.meta_description || '')}, 0, 100
      WHERE NOT EXISTS (SELECT 1 FROM pages WHERE slug = ${q(pg.slug)});`,
    ...pg.sections.map((s, i) => `INSERT INTO sections (page_id, position, type, data)
      SELECT ${pageId(pg.slug)}, ${i}, ${q(s.type)}, ${sqlJson(s.data)}
      WHERE NOT EXISTS (SELECT 1 FROM sections WHERE page_id = ${pageId(pg.slug)} AND position = ${i});`),
  ]);
}

// ---- 1. Upload the photos.
console.log(`Uploading ${media.length} images to ${remote ? 'production' : 'local'} storage...`);
for (const m of media) {
  wrangler(['r2', 'object', 'put', `${BUCKET}/${keyOf(m.file)}`, `--file=${join(importDir, 'images', m.file)}`,
    `--content-type=${typeOf(m.file)}`, '--cache-control=public,max-age=31536000,immutable', ...where]);
}

// ---- 2. Media rows, pages, sections and FAQ, with a revision on each side of the change.
const touched = [...new Set(placements.map((p) => p.page))];
const sql = [
  ...media.map((m) => {
    const size = statSync(join(importDir, 'images', m.file)).size;
    return `INSERT INTO media (r2_key, filename, content_type, size, width, height, alt)
      VALUES (${[keyOf(m.file), m.file, typeOf(m.file), size, m.width, m.height, m.alt].map(q).join(', ')})
      ON CONFLICT (r2_key) DO NOTHING;`;
  }),
  ...pagesSql(),
  ...touched.flatMap((slug) => snapshotSql(slug, 'Before Wix import')),
  ...placements.flatMap(placementSql),
  ...touched.flatMap((slug) => snapshotSql(slug, 'Wix import')),
  ...faqSql(),
].join('\n');
console.log('\nUpdating the database...');
runSql(sql);

// ---- 3. Report what landed and what was skipped.
const checks = placements.flatMap((p) => {
  const label = p.insert_after ? `${p.page} / photo collage after "${p.insert_after.heading}"` : `${p.page} / ${p.heading ?? p.type}`;
  const at = { ...p, heading: p.set?.heading ?? p.heading };
  const out = Object.entries(p.set || {}).map(([k, v]) => ({
    label: `${label} / ${k}${Array.isArray(v) ? ` (${v.length})` : typeof v === 'string' && v.length < 40 ? ` = ${v}` : ''}`,
    p: at,
    expr: Array.isArray(v) ? `json_array_length(data, ${q(`$.${k}`)}) = ${v.length}` : `json_extract(data, ${q(`$.${k}`)}) = ${q(v)}`,
  }));
  if (p.image) out.push({ label: `${label} / photo`, p: at, expr: `json_extract(data, '$.image') IS NOT NULL` });
  if (p.photos) out.push({ label: `${label} / photos`, p: at, expr: `json_array_length(data, '$.photos') = ${p.photos.length}` });
  if (p.gallery) out.push({ label: `${label} / logos`, p: at, expr: `json_array_length(data, '$.images') = ${p.gallery.length}` });
  return out;
});
const report = `SELECT json_array(${[
  ...checks.map((c) => `(SELECT ${c.expr} FROM sections WHERE ${match(c.p)})`),
  `(SELECT count(*) FROM faq_items)`,
  ...newPages.map((pg) => `(SELECT count(*) FROM sections WHERE page_id = ${pageId(pg.slug)})`),
].join(', ')}) AS v;`;
const values = JSON.parse(JSON.parse(runSql(report, { json: true })).at(-1).results[0].v);
let skipped = 0;
console.log('');
checks.forEach((c, i) => {
  const ok = values[i] === 1;
  if (!ok) skipped++;
  console.log(`${ok ? '  ok  ' : '  SKIP'} ${c.label}`);
});
if (faq.length) console.log(`  ok   FAQ: ${values[checks.length]} questions`);
newPages.forEach((pg, i) => console.log(`  ok   page /${pg.slug}: ${values[checks.length + 1 + i]} sections`));
if (skipped) console.log(`\n${skipped} item(s) skipped: the section wasn't found (renamed, retyped or deleted in the admin). Set those in the admin instead.`);

// ---- 4. Production cache.
if (remote) {
  const { purged, purgeError } = await purgeSite({ SITE_URL: 'https://www.5rsuites.com', PURGE_SECRET: process.env.PURGE_SECRET }, ['all']);
  console.log(purged ? '\nPublic site cache purged.' : `\nCache not purged (${purgeError}) — set PURGE_SECRET and re-run to purge it.`);
}
console.log('\nDone.');

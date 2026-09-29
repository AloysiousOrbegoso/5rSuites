#!/usr/bin/env node
// Imports the photos carried over from the old Wix site (scripts/wix-import/) into the media
// library and places each one in its section, per scripts/wix-import/map.json. Also applies
// the few layout settings (photo side, map) where the starter content differed from Wix, and
// adds the photo collages Wix has on Home and About. Run `npm run db:migrate:local` (or
// :remote) first so the database knows the photo_collage section type.
//
//   npm run import-wix-images                 # local database + storage (.wrangler/state)
//   npm run import-wix-images -- --remote     # production D1 + R2
//
// Sections are matched by page, block type and heading, so a section that was renamed or
// deleted in the admin is skipped (and reported) rather than guessed at. Each touched page
// gets a "Before Wix image import" revision first, so the change can be undone from the
// admin's page history. Safe to re-run.
//
// For --remote, set PURGE_SECRET (same value as the site's) to purge the public site's cache
// afterwards; otherwise the new photos appear once each page's cache is next purged.

import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { purgeSite, snapshotStatements } from '../apps/admin/functions/lib/content.js';

const remote = process.argv.includes('--remote');
const importDir = fileURLToPath(new URL('./wix-import/', import.meta.url));
const adminDir = fileURLToPath(new URL('../apps/admin/', import.meta.url));
const { media, placements } = JSON.parse(readFileSync(join(importDir, 'map.json'), 'utf8'));
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

// SQL literal. Everything below is built from map.json, but quote it properly anyway.
const q = (v) => (v === null || v === undefined ? 'NULL' : typeof v === 'number' ? String(v) : `'${String(v).replace(/'/g, "''")}'`);
const mediaId = (file) => `(SELECT id FROM media WHERE r2_key = ${q(keyOf(file))})`;
const pageId = (slug) => `(SELECT id FROM pages WHERE slug = ${q(slug)})`;
const byHeading = (page, type, heading) => `page_id = ${pageId(page)} AND type = ${q(type)} AND json_extract(data, '$.heading') = ${q(heading)}`;
// Sections added by the import (insert_after) have no heading; they're the page's first of their type.
const match = (p) => (p.insert_after
  ? `id = (SELECT id FROM sections WHERE page_id = ${pageId(p.page)} AND type = ${q(p.type)} ORDER BY position LIMIT 1)`
  : byHeading(p.page, p.type, p.heading));

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
  const fields = Object.entries(p.set || {}).map(([k, v]) => set(`json_set(data, ${q(`$.${k}`)}, ${q(v)})`));
  if (p.insert_after) {
    // Add the section once, right after its anchor, shifting the sections below it down.
    const a = p.insert_after;
    const anchor = `(SELECT position FROM sections WHERE ${byHeading(p.page, a.type, a.heading)} LIMIT 1)`;
    const absent = `NOT EXISTS (SELECT 1 FROM sections WHERE page_id = ${pageId(p.page)} AND type = ${q(p.type)})`;
    const photos = p.photos.map((f) => `json_object('image', ${mediaId(f)})`).join(', ');
    return [
      `UPDATE sections SET position = position + 1 WHERE page_id = ${pageId(p.page)} AND position > ${anchor} AND ${absent};`,
      `INSERT INTO sections (page_id, position, type, data) SELECT ${pageId(p.page)}, ${anchor} + 1, ${q(p.type)}, '{}' WHERE ${anchor} IS NOT NULL AND ${absent};`,
      ...fields,
      set(`json_set(data, '$.photos', json_array(${photos}))`),
    ];
  }
  if (p.image) return [...fields, set(`json_set(data, '$.image', ${mediaId(p.image)})`)];
  if (!p.gallery && !p.items) return fields;
  if (p.gallery) {
    const alt = (file) => media.find((m) => m.file === file)?.alt || '';
    const items = p.gallery.map((f) => `json_object('image', ${mediaId(f)}, 'caption', ${q(alt(f))}, 'link', '')`);
    return [set(`json_set(data, '$.images', json_array(${items.join(', ')}))`)];
  }
  // Card icons: find each card by its title, wherever it now sits in the list.
  return Object.entries(p.items).map(([title, file]) => {
    const idx = `(SELECT key FROM json_each(sections.data, '$.items') WHERE json_extract(value, '$.title') = ${q(title)} LIMIT 1)`;
    return `UPDATE sections SET data = json_set(data, '$.items[' || ${idx} || '].image', ${mediaId(file)}), updated_at = datetime('now')
      WHERE ${match(p)} AND ${idx} IS NOT NULL;`;
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

// 1. Upload the files.
console.log(`Uploading ${media.length} images to ${remote ? 'production' : 'local'} storage...`);
for (const m of media) {
  wrangler(['r2', 'object', 'put', `${BUCKET}/${keyOf(m.file)}`, `--file=${join(importDir, 'images', m.file)}`,
    `--content-type=${typeOf(m.file)}`, '--cache-control=public,max-age=31536000,immutable', ...where]);
}

// 2. Media rows, then place them, with a revision on each side of the change.
const pages = [...new Set(placements.map((p) => p.page))];
const sql = [
  ...media.map((m) => {
    const size = statSync(join(importDir, 'images', m.file)).size;
    return `INSERT INTO media (r2_key, filename, content_type, size, width, height, alt)
      VALUES (${[keyOf(m.file), m.file, typeOf(m.file), size, m.width, m.height, m.alt].map(q).join(', ')})
      ON CONFLICT (r2_key) DO NOTHING;`;
  }),
  ...pages.flatMap((slug) => snapshotSql(slug, 'Before Wix image import')),
  ...placements.flatMap(placementSql),
  ...pages.flatMap((slug) => snapshotSql(slug, 'Wix image import')),
].join('\n');
console.log('\nUpdating the database...');
runSql(sql);

// 3. Report what landed and what was skipped.
const checks = placements.flatMap((p) => {
  const label = p.insert_after ? `${p.page} / photo collage after "${p.insert_after.heading}"` : `${p.page} / ${p.heading || p.type}`;
  if (p.items) return Object.keys(p.items).map((t) => ({ label: `${label} / ${t} icon`, p, path: `(SELECT json_extract(value, '$.image') FROM json_each(data, '$.items') WHERE json_extract(value, '$.title') = ${q(t)})` }));
  const fields = Object.entries(p.set || {}).map(([k, v]) => ({ label: `${label} / ${k} = ${v}`, p, path: `json_extract(data, ${q(`$.${k}`)}) = ${q(v)}` }));
  if (!p.image && !p.gallery && !p.photos) return fields;
  const path = p.photos ? `json_array_length(data, '$.photos')` : p.gallery ? `json_array_length(data, '$.images')` : `json_extract(data, '$.image')`;
  return [...fields, { label, p, path }];
});
const report = `SELECT json_array(${checks.map((c) => `(SELECT ${c.path} FROM sections WHERE ${match(c.p)})`).join(', ')}) AS v;`;
const values = JSON.parse(JSON.parse(runSql(report, { json: true })).at(-1).results[0].v);
let skipped = 0;
console.log('');
checks.forEach((c, i) => {
  const ok = values[i] !== null && values[i] !== 0;
  if (!ok) skipped++;
  console.log(`${ok ? '  ok  ' : '  SKIP'} ${c.label}`);
});
if (skipped) console.log(`\n${skipped} placement(s) skipped: the section wasn't found (renamed, retyped or deleted in the admin). Pick those images in the admin instead.`);

// 4. Production cache.
if (remote) {
  const { purged, purgeError } = await purgeSite({ SITE_URL: 'https://www.5rsuites.com', PURGE_SECRET: process.env.PURGE_SECRET }, ['all']);
  console.log(purged ? '\nPublic site cache purged.' : `\nCache not purged (${purgeError}) — set PURGE_SECRET and re-run to purge it.`);
}
console.log('\nDone.');

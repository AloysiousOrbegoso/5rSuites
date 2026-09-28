#!/usr/bin/env node
// One-off migration helper: downloads every photo used on the old Wix site, at original
// resolution, and writes a manifest saying which page(s) each one appeared on and in what
// order. Run it on your own machine (it needs to reach www.5rsuites.com while Wix still
// serves it); no Wix login needed, it reads the public pages.
//
//   node scripts/wix-export-images.mjs                 # every page in the Wix sitemap
//   node scripts/wix-export-images.mjs https://www.5rsuites.com/about saved-page.html
//   node scripts/wix-export-images.mjs --list          # show what it found, download nothing
//   node scripts/wix-export-images.mjs --out some/dir  # default: wix-images/
//
// Output: <out>/<wix file id> for each photo, plus <out>/manifest.csv
// (file, first_page, order_on_page, alt, all_pages). Send the folder back to be imported.

import { mkdirSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const SITE = 'https://www.5rsuites.com';
const args = process.argv.slice(2);
const listOnly = args.includes('--list');
const outIdx = args.indexOf('--out');
const outDir = outIdx >= 0 ? args[outIdx + 1] : 'wix-images';
const sources = args.filter((a, i) => !a.startsWith('--') && (outIdx < 0 || i !== outIdx + 1));

// Wix serves resized copies as static.wixstatic.com/media/<id>/v1/fill/...; the bare
// /media/<id> URL is the original upload.
const MEDIA = /static\.wixstatic\.com\/media\/([A-Za-z0-9_~.-]+?\.(?:jpe?g|png|webp|gif|avif))/gi;

async function get(url) {
  const res = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0 (5R Suites migration)' } });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res;
}

async function pageUrls() {
  const urls = [];
  const index = await (await get(`${SITE}/sitemap.xml`)).text();
  const locs = (xml) => [...xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)].map((m) => m[1]);
  for (const loc of locs(index)) {
    if (!loc.endsWith('.xml')) urls.push(loc);
    else if (/pages?-sitemap/.test(loc)) urls.push(...locs(await (await get(loc)).text()));
  }
  return [...new Set(urls)];
}

// Pulls image ids out of a page in document order, with alt text where an <img> gives one.
export function extractImages(html) {
  const text = html.replace(/\\u002F/gi, '/').replace(/\\\//g, '/');
  const found = new Map();
  const add = (id, alt = '') => {
    const prev = found.get(id);
    if (!prev) found.set(id, { id, alt });
    else if (!prev.alt && alt) prev.alt = alt;
  };
  // <img> tags first so their alt text is attached, then a sweep of everything else
  // (CSS backgrounds, JSON data), keeping first-seen order via the position in the page.
  const hits = [];
  for (const tag of text.matchAll(/<img\b[^>]*>/gi)) {
    const alt = (tag[0].match(/\balt="([^"]*)"/i) || [])[1] || '';
    for (const m of tag[0].matchAll(MEDIA)) hits.push({ pos: tag.index, id: m[1], alt });
  }
  for (const m of text.matchAll(MEDIA)) hits.push({ pos: m.index, id: m[1], alt: '' });
  hits.sort((a, b) => a.pos - b.pos).forEach((h) => add(h.id, decode(h.alt)));
  return [...found.values()];
}

const decode = (s) => s.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>');
const csv = (v) => `"${String(v).replace(/"/g, '""')}"`;

async function main() {
  const inputs = sources.length ? sources : await pageUrls();
  const images = new Map(); // id -> { id, alt, pages: [], firstPage, order }
  for (const src of inputs) {
    const html = /^https?:/.test(src) ? await (await get(src)).text() : readFileSync(src, 'utf8');
    const page = /^https?:/.test(src) ? new URL(src).pathname : src;
    const found = extractImages(html);
    console.log(`${page}: ${found.length} image(s)`);
    found.forEach((img, i) => {
      const entry = images.get(img.id) || { id: img.id, alt: img.alt, pages: [], firstPage: page, order: i + 1 };
      if (!entry.alt) entry.alt = img.alt;
      if (!entry.pages.includes(page)) entry.pages.push(page);
      images.set(img.id, entry);
    });
  }

  const rows = [...images.values()];
  if (listOnly) {
    for (const r of rows) console.log(`  ${r.firstPage} #${r.order}  ${r.id}  ${r.alt}`);
    console.log(`${rows.length} unique image(s). Nothing downloaded (--list).`);
    return;
  }

  mkdirSync(outDir, { recursive: true });
  let done = 0, failed = 0;
  const queue = [...rows];
  await Promise.all(Array.from({ length: 4 }, async () => {
    for (let r; (r = queue.shift()); ) {
      const file = join(outDir, r.id);
      if (existsSync(file)) { done++; continue; }
      try {
        const res = await get(`https://static.wixstatic.com/media/${r.id}`);
        writeFileSync(file, Buffer.from(await res.arrayBuffer()));
        done++;
      } catch (e) {
        failed++;
        console.error(`  failed: ${r.id} (${e.message})`);
      }
    }
  }));

  const manifest = ['file,first_page,order_on_page,alt,all_pages', ...rows.map((r) => [r.id, r.firstPage, r.order, r.alt, r.pages.join(' ')].map(csv).join(','))];
  writeFileSync(join(outDir, 'manifest.csv'), manifest.join('\n') + '\n');
  console.log(`\n${done} downloaded to ${outDir}/, ${failed} failed. Manifest: ${join(outDir, 'manifest.csv')}`);
}

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('wix-export-images.mjs')) {
  main().catch((e) => { console.error(e.message); process.exit(1); });
}

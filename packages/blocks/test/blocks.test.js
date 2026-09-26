import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BLOCK_TYPES, validateSection, defaultData, collectImageIds, ValidationError } from '../index.js';
import { renderMarkdown } from '../markdown.js';

test('block types match the schema CHECK constraint', async () => {
  const { readFile } = await import('node:fs/promises');
  const sql = await readFile(new URL('../../../migrations/0001_init.sql', import.meta.url), 'utf8');
  const check = sql.match(/type\s+IN \(([\s\S]*?)\)\)/)[1];
  const fromSql = [...check.matchAll(/'([a-z_]+)'/g)].map((m) => m[1]);
  assert.deepEqual([...fromSql].sort(), [...BLOCK_TYPES].sort());
});

test('default data validates for every non-required block', () => {
  for (const type of BLOCK_TYPES) {
    const data = defaultData(type);
    try {
      validateSection(type, data);
    } catch (e) {
      assert.ok(e instanceof ValidationError, `${type}: ${e.message}`);
    }
  }
});

test('unknown keys are dropped and strings trimmed', () => {
  const out = validateSection('quote', { quote: '  Great stay  ', evil: '<script>' });
  assert.equal(out.quote, 'Great stay');
  assert.equal('evil' in out, false);
});

test('unsafe urls are rejected', () => {
  assert.throws(() => validateSection('cta_banner', { heading: 'x', button_url: 'javascript:alert(1)' }), ValidationError);
  assert.throws(() => validateSection('cta_banner', { heading: 'x', button_url: '//evil.com' }), ValidationError);
  assert.doesNotThrow(() => validateSection('cta_banner', { heading: 'x', button_url: '/contact' }));
});

test('required fields and lists', () => {
  assert.throws(() => validateSection('hero', {}), /Heading is required/);
  assert.throws(() => validateSection('image_gallery', { images: [{ caption: 'no image' }] }), /Image is required/);
  const out = validateSection('image_gallery', { images: [{ image: '4' }] });
  assert.equal(out.images[0].image, 4);
  assert.deepEqual([...collectImageIds('image_gallery', out)], [4]);
});

test('markdown escapes html and blocks unsafe links', () => {
  const html = renderMarkdown('## Hi\n\n<b>x</b> **bold** [a](javascript:alert(1)) [b](/contact)\n\n- one\n- two');
  assert.match(html, /<h2>Hi<\/h2>/);
  assert.match(html, /&lt;b&gt;x&lt;\/b&gt;/);
  assert.match(html, /<strong>bold<\/strong>/);
  assert.doesNotMatch(html, /javascript:/);
  assert.match(html, /<a href="\/contact">b<\/a>/);
  assert.match(html, /<ul>\n<li>one<\/li>\n<li>two<\/li>\n<\/ul>/);
});

test('every image field is named "image" (the admin media-in-use check relies on it)', async () => {
  const { BLOCKS } = await import('../index.js');
  const walk = (fields) => fields.forEach((f) => {
    if (f.kind === 'image') assert.equal(f.name, 'image');
    if (f.kind === 'list') walk(f.fields);
  });
  Object.values(BLOCKS).forEach((b) => walk(b.fields));
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { published } from '../functions/lib/content.js';

test('published() merges the purge outcome into the response body', async () => {
  const realFetch = globalThis.fetch;
  let call;
  globalThis.fetch = async (url, init) => ((call = { url: String(url), init }), new Response('{}', { status: 200 }));
  try {
    const res = await published({ SITE_URL: 'https://site.test', PURGE_SECRET: 's' }, ['faq'], { ok: true }, { status: 201 });
    assert.equal(res.status, 201);
    assert.deepEqual(await res.json(), { ok: true, purged: true });
    assert.equal(call.url, 'https://site.test/api/internal/purge');
    assert.deepEqual(JSON.parse(call.init.body), { tags: ['faq'] });
  } finally {
    globalThis.fetch = realFetch;
  }
});

test('published() still answers when purging is not configured', async () => {
  const res = await published({}, ['all'], { id: 7 });
  const body = await res.json();
  assert.equal(body.id, 7);
  assert.equal(body.purged, false);
  assert.match(body.purgeError, /not configured/);
});

import { restorableSections } from '../functions/lib/content.js';

test('restorableSections validates and cleans saved sections', () => {
  const { sections, problems } = restorableSections({
    sections: [{ type: 'quote', data: { quote: '  Great stay  ', stale_key: 1 } }],
  });
  assert.deepEqual(problems, []);
  assert.equal(sections[0].data.quote, 'Great stay');
  assert.equal('stale_key' in sections[0].data, false);
});

test('restorableSections reports sections that no longer validate instead of passing them through', () => {
  const { sections, problems } = restorableSections({
    sections: [
      { type: 'quote', data: {} }, // required quote missing
      { type: 'retired_block', data: {} },
      { type: 'hero', data: { heading: 'Welcome' } },
    ],
  });
  assert.equal(sections.length, 1);
  assert.equal(sections[0].type, 'hero');
  assert.equal(problems.length, 2);
  assert.match(problems[0], /Section 1 \(Quote\).*required/);
  assert.match(problems[1], /Section 2 .*no longer exists/);
});

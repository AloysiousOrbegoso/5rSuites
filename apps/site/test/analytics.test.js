import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classifyDevice, classifySource, cleanPath, isBot, localDay, visitorId } from '../src/lib/analytics.js';

const site = 'www.5rsuites.com';

test('traffic sources', () => {
  assert.deepEqual(classifySource({ referrer: '', siteHost: site }), { entry: true, source: 'direct', referrer: '' });
  assert.equal(classifySource({ referrer: 'https://www.google.com/', siteHost: site }).source, 'search');
  assert.equal(classifySource({ referrer: 'https://duckduckgo.com/', siteHost: site }).source, 'search');
  assert.equal(classifySource({ referrer: 'https://l.facebook.com/l.php', siteHost: site }).source, 'social');
  assert.equal(classifySource({ referrer: 'https://t.co/abc', siteHost: site }).source, 'social');
  assert.deepEqual(classifySource({ referrer: 'https://www.apartments.com/x', siteHost: site }), { entry: true, source: 'referral', referrer: 'apartments.com' });
  // utm_source wins over the referrer
  assert.deepEqual(classifySource({ referrer: 'https://www.google.com/', search: '?utm_source=Newsletter', siteHost: site }), { entry: true, source: 'campaign', referrer: 'newsletter' });
});

test('moving between pages of the site is not a new visit', () => {
  assert.equal(classifySource({ referrer: 'https://www.5rsuites.com/about', siteHost: site }).entry, false);
  assert.equal(classifySource({ referrer: 'https://5rsuites.com/', siteHost: site }).entry, false);
});

test('devices, paths, bots', () => {
  assert.equal(classifyDevice(390), 'mobile');
  assert.equal(classifyDevice(800), 'tablet');
  assert.equal(classifyDevice(1440), 'desktop');
  assert.equal(classifyDevice(0, 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Mobile'), 'mobile');
  assert.equal(cleanPath('/about/?x=1#top'), '/about');
  assert.equal(cleanPath('/'), '/');
  assert.equal(cleanPath('//evil.com'), null);
  assert.equal(cleanPath('https://x.com/'), null);
  assert.equal(isBot('Mozilla/5.0 (compatible; Googlebot/2.1)'), true);
  assert.equal(isBot(''), true);
  assert.equal(isBot('Mozilla/5.0 (Windows NT 10.0) Chrome/130 Safari/537.36'), false);
});

test('visitor ids are stable within a day and change across days', async () => {
  const a = await visitorId('secret', '2026-09-30', '1.2.3.4', 'UA');
  assert.equal(a, await visitorId('secret', '2026-09-30', '1.2.3.4', 'UA'));
  assert.notEqual(a, await visitorId('secret', '2026-10-01', '1.2.3.4', 'UA'));
  assert.notEqual(a, await visitorId('secret', '2026-09-30', '1.2.3.5', 'UA'));
  assert.match(a, /^[0-9a-f]{20}$/);
});

test('local day uses the site time zone', () => {
  // 03:00 UTC on Oct 1 is still Sep 30 in Los Angeles.
  assert.equal(localDay(new Date('2026-10-01T03:00:00Z')), '2026-09-30');
});

test('any of the site hosts counts as internal (production, preview, local)', () => {
  const hosts = ['www.5rsuites.com', 'localhost'];
  assert.equal(classifySource({ referrer: 'http://localhost:8787/about', siteHosts: hosts }).entry, false);
  assert.equal(classifySource({ referrer: 'https://www.5rsuites.com/', siteHosts: hosts }).entry, false);
  assert.equal(classifySource({ referrer: 'https://www.google.com/', siteHosts: hosts }).source, 'search');
});

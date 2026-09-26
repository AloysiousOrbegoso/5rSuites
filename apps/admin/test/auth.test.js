import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PBKDF2_ITERATIONS, hashPassword, readSessionToken, sha256, validateNewPassword, verifyPassword } from '../functions/lib/auth.js';
import { cleanSlug } from '../functions/lib/http.js';

test('PBKDF2 hash round-trips and uses 100k iterations', async () => {
  const h = await hashPassword('correct horse battery');
  assert.match(h, new RegExp(`^pbkdf2_sha256\\$${PBKDF2_ITERATIONS}\\$`));
  assert.equal(PBKDF2_ITERATIONS, 100_000);
  assert.equal(await verifyPassword('correct horse battery', h), true);
  assert.equal(await verifyPassword('wrong', h), false);
  assert.equal(await verifyPassword('x', 'garbage'), false);
  assert.notEqual(await hashPassword('same'), await hashPassword('same')); // salted
});

test('password rules', () => {
  assert.ok(validateNewPassword('short'));
  assert.equal(validateNewPassword('long-enough-pw'), null);
});

test('session cookie parsing and token hashing', async () => {
  const req = new Request('https://a.test', { headers: { Cookie: 'a=1; __Host-5r_session=abc=def; b=2' } });
  assert.equal(readSessionToken(req), 'abc=def');
  assert.equal((await sha256('x')).length, 43);
});

test('slugs', () => {
  assert.equal(cleanSlug(' About-Us '), 'about-us');
  assert.throws(() => cleanSlug('api'));
  assert.throws(() => cleanSlug('-bad'));
  assert.throws(() => cleanSlug('a/b'));
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { submissionFilter } from '../functions/lib/submissions.js';

const f = (qs) => submissionFilter(new URLSearchParams(qs));

test('no filters = inbox (archived hidden)', () => {
  assert.deepEqual(f(''), { type: null, clause: "WHERE status != 'archived'", binds: [] });
});

test('type and status filters bind their values', () => {
  assert.deepEqual(f('type=careers&status=new'), { type: 'careers', clause: 'WHERE form_type = ? AND status = ?', binds: ['careers', 'new'] });
});

test('status=all shows everything; unknown values are ignored', () => {
  assert.deepEqual(f('status=all'), { type: null, clause: '', binds: [] });
  assert.equal(f('type=bogus').type, null);
  assert.equal(f('type=bogus').binds.length, 0);
});

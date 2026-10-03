import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FORM_TYPE_IDS } from '@5rsuites/blocks';
import { FORMS } from '../src/lib/form-specs.js';

test('every form type has a field spec, and every spec is a form type', () => {
  assert.deepEqual(Object.keys(FORMS).sort(), [...FORM_TYPE_IDS].sort());
});

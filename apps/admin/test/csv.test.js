import { test } from 'node:test';
import assert from 'node:assert/strict';
import { csvCell, toCsv } from '../functions/lib/csv.js';

test('csv quoting and formula protection', () => {
  assert.equal(csvCell('plain'), 'plain');
  assert.equal(csvCell('a, b'), '"a, b"');
  assert.equal(csvCell('say "hi"'), '"say ""hi"""');
  assert.equal(csvCell('line\nbreak'), '"line\nbreak"');
  assert.equal(csvCell('=HYPERLINK("x")'), `"'=HYPERLINK(""x"")"`);
  assert.equal(csvCell('+1 555'), "'+1 555");
  assert.equal(csvCell(null), '');
  assert.equal(csvCell(42), '42');
});

test('csv file has a BOM and CRLF rows', () => {
  assert.equal(toCsv([['a', 'b'], ['1', '2']]), '﻿a,b\r\n1,2\r\n');
});

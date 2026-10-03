import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pagesUsingImage } from '../functions/lib/media.js';

const row = (page_id, title, type, data) => ({ page_id, title, type, data: JSON.stringify(data) });

test('finds images in plain and nested block fields, whatever the key is called', () => {
  const rows = [
    row(1, 'Home', 'hero', { heading: 'Hi', image: 7 }),
    row(2, 'About', 'photo_collage', { photos: [{ image: 3 }, { image: 7 }] }), // nested list
    row(3, 'Stay', 'amenity_grid', { items: [{ icon: 'wifi', image: 7, label: 'x' }], image: null }),
    row(4, 'Other', 'hero', { image: 8 }),
  ];
  assert.deepEqual(pagesUsingImage(rows, 7).map((p) => p.id), [1, 2, 3]);
  assert.deepEqual(pagesUsingImage(rows, 99), []);
});

test('a page using an image twice is listed once', () => {
  const rows = [row(1, 'Home', 'hero', { image: 7 }), row(1, 'Home', 'cta_banner', { image: 7 })];
  assert.deepEqual(pagesUsingImage(rows, 7), [{ id: 1, title: 'Home' }]);
});

test('numbers that merely equal the id in non-image fields do not count', () => {
  const rows = [row(1, 'Home', 'faq_list', { heading: 'FAQ', limit: 7 })];
  assert.deepEqual(pagesUsingImage(rows, 7), []);
});

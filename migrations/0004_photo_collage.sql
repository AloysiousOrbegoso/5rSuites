-- Adds the photo_collage block type (the overlapping three-photo layout from the old site).
-- SQLite can't change a CHECK constraint in place, so the sections table is rebuilt.
-- Nothing references sections, so the copy is straightforward.

CREATE TABLE sections_new (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  page_id    INTEGER NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
  position   INTEGER NOT NULL,
  type       TEXT    NOT NULL CHECK (type IN (
               'hero', 'rich_text', 'image_gallery', 'photo_collage', 'traveler_grid', 'amenity_grid',
               'cta_banner', 'quote', 'contact_strip', 'faq_list', 'unit_grid', 'form')),
  data       TEXT    NOT NULL DEFAULT '{}' CHECK (json_valid(data)),
  created_at TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_by INTEGER REFERENCES users(id) ON DELETE SET NULL
);
INSERT INTO sections_new (id, page_id, position, type, data, created_at, updated_at, updated_by)
  SELECT id, page_id, position, type, data, created_at, updated_at, updated_by FROM sections;
DROP TABLE sections;
ALTER TABLE sections_new RENAME TO sections;
CREATE INDEX idx_sections_page ON sections(page_id, position);

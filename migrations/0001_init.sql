-- 5R Suites — initial schema. This file is the source of truth for the database.
-- Timestamps are ISO-8601 UTC strings (SQLite datetime('now') format).

PRAGMA foreign_keys = ON;

-- ---------------------------------------------------------------------------
-- Auth
-- ---------------------------------------------------------------------------

CREATE TABLE users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  email         TEXT    NOT NULL UNIQUE COLLATE NOCASE,
  name          TEXT    NOT NULL DEFAULT '',
  role          TEXT    NOT NULL CHECK (role IN ('owner', 'staff')),
  -- "pbkdf2_sha256$<iterations>$<salt b64>$<hash b64>". NULL until an invite is accepted.
  password_hash TEXT,
  created_at    TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT    NOT NULL DEFAULT (datetime('now')),
  last_login_at TEXT
);

-- The session id is the SHA-256 of the cookie token; the raw token is never stored.
CREATE TABLE sessions (
  id         TEXT    PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT    NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT    NOT NULL,
  ip         TEXT,
  user_agent TEXT
);
CREATE INDEX idx_sessions_user ON sessions(user_id);
CREATE INDEX idx_sessions_expires ON sessions(expires_at);

-- Single-use tokens for password resets and staff invites. Only the hash is stored.
CREATE TABLE password_resets (
  token_hash TEXT    PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  purpose    TEXT    NOT NULL DEFAULT 'reset' CHECK (purpose IN ('reset', 'invite')),
  created_at TEXT    NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT    NOT NULL,
  used_at    TEXT
);
CREATE INDEX idx_password_resets_user ON password_resets(user_id);

-- ---------------------------------------------------------------------------
-- Content
-- ---------------------------------------------------------------------------

CREATE TABLE pages (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  -- 'home' is served at "/". Lowercase letters, digits and hyphens only.
  slug             TEXT    NOT NULL UNIQUE CHECK (slug GLOB '[a-z0-9]*' AND slug NOT GLOB '*[^a-z0-9-]*'),
  title            TEXT    NOT NULL,
  meta_description TEXT    NOT NULL DEFAULT '',
  show_in_nav      INTEGER NOT NULL DEFAULT 1 CHECK (show_in_nav IN (0, 1)),
  nav_order        INTEGER NOT NULL DEFAULT 0,
  created_at       TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at       TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_by       INTEGER REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE sections (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  page_id    INTEGER NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
  position   INTEGER NOT NULL,
  type       TEXT    NOT NULL CHECK (type IN (
               'hero', 'rich_text', 'image_gallery', 'traveler_grid', 'amenity_grid',
               'cta_banner', 'quote', 'contact_strip', 'faq_list', 'unit_grid', 'form')),
  data       TEXT    NOT NULL DEFAULT '{}' CHECK (json_valid(data)),
  created_at TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_by INTEGER REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX idx_sections_page ON sections(page_id, position);

-- Full-page snapshots. Last 20 per page are kept (pruned by the API on write).
CREATE TABLE page_revisions (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  page_id    INTEGER NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
  snapshot   TEXT    NOT NULL CHECK (json_valid(snapshot)),
  note       TEXT    NOT NULL DEFAULT '',
  created_at TEXT    NOT NULL DEFAULT (datetime('now')),
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX idx_page_revisions_page ON page_revisions(page_id, id DESC);

CREATE TABLE media (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  r2_key       TEXT    NOT NULL UNIQUE,
  filename     TEXT    NOT NULL,
  content_type TEXT    NOT NULL,
  size         INTEGER NOT NULL,
  width        INTEGER,
  height       INTEGER,
  alt          TEXT    NOT NULL DEFAULT '',
  created_at   TEXT    NOT NULL DEFAULT (datetime('now')),
  uploaded_by  INTEGER REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE faq_items (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  question   TEXT    NOT NULL,
  answer     TEXT    NOT NULL,
  category   TEXT    NOT NULL DEFAULT '',
  position   INTEGER NOT NULL DEFAULT 0,
  created_at TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_faq_items_position ON faq_items(category, position);

CREATE TABLE units (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  name         TEXT    NOT NULL,
  city         TEXT    NOT NULL DEFAULT '',
  neighborhood TEXT    NOT NULL DEFAULT '',
  bedrooms     INTEGER NOT NULL DEFAULT 0,
  bathrooms    REAL    NOT NULL DEFAULT 1,
  sleeps       INTEGER NOT NULL DEFAULT 1,
  description  TEXT    NOT NULL DEFAULT '',
  image_id     INTEGER REFERENCES media(id) ON DELETE SET NULL,
  -- Booking stays on the external system (5rsuites.holidayfuture.com).
  booking_url  TEXT    NOT NULL DEFAULT '',
  is_active    INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  position     INTEGER NOT NULL DEFAULT 0,
  created_at   TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at   TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_units_active ON units(is_active, position);

-- ---------------------------------------------------------------------------
-- Forms
-- ---------------------------------------------------------------------------

-- The D1 row is the source of truth. Email is a notification on top of it.
CREATE TABLE form_submissions (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  form_type       TEXT    NOT NULL CHECK (form_type IN ('contact', 'register_property', 'careers')),
  name            TEXT    NOT NULL DEFAULT '',
  email           TEXT    NOT NULL DEFAULT '',
  data            TEXT    NOT NULL CHECK (json_valid(data)),
  attachment_key  TEXT,
  status          TEXT    NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'read', 'archived')),
  notify_status   TEXT    NOT NULL DEFAULT 'pending' CHECK (notify_status IN ('pending', 'sent', 'failed')),
  notify_error    TEXT,
  -- Register Property only: automated market report (AirROI data).
  report_status   TEXT    CHECK (report_status IN ('pending', 'sent', 'held', 'failed')),
  report_data     TEXT    CHECK (report_data IS NULL OR json_valid(report_data)),
  report_error    TEXT,
  ip              TEXT,
  user_agent      TEXT,
  created_at      TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_form_submissions_type ON form_submissions(form_type, created_at DESC);
CREATE INDEX idx_form_submissions_status ON form_submissions(status);

-- Generic sliding-window rate limiting (login failures, password reset requests, form posts).
CREATE TABLE rate_limit_log (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  bucket     TEXT    NOT NULL,
  key        TEXT    NOT NULL,
  created_at TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_rate_limit_lookup ON rate_limit_log(bucket, key, created_at);

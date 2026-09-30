-- Site settings, share images and first-party analytics.

-- Business details and links edited in the admin (owner-only Settings screen). The public
-- site falls back to the wrangler.jsonc vars for any key not set here.
CREATE TABLE settings (
  key        TEXT PRIMARY KEY,
  value      TEXT    NOT NULL DEFAULT '',
  updated_at TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_by INTEGER REFERENCES users(id) ON DELETE SET NULL
);

-- Image shown when a page is shared (Open Graph). NULL = use the site default from settings.
ALTER TABLE pages ADD COLUMN share_image INTEGER REFERENCES media(id) ON DELETE SET NULL;

-- Page views recorded by the public site's beacon. No cookies and nothing personal:
-- `visitor` is a hash of IP + browser keyed to the day, so it counts unique visitors per day
-- but can't follow anyone across days or be turned back into an IP. Rows older than about
-- 13 months are pruned automatically.
CREATE TABLE page_views (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  day        TEXT    NOT NULL,                  -- local date (site time zone), 'YYYY-MM-DD'
  created_at TEXT    NOT NULL DEFAULT (datetime('now')),
  path       TEXT    NOT NULL,
  visitor    TEXT    NOT NULL,
  entry      INTEGER NOT NULL DEFAULT 0 CHECK (entry IN (0, 1)),  -- 1 = arrived from outside the site (starts a visit)
  source     TEXT    NOT NULL DEFAULT '',       -- entry views: direct | search | social | referral | campaign
  referrer   TEXT    NOT NULL DEFAULT '',       -- entry views: referring site's host, or the utm_source
  device     TEXT    NOT NULL DEFAULT '',       -- desktop | tablet | mobile
  country    TEXT    NOT NULL DEFAULT ''        -- two-letter code from Cloudflare
);
CREATE INDEX idx_page_views_day ON page_views(day);

-- Start Settings with the values the site already shows (previously wrangler.jsonc vars), so
-- the screen opens filled in. Once a key has a row, the row wins, including a blank value
-- (blank hides that link).
INSERT OR IGNORE INTO settings (key, value) VALUES
  ('contact_phone',   '360-320-6166'),
  ('contact_email',   'info@5rsuites.com'),
  ('mailing_address', '9330 NE Van Mall Drive Suite 203 #122'),
  ('booking_url',     'https://5rsuites.holidayfuture.com'),
  ('privacy_url',     '/privacy-policy'),
  ('terms_url',       '/terms-conditions'),
  ('facebook_url',    'https://www.facebook.com/stay5R'),
  ('instagram_url',   'https://www.instagram.com/5rsuites/'),
  ('youtube_url',     'https://www.youtube.com/@5rsuites641');

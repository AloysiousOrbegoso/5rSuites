-- City-level market figures from AirROI (Find Market by Coordinates + Get Market Summary).
-- Fetched the first time a Register Property lead comes from a city, then reused until
-- they are older than MARKET_CACHE_DAYS (default 365) — so each city costs ~$0.11 a year.
CREATE TABLE market_cache (
  city_key   TEXT PRIMARY KEY,            -- normalized "city|state" from the form, e.g. "tacoma|wa"
  market     TEXT NOT NULL CHECK (json_valid(market)),   -- AirROI market object from /markets/lookup
  summary    TEXT NOT NULL CHECK (json_valid(summary)),  -- normalized /markets/summary figures
  fetched_at TEXT NOT NULL DEFAULT (datetime('now'))
);

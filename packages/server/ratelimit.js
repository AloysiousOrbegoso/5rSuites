// Sliding-window counters stored in D1 (rate_limit_log).

export async function countRecent(db, bucket, key, windowMinutes) {
  const row = await db
    .prepare(`SELECT COUNT(*) AS n FROM rate_limit_log WHERE bucket = ? AND key = ? AND created_at > datetime('now', ?)`)
    .bind(bucket, key, `-${windowMinutes} minutes`)
    .first();
  return row?.n ?? 0;
}

export function recordHit(db, bucket, key) {
  return db.prepare('INSERT INTO rate_limit_log (bucket, key) VALUES (?, ?)').bind(bucket, key);
}

export function clearHits(db, bucket, key) {
  return db.prepare('DELETE FROM rate_limit_log WHERE bucket = ? AND key = ?').bind(bucket, key);
}

// Housekeeping: nothing needs more than a day of history.
export function pruneOld(db) {
  return db.prepare(`DELETE FROM rate_limit_log WHERE created_at < datetime('now', '-1 day')`);
}

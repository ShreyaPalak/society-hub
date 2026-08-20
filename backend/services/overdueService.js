const db = require('../config/db');

const SETTING_KEY = 'overdue_threshold_days';

function getOverdueThresholdDays() {
  const row = db.prepare('SELECT value FROM app_settings WHERE key = ?').get(SETTING_KEY);
  return row ? Number(row.value) : Number(process.env.DEFAULT_OVERDUE_THRESHOLD_DAYS || 3);
}

function setOverdueThresholdDays(days, adminId) {
  db.prepare(
    `INSERT INTO app_settings (key, value, updated_by, updated_at)
     VALUES (?, ?, ?, datetime('now'))
     ON CONFLICT(key) DO UPDATE SET value = excluded.value,
                                     updated_by = excluded.updated_by,
                                     updated_at = excluded.updated_at`
  ).run(SETTING_KEY, String(days), adminId);
  return days;
}

/**
 * "Overdue" is never persisted on the complaints table. It's computed at
 * query time from status + created_at + the configurable threshold, so a
 * single admin setting change re-classifies the entire table instantly
 * with no migration, no background job, and no stale cached flag.
 *
 * SQLite's julianday() gives fractional-day precision; threshold is in
 * whole days. `?` params are bound, never string-concatenated.
 */
function overdueSqlFragment(alias = 'complaints') {
  return `(${alias}.status != 'RESOLVED' AND (julianday('now') - julianday(${alias}.created_at)) > ?)`;
}

module.exports = { getOverdueThresholdDays, setOverdueThresholdDays, overdueSqlFragment };

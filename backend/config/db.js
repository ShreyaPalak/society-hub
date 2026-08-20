const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

const DB_FILE = process.env.DATABASE_FILE || './db/society.db';
const resolvedPath = path.resolve(__dirname, '..', DB_FILE);

// Ensure the folder for the sqlite file exists (first boot on a fresh clone).
fs.mkdirSync(path.dirname(resolvedPath), { recursive: true });

const db = new Database(resolvedPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Apply schema.sql idempotently (CREATE TABLE IF NOT EXISTS everywhere).
const schema = fs.readFileSync(path.join(__dirname, '..', 'db', 'schema.sql'), 'utf8');
db.exec(schema);

// SQLite has no portable ADD COLUMN IF NOT EXISTS syntax. Inspecting the
// table first keeps startup migrations idempotent and preserves existing data.
function addColumnIfMissing(table, column, definition) {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all();
  if (!columns.some((entry) => entry.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

addColumnIfMissing('complaints', 'assigned_worker_name', 'TEXT');
addColumnIfMissing('complaints', 'assigned_worker_phone', 'TEXT');
addColumnIfMissing('complaints', 'scheduled_visit_time', 'TEXT');
addColumnIfMissing('complaint_history', 'assigned_worker_name', 'TEXT');
addColumnIfMissing('complaint_history', 'assigned_worker_phone', 'TEXT');
db.exec(`
  CREATE INDEX IF NOT EXISTS idx_complaints_status_created ON complaints(status, created_at);
  CREATE INDEX IF NOT EXISTS idx_complaints_resident ON complaints(resident_id);
`);

// Seed the default overdue threshold exactly once, without clobbering an
// admin-configured value on subsequent boots.
const defaultThreshold = process.env.DEFAULT_OVERDUE_THRESHOLD_DAYS || '3';
db.prepare(
  `INSERT OR IGNORE INTO app_settings (key, value) VALUES ('overdue_threshold_days', ?)`
).run(defaultThreshold);

module.exports = db;

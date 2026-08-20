-- =====================================================================
-- Society Hub - Database Schema (SQLite)
-- Design notes:
--  - complaint_history is APPEND-ONLY. Nothing in this table is ever
--    UPDATEd or DELETEd by application code. It is the immutable audit
--    trail referenced in the system design write-up.
--  - "overdue" is NEVER stored as a column. It is always derived at
--    query time from status + created_at + the configurable threshold
--    in app_settings, so changing the threshold instantly re-classifies
--    every complaint without a migration or a background job.
-- =====================================================================

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    name          TEXT NOT NULL,
    email         TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role          TEXT NOT NULL CHECK (role IN ('resident', 'admin')),
    apartment_no  TEXT,
    created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS complaints (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    resident_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    category      TEXT NOT NULL CHECK (category IN
                    ('Plumbing','Electrical','Elevator','Common Area','Security','Housekeeping','Other')),
    description   TEXT NOT NULL,
    photo_url     TEXT,
    priority      TEXT NOT NULL DEFAULT 'LOW' CHECK (priority IN ('LOW','MEDIUM','HIGH')),
    status        TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN','IN_PROGRESS','RESOLVED')),
    created_at    TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_complaints_status   ON complaints(status);
CREATE INDEX IF NOT EXISTS idx_complaints_resident ON complaints(resident_id);
CREATE INDEX IF NOT EXISTS idx_complaints_created  ON complaints(created_at);

CREATE TABLE IF NOT EXISTS complaint_history (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    complaint_id      INTEGER NOT NULL REFERENCES complaints(id) ON DELETE CASCADE,
    action_type       TEXT NOT NULL CHECK (action_type IN ('CREATED','STATUS_CHANGE','PRIORITY_CHANGE')),
    previous_status   TEXT,
    new_status        TEXT,
    previous_priority TEXT,
    new_priority      TEXT,
    note              TEXT,
    updated_by        INTEGER NOT NULL REFERENCES users(id),
    created_at        TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_history_complaint ON complaint_history(complaint_id);

CREATE TABLE IF NOT EXISTS notices (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    title         TEXT NOT NULL,
    content       TEXT NOT NULL,
    is_important  INTEGER NOT NULL DEFAULT 0,
    created_by    INTEGER NOT NULL REFERENCES users(id),
    created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_notices_important ON notices(is_important);

CREATE TABLE IF NOT EXISTS app_settings (
    key         TEXT PRIMARY KEY,
    value       TEXT NOT NULL,
    updated_by  INTEGER REFERENCES users(id),
    updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

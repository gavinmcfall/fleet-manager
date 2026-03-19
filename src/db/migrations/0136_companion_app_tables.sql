-- Companion app tables — stores game events and live status from the desktop companion.

CREATE TABLE companion_events (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id         TEXT    NOT NULL,
    type            TEXT    NOT NULL,
    source          TEXT    NOT NULL DEFAULT 'log',
    event_timestamp TEXT    NOT NULL,
    data_json       TEXT    NOT NULL DEFAULT '{}',
    received_at     TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_companion_events_user    ON companion_events(user_id);
CREATE INDEX idx_companion_events_type    ON companion_events(user_id, type);
CREATE INDEX idx_companion_events_time    ON companion_events(user_id, event_timestamp);

CREATE TABLE companion_status (
    user_id           TEXT PRIMARY KEY,
    player_handle     TEXT,
    current_ship      TEXT,
    location          TEXT,
    jurisdiction      TEXT,
    event_count       INTEGER NOT NULL DEFAULT 0,
    companion_version TEXT,
    updated_at        TEXT NOT NULL DEFAULT (datetime('now'))
);

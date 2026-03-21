-- Companion gRPC data tables — stores synced data from CIG's gRPC API via the desktop companion app.

-- Wallet balance snapshots (time-series for charting)
CREATE TABLE companion_wallet_snapshots (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id     TEXT    NOT NULL,
    auec        INTEGER NOT NULL DEFAULT 0,
    uec         INTEGER NOT NULL DEFAULT 0,
    rec         INTEGER NOT NULL DEFAULT 0,
    mer         INTEGER NOT NULL DEFAULT 0,
    captured_at TEXT    NOT NULL,
    received_at TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_companion_wallet_snapshots_user ON companion_wallet_snapshots(user_id);
CREATE INDEX idx_companion_wallet_snapshots_time ON companion_wallet_snapshots(user_id, captured_at);

-- Wallet current state (fast lookup, upserted on each sync)
CREATE TABLE companion_wallet_current (
    user_id    TEXT PRIMARY KEY,
    auec       INTEGER NOT NULL DEFAULT 0,
    uec        INTEGER NOT NULL DEFAULT 0,
    rec        INTEGER NOT NULL DEFAULT 0,
    mer        INTEGER NOT NULL DEFAULT 0,
    captured_at TEXT   NOT NULL,
    updated_at TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- Friends with presence
CREATE TABLE companion_friends (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id         TEXT    NOT NULL,
    account_id      TEXT    NOT NULL,
    nickname        TEXT,
    display_name    TEXT,
    presence        TEXT    NOT NULL DEFAULT 'offline',
    activity_state  TEXT,
    activity_detail TEXT,
    updated_at      TEXT    NOT NULL DEFAULT (datetime('now')),
    UNIQUE(user_id, account_id)
);

CREATE INDEX idx_companion_friends_user ON companion_friends(user_id);

-- Reputation scores per faction (current state)
CREATE TABLE companion_reputation_scores (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id       TEXT    NOT NULL,
    entity_id     TEXT    NOT NULL,
    scope         TEXT    NOT NULL DEFAULT 'default',
    score         INTEGER NOT NULL DEFAULT 0,
    standing_tier TEXT,
    drift         REAL,
    captured_at   TEXT    NOT NULL,
    updated_at    TEXT    NOT NULL DEFAULT (datetime('now')),
    UNIQUE(user_id, entity_id, scope)
);

CREATE INDEX idx_companion_reputation_scores_user ON companion_reputation_scores(user_id);

-- Reputation score history (append-only from GetScoreHistory)
CREATE TABLE companion_reputation_history (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id         TEXT    NOT NULL,
    entity_id       TEXT    NOT NULL,
    scope           TEXT    NOT NULL DEFAULT 'default',
    score           INTEGER NOT NULL,
    event_timestamp TEXT    NOT NULL,
    received_at     TEXT    NOT NULL DEFAULT (datetime('now')),
    UNIQUE(user_id, entity_id, scope, event_timestamp)
);

CREATE INDEX idx_companion_reputation_history_user   ON companion_reputation_history(user_id);
CREATE INDEX idx_companion_reputation_history_entity ON companion_reputation_history(user_id, entity_id, scope);

-- Blueprint collection
CREATE TABLE companion_blueprints (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id         TEXT    NOT NULL,
    blueprint_id    TEXT    NOT NULL,
    category_id     TEXT,
    item_class_id   TEXT,
    tier            INTEGER,
    remaining_uses  INTEGER NOT NULL DEFAULT -1,
    source          TEXT    NOT NULL DEFAULT 'GAMEPLAY',
    process_type    TEXT,
    updated_at      TEXT    NOT NULL DEFAULT (datetime('now')),
    UNIQUE(user_id, blueprint_id)
);

CREATE INDEX idx_companion_blueprints_user ON companion_blueprints(user_id);
CREATE INDEX idx_companion_blueprints_item ON companion_blueprints(item_class_id);

-- Entitlements (ships, items from CIG)
CREATE TABLE companion_entitlements (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id             TEXT    NOT NULL,
    urn                 TEXT    NOT NULL,
    name                TEXT,
    entity_class_guid   TEXT,
    entitlement_type    TEXT    NOT NULL DEFAULT 'PERMANENT',
    status              TEXT,
    item_type           TEXT,
    source              TEXT,
    insurance_lifetime  INTEGER NOT NULL DEFAULT 0,
    insurance_duration  INTEGER,
    vehicle_id          INTEGER REFERENCES vehicles(id),
    updated_at          TEXT    NOT NULL DEFAULT (datetime('now')),
    UNIQUE(user_id, urn)
);

CREATE INDEX idx_companion_entitlements_user    ON companion_entitlements(user_id);
CREATE INDEX idx_companion_entitlements_vehicle ON companion_entitlements(vehicle_id);
CREATE INDEX idx_companion_entitlements_guid    ON companion_entitlements(entity_class_guid);

-- Active + recent missions
CREATE TABLE companion_missions (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id         TEXT    NOT NULL,
    mission_id      TEXT    NOT NULL,
    contract_id     TEXT,
    template        TEXT,
    state           TEXT    NOT NULL DEFAULT 'PENDING',
    title           TEXT,
    description     TEXT,
    reward_auec     INTEGER,
    expires_at      TEXT,
    objectives_json TEXT,
    captured_at     TEXT,
    updated_at      TEXT    NOT NULL DEFAULT (datetime('now')),
    UNIQUE(user_id, mission_id)
);

CREATE INDEX idx_companion_missions_user  ON companion_missions(user_id);
CREATE INDEX idx_companion_missions_state ON companion_missions(user_id, state);

-- Player stats
CREATE TABLE companion_stats (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id     TEXT    NOT NULL,
    stat_def_id TEXT    NOT NULL,
    value       REAL    NOT NULL DEFAULT 0,
    best        REAL,
    category    TEXT,
    game_mode   TEXT,
    updated_at  TEXT    NOT NULL DEFAULT (datetime('now')),
    UNIQUE(user_id, stat_def_id, game_mode)
);

CREATE INDEX idx_companion_stats_user     ON companion_stats(user_id);
CREATE INDEX idx_companion_stats_category ON companion_stats(user_id, category);

-- Per-data-type sync status (upserted per sync)
CREATE TABLE companion_sync_log (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id    TEXT    NOT NULL,
    data_type  TEXT    NOT NULL,
    status     TEXT    NOT NULL DEFAULT 'success',
    item_count INTEGER,
    error      TEXT,
    synced_at  TEXT    NOT NULL DEFAULT (datetime('now')),
    UNIQUE(user_id, data_type)
);

CREATE INDEX idx_companion_sync_log_user ON companion_sync_log(user_id);

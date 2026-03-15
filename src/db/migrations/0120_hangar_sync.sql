-- Hangar sync: RSI profile, buy-back pledges, and upgrade history tables

CREATE TABLE IF NOT EXISTS user_rsi_profiles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL UNIQUE,
    rsi_handle TEXT,
    rsi_displayname TEXT,
    avatar_url TEXT,
    enlisted_since TEXT,
    country TEXT,
    concierge_level TEXT,
    subscriber_type TEXT,
    subscriber_frequency TEXT,
    store_credit_cents INTEGER,
    uec_balance INTEGER,
    rec_balance INTEGER,
    referral_code TEXT,
    has_game_package INTEGER DEFAULT 0,
    orgs_json TEXT,
    badges_json TEXT,
    featured_badges_json TEXT,
    synced_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES user(id)
);

CREATE TABLE IF NOT EXISTS user_buyback_pledges (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    rsi_pledge_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    value_cents INTEGER,
    date TEXT,
    is_credit_reclaimable INTEGER DEFAULT 0,
    items_json TEXT,
    synced_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES user(id)
);
CREATE INDEX idx_user_buyback_user ON user_buyback_pledges(user_id);

CREATE TABLE IF NOT EXISTS user_pledge_upgrades (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    rsi_pledge_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    applied_at TEXT,
    new_value TEXT,
    synced_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES user(id)
);
CREATE INDEX idx_user_upgrades_user ON user_pledge_upgrades(user_id);

-- Hangar sync change event type
INSERT OR IGNORE INTO change_event_types (id, key, label, category) VALUES (20, 'hangar_synced', 'Hangar Synced via Extension', 'fleet');

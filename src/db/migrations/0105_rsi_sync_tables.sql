-- Migration 0105: RSI Sync Infrastructure
--
-- Adds tables for the sc-bridge-sync browser extension data pipeline.
-- Three ownership tiers:
--   1. Platform catalog (retained forever) — RSI media registry, entity mappings, per-table RSI metadata
--   2. Staging (reviewed weekly) — new items/media discovered from imports
--   3. User data (GDPR, ON DELETE CASCADE) — pledges, items, CCU chains, account snapshots
--
-- Also adds missing insurance types discovered from RSI (60-month, 2-month).

-- ============================================================
-- 0. Missing Insurance Types
-- ============================================================
-- RSI hangar shows these but our seed data doesn't include them.

INSERT OR IGNORE INTO insurance_types (id, key, label, duration_months, is_lifetime)
VALUES (8, '60_month', '60-Month Insurance', 60, FALSE);

INSERT OR IGNORE INTO insurance_types (id, key, label, duration_months, is_lifetime)
VALUES (9, '2_month', '2-Month Insurance', 2, FALSE);


-- ============================================================
-- 1. PLATFORM CATALOG — RSI Media Registry
-- ============================================================
-- Universal image registry. Every RSI media slug we've ever seen.
-- From a single slug + filename + extension, all size variants can be derived:
--   Old CDN: /media/{slug}/{size}/{filename}.{ext}
--   New CDN: https://media.robertsspaceindustries.com/{slug}/{size}.{ext}

CREATE TABLE rsi_media (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    slug             TEXT    NOT NULL UNIQUE,   -- e.g. 'am12jusvbx8mqr'
    filename         TEXT,                      -- e.g. 'Dragonfly-Left'
    source_extension TEXT,                      -- e.g. 'jpg', 'png'
    cdn_format       TEXT    NOT NULL DEFAULT 'old',  -- 'old' (/media/) or 'new' (media.rsi.com)
    cf_image_id      TEXT,                      -- CF Images ID (null until uploaded)
    cf_image_url     TEXT,                      -- CF delivery URL (null until uploaded)
    first_seen_at    TEXT    NOT NULL DEFAULT (datetime('now')),
    last_seen_at     TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_rsi_media_cf ON rsi_media(cf_image_id) WHERE cf_image_id IS NOT NULL;


-- ============================================================
-- 2. PLATFORM CATALOG — Per-Table RSI Metadata
-- ============================================================
-- Type-specific RSI metadata linked to existing entity tables.
-- Only created for tables where RSI-side data adds value.

-- Vehicles: RSI ship matrix ID, store URL, media link
CREATE TABLE vehicle_rsi_meta (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    vehicle_id     INTEGER NOT NULL UNIQUE REFERENCES vehicles(id) ON DELETE CASCADE,
    rsi_ship_id    INTEGER,            -- RSI ship matrix ID (from /ship-matrix/index)
    rsi_media_id   INTEGER REFERENCES rsi_media(id),
    rsi_store_url  TEXT,               -- e.g. '/pledge/ships/rsi-aurora/Aurora-ES'
    first_seen_at  TEXT    NOT NULL DEFAULT (datetime('now')),
    last_seen_at   TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_vehicle_rsi_meta_rsi_ship ON vehicle_rsi_meta(rsi_ship_id)
    WHERE rsi_ship_id IS NOT NULL;

-- Paints: media link (paints have no RSI item ID in the ship matrix)
CREATE TABLE paint_rsi_meta (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    paint_id       INTEGER NOT NULL UNIQUE REFERENCES paints(id) ON DELETE CASCADE,
    rsi_media_id   INTEGER REFERENCES rsi_media(id),
    first_seen_at  TEXT    NOT NULL DEFAULT (datetime('now')),
    last_seen_at   TEXT    NOT NULL DEFAULT (datetime('now'))
);


-- ============================================================
-- 3. PLATFORM CATALOG — RSI Entity Mappings
-- ============================================================
-- Junction table linking RSI-discovered items to our existing tables.
-- Populated during weekly review. The "approved link" between RSI and SC Bridge.

CREATE TABLE rsi_entity_mappings (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    rsi_name       TEXT    NOT NULL,           -- what RSI calls it, e.g. 'Hurricane'
    rsi_item_id    INTEGER,                    -- RSI's internal item ID (from upgrade data, ship matrix)
    rsi_kind       TEXT    NOT NULL,           -- 'Ship','Insurance','Skin','FPS Equipment',
                                              -- 'Hangar decoration','Component','Credits'
    entity_table   TEXT,                       -- target table: 'vehicles','paints','fps_weapons', etc.
    entity_id      INTEGER,                    -- row ID in the target table (null until mapped)
    rsi_media_id   INTEGER REFERENCES rsi_media(id),
    reviewed_at    TEXT,                       -- null = pending review
    reviewed_by    TEXT,                       -- admin user_id (informational, not FK — admin deletion must not break mappings)
    created_at     TEXT    NOT NULL DEFAULT (datetime('now')),
    UNIQUE(rsi_name, rsi_kind)
);

CREATE INDEX idx_rsi_entity_mappings_entity ON rsi_entity_mappings(entity_table, entity_id)
    WHERE entity_table IS NOT NULL;
CREATE INDEX idx_rsi_entity_mappings_rsi_id ON rsi_entity_mappings(rsi_item_id)
    WHERE rsi_item_id IS NOT NULL;
CREATE INDEX idx_rsi_entity_mappings_pending ON rsi_entity_mappings(reviewed_at)
    WHERE reviewed_at IS NULL;


-- ============================================================
-- 4. STAGING — Items Discovered from Imports
-- ============================================================
-- Raw items from extension imports that don't yet exist in our catalog.
-- Weekly cron generates a report; admin reviews and promotes or discards.

CREATE TABLE rsi_staging_items (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    rsi_item_id       INTEGER,                 -- RSI's internal item ID (if known)
    name              TEXT    NOT NULL,
    kind              TEXT,                     -- Ship, Skin, FPS Equipment, etc.
    manufacturer_code TEXT,
    manufacturer_name TEXT,
    image_url         TEXT,                     -- raw URL as seen in hangar HTML
    rsi_media_id      INTEGER REFERENCES rsi_media(id),
    source_user_id    TEXT,                     -- who surfaced this (debug only, not displayed)
    discovered_at     TEXT    NOT NULL DEFAULT (datetime('now')),
    reviewed_at       TEXT,
    review_action     TEXT,                     -- 'promoted','discarded','deferred'
    promoted_to_table TEXT,                     -- e.g. 'vehicles','paints'
    promoted_to_id    INTEGER,
    notes             TEXT,
    UNIQUE(name, kind)
);

CREATE INDEX idx_rsi_staging_items_pending ON rsi_staging_items(reviewed_at)
    WHERE reviewed_at IS NULL;


-- ============================================================
-- 5. STAGING — Media Discovered from Imports
-- ============================================================
-- New RSI media URLs that we haven't seen before.
-- Separate from rsi_media so we can review before inserting.

CREATE TABLE rsi_staging_media (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    slug             TEXT    NOT NULL,
    filename         TEXT,
    source_extension TEXT,
    cdn_format       TEXT,
    image_url        TEXT,                     -- full URL as seen
    source_context   TEXT,                     -- e.g. 'Ship: Terrapin Medic', 'Skin: Stormcloud'
    discovered_at    TEXT    NOT NULL DEFAULT (datetime('now')),
    reviewed_at      TEXT,
    review_action    TEXT,                     -- 'promoted','discarded'
    UNIQUE(slug)
);


-- ============================================================
-- 6. STAGING — Weekly Reports
-- ============================================================

CREATE TABLE rsi_staging_reports (
    id                        INTEGER PRIMARY KEY AUTOINCREMENT,
    generated_at              TEXT    NOT NULL DEFAULT (datetime('now')),
    report_json               TEXT    NOT NULL,  -- structured diff
    new_items_count           INTEGER NOT NULL DEFAULT 0,
    new_media_count           INTEGER NOT NULL DEFAULT 0,
    new_insurance_types_count INTEGER NOT NULL DEFAULT 0,
    emailed_at                TEXT,               -- null until notification sent
    reviewed_at               TEXT
);


-- ============================================================
-- 7. USER DATA — Hangar Sync History
-- ============================================================
-- Tracks each sync from the extension. GDPR: CASCADE from user.

CREATE TABLE user_hangar_syncs (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id      TEXT    NOT NULL REFERENCES user(id) ON DELETE CASCADE,
    synced_at    TEXT    NOT NULL DEFAULT (datetime('now')),
    source       TEXT    NOT NULL DEFAULT 'extension',  -- 'extension','hangarxplor'
    pledge_count INTEGER,
    ship_count   INTEGER,
    item_count   INTEGER,
    raw_hash     TEXT                                    -- hash of import payload for dedup
);

CREATE INDEX idx_user_hangar_syncs_user ON user_hangar_syncs(user_id);


-- ============================================================
-- 8. USER DATA — Pledges (the container)
-- ============================================================
-- One row per RSI pledge. A pledge contains items (ships, insurance, skins, etc.)
-- GDPR: CASCADE from user.

CREATE TABLE user_pledges (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id             TEXT    NOT NULL REFERENCES user(id) ON DELETE CASCADE,
    sync_id             INTEGER NOT NULL REFERENCES user_hangar_syncs(id) ON DELETE CASCADE,
    rsi_pledge_id       INTEGER NOT NULL,           -- RSI's pledge ID
    name                TEXT    NOT NULL,            -- 'Standalone Ships - Constellation Taurus'
    value               TEXT,                        -- '$220.00 USD' (raw string)
    value_cents         INTEGER,                     -- 22000 (parsed)
    configuration_value TEXT,                        -- '$0.00 USD'
    currency            TEXT,                        -- 'Store Credit', 'New Money'
    pledge_date         TEXT,                        -- 'August 19, 2025' (raw)
    pledge_date_parsed  TEXT,                        -- '2025-08-19' (ISO)
    is_upgraded         INTEGER NOT NULL DEFAULT 0,
    is_reclaimable      INTEGER NOT NULL DEFAULT 0,
    is_giftable         INTEGER NOT NULL DEFAULT 0,
    availability        TEXT,                        -- 'Attributed', 'Gift'
    UNIQUE(user_id, rsi_pledge_id)
);

CREATE INDEX idx_user_pledges_user ON user_pledges(user_id);
CREATE INDEX idx_user_pledges_sync ON user_pledges(sync_id);


-- ============================================================
-- 9. USER DATA — Pledge Items (contents of a pledge)
-- ============================================================
-- Every item within a pledge: ships, insurance, skins, decorations, FPS gear, etc.
-- GDPR: CASCADE from user + pledge.

CREATE TABLE user_pledge_items (
    id                    INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id               TEXT    NOT NULL REFERENCES user(id) ON DELETE CASCADE,
    user_pledge_id        INTEGER NOT NULL REFERENCES user_pledges(id) ON DELETE CASCADE,
    title                 TEXT    NOT NULL,           -- 'Terrapin Medic'
    kind                  TEXT,                       -- 'Ship','Insurance','Skin','FPS Equipment',
                                                     -- 'Hangar decoration','Component','Credits'
    manufacturer_code     TEXT,                       -- 'ANVL'
    manufacturer_name     TEXT,                       -- 'Anvil Aerospace'
    image_url             TEXT,                       -- raw RSI image URL
    rsi_media_id          INTEGER REFERENCES rsi_media(id),
    rsi_entity_mapping_id INTEGER REFERENCES rsi_entity_mappings(id),
    custom_name           TEXT,                       -- user's ship name (e.g. 'Jean-Luc')
    serial                TEXT,                       -- ship serial number
    is_nameable           INTEGER NOT NULL DEFAULT 0,
    insurance_type_id     INTEGER REFERENCES insurance_types(id),  -- parsed from title for Insurance items
    sort_order            INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX idx_user_pledge_items_user ON user_pledge_items(user_id);
CREATE INDEX idx_user_pledge_items_pledge ON user_pledge_items(user_pledge_id);
CREATE INDEX idx_user_pledge_items_kind ON user_pledge_items(kind);


-- ============================================================
-- 10. USER DATA — Pledge Upgrade History (CCU chains)
-- ============================================================
-- Full upgrade chain per pledge. Ordered newest-first.
-- GDPR: CASCADE from user + pledge.

CREATE TABLE user_pledge_upgrades (
    id                    INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id               TEXT    NOT NULL REFERENCES user(id) ON DELETE CASCADE,
    user_pledge_id        INTEGER NOT NULL REFERENCES user_pledges(id) ON DELETE CASCADE,
    upgrade_rsi_pledge_id INTEGER,                   -- RSI's upgrade pledge ID (e.g. #21280683)
    upgrade_name          TEXT    NOT NULL,           -- 'Upgrade - Carrack w/C8X to Carrack Expedition...'
    applied_at            TEXT,                       -- 'Feb 28 2020, 7:41 am' (raw)
    applied_at_parsed     TEXT,                       -- '2020-02-28T07:41:00' (ISO)
    new_value             TEXT,                       -- '$295.00 USD' (raw)
    new_value_cents       INTEGER,                    -- 29500 (parsed)
    sort_order            INTEGER NOT NULL DEFAULT 0  -- 0 = most recent upgrade
);

CREATE INDEX idx_user_pledge_upgrades_user ON user_pledge_upgrades(user_id);
CREATE INDEX idx_user_pledge_upgrades_pledge ON user_pledge_upgrades(user_pledge_id);


-- ============================================================
-- 11. USER DATA — Account Snapshots
-- ============================================================
-- Point-in-time capture of account metadata. One row per sync.
-- Tracks concierge progression, subscriber changes over time.
-- GDPR: CASCADE from user.

CREATE TABLE user_account_snapshots (
    id                    INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id               TEXT    NOT NULL REFERENCES user(id) ON DELETE CASCADE,
    sync_id               INTEGER NOT NULL REFERENCES user_hangar_syncs(id) ON DELETE CASCADE,
    synced_at             TEXT    NOT NULL DEFAULT (datetime('now')),
    nickname              TEXT,
    displayname           TEXT,
    avatar_url            TEXT,
    enlisted_since        TEXT,                       -- '2016-01-04 22:37:31'
    country               TEXT,
    concierge_level       TEXT,                       -- 'Wing Commander'
    concierge_next_level  TEXT,                       -- 'Praetorian'
    concierge_progress    INTEGER,                    -- 95 (percentage)
    subscriber_type       TEXT,                       -- 'Imperator'
    subscriber_frequency  TEXT,                       -- 'Monthly'
    store_credit_cents    INTEGER,                    -- 0
    uec_balance           INTEGER,                    -- 50000
    rec_balance           INTEGER,                    -- 3613280
    org_name              TEXT,                       -- 'The Exelus Corporation'
    org_sid               TEXT,                       -- 'EXLS'
    badges_json           TEXT,                       -- JSON map of badge_id → badge_name
    referral_code         TEXT,
    has_game_package      INTEGER
);

CREATE INDEX idx_user_account_snapshots_user ON user_account_snapshots(user_id);
CREATE INDEX idx_user_account_snapshots_sync ON user_account_snapshots(sync_id);


-- ============================================================
-- 12. USER DATA — Nameable Ships
-- ============================================================
-- Custom ship names with RSI membership_id linking.
-- Separate from pledge_items because the same nameable ship can appear
-- across multiple pledges (RSI shows it on related pledges).
-- GDPR: CASCADE from user.

CREATE TABLE user_named_ships (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id         TEXT    NOT NULL REFERENCES user(id) ON DELETE CASCADE,
    sync_id         INTEGER NOT NULL REFERENCES user_hangar_syncs(id) ON DELETE CASCADE,
    membership_id   INTEGER NOT NULL,               -- RSI's membership_id (links across pledges)
    default_name    TEXT    NOT NULL,                -- 'Carrack Expedition with Pisces Expedition'
    custom_name     TEXT    NOT NULL,                -- 'Jean-Luc'
    UNIQUE(user_id, membership_id)
);

CREATE INDEX idx_user_named_ships_user ON user_named_ships(user_id);

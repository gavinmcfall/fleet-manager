-- Structured companion event tables — typed columns per domain so log events
-- become queryable, actionable data tied to user accounts.
--
-- The raw companion_events table (0136) is kept as an append-only audit trail.
-- These tables are populated server-side when events arrive at POST /api/companion/events.
--
-- 58 event types across 9 tables as of companion v0.3.0.

-- Game sessions: player_login + server_joined create/update session rows.
-- One row per play session — closed when next login occurs or on timeout.
CREATE TABLE companion_sessions (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id         TEXT    NOT NULL,
    player_handle   TEXT,
    shard           TEXT,
    started_at      TEXT    NOT NULL,
    ended_at        TEXT,
    FOREIGN KEY (user_id) REFERENCES user(id) ON DELETE CASCADE
);

CREATE INDEX idx_companion_sessions_user ON companion_sessions(user_id);
CREATE INDEX idx_companion_sessions_time ON companion_sessions(user_id, started_at);

-- Ship activity: boarding, exiting, insurance, impound, hangar, ship list, fuel events.
-- event_type: boarded, exited, insurance_claim, claim_complete, impounded, hangar_ready,
--             list_fetched, loaded, reconciliation, low_fuel
CREATE TABLE companion_ship_events (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id         TEXT    NOT NULL,
    event_type      TEXT    NOT NULL,
    ship_name       TEXT,
    owner_handle    TEXT,
    request_id      TEXT,              -- insurance claim request ID
    reason          TEXT,              -- impound reason
    ship_count      INTEGER,           -- entitlement/vehicle list count
    details         TEXT,              -- reconciliation details
    status          TEXT,              -- reconciliation status
    phase           TEXT,              -- reconciliation phase
    event_at        TEXT    NOT NULL,
    FOREIGN KEY (user_id) REFERENCES user(id) ON DELETE CASCADE
);

CREATE INDEX idx_companion_ship_events_user ON companion_ship_events(user_id);
CREATE INDEX idx_companion_ship_events_type ON companion_ship_events(user_id, event_type);
CREATE INDEX idx_companion_ship_events_time ON companion_ship_events(user_id, event_at);

-- Mission lifecycle: accepted, completed, failed, available, shared, ended, objectives.
-- event_type: accepted, completed, failed, available, shared, ended, end_mission,
--             new_objective, objective_complete, objective_withdrawn
CREATE TABLE companion_mission_events (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id         TEXT    NOT NULL,
    event_type      TEXT    NOT NULL,
    mission_name    TEXT,
    mission_id      TEXT,
    description     TEXT,              -- objective description
    player_handle   TEXT,
    completion_type TEXT,              -- from end_mission
    reason          TEXT,              -- from end_mission
    state           TEXT,              -- from mission_ended
    event_at        TEXT    NOT NULL,
    FOREIGN KEY (user_id) REFERENCES user(id) ON DELETE CASCADE
);

CREATE INDEX idx_companion_mission_events_user ON companion_mission_events(user_id);
CREATE INDEX idx_companion_mission_events_type ON companion_mission_events(user_id, event_type);
CREATE INDEX idx_companion_mission_events_time ON companion_mission_events(user_id, event_at);

-- Location tracking: location changes, jurisdiction, zone transitions, property, restricted areas.
-- event_type: location_change, jurisdiction_entered, armistice_entered, armistice_exited,
--             armistice_exiting, monitored_entered, monitored_exited, monitored_down,
--             monitored_restored, private_property_entered, private_property_exited,
--             restricted_area_warning, restricted_area_exited
CREATE TABLE companion_location_events (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id         TEXT    NOT NULL,
    event_type      TEXT    NOT NULL,
    location        TEXT,
    jurisdiction    TEXT,
    player_handle   TEXT,
    event_at        TEXT    NOT NULL,
    FOREIGN KEY (user_id) REFERENCES user(id) ON DELETE CASCADE
);

CREATE INDEX idx_companion_location_events_user ON companion_location_events(user_id);
CREATE INDEX idx_companion_location_events_type ON companion_location_events(user_id, event_type);
CREATE INDEX idx_companion_location_events_time ON companion_location_events(user_id, event_at);

-- Quantum travel: target selection, fuel request, arrival.
-- event_type: target_selected, destination_selected, fuel_requested, arrived
CREATE TABLE companion_travel_events (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id         TEXT    NOT NULL,
    event_type      TEXT    NOT NULL,
    destination     TEXT,
    event_at        TEXT    NOT NULL,
    FOREIGN KEY (user_id) REFERENCES user(id) ON DELETE CASCADE
);

CREATE INDEX idx_companion_travel_events_user ON companion_travel_events(user_id);
CREATE INDEX idx_companion_travel_events_time ON companion_travel_events(user_id, event_at);

-- Economy: money transfers, fines, transactions, rewards, refinery, blueprints.
-- event_type: money_sent, fined, transaction_complete, rewards_earned, refinery_complete, blueprint_received
CREATE TABLE companion_economy_events (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id         TEXT    NOT NULL,
    event_type      TEXT    NOT NULL,
    amount          INTEGER,           -- aUEC/UEC amount
    currency        TEXT,              -- UEC, aUEC
    recipient       TEXT,              -- money_sent target
    location        TEXT,              -- refinery location
    item_name       TEXT,              -- blueprint name
    reward_count    INTEGER,           -- rewards_earned count
    event_at        TEXT    NOT NULL,
    FOREIGN KEY (user_id) REFERENCES user(id) ON DELETE CASCADE
);

CREATE INDEX idx_companion_economy_events_user ON companion_economy_events(user_id);
CREATE INDEX idx_companion_economy_events_type ON companion_economy_events(user_id, event_type);
CREATE INDEX idx_companion_economy_events_time ON companion_economy_events(user_id, event_at);

-- Combat and health: injuries, death, collisions, crimestat, emergency, med bed, crime.
-- event_type: injury, incapacitated, fatal_collision, crimestat_increased, emergency_services,
--             crime_committed, actor_death, med_bed_heal
CREATE TABLE companion_combat_events (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id         TEXT    NOT NULL,
    event_type      TEXT    NOT NULL,
    severity        TEXT,              -- injury severity (Minor/Major/Severe)
    body_part       TEXT,              -- injury body part
    tier            INTEGER,           -- injury tier
    vehicle         TEXT,              -- fatal_collision vehicle / med_bed vehicle
    zone            TEXT,              -- fatal_collision zone
    actor           TEXT,              -- actor_death / med_bed actor name
    bed_name        TEXT,              -- med_bed name
    crime           TEXT,              -- crime_committed crime type
    heal_head       INTEGER DEFAULT 0, -- med_bed body part flags
    heal_torso      INTEGER DEFAULT 0,
    heal_left_arm   INTEGER DEFAULT 0,
    heal_right_arm  INTEGER DEFAULT 0,
    heal_left_leg   INTEGER DEFAULT 0,
    heal_right_leg  INTEGER DEFAULT 0,
    event_at        TEXT    NOT NULL,
    FOREIGN KEY (user_id) REFERENCES user(id) ON DELETE CASCADE
);

CREATE INDEX idx_companion_combat_events_user ON companion_combat_events(user_id);
CREATE INDEX idx_companion_combat_events_type ON companion_combat_events(user_id, event_type);
CREATE INDEX idx_companion_combat_events_time ON companion_combat_events(user_id, event_at);

-- Social: party membership, group activity.
-- event_type: party_member_joined, party_member_left, party_disbanded
CREATE TABLE companion_social_events (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id         TEXT    NOT NULL,
    event_type      TEXT    NOT NULL,
    player_name     TEXT,              -- who joined/left
    event_at        TEXT    NOT NULL,
    FOREIGN KEY (user_id) REFERENCES user(id) ON DELETE CASCADE
);

CREATE INDEX idx_companion_social_events_user ON companion_social_events(user_id);
CREATE INDEX idx_companion_social_events_time ON companion_social_events(user_id, event_at);

-- System: journal entries, player spawns, and other meta events.
-- event_type: journal_entry_added, player_spawned
CREATE TABLE companion_system_events (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id         TEXT    NOT NULL,
    event_type      TEXT    NOT NULL,
    entry           TEXT,              -- journal entry text
    event_at        TEXT    NOT NULL,
    FOREIGN KEY (user_id) REFERENCES user(id) ON DELETE CASCADE
);

CREATE INDEX idx_companion_system_events_user ON companion_system_events(user_id);
CREATE INDEX idx_companion_system_events_time ON companion_system_events(user_id, event_at);

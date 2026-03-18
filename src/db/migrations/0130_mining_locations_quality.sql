-- 0130_mining_locations_quality.sql
-- Mining locations, quality distribution, and clustering presets for 4.7.
-- 50 mining locations, 2 quality curves, 23 clustering presets.

-- Mining locations (where you can mine and what compositions spawn there)
CREATE TABLE mining_locations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    preset_file TEXT NOT NULL,
    preset_guid TEXT,
    name TEXT NOT NULL,
    system TEXT NOT NULL,
    location_type TEXT NOT NULL,
    game_version_id INTEGER REFERENCES game_versions(id)
);
CREATE INDEX idx_mining_locations_system ON mining_locations(system);
CREATE INDEX idx_mining_locations_game_version ON mining_locations(game_version_id);

-- What compositions spawn at each location (with probability)
CREATE TABLE mining_location_deposits (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    mining_location_id INTEGER NOT NULL REFERENCES mining_locations(id),
    group_name TEXT NOT NULL,
    group_probability REAL NOT NULL DEFAULT 1.0,
    composition_guid TEXT NOT NULL,
    relative_probability REAL NOT NULL DEFAULT 1.0,
    clustering_preset_guid TEXT
);
CREATE INDEX idx_mining_location_deposits_location ON mining_location_deposits(mining_location_id);

-- Clustering presets (how rocks cluster together)
CREATE TABLE mining_clustering_presets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    uuid TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    probability_of_clustering REAL NOT NULL DEFAULT 0,
    game_version_id INTEGER REFERENCES game_versions(id)
);

-- Clustering preset params (size/proximity ranges per cluster type)
CREATE TABLE mining_clustering_params (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    mining_clustering_preset_id INTEGER NOT NULL REFERENCES mining_clustering_presets(id),
    relative_probability REAL NOT NULL DEFAULT 1.0,
    min_size INTEGER NOT NULL DEFAULT 1,
    max_size INTEGER NOT NULL DEFAULT 1,
    min_proximity REAL NOT NULL DEFAULT 0,
    max_proximity REAL NOT NULL DEFAULT 0
);
CREATE INDEX idx_mining_clustering_params_preset ON mining_clustering_params(mining_clustering_preset_id);

-- Quality distribution (RNG curves per system)
CREATE TABLE mining_quality_distributions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    min_quality INTEGER NOT NULL DEFAULT 1,
    max_quality INTEGER NOT NULL DEFAULT 1000,
    mean REAL NOT NULL DEFAULT 500,
    stddev REAL NOT NULL DEFAULT 250,
    game_version_id INTEGER REFERENCES game_versions(id)
);

-- Mining equipment: lasers
CREATE TABLE mining_lasers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    size INTEGER NOT NULL DEFAULT 1,
    grade INTEGER NOT NULL DEFAULT 1,
    manufacturer TEXT,
    vehicle_built_in TEXT,
    module_slots INTEGER NOT NULL DEFAULT 0,
    throttle_lerp_speed REAL,
    throttle_minimum REAL,
    beam_full_range REAL,
    beam_zero_range REAL,
    beam_dps REAL,
    extract_full_range REAL,
    extract_zero_range REAL,
    extract_dps REAL,
    mod_instability REAL NOT NULL DEFAULT 0,
    mod_optimal_window_size REAL NOT NULL DEFAULT 0,
    mod_resistance REAL NOT NULL DEFAULT 0,
    mod_shatter_damage REAL NOT NULL DEFAULT 0,
    mod_cluster_factor REAL NOT NULL DEFAULT 0,
    mod_optimal_charge_rate REAL NOT NULL DEFAULT 0,
    mod_catastrophic_charge_rate REAL NOT NULL DEFAULT 0,
    mod_filter REAL NOT NULL DEFAULT 0,
    game_version_id INTEGER REFERENCES game_versions(id)
);

-- Mining equipment: modules (active/passive modifiers)
CREATE TABLE mining_modules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    size INTEGER NOT NULL DEFAULT 1,
    grade INTEGER NOT NULL DEFAULT 1,
    manufacturer TEXT,
    charges INTEGER,
    lifetime REAL,
    damage_multiplier REAL NOT NULL DEFAULT 1.0,
    mod_instability REAL NOT NULL DEFAULT 0,
    mod_optimal_window_size REAL NOT NULL DEFAULT 0,
    mod_resistance REAL NOT NULL DEFAULT 0,
    mod_shatter_damage REAL NOT NULL DEFAULT 0,
    mod_cluster_factor REAL NOT NULL DEFAULT 0,
    mod_optimal_charge_rate REAL NOT NULL DEFAULT 0,
    mod_catastrophic_charge_rate REAL NOT NULL DEFAULT 0,
    mod_filter REAL NOT NULL DEFAULT 0,
    game_version_id INTEGER REFERENCES game_versions(id)
);

-- Mining equipment: gadgets (consumable modifiers)
CREATE TABLE mining_gadgets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    manufacturer TEXT,
    mod_instability REAL NOT NULL DEFAULT 0,
    mod_optimal_window_size REAL NOT NULL DEFAULT 0,
    mod_resistance REAL NOT NULL DEFAULT 0,
    mod_shatter_damage REAL NOT NULL DEFAULT 0,
    mod_cluster_factor REAL NOT NULL DEFAULT 0,
    mod_optimal_charge_rate REAL NOT NULL DEFAULT 0,
    mod_catastrophic_charge_rate REAL NOT NULL DEFAULT 0,
    game_version_id INTEGER REFERENCES game_versions(id)
);

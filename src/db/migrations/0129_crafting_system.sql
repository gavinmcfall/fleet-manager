-- 0129_crafting_system.sql
-- Crafting blueprints, slots, and property modifiers for 4.7.
-- 1,045 blueprints, 22 resources, 14 craftable properties.

-- Crafting resources (mineable materials used in crafting)
CREATE TABLE crafting_resources (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    game_version_id INTEGER REFERENCES game_versions(id)
);

-- Crafting properties (stat modifiers that blueprints can affect)
CREATE TABLE crafting_properties (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    key TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    unit TEXT,
    category TEXT NOT NULL
);

-- Blueprints
CREATE TABLE crafting_blueprints (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    uuid TEXT NOT NULL UNIQUE,
    tag TEXT NOT NULL,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    sub_type TEXT NOT NULL,
    product_entity_class TEXT,
    craft_time_seconds INTEGER NOT NULL DEFAULT 0,
    game_version_id INTEGER REFERENCES game_versions(id)
);
CREATE INDEX idx_crafting_blueprints_type ON crafting_blueprints(type);
CREATE INDEX idx_crafting_blueprints_sub_type ON crafting_blueprints(sub_type);
CREATE INDEX idx_crafting_blueprints_game_version ON crafting_blueprints(game_version_id);

-- Blueprint slots (each blueprint has 1-4 slots, each requiring a resource)
CREATE TABLE crafting_blueprint_slots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    crafting_blueprint_id INTEGER NOT NULL REFERENCES crafting_blueprints(id),
    slot_index INTEGER NOT NULL DEFAULT 0,
    name TEXT NOT NULL,
    resource_name TEXT NOT NULL,
    quantity REAL NOT NULL DEFAULT 0,
    min_quality INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX idx_crafting_blueprint_slots_blueprint ON crafting_blueprint_slots(crafting_blueprint_id);

-- Slot property modifiers (how resource quality affects the crafted item)
CREATE TABLE crafting_slot_modifiers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    crafting_blueprint_slot_id INTEGER NOT NULL REFERENCES crafting_blueprint_slots(id),
    crafting_property_id INTEGER NOT NULL REFERENCES crafting_properties(id),
    start_quality INTEGER NOT NULL DEFAULT 0,
    end_quality INTEGER NOT NULL DEFAULT 1000,
    modifier_at_start REAL NOT NULL DEFAULT 1.0,
    modifier_at_end REAL NOT NULL DEFAULT 1.0
);
CREATE INDEX idx_crafting_slot_modifiers_slot ON crafting_slot_modifiers(crafting_blueprint_slot_id);

-- Seed the 14 crafting properties
INSERT INTO crafting_properties (key, name, unit, category) VALUES
    ('weapon_recoil_handling', 'Recoil Handling', '%+.2f %%', 'weapon'),
    ('weapon_reloadspeed', 'Reload Speed', NULL, 'weapon'),
    ('weapon_recoil_smoothness', 'Recoil Smoothness', '%+.2f %%', 'weapon'),
    ('weapon_firerate', 'Fire Rate', '%.2f RPM', 'weapon'),
    ('weapon_spread', 'Spread', NULL, 'weapon'),
    ('weapon_damage', 'Impact Force', '%+.2f %%', 'weapon'),
    ('weapon_recoil_kick', 'Recoil Kick', '%+.2f %%', 'weapon'),
    ('armor_damagemitigation', 'Damage Mitigation', NULL, 'armor'),
    ('armor_radiationcapacity', 'Radiation Capacity', '%.2f mRem', 'armor'),
    ('armor_radiationdissipation', 'Radiation Dissipation', '%.2f mRem/s', 'armor'),
    ('armor_temperaturemin', 'Min Temp', '%+.2f °C', 'armor'),
    ('armor_temperaturemax', 'Max Temp', '%+.2f °C', 'armor'),
    ('crafter_craftspeed', 'Craft Speed', NULL, 'crafter'),
    ('crafter_dismantleefficiency', 'Dismantle Efficiency', NULL, 'crafter');

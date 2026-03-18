-- 0131_salvageable_ships.sql
-- Salvageable ship variants and their harvestable components.
-- Maps unmanned/derelict/boarded ship entities to their base vehicle
-- and lists what components can be salvaged from them.

CREATE TABLE salvageable_ships (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    entity_name TEXT NOT NULL,
    entity_uuid TEXT NOT NULL,
    base_vehicle_id INTEGER REFERENCES vehicles(id),
    variant_type TEXT NOT NULL,
    game_version_id INTEGER REFERENCES game_versions(id)
);
CREATE INDEX idx_salvageable_ships_base ON salvageable_ships(base_vehicle_id);
CREATE INDEX idx_salvageable_ships_version ON salvageable_ships(game_version_id);
CREATE UNIQUE INDEX idx_salvageable_ships_uuid_version ON salvageable_ships(entity_uuid, game_version_id);

-- What components are equipped on each salvageable ship
CREATE TABLE salvageable_ship_components (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    salvageable_ship_id INTEGER NOT NULL REFERENCES salvageable_ships(id),
    port_name TEXT NOT NULL,
    port_type TEXT,
    component_uuid TEXT,
    component_name TEXT,
    component_type TEXT,
    component_sub_type TEXT,
    size INTEGER
);
CREATE INDEX idx_salvageable_ship_components_ship ON salvageable_ship_components(salvageable_ship_id);
CREATE INDEX idx_salvageable_ship_components_uuid ON salvageable_ship_components(component_uuid);

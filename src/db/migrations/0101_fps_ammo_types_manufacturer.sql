-- Add manufacturer_id to fps_ammo_types to match extract script output
ALTER TABLE fps_ammo_types ADD COLUMN manufacturer_id INTEGER REFERENCES manufacturers(id);

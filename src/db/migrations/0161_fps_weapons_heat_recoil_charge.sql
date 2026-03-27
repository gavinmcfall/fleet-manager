-- Add heat_per_shot, charge_time, and recoil_strength columns to fps_weapons
ALTER TABLE fps_weapons ADD COLUMN heat_per_shot REAL;
ALTER TABLE fps_weapons ADD COLUMN charge_time REAL;
ALTER TABLE fps_weapons ADD COLUMN recoil_strength REAL;

-- Add detonation_type column to fps_utilities
-- Values: Timed, Impact, Proximity, Laser (or NULL for non-explosive items)
ALTER TABLE fps_utilities ADD COLUMN detonation_type TEXT;

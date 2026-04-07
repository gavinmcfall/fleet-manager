-- Add is_default_for_vehicle to paint_vehicles junction table.
-- Each vehicle entity defines its default paint via SubGeometry[0].Tags.
-- This flag marks which paint is the ship's built-in skin so fleet sync
-- can auto-inherit it for the user.
ALTER TABLE paint_vehicles ADD COLUMN is_default_for_vehicle INTEGER DEFAULT 0;

-- Add minimum power draw fraction to vehicle_components.
-- Components consume between power_draw_min and power_draw depending on state:
--   Weapons: min=0 (idle/not firing), max=power_draw (firing)
--   Shields: min=25% of power_draw (idle), max=power_draw (regenerating)
--   Coolers: min=25-50% of power_draw (idle), max=power_draw (full load)
--   QD/Radar: min=100% (always full draw when online)
ALTER TABLE vehicle_components ADD COLUMN power_draw_min REAL;

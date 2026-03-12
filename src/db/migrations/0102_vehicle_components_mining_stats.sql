-- Mining module stats on vehicle_components (was in stats_json, never promoted before DROP)
ALTER TABLE vehicle_components ADD COLUMN laser_instability REAL;
ALTER TABLE vehicle_components ADD COLUMN optimal_charge_window_size REAL;
ALTER TABLE vehicle_components ADD COLUMN resistance_modifier REAL;
ALTER TABLE vehicle_components ADD COLUMN shatter_damage_modifier REAL;
ALTER TABLE vehicle_components ADD COLUMN optimal_charge_rate REAL;
ALTER TABLE vehicle_components ADD COLUMN catastrophic_charge_rate REAL;
ALTER TABLE vehicle_components ADD COLUMN filter_modifier REAL;

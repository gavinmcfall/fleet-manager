-- Add controller mapping columns to vehicle_ports
-- Enables "who controls this weapon mount" queries

ALTER TABLE vehicle_ports ADD COLUMN controller TEXT;
ALTER TABLE vehicle_ports ADD COLUMN controller_label TEXT;
ALTER TABLE vehicle_ports ADD COLUMN missile_type TEXT;

CREATE INDEX idx_vehicle_ports_controller ON vehicle_ports(controller);

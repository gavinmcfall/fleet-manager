-- 0218_vehicle_command_module.sql
-- Add Vehicle Command Module fields surfaced in 4.8.0-PTU as new fields on
-- EntityClassDefinition: gForceResistance (Flight Suit G-Force Resistance) +
-- AllowRoomConnection (likely the detachable-command-module flag for Drake
-- Caterpillar / Drake Ironclad).

ALTER TABLE vehicles ADD COLUMN g_force_resistance REAL;
ALTER TABLE vehicles ADD COLUMN allow_room_connection INTEGER DEFAULT 0;

ALTER TABLE ptu_vehicles ADD COLUMN g_force_resistance REAL;
ALTER TABLE ptu_vehicles ADD COLUMN allow_room_connection INTEGER DEFAULT 0;

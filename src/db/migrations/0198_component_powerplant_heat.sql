-- Migration 0198: Add heat threshold columns to component_powerplants.
-- In 4.7, powerplants (like coolers) have per-component overheat thresholds
-- at SEntityPhysicsControllerParams.PhysType.temperature.itemResourceParams.
-- Fields: overheatWarningTemperature → max_temperature, overheatTemperature →
-- overheat_temperature. CIG removed OverpowerPerformance/OverclockPerformance
-- values in 4.7 (powerRanges.{low,medium,high}.modifier stubbed to 0);
-- heat thresholds are the replacement mechanic.

ALTER TABLE component_powerplants ADD COLUMN max_temperature REAL;
ALTER TABLE component_powerplants ADD COLUMN overheat_temperature REAL;

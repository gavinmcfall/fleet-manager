-- Add vehicle reward slug for contracts that grant a ship as reward
ALTER TABLE contracts ADD COLUMN reward_vehicle_slug TEXT;

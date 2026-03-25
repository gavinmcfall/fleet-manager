-- Add removed column to mission tables missed by 0143 delta versioning prep
ALTER TABLE mission_types ADD COLUMN removed INTEGER NOT NULL DEFAULT 0;
ALTER TABLE mission_givers ADD COLUMN removed INTEGER NOT NULL DEFAULT 0;

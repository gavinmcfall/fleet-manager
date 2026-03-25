-- Add updated_at to profile_verification_pending for rate-limiting verification checks (M-04)
ALTER TABLE profile_verification_pending ADD COLUMN updated_at TEXT;

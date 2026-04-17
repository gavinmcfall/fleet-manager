-- 0195_user_two_factor_enabled.sql
-- Add twoFactorEnabled column to the user table to preserve 2FA state during
-- the NERDZ → SC Bridge account migration.
--
-- NERDZ's sc-companion-v2 has this column (Better Auth v1.4+ added it).
-- scbridge-staging was bootstrapped before the column was part of the schema.
-- Without this migration, the NERDZ user-data import would lose the 2FA-enabled
-- flag for users who have 2FA turned on.
--
-- Default 0 (false) so existing staging users stay consistent with current
-- behavior. Better Auth reads/writes this flag when 2FA is enabled/disabled.

ALTER TABLE user ADD COLUMN twoFactorEnabled INTEGER DEFAULT 0;

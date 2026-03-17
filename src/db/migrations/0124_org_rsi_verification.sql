-- RSI org verification: prove ownership by placing a key in the org's charter on RSI.
-- verification_key: random token the owner must add to their RSI org charter
-- verified_at: timestamp when verification succeeded (NULL = not verified)
-- verified_by: userId of the user who completed verification
ALTER TABLE organization ADD COLUMN verification_key TEXT;
ALTER TABLE organization ADD COLUMN verified_at TEXT;
ALTER TABLE organization ADD COLUMN verified_by TEXT;

-- Profile bio verification: lets users prove RSI identity by placing a key in their citizen bio
CREATE TABLE profile_verification_pending (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  handle TEXT NOT NULL,
  verification_key TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  UNIQUE(user_id)
);
CREATE INDEX idx_profile_verification_pending_handle ON profile_verification_pending(handle);

-- Add verification state to existing user_rsi_profile
ALTER TABLE user_rsi_profile ADD COLUMN verified_at TEXT;
ALTER TABLE user_rsi_profile ADD COLUMN verified_handle TEXT;
CREATE UNIQUE INDEX idx_user_rsi_profile_verified_handle
  ON user_rsi_profile(verified_handle) WHERE verified_handle IS NOT NULL;

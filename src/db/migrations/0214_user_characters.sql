-- Character backup: store per-user CHF file + optional headshot metadata.
-- CHF blobs + headshots live in the CHARACTERS R2 bucket keyed by
-- {user_id}/{character_id}.{chf|webp}. This table tracks the metadata
-- and the R2 keys so deletion cleans up both.
CREATE TABLE IF NOT EXISTS user_characters (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id       TEXT    NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  name          TEXT    NOT NULL,
  chf_key       TEXT    NOT NULL,
  headshot_key  TEXT,
  file_size     INTEGER NOT NULL,
  created_at    TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_user_characters_user ON user_characters(user_id);

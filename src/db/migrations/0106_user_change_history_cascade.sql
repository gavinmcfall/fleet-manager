-- Migration 0106: Add ON DELETE CASCADE to user_change_history
--
-- user_change_history.user_id had no FK constraint — deleting a user
-- left orphaned audit records. Rebuild with REFERENCES + CASCADE.

ALTER TABLE user_change_history RENAME TO user_change_history_old;

CREATE TABLE user_change_history (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id       TEXT    NOT NULL REFERENCES user(id) ON DELETE CASCADE,
    event_type_id INTEGER NOT NULL REFERENCES change_event_types(id),
    provider_id   TEXT,
    field_name    TEXT,
    old_value     TEXT,
    new_value     TEXT,
    metadata      TEXT,
    ip_address    TEXT,
    created_at    DATETIME DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO user_change_history SELECT * FROM user_change_history_old;
DROP TABLE user_change_history_old;

CREATE INDEX IF NOT EXISTS idx_user_change_history_user_id    ON user_change_history(user_id);
CREATE INDEX IF NOT EXISTS idx_user_change_history_event_type ON user_change_history(event_type_id);
CREATE INDEX IF NOT EXISTS idx_user_change_history_created_at ON user_change_history(created_at);

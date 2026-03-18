-- Player reputation: ratings, reviews, and audit log for post-op feedback

CREATE TABLE rating_categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  key TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  description TEXT
);
INSERT INTO rating_categories (key, label, description) VALUES
  ('reliability', 'Reliability', 'Shows up on time, follows through'),
  ('skill', 'Skill', 'Competent at their role'),
  ('communication', 'Communication', 'Responsive, clear, keeps team informed'),
  ('fairness', 'Fairness', 'Honest, fair dealings, trustworthy with money');

CREATE TABLE player_ratings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  rater_user_id TEXT NOT NULL,
  ratee_user_id TEXT NOT NULL,
  org_op_id INTEGER REFERENCES org_ops(id),
  rating_category_id INTEGER NOT NULL REFERENCES rating_categories(id),
  score INTEGER NOT NULL CHECK (score >= 1 AND score <= 5),
  ip_address TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  UNIQUE(rater_user_id, ratee_user_id, org_op_id, rating_category_id)
);
CREATE INDEX idx_player_ratings_ratee ON player_ratings(ratee_user_id);
CREATE INDEX idx_player_ratings_rater ON player_ratings(rater_user_id);
CREATE INDEX idx_player_ratings_op ON player_ratings(org_op_id);

CREATE TABLE player_reviews (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  rater_user_id TEXT NOT NULL,
  ratee_user_id TEXT NOT NULL,
  org_op_id INTEGER REFERENCES org_ops(id),
  comment TEXT NOT NULL,
  ip_address TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  UNIQUE(rater_user_id, ratee_user_id, org_op_id)
);
CREATE INDEX idx_player_reviews_ratee ON player_reviews(ratee_user_id);

CREATE TABLE rating_audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  action TEXT NOT NULL,
  actor_user_id TEXT NOT NULL,
  target_rating_id INTEGER,
  target_review_id INTEGER,
  detail TEXT,
  ip_address TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX idx_rating_audit_log_actor ON rating_audit_log(actor_user_id);
CREATE INDEX idx_rating_audit_log_created ON rating_audit_log(created_at);

-- Materialized reputation (updated on each new rating)
CREATE TABLE player_reputation (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  rating_category_id INTEGER NOT NULL REFERENCES rating_categories(id),
  median_score REAL NOT NULL DEFAULT 0,
  rating_count INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT DEFAULT (datetime('now')),
  UNIQUE(user_id, rating_category_id)
);
CREATE INDEX idx_player_reputation_user ON player_reputation(user_id);

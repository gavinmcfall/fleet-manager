-- Org Ops: structured operations (mining runs, cargo hauls, etc.) with payout tracking

-- Op types lookup
CREATE TABLE op_types (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  key TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL
);
INSERT INTO op_types (key, label) VALUES
  ('mining', 'Mining Run'),
  ('cargo', 'Cargo Haul'),
  ('bounty', 'Bounty Hunting'),
  ('salvage', 'Salvage Op'),
  ('escort', 'Escort Mission'),
  ('exploration', 'Exploration'),
  ('trade', 'Trade Run'),
  ('other', 'Other');

-- Core ops table
CREATE TABLE org_ops (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  org_id TEXT NOT NULL,
  name TEXT NOT NULL,
  op_type_id INTEGER NOT NULL REFERENCES op_types(id),
  status TEXT NOT NULL DEFAULT 'planning',
  description TEXT,
  created_by TEXT NOT NULL,
  started_at TEXT,
  completed_at TEXT,
  webhook_url TEXT,
  is_public INTEGER NOT NULL DEFAULT 0,
  join_code TEXT,
  join_code_expires_at TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX idx_org_ops_org_id ON org_ops(org_id);
CREATE INDEX idx_org_ops_status ON org_ops(status);
CREATE INDEX idx_org_ops_created_by ON org_ops(created_by);
CREATE UNIQUE INDEX idx_org_ops_join_code ON org_ops(join_code) WHERE join_code IS NOT NULL;

-- Participants
CREATE TABLE org_op_participants (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  org_op_id INTEGER NOT NULL REFERENCES org_ops(id),
  user_id TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'member',
  payout_ratio REAL,
  joined_at TEXT DEFAULT (datetime('now')),
  left_at TEXT,
  logged_off INTEGER NOT NULL DEFAULT 0,
  UNIQUE(org_op_id, user_id)
);
CREATE INDEX idx_org_op_participants_op ON org_op_participants(org_op_id);
CREATE INDEX idx_org_op_participants_user ON org_op_participants(user_id);

-- Ships assigned (links to user_fleet for specific ship instances)
CREATE TABLE org_op_ships (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  org_op_id INTEGER NOT NULL REFERENCES org_ops(id),
  user_fleet_id INTEGER NOT NULL REFERENCES user_fleet(id),
  owner_user_id TEXT NOT NULL,
  role TEXT,
  UNIQUE(org_op_id, user_fleet_id)
);
CREATE INDEX idx_org_op_ships_op ON org_op_ships(org_op_id);

-- Capital contributions
CREATE TABLE org_op_capital (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  org_op_id INTEGER NOT NULL REFERENCES org_ops(id),
  user_id TEXT NOT NULL,
  amount INTEGER NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'aUEC',
  note TEXT,
  paid INTEGER NOT NULL DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX idx_org_op_capital_op ON org_op_capital(org_op_id);

-- Earnings
CREATE TABLE org_op_earnings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  org_op_id INTEGER NOT NULL REFERENCES org_ops(id),
  amount INTEGER NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'aUEC',
  note TEXT,
  logged_by TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX idx_org_op_earnings_op ON org_op_earnings(org_op_id);

-- Payouts (calculated on completion)
CREATE TABLE org_op_payouts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  org_op_id INTEGER NOT NULL REFERENCES org_ops(id),
  user_id TEXT NOT NULL,
  amount INTEGER NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'aUEC',
  paid INTEGER NOT NULL DEFAULT 0,
  paid_at TEXT,
  UNIQUE(org_op_id, user_id)
);
CREATE INDEX idx_org_op_payouts_op ON org_op_payouts(org_op_id);
CREATE INDEX idx_org_op_payouts_user ON org_op_payouts(user_id);

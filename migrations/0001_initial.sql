CREATE TABLE IF NOT EXISTS fixtures (
  id TEXT PRIMARY KEY,
  league_id INTEGER,
  league_name TEXT,
  country TEXT,
  kickoff_utc TEXT NOT NULL,
  status TEXT,
  home_team_id INTEGER,
  home_team TEXT NOT NULL,
  away_team_id INTEGER,
  away_team TEXT NOT NULL,
  home_goals INTEGER,
  away_goals INTEGER,
  raw_json TEXT,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_fixtures_kickoff ON fixtures(kickoff_utc);
CREATE INDEX IF NOT EXISTS idx_fixtures_league ON fixtures(league_id);

CREATE TABLE IF NOT EXISTS predictions (
  prediction_id TEXT PRIMARY KEY,
  fixture_id TEXT NOT NULL,
  model_version TEXT NOT NULL,
  generated_at TEXT NOT NULL,
  home_probability REAL NOT NULL,
  draw_probability REAL NOT NULL,
  away_probability REAL NOT NULL,
  over25_probability REAL NOT NULL,
  btts_probability REAL NOT NULL,
  expected_home_goals REAL NOT NULL,
  expected_away_goals REAL NOT NULL,
  confidence INTEGER NOT NULL,
  verdict TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING',
  actual_home_goals INTEGER,
  actual_away_goals INTEGER,
  graded_at TEXT,
  FOREIGN KEY (fixture_id) REFERENCES fixtures(id)
);

CREATE INDEX IF NOT EXISTS idx_predictions_fixture ON predictions(fixture_id);
CREATE INDEX IF NOT EXISTS idx_predictions_generated ON predictions(generated_at);

CREATE TABLE IF NOT EXISTS sync_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  run_at TEXT NOT NULL,
  provider TEXT NOT NULL,
  fixtures_seen INTEGER NOT NULL DEFAULT 0,
  fixtures_written INTEGER NOT NULL DEFAULT 0,
  error TEXT
);

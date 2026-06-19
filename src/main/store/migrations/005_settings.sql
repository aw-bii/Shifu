CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

INSERT OR IGNORE INTO settings (key, value) VALUES ('wizard_done', '0');
INSERT OR IGNORE INTO settings (key, value) VALUES ('theme', 'system');

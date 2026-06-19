CREATE TABLE IF NOT EXISTS pipeline_templates (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS pipeline_steps (
  id           TEXT PRIMARY KEY,
  template_id  TEXT NOT NULL REFERENCES pipeline_templates(id) ON DELETE CASCADE,
  step_order   INTEGER NOT NULL,
  backend_id   TEXT NOT NULL,
  persona_id   TEXT REFERENCES personas(id) ON DELETE SET NULL
);

ALTER TABLE conversations ADD COLUMN pipeline_template_id TEXT REFERENCES pipeline_templates(id);

ALTER TABLE messages ADD COLUMN step_index INTEGER;

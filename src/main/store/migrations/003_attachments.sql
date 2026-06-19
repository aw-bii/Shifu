CREATE TABLE IF NOT EXISTS attachments (
  id               TEXT PRIMARY KEY,
  message_id       TEXT NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  original_name    TEXT NOT NULL,
  stored_path      TEXT NOT NULL,
  mime_type        TEXT NOT NULL,
  size_bytes       INTEGER NOT NULL,
  extracted_text   TEXT,
  extraction_error INTEGER NOT NULL DEFAULT 0,
  created_at       INTEGER NOT NULL
);

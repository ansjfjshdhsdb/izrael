-- Older installations may still have sample licenses. Keep all unmarked records.
DELETE FROM licenses WHERE json_type(record, '$.demo') = 'true';

CREATE TABLE IF NOT EXISTS admin_sessions (
  session_key TEXT PRIMARY KEY,
  expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS session_expiry ON admin_sessions(expires_at);

CREATE TABLE IF NOT EXISTS login_attempts (
  client_key TEXT PRIMARY KEY,
  attempts INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS attempt_expiry ON login_attempts(expires_at);

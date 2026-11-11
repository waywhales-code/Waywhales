CREATE TABLE IF NOT EXISTS push_subscriptions (
  device_id TEXT PRIMARY KEY,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  timezone TEXT NOT NULL,
  reminder_time TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1,
  last_sent_local_date TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_push_due
  ON push_subscriptions(enabled, reminder_time);

-- Reuse one VAPID JWT per push-service audience instead of creating a new
-- token for every device notification. Tokens expire after 12 hours.
CREATE TABLE IF NOT EXISTS vapid_tokens (
  audience TEXT PRIMARY KEY,
  token TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

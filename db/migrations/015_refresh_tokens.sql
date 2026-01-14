ALTER TABLE users
ADD COLUMN IF NOT EXISTS refresh_token_hash TEXT,
ADD COLUMN IF NOT EXISTS refresh_expires TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_users_refresh_token_hash ON users (refresh_token_hash);

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS reset_token text,
  ADD COLUMN IF NOT EXISTS reset_expires timestamptz;

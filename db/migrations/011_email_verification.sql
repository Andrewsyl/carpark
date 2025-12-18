-- Add email verification fields. Existing users are marked verified.
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS email_verified boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS verification_token text,
  ADD COLUMN IF NOT EXISTS verification_expires timestamptz;

UPDATE users SET email_verified = true WHERE email_verified IS NULL;

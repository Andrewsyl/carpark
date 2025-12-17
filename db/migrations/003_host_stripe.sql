ALTER TABLE users
ADD COLUMN IF NOT EXISTS host_stripe_account_id text;

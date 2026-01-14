ALTER TABLE bookings
ADD COLUMN IF NOT EXISTS platform_fee_cents integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS payout_status text DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS payout_available_at timestamptz,
ADD COLUMN IF NOT EXISTS stripe_transfer_id text;

CREATE INDEX IF NOT EXISTS bookings_payout_status_idx ON bookings(payout_status);
CREATE INDEX IF NOT EXISTS bookings_payout_available_idx ON bookings(payout_available_at);

UPDATE bookings
SET platform_fee_cents = COALESCE(platform_fee_cents, ROUND(amount_cents * 0.10))
WHERE amount_cents IS NOT NULL;

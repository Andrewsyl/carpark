ALTER TABLE bookings
ADD COLUMN IF NOT EXISTS refund_status text,
ADD COLUMN IF NOT EXISTS refund_id text,
ADD COLUMN IF NOT EXISTS refunded_at timestamptz;

CREATE INDEX IF NOT EXISTS bookings_refund_status_idx ON bookings(refund_status);

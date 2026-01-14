ALTER TABLE bookings
ADD COLUMN IF NOT EXISTS checked_in_at timestamptz,
ADD COLUMN IF NOT EXISTS no_show_at timestamptz;

CREATE INDEX IF NOT EXISTS bookings_checked_in_idx ON bookings(checked_in_at);
CREATE INDEX IF NOT EXISTS bookings_no_show_idx ON bookings(no_show_at);

ALTER TABLE bookings
ADD COLUMN IF NOT EXISTS status text DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS checkout_session_id text,
ADD COLUMN IF NOT EXISTS amount_cents integer,
ADD COLUMN IF NOT EXISTS currency text;

CREATE INDEX IF NOT EXISTS bookings_status_idx ON bookings(status);
CREATE INDEX IF NOT EXISTS bookings_checkout_session_idx ON bookings(checkout_session_id);

ALTER TABLE listings
ADD COLUMN IF NOT EXISTS image_urls text[] DEFAULT '{}';

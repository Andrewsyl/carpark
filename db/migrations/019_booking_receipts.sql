ALTER TABLE bookings
ADD COLUMN IF NOT EXISTS receipt_url text;

CREATE INDEX IF NOT EXISTS bookings_receipt_url_idx ON bookings(receipt_url);

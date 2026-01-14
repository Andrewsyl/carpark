-- Prevent overlapping bookings for the same listing (ignores canceled bookings).
CREATE EXTENSION IF NOT EXISTS btree_gist;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'bookings_no_overlap'
  ) THEN
    ALTER TABLE bookings
      ADD CONSTRAINT bookings_no_overlap
      EXCLUDE USING gist (
        listing_id WITH =,
        tstzrange(start_time, end_time, '[)') WITH &&
      )
      WHERE (status IS NULL OR status <> 'canceled');
  END IF;
END $$;

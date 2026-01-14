DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'fk_host'
  ) THEN
    ALTER TABLE listings
    ADD CONSTRAINT fk_host
    FOREIGN KEY (host_id)
    REFERENCES users(id)
    ON DELETE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'fk_listing'
  ) THEN
    ALTER TABLE bookings
    ADD CONSTRAINT fk_listing
    FOREIGN KEY (listing_id)
    REFERENCES listings(id)
    ON DELETE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'fk_driver'
  ) THEN
    ALTER TABLE bookings
    ADD CONSTRAINT fk_driver
    FOREIGN KEY (driver_id)
    REFERENCES users(id)
    ON DELETE CASCADE;
  END IF;
END $$;

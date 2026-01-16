DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'listings'
      AND column_name = 'price_per_day'
      AND data_type = 'integer'
  ) THEN
    ALTER TABLE listings
    ALTER COLUMN price_per_day TYPE numeric(10, 2)
    USING price_per_day::numeric(10, 2);
  END IF;
END $$;

ALTER TABLE listings
ADD COLUMN IF NOT EXISTS access_code TEXT;

ALTER TABLE listings
ADD COLUMN IF NOT EXISTS permission_declared BOOLEAN NOT NULL DEFAULT FALSE;

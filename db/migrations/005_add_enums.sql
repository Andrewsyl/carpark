DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
    CREATE TYPE user_role AS ENUM ('driver', 'host');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'booking_status') THEN
    CREATE TYPE booking_status AS ENUM ('pending', 'confirmed', 'canceled');
  END IF;
END $$;

-- Note: default values needs to be dropped and re-created to avoid type conflicts
ALTER TABLE users
  ALTER COLUMN role DROP DEFAULT,
  ALTER COLUMN role TYPE user_role USING role::user_role,
  ALTER COLUMN role SET DEFAULT 'driver';

ALTER TABLE bookings
  ALTER COLUMN status DROP DEFAULT,
  ALTER COLUMN status TYPE booking_status USING status::booking_status,
  ALTER COLUMN status SET DEFAULT 'pending';

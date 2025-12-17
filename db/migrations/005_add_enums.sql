CREATE TYPE user_role AS ENUM ('driver', 'host');
CREATE TYPE booking_status AS ENUM ('pending', 'confirmed', 'canceled');

-- Note: default values needs to be dropped and re-created to avoid type conflicts
ALTER TABLE users
  ALTER COLUMN role DROP DEFAULT,
  ALTER COLUMN role TYPE user_role USING role::user_role,
  ALTER COLUMN role SET DEFAULT 'driver';

ALTER TABLE bookings
  ALTER COLUMN status DROP DEFAULT,
  ALTER COLUMN status TYPE booking_status USING status::booking_status,
  ALTER COLUMN status SET DEFAULT 'pending';

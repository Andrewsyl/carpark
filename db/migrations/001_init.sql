CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE NOT NULL,
  password_hash text NOT NULL,
  role text DEFAULT 'driver',
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS listings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  address text NOT NULL,
  price_per_day integer NOT NULL,
  availability_text text NOT NULL,
  host_id uuid NOT NULL,
  amenities text[] DEFAULT '{}',
  rating numeric,
  geom geometry(Point, 4326) NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid REFERENCES listings(id),
  driver_id uuid NOT NULL,
  start_time timestamptz NOT NULL,
  end_time timestamptz NOT NULL,
  payment_intent_id text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS listings_geom_idx ON listings USING GIST (geom);
CREATE INDEX IF NOT EXISTS bookings_timerange_idx ON bookings USING GIST (tstzrange(start_time, end_time));

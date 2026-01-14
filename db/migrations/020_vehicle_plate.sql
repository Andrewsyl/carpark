ALTER TABLE bookings
ADD COLUMN IF NOT EXISTS vehicle_plate text;

CREATE INDEX IF NOT EXISTS bookings_vehicle_plate_idx ON bookings(vehicle_plate);

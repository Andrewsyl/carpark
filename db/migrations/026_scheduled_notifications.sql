CREATE TABLE IF NOT EXISTS scheduled_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  booking_id uuid REFERENCES bookings(id) ON DELETE CASCADE,
  type text NOT NULL,
  scheduled_at timestamptz NOT NULL,
  payload jsonb,
  sent_at timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_scheduled_notifications_due
  ON scheduled_notifications (scheduled_at)
  WHERE sent_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_scheduled_notifications_booking_type
  ON scheduled_notifications (booking_id, type);

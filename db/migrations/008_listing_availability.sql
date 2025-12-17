-- Host-managed availability (one-off and simple weekly recurrence)

CREATE TABLE IF NOT EXISTS listing_availability (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('open', 'blocked')),
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  repeat_weekdays INT[] NULL, -- 0=Sunday ... 6=Saturday
  repeat_until DATE NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_listing_availability_listing ON listing_availability(listing_id);
CREATE INDEX IF NOT EXISTS idx_listing_availability_repeat ON listing_availability USING GIN (repeat_weekdays);
CREATE INDEX IF NOT EXISTS idx_listing_availability_time ON listing_availability(starts_at, ends_at);

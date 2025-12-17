-- Reviews & ratings (driver -> listing/host, host -> driver)

CREATE TABLE IF NOT EXISTS reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  target_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  listing_id UUID NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('driver_review', 'host_review')),
  rating NUMERIC(3,1) NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (booking_id, role)
);

ALTER TABLE listings
  ADD COLUMN IF NOT EXISTS rating_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS rating NUMERIC(3,1) NOT NULL DEFAULT 5;

CREATE INDEX IF NOT EXISTS idx_reviews_listing_id_created_at ON reviews (listing_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reviews_target_user ON reviews (target_user_id);
CREATE INDEX IF NOT EXISTS idx_reviews_author ON reviews (author_id);

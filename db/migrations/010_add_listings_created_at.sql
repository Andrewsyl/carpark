-- Add created_at to listings for admin views and ordering
ALTER TABLE listings
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now();

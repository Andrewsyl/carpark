CREATE TABLE IF NOT EXISTS favorites (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  listing_id uuid NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (user_id, listing_id)
);

CREATE INDEX IF NOT EXISTS favorites_user_idx ON favorites(user_id);

ALTER TABLE listings
ADD COLUMN IF NOT EXISTS image_urls text[] DEFAULT '{}';

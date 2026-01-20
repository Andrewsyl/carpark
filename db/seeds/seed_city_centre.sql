-- Add 10 more parking spaces in Dublin City Centre
-- Using existing host user

INSERT INTO listings (id, host_id, title, address, price_per_day, availability_text, geom, amenities, image_urls, status)
VALUES
  -- Grafton Street area
  (gen_random_uuid(), (SELECT id FROM users LIMIT 1), 'Premium Parking - Grafton Quarter', 'Grafton Street, Dublin 2', 1800, 'Available 24/7', ST_SetSRID(ST_MakePoint(-6.2602, 53.3420), 4326), ARRAY['Covered', 'Security Camera', '24/7 Access'], ARRAY['https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=800'], 'approved'),
  
  -- O'Connell Street
  (gen_random_uuid(), (SELECT id FROM users LIMIT 1), 'Secure Space - O''Connell Street', 'O''Connell Street Upper, Dublin 1', 1700, 'Available 24/7', ST_SetSRID(ST_MakePoint(-6.2603, 53.3515), 4326), ARRAY['Covered', 'Security Camera', 'Electric Charging'], ARRAY['https://images.unsplash.com/photo-1590674899484-d5640e854abe?w=800'], 'approved'),
  
  -- Merrion Square
  (gen_random_uuid(), (SELECT id FROM users LIMIT 1), 'Georgian Quarter Parking', 'Merrion Square West, Dublin 2', 1600, 'Available 24/7', ST_SetSRID(ST_MakePoint(-6.2503, 53.3395), 4326), ARRAY['Covered', '24/7 Access'], ARRAY['https://images.unsplash.com/photo-1506521781263-d8422e82f27a?w=800'], 'approved'),
  
  -- Trinity College area
  (gen_random_uuid(), (SELECT id FROM users LIMIT 1), 'Trinity Quarter Space', 'Nassau Street, Dublin 2', 1700, 'Available 24/7', ST_SetSRID(ST_MakePoint(-6.2546, 53.3438), 4326), ARRAY['Covered', 'Security Camera'], ARRAY['https://images.unsplash.com/photo-1582407947304-fd86f028f716?w=800'], 'approved'),
  
  -- Dame Street
  (gen_random_uuid(), (SELECT id FROM users LIMIT 1), 'Dame Street Secure Parking', 'Dame Street, Dublin 2', 1600, 'Available 24/7', ST_SetSRID(ST_MakePoint(-6.2670, 53.3445), 4326), ARRAY['Covered', '24/7 Access', 'Security Camera'], ARRAY['https://images.unsplash.com/photo-1569950044272-e04b4b26315a?w=800'], 'approved'),
  
  -- St Stephen's Green
  (gen_random_uuid(), (SELECT id FROM users LIMIT 1), 'St Stephen''s Green Parking', 'St Stephen''s Green, Dublin 2', 1800, 'Available 24/7', ST_SetSRID(ST_MakePoint(-6.2592, 53.3381), 4326), ARRAY['Covered', 'Electric Charging', '24/7 Access'], ARRAY['https://images.unsplash.com/photo-1590859808308-3d2d9c515b1a?w=800'], 'approved'),
  
  -- Henry Street
  (gen_random_uuid(), (SELECT id FROM users LIMIT 1), 'Henry Street Shopping Quarter', 'Henry Street, Dublin 1', 1700, 'Available 24/7', ST_SetSRID(ST_MakePoint(-6.2628, 53.3493), 4326), ARRAY['Covered', 'Security Camera'], ARRAY['https://images.unsplash.com/photo-1506521781263-d8422e82f27a?w=800'], 'approved'),
  
  -- Custom House
  (gen_random_uuid(), (SELECT id FROM users LIMIT 1), 'Custom House Quarter', 'Custom House Quay, Dublin 1', 1500, 'Available 24/7', ST_SetSRID(ST_MakePoint(-6.2585, 53.3484), 4326), ARRAY['Covered', '24/7 Access'], ARRAY['https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=800'], 'approved'),
  
  -- Abbey Street
  (gen_random_uuid(), (SELECT id FROM users LIMIT 1), 'Abbey Theatre District Parking', 'Abbey Street Lower, Dublin 1', 1600, 'Available 24/7', ST_SetSRID(ST_MakePoint(-6.2597, 53.3486), 4326), ARRAY['Covered', 'Security Camera', 'Electric Charging'], ARRAY['https://images.unsplash.com/photo-1582407947304-fd86f028f716?w=800'], 'approved'),
  
  -- Capel Street
  (gen_random_uuid(), (SELECT id FROM users LIMIT 1), 'Capel Street City Parking', 'Capel Street, Dublin 1', 1500, 'Available 24/7', ST_SetSRID(ST_MakePoint(-6.2677, 53.3473), 4326), ARRAY['Covered', '24/7 Access', 'Security Camera'], ARRAY['https://images.unsplash.com/photo-1590674899484-d5640e854abe?w=800'], 'approved');

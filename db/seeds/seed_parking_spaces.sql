-- Delete all bookings first (to avoid foreign key issues)
TRUNCATE TABLE bookings CASCADE;
TRUNCATE TABLE reviews CASCADE;
TRUNCATE TABLE favorites CASCADE;
TRUNCATE TABLE listing_availability CASCADE;

-- Delete all existing listings
DELETE FROM listings;

-- Insert 50 parking spaces across Dublin apartment blocks  
-- Note: Using ST_SetSRID(ST_MakePoint(longitude, latitude), 4326) for geom field
INSERT INTO listings (
  title, address, price_per_day, availability_text, host_id,
  amenities, geom, image_urls, rating_count, status
) VALUES
-- Dublin City Centre
('Grand Canal Dock Apartment Parking', 'Grand Canal Dock, Dublin 2', 1200, 'Available daily', (SELECT id FROM users LIMIT 1), ARRAY['Covered', 'Security Camera', 'Electric Charging'], ST_SetSRID(ST_MakePoint(-6.2394, 53.3419), 4326), ARRAY['https://images.unsplash.com/photo-1590674899484-d5640e854abe?w=800'], 0, 'approved'),
('Smithfield Loft Parking', 'Smithfield Square, Dublin 7', 1000, 'Available daily', (SELECT id FROM users LIMIT 1), ARRAY['Covered', '24/7 Access'], ST_SetSRID(ST_MakePoint(-6.2786, 53.3478), 4326), ARRAY['https://images.unsplash.com/photo-1506521781263-d8422e82f27a?w=800'], 0, 'approved'),
('The Spire Apartments Parking', 'O''Connell Street, Dublin 1', 1500, 'Available daily', (SELECT id FROM users LIMIT 1), ARRAY['Covered', 'Security Camera', 'Electric Charging'], ST_SetSRID(ST_MakePoint(-6.2603, 53.3498), 4326), ARRAY['https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=800'], 0, 'approved'),
('Christchurch View Apartments', 'Christchurch Place, Dublin 8', 1300, 'Available daily', (SELECT id FROM users LIMIT 1), ARRAY['Covered', 'Security Camera'], ST_SetSRID(ST_MakePoint(-6.2708, 53.3432), 4326), ARRAY['https://images.unsplash.com/photo-1469022563428-aa04fef9f5a2?w=800'], 0, 'approved'),
('Temple Bar Lofts Parking', 'Temple Bar, Dublin 2', 1800, 'Available daily', (SELECT id FROM users LIMIT 1), ARRAY['Covered', '24/7 Access'], ST_SetSRID(ST_MakePoint(-6.2644, 53.3456), 4326), ARRAY['https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=800'], 0, 'approved'),

-- South Dublin
('Ballsbridge Apartments', 'Ballsbridge, Dublin 4', 1100, 'Available daily', (SELECT id FROM users LIMIT 1), ARRAY['Covered', 'Security Camera'], ST_SetSRID(ST_MakePoint(-6.2299, 53.3275), 4326), ARRAY['https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=800'], 0, 'approved'),
('Donnybrook Village Parking', 'Donnybrook, Dublin 4', 1000, 'Available daily', (SELECT id FROM users LIMIT 1), ARRAY['Covered', 'Gated', 'Security Camera'], ST_SetSRID(ST_MakePoint(-6.2408, 53.3178), 4326), ARRAY['https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=800'], 0, 'approved'),
('Ringsend Dockside Apartments', 'Ringsend, Dublin 4', 900, 'Available daily', (SELECT id FROM users LIMIT 1), ARRAY['Covered', '24/7 Access'], ST_SetSRID(ST_MakePoint(-6.2265, 53.3410), 4326), ARRAY['https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=800'], 0, 'approved'),
('Sandymount Green Apartments', 'Sandymount, Dublin 4', 800, 'Available daily', (SELECT id FROM users LIMIT 1), ARRAY['Covered'], ST_SetSRID(ST_MakePoint(-6.2180, 53.3286), 4326), ARRAY['https://images.unsplash.com/photo-1558036117-15d82a90b9b1?w=800'], 0, 'approved'),
('Ranelagh Village Parking', 'Ranelagh, Dublin 6', 1000, 'Available daily', (SELECT id FROM users LIMIT 1), ARRAY['Covered', '24/7 Access'], ST_SetSRID(ST_MakePoint(-6.2564, 53.3223), 4326), ARRAY['https://images.unsplash.com/photo-1560184897-ae75f418493e?w=800'], 0, 'approved'),

-- North Dublin
('Drumcondra Apartments', 'Drumcondra, Dublin 9', 900, 'Available daily', (SELECT id FROM users LIMIT 1), ARRAY['Covered', 'Security Camera'], ST_SetSRID(ST_MakePoint(-6.2561, 53.3689), 4326), ARRAY['https://images.unsplash.com/photo-1605146769289-440113cc3d00?w=800'], 0, 'approved'),
('Glasnevin Park Apartments', 'Glasnevin, Dublin 11', 800, 'Available daily', (SELECT id FROM users LIMIT 1), ARRAY['Covered'], ST_SetSRID(ST_MakePoint(-6.2825, 53.3782), 4326), ARRAY['https://images.unsplash.com/photo-1515263487990-61b07816b324?w=800'], 0, 'approved'),
('Phibsborough Lofts', 'Phibsborough, Dublin 7', 1000, 'Available daily', (SELECT id FROM users LIMIT 1), ARRAY['Covered', '24/7 Access'], ST_SetSRID(ST_MakePoint(-6.2744, 53.3575), 4326), ARRAY['https://images.unsplash.com/photo-1503174971373-b1f69850bded?w=800'], 0, 'approved'),
('Stoneybatter Mill Apartments', 'Stoneybatter, Dublin 7', 950, 'Available daily', (SELECT id FROM users LIMIT 1), ARRAY['Covered', 'Security Camera'], ST_SetSRID(ST_MakePoint(-6.2837, 53.3532), 4326), ARRAY['https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=800'], 0, 'approved'),
('Cabra Park Apartments', 'Cabra, Dublin 7', 700, 'Available daily', (SELECT id FROM users LIMIT 1), ARRAY['Covered'], ST_SetSRID(ST_MakePoint(-6.2993, 53.3638), 4326), ARRAY['https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800'], 0, 'approved'),

-- West Dublin  
('Blanchardstown Apartments', 'Blanchardstown, Dublin 15', 600, 'Available daily', (SELECT id FROM users LIMIT 1), ARRAY['Covered', '24/7 Access'], ST_SetSRID(ST_MakePoint(-6.3768, 53.3877), 4326), ARRAY['https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=800'], 0, 'approved'),
('Castleknock Park Apartments', 'Castleknock, Dublin 15', 800, 'Available daily', (SELECT id FROM users LIMIT 1), ARRAY['Covered', 'Gated', 'Security Camera'], ST_SetSRID(ST_MakePoint(-6.3564, 53.3751), 4326), ARRAY['https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?w=800'], 0, 'approved'),
('Lucan Village Apartments', 'Lucan, Co. Dublin', 650, 'Available daily', (SELECT id FROM users LIMIT 1), ARRAY['Covered'], ST_SetSRID(ST_MakePoint(-6.4499, 53.3573), 4326), ARRAY['https://images.unsplash.com/photo-1600573472592-401b489a3cdc?w=800'], 0, 'approved'),
('Clondalkin Heights', 'Clondalkin, Dublin 22', 600, 'Available daily', (SELECT id FROM users LIMIT 1), ARRAY['Covered'], ST_SetSRID(ST_MakePoint(-6.3951, 53.3218), 4326), ARRAY['https://images.unsplash.com/photo-1600607687644-c7171b42498b?w=800'], 0, 'approved'),
('Palmerstown Park Apartments', 'Palmerstown, Dublin 20', 700, 'Available daily', (SELECT id FROM users LIMIT 1), ARRAY['Covered', '24/7 Access'], ST_SetSRID(ST_MakePoint(-6.3753, 53.3535), 4326), ARRAY['https://images.unsplash.com/photo-1600566752355-35792bedcfea?w=800'], 0, 'approved'),

-- East Dublin
('Howth Marina Apartments', 'Howth, Co. Dublin', 1100, 'Available daily', (SELECT id FROM users LIMIT 1), ARRAY['Covered', 'Security Camera'], ST_SetSRID(ST_MakePoint(-6.0650, 53.3888), 4326), ARRAY['https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=800'], 0, 'approved'),
('Clontarf Promenade Apartments', 'Clontarf, Dublin 3', 1000, 'Available daily', (SELECT id FROM users LIMIT 1), ARRAY['Covered'], ST_SetSRID(ST_MakePoint(-6.2046, 53.3669), 4326), ARRAY['https://images.unsplash.com/photo-1600585154526-990dced4db0d?w=800'], 0, 'approved'),
('Raheny Village Apartments', 'Raheny, Dublin 5', 800, 'Available daily', (SELECT id FROM users LIMIT 1), ARRAY['Covered', '24/7 Access'], ST_SetSRID(ST_MakePoint(-6.1711, 53.3808), 4326), ARRAY['https://images.unsplash.com/photo-1600566752229-250ed79470d5?w=800'], 0, 'approved'),
('Killester Park Apartments', 'Killester, Dublin 5', 850, 'Available daily', (SELECT id FROM users LIMIT 1), ARRAY['Covered'], ST_SetSRID(ST_MakePoint(-6.1969, 53.3711), 4326), ARRAY['https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?w=800'], 0, 'approved'),
('Sutton Cross Apartments', 'Sutton, Dublin 13', 900, 'Available daily', (SELECT id FROM users LIMIT 1), ARRAY['Covered', 'Security Camera'], ST_SetSRID(ST_MakePoint(-6.1165, 53.3911), 4326), ARRAY['https://images.unsplash.com/photo-1600566753086-00f18fb6b3ea?w=800'], 0, 'approved'),

-- South County Dublin
('Dun Laoghaire Harbour Apartments', 'Dun Laoghaire, Co. Dublin', 1200, 'Available daily', (SELECT id FROM users LIMIT 1), ARRAY['Covered', 'Security Camera', 'Electric Charging'], ST_SetSRID(ST_MakePoint(-6.1351, 53.2948), 4326), ARRAY['https://images.unsplash.com/photo-1600585152915-d208bec867a1?w=800'], 0, 'approved'),
('Blackrock Village Apartments', 'Blackrock, Co. Dublin', 1100, 'Available daily', (SELECT id FROM users LIMIT 1), ARRAY['Covered', 'Gated'], ST_SetSRID(ST_MakePoint(-6.1774, 53.3015), 4326), ARRAY['https://images.unsplash.com/photo-1600573472550-8090b5e0745e?w=800'], 0, 'approved'),
('Monkstown Farm Apartments', 'Monkstown, Co. Dublin', 1000, 'Available daily', (SELECT id FROM users LIMIT 1), ARRAY['Covered'], ST_SetSRID(ST_MakePoint(-6.1536, 53.2926), 4326), ARRAY['https://images.unsplash.com/photo-1600585154363-67eb9e2e2099?w=800'], 0, 'approved'),
('Stillorgan Park Apartments', 'Stillorgan, Co. Dublin', 900, 'Available daily', (SELECT id FROM users LIMIT 1), ARRAY['Covered', '24/7 Access'], ST_SetSRID(ST_MakePoint(-6.1984, 53.2892), 4326), ARRAY['https://images.unsplash.com/photo-1600566752355-35792bedcfea?w=800'], 0, 'approved'),
('Dundrum Town Apartments', 'Dundrum, Dublin 14', 1400, 'Available daily', (SELECT id FROM users LIMIT 1), ARRAY['Covered', 'Security Camera', 'Electric Charging'], ST_SetSRID(ST_MakePoint(-6.2438, 53.2880), 4326), ARRAY['https://images.unsplash.com/photo-1600573472592-401b489a3cdc?w=800'], 0, 'approved'),

-- Additional City Centre
('IFSC Apartments', 'IFSC, Dublin 1', 1600, 'Available daily', (SELECT id FROM users LIMIT 1), ARRAY['Covered', 'Security Camera', 'Electric Charging'], ST_SetSRID(ST_MakePoint(-6.2425, 53.3488), 4326), ARRAY['https://images.unsplash.com/photo-1600607687644-c7171b42498b?w=800'], 0, 'approved'),
('Portobello Harbour Apartments', 'Portobello, Dublin 8', 1100, 'Available daily', (SELECT id FROM users LIMIT 1), ARRAY['Covered', '24/7 Access'], ST_SetSRID(ST_MakePoint(-6.2639, 53.3336), 4326), ARRAY['https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?w=800'], 0, 'approved'),
('Rathmines Village Apartments', 'Rathmines, Dublin 6', 900, 'Available daily', (SELECT id FROM users LIMIT 1), ARRAY['Covered'], ST_SetSRID(ST_MakePoint(-6.2648, 53.3216), 4326), ARRAY['https://images.unsplash.com/photo-1600585152915-d208bec867a1?w=800'], 0, 'approved'),
('Harold''s Cross Apartments', 'Harold''s Cross, Dublin 6W', 850, 'Available daily', (SELECT id FROM users LIMIT 1), ARRAY['Covered'], ST_SetSRID(ST_MakePoint(-6.2802, 53.3254), 4326), ARRAY['https://images.unsplash.com/photo-1600573472550-8090b5e0745e?w=800'], 0, 'approved'),
('Terenure Village Apartments', 'Terenure, Dublin 6W', 800, 'Available daily', (SELECT id FROM users LIMIT 1), ARRAY['Covered', '24/7 Access'], ST_SetSRID(ST_MakePoint(-6.2835, 53.3084), 4326), ARRAY['https://images.unsplash.com/photo-1600566752229-250ed79470d5?w=800'], 0, 'approved'),

-- More North Dublin
('Fairview Park Apartments', 'Fairview, Dublin 3', 950, 'Available daily', (SELECT id FROM users LIMIT 1), ARRAY['Covered'], ST_SetSRID(ST_MakePoint(-6.2354, 53.3636), 4326), ARRAY['https://images.unsplash.com/photo-1600566752355-35792bedcfea?w=800'], 0, 'approved'),
('Artane Apartments', 'Artane, Dublin 5', 750, 'Available daily', (SELECT id FROM users LIMIT 1), ARRAY['Covered'], ST_SetSRID(ST_MakePoint(-6.2223, 53.3846), 4326), ARRAY['https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800'], 0, 'approved'),
('Coolock Village Apartments', 'Coolock, Dublin 5', 700, 'Available daily', (SELECT id FROM users LIMIT 1), ARRAY['Covered'], ST_SetSRID(ST_MakePoint(-6.2037, 53.3892), 4326), ARRAY['https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=800'], 0, 'approved'),
('Santry Park Apartments', 'Santry, Dublin 9', 800, 'Available daily', (SELECT id FROM users LIMIT 1), ARRAY['Covered', '24/7 Access'], ST_SetSRID(ST_MakePoint(-6.2596, 53.3983), 4326), ARRAY['https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=800'], 0, 'approved'),
('Beaumont Apartments', 'Beaumont, Dublin 9', 850, 'Available daily', (SELECT id FROM users LIMIT 1), ARRAY['Covered'], ST_SetSRID(ST_MakePoint(-6.2374, 53.3869), 4326), ARRAY['https://images.unsplash.com/photo-1600585154526-990dced4db0d?w=800'], 0, 'approved'),

-- More South Dublin
('Rathgar Village Apartments', 'Rathgar, Dublin 6', 1050, 'Available daily', (SELECT id FROM users LIMIT 1), ARRAY['Covered', 'Security Camera'], ST_SetSRID(ST_MakePoint(-6.2714, 53.3144), 4326), ARRAY['https://images.unsplash.com/photo-1600566753086-00f18fb6b3ea?w=800'], 0, 'approved'),
('Milltown Apartments', 'Milltown, Dublin 6', 1000, 'Available daily', (SELECT id FROM users LIMIT 1), ARRAY['Covered', '24/7 Access'], ST_SetSRID(ST_MakePoint(-6.2470, 53.3074), 4326), ARRAY['https://images.unsplash.com/photo-1600573472592-401b489a3cdc?w=800'], 0, 'approved'),
('Churchtown Village Apartments', 'Churchtown, Dublin 14', 900, 'Available daily', (SELECT id FROM users LIMIT 1), ARRAY['Covered'], ST_SetSRID(ST_MakePoint(-6.2645, 53.2982), 4326), ARRAY['https://images.unsplash.com/photo-1600607687644-c7171b42498b?w=800'], 0, 'approved'),
('Windy Arbour Apartments', 'Windy Arbour, Dublin 14', 850, 'Available daily', (SELECT id FROM users LIMIT 1), ARRAY['Covered'], ST_SetSRID(ST_MakePoint(-6.2573, 53.3026), 4326), ARRAY['https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?w=800'], 0, 'approved'),
('Clonskeagh Apartments', 'Clonskeagh, Dublin 14', 950, 'Available daily', (SELECT id FROM users LIMIT 1), ARRAY['Covered', 'Security Camera'], ST_SetSRID(ST_MakePoint(-6.2280, 53.3083), 4326), ARRAY['https://images.unsplash.com/photo-1600585152915-d208bec867a1?w=800'], 0, 'approved'),

-- Final additions
('Rialto Bridge Apartments', 'Rialto, Dublin 8', 900, 'Available daily', (SELECT id FROM users LIMIT 1), ARRAY['Covered', '24/7 Access'], ST_SetSRID(ST_MakePoint(-6.2960, 53.3367), 4326), ARRAY['https://images.unsplash.com/photo-1600573472550-8090b5e0745e?w=800'], 0, 'approved'),
('Inchicore Village Apartments', 'Inchicore, Dublin 8', 750, 'Available daily', (SELECT id FROM users LIMIT 1), ARRAY['Covered'], ST_SetSRID(ST_MakePoint(-6.3155, 53.3390), 4326), ARRAY['https://images.unsplash.com/photo-1600566752229-250ed79470d5?w=800'], 0, 'approved'),
('Walkinstown Park Apartments', 'Walkinstown, Dublin 12', 700, 'Available daily', (SELECT id FROM users LIMIT 1), ARRAY['Covered'], ST_SetSRID(ST_MakePoint(-6.3346, 53.3174), 4326), ARRAY['https://images.unsplash.com/photo-1600566752355-35792bedcfea?w=800'], 0, 'approved'),
('Crumlin Village Apartments', 'Crumlin, Dublin 12', 750, 'Available daily', (SELECT id FROM users LIMIT 1), ARRAY['Covered'], ST_SetSRID(ST_MakePoint(-6.3171, 53.3238), 4326), ARRAY['https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800'], 0, 'approved'),
('Kimmage Manor Apartments', 'Kimmage, Dublin 12', 800, 'Available daily', (SELECT id FROM users LIMIT 1), ARRAY['Covered', '24/7 Access'], ST_SetSRID(ST_MakePoint(-6.3000, 53.3162), 4326), ARRAY['https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=800'], 0, 'approved');


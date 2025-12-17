# ParkShare Dublin

MVP scaffold for a peer-to-peer parking marketplace in Dublin. Frontend is Next.js 15 + Tailwind; backend is Express + PostgreSQL/PostGIS with Stripe Connect stubs.

## Structure
- `apps/web`: Next.js App Router UI (landing, search, host form, dashboard)
- `apps/api`: Express API with Postgres, PostGIS geosearch, and Stripe Connect checkout placeholder
- `tsconfig.base.json`: shared TypeScript config
- `.env.example`: required environment variables

## Getting started
1) Install deps (workspaces):
```bash
npm install
npm run dev:web     # Next.js on 3000
npm run dev:api     # Express on 4000
```
2) Copy `.env.example` to `.env` and fill values.
3) Ensure Postgres has PostGIS: `CREATE EXTENSION IF NOT EXISTS postgis;`

### Env vars
- `WEB_BASE_URL`, `NEXT_PUBLIC_API_BASE`
- `DATABASE_URL` (Postgres with PostGIS)
- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`
- `GOOGLE_MAPS_API_KEY`
- `JWT_SECRET` (for API-issued JWTs)

## API outline
- `GET /api/listings/search?lat=53.3498&lng=-6.2603&radiusKm=5&from=2024-12-20T09:00:00Z&to=2024-12-20T17:00:00Z`
  - Uses `ST_DWithin` to find spaces within radius and filters overlapping bookings via `tstzrange`.
- `POST /api/listings`
  - Body: `{ title, address, pricePerDay, availabilityText, hostId, latitude, longitude, amenities? }`
  - Inserts listing with PostGIS geometry.
- `POST /api/bookings`
  - Body: `{ listingId, driverId, from, to, amountCents, currency?, hostStripeAccountId, platformFeePercent? }`
  - Checks for overlap, creates Stripe Checkout session with application fee, stores pending booking. Confirm via webhook in production.

## Database notes
Example DDL:
```sql
CREATE TABLE listings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  address text NOT NULL,
  price_per_day integer NOT NULL,
  availability_text text NOT NULL,
  host_id uuid NOT NULL,
  amenities text[] DEFAULT '{}',
  rating numeric,
  geom geometry(Point, 4326) NOT NULL
);

CREATE TABLE bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid REFERENCES listings(id),
  driver_id uuid NOT NULL,
  start_time timestamptz NOT NULL,
  end_time timestamptz NOT NULL,
  payment_intent_id text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX listings_geom_idx ON listings USING GIST (geom);
CREATE INDEX bookings_timerange_idx ON bookings USING GIST (tstzrange(start_time, end_time));

CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE NOT NULL,
  password_hash text NOT NULL,
  role text DEFAULT 'driver',
  created_at timestamptz DEFAULT now()
);
```

## Stripe Connect flow (stubbed)
- Store each host's `stripe_account_id` after onboarding.
- When booking, create Checkout Session with `application_fee_amount` + `transfer_data.destination = host_account`.
- Handle webhooks for `checkout.session.completed` and `payment_intent.succeeded` to mark booking confirmed and trigger payout.

## Frontend pages
- `/` landing with search form and featured listings
- `/search` driver search results + map placeholder (Google Maps JS API)
- `/host` host listing form + recent bookings
- `/dashboard` combined driver + host bookings
- `/login` / `/signup` email/password auth hitting the Express API (JWT stored in localStorage)

## Next steps
- Wire auth (email/password) and session management.
- Replace mock data with API calls to `apps/api` endpoints.
- Add Stripe webhook handler + host onboarding routes.
- Integrate Google Maps Places Autocomplete and pass geometry to backend.
- Add image upload (S3/Cloudinary) and persistence for photos.

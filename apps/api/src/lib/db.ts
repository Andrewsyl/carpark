import "../loadEnv.js";
import { Pool } from "pg";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.warn("DATABASE_URL not set. Database calls will fail until configured.");
}

export const pool = new Pool({ connectionString });

type ReviewRole = "driver_review" | "host_review";

export type UserRecord = {
  id: string;
  email: string;
  password_hash: string;
  role?: "driver" | "host" | "admin";
  host_stripe_account_id?: string | null;
  email_verified?: boolean;
  verification_token?: string | null;
  verification_expires?: Date | null;
};

export type SpaceSearchInput = {
  lat: number;
  lng: number;
  radiusKm: number;
  from: string;
  to: string;
  spaceType?: string;
};

export async function findAvailableSpaces(input: SpaceSearchInput) {
  const { lat, lng, radiusKm, from, to, spaceType } = input;
  const spaceTypeFilter = spaceType?.trim()
    ? `%${spaceType.trim().toLowerCase()}%`
    : null;
  const baseQuery = `
    SELECT
      id,
      title,
      address,
      price_per_day,
      rating,
      rating_count,
      availability_text,
      ST_X(geom) AS longitude,
      ST_Y(geom) AS latitude,
      ST_Distance(
        geom::geography,
        ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography
      ) AS distance_m
    FROM listings
    WHERE ST_DWithin(
      geom::geography,
      ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography,
      $3
    )
    AND status <> 'archived'
    AND ($6::text IS NULL OR lower(title) LIKE $6)
    AND NOT EXISTS (
      SELECT 1 FROM bookings b
      WHERE b.listing_id = listings.id
      AND (b.status IS NULL OR b.status <> 'canceled')
      AND tstzrange(b.start_time, b.end_time, '[)') && tstzrange($4::timestamptz, $5::timestamptz, '[)')
    )
    AND NOT EXISTS (
      SELECT 1 FROM listing_availability a
      WHERE a.listing_id = listings.id
        AND a.kind = 'blocked'
        AND (
          (a.repeat_weekdays IS NULL AND tstzrange(a.starts_at, a.ends_at, '[)') && tstzrange($4::timestamptz, $5::timestamptz, '[)'))
          OR (
            a.repeat_weekdays IS NOT NULL
            AND (a.repeat_until IS NULL OR a.repeat_until >= $4::date)
            AND EXISTS (
              SELECT 1
              FROM generate_series(date_trunc('day', $4::timestamptz), date_trunc('day', $5::timestamptz), interval '1 day') d
              WHERE extract(dow FROM d) = ANY(a.repeat_weekdays)
                AND tstzrange(d + (a.starts_at::time), d + (a.ends_at::time), '[)') && tstzrange($4::timestamptz, $5::timestamptz, '[)')
            )
          )
        )
    )
    AND (
      NOT EXISTS (SELECT 1 FROM listing_availability o WHERE o.listing_id = listings.id AND o.kind = 'open')
      OR EXISTS (
        SELECT 1 FROM listing_availability o
        WHERE o.listing_id = listings.id
          AND o.kind = 'open'
          AND (
            (o.repeat_weekdays IS NULL AND tstzrange(o.starts_at, o.ends_at, '[)') && tstzrange($4::timestamptz, $5::timestamptz, '[)'))
            OR (
              o.repeat_weekdays IS NOT NULL
              AND (o.repeat_until IS NULL OR o.repeat_until >= $4::date)
              AND EXISTS (
                SELECT 1
                FROM generate_series(date_trunc('day', $4::timestamptz), date_trunc('day', $5::timestamptz), interval '1 day') d
                WHERE extract(dow FROM d) = ANY(o.repeat_weekdays)
                  AND tstzrange(d + (o.starts_at::time), d + (o.ends_at::time), '[)') && tstzrange($4::timestamptz, $5::timestamptz, '[)')
              )
            )
          )
      )
    )
    ORDER BY distance_m ASC
    LIMIT 200;
  `;

  const legacyQuery = `
    SELECT
      id,
      title,
      address,
      price_per_day,
      rating,
      rating_count,
      availability_text,
      ST_X(geom) AS longitude,
      ST_Y(geom) AS latitude,
      ST_Distance(
        geom::geography,
        ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography
      ) AS distance_m
    FROM listings
    WHERE ST_DWithin(
      geom::geography,
      ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography,
      $3
    )
    AND status <> 'archived'
    AND ($6::text IS NULL OR lower(title) LIKE $6)
    AND NOT EXISTS (
      SELECT 1 FROM bookings b
      WHERE b.listing_id = listings.id
      AND tstzrange(b.start_time, b.end_time, '[)') && tstzrange($4::timestamptz, $5::timestamptz, '[)')
    )
    ORDER BY distance_m ASC
    LIMIT 200;
  `;

  const params = [lng, lat, radiusKm * 1000, from, to, spaceTypeFilter];
  try {
    const query = baseQuery.replace("rating,", "rating,") + "";
    const result = await pool.query(
      baseQuery.replace(
        "availability_text,",
        "availability_text, image_urls,"
      ),
      params
    );
    return result.rows.map((row) => ({
      id: row.id,
      title: row.title,
      address: row.address,
      pricePerDay: row.price_per_day,
      rating: Number(row.rating ?? 5),
      ratingCount: Number(row.rating_count ?? 0),
      availability: row.availability_text,
      imageUrls: row.image_urls ?? [],
      distanceKm: Math.round((row.distance_m / 1000) * 10) / 10,
      latitude: row.latitude,
      longitude: row.longitude,
    }));
  } catch (err: any) {
    if (err?.code !== "42703" && err?.code !== "42P01") throw err;
    // Fallback for older schema without image_urls / rating_count / availability table
    const legacy = legacyQuery.replace("rating_count,", "");
    const result = await pool.query(legacy, params);
    return result.rows.map((row) => ({
      id: row.id,
      title: row.title,
      address: row.address,
      pricePerDay: row.price_per_day,
      rating: Number(row.rating ?? 5),
      ratingCount: Number(row.rating_count ?? 0),
      availability: row.availability_text,
      imageUrls: [],
      distanceKm: Math.round((row.distance_m / 1000) * 10) / 10,
      latitude: row.latitude,
      longitude: row.longitude,
    }));
  }
}

export async function findSpacesWithAvailability(input: SpaceSearchInput) {
  const { lat, lng, radiusKm, from, to, spaceType } = input;
  const spaceTypeFilter = spaceType?.trim()
    ? `%${spaceType.trim().toLowerCase()}%`
    : null;
  const availabilityCheck = `
    NOT EXISTS (
      SELECT 1 FROM bookings b
      WHERE b.listing_id = listings.id
      AND (b.status IS NULL OR b.status <> 'canceled')
      AND tstzrange(b.start_time, b.end_time, '[)') && tstzrange($4::timestamptz, $5::timestamptz, '[)')
    )
    AND NOT EXISTS (
      SELECT 1 FROM listing_availability a
      WHERE a.listing_id = listings.id
        AND a.kind = 'blocked'
        AND (
          (a.repeat_weekdays IS NULL AND tstzrange(a.starts_at, a.ends_at, '[)') && tstzrange($4::timestamptz, $5::timestamptz, '[)'))
          OR (
            a.repeat_weekdays IS NOT NULL
            AND (a.repeat_until IS NULL OR a.repeat_until >= $4::date)
            AND EXISTS (
              SELECT 1
              FROM generate_series(date_trunc('day', $4::timestamptz), date_trunc('day', $5::timestamptz), interval '1 day') d
              WHERE extract(dow FROM d) = ANY(a.repeat_weekdays)
                AND tstzrange(d + (a.starts_at::time), d + (a.ends_at::time), '[)') && tstzrange($4::timestamptz, $5::timestamptz, '[)')
            )
          )
        )
    )
    AND (
      NOT EXISTS (SELECT 1 FROM listing_availability o WHERE o.listing_id = listings.id AND o.kind = 'open')
      OR EXISTS (
        SELECT 1 FROM listing_availability o
        WHERE o.listing_id = listings.id
          AND o.kind = 'open'
          AND (
            (o.repeat_weekdays IS NULL AND tstzrange(o.starts_at, o.ends_at, '[)') && tstzrange($4::timestamptz, $5::timestamptz, '[)'))
            OR (
              o.repeat_weekdays IS NOT NULL
              AND (o.repeat_until IS NULL OR o.repeat_until >= $4::date)
              AND EXISTS (
                SELECT 1
                FROM generate_series(date_trunc('day', $4::timestamptz), date_trunc('day', $5::timestamptz), interval '1 day') d
                WHERE extract(dow FROM d) = ANY(o.repeat_weekdays)
                  AND tstzrange(d + (o.starts_at::time), d + (o.ends_at::time), '[)') && tstzrange($4::timestamptz, $5::timestamptz, '[)')
              )
            )
          )
      )
    )
  `;
  const baseQuery = `
    SELECT
      id,
      title,
      address,
      price_per_day,
      rating,
      rating_count,
      availability_text,
      (${availabilityCheck}) AS is_available,
      ST_X(geom) AS longitude,
      ST_Y(geom) AS latitude,
      ST_Distance(
        geom::geography,
        ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography
      ) AS distance_m
    FROM listings
    WHERE ST_DWithin(
      geom::geography,
      ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography,
      $3
    )
    AND status <> 'archived'
    AND ($6::text IS NULL OR lower(title) LIKE $6)
    ORDER BY distance_m ASC
    LIMIT 200;
  `;

  const legacyQuery = `
    SELECT
      id,
      title,
      address,
      price_per_day,
      rating,
      rating_count,
      availability_text,
      (${availabilityCheck}) AS is_available,
      ST_X(geom) AS longitude,
      ST_Y(geom) AS latitude,
      ST_Distance(
        geom::geography,
        ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography
      ) AS distance_m
    FROM listings
    WHERE ST_DWithin(
      geom::geography,
      ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography,
      $3
    )
    AND status <> 'archived'
    AND ($6::text IS NULL OR lower(title) LIKE $6)
    ORDER BY distance_m ASC
    LIMIT 200;
  `;

  const params = [lng, lat, radiusKm * 1000, from, to, spaceTypeFilter];
  try {
    const result = await pool.query(
      baseQuery.replace(
        "availability_text,",
        "availability_text, image_urls,"
      ),
      params
    );
    return result.rows.map((row) => ({
      id: row.id,
      title: row.title,
      address: row.address,
      pricePerDay: row.price_per_day,
      rating: Number(row.rating ?? 5),
      ratingCount: Number(row.rating_count ?? 0),
      availability: row.availability_text,
      imageUrls: row.image_urls ?? [],
      distanceKm: Math.round((row.distance_m / 1000) * 10) / 10,
      latitude: row.latitude,
      longitude: row.longitude,
      isAvailable: row.is_available,
    }));
  } catch (err: any) {
    if (err?.code !== "42703" && err?.code !== "42P01") throw err;
    const legacy = legacyQuery.replace("rating_count,", "");
    const result = await pool.query(legacy, params);
    return result.rows.map((row) => ({
      id: row.id,
      title: row.title,
      address: row.address,
      pricePerDay: row.price_per_day,
      rating: Number(row.rating ?? 5),
      ratingCount: Number(row.rating_count ?? 0),
      availability: row.availability_text,
      imageUrls: [],
      distanceKm: Math.round((row.distance_m / 1000) * 10) / 10,
      latitude: row.latitude,
      longitude: row.longitude,
      isAvailable: row.is_available,
    }));
  }
}

export type NewListing = {
  title: string;
  address: string;
  pricePerDay: number;
  availabilityText: string;
  hostId: string;
  hostStripeAccountId?: string | null;
  latitude: number;
  longitude: number;
  amenities?: string[];
  imageUrls?: string[];
  accessCode?: string | null;
  permissionDeclared?: boolean;
};

export async function createListing(listing: NewListing) {
  const query = `
    INSERT INTO listings (
      title,
      address,
      price_per_day,
      availability_text,
      host_id,
      amenities,
      geom,
      image_urls,
      access_code,
      permission_declared
    )
    VALUES ($1, $2, $3, $4, $5, $6, ST_SetSRID(ST_MakePoint($7, $8), 4326), $9, $10, $11)
    RETURNING id;
  `;
  const params = [
    listing.title,
    listing.address,
    listing.pricePerDay,
    listing.availabilityText,
    listing.hostId,
    listing.amenities ?? [],
    listing.longitude,
    listing.latitude,
    listing.imageUrls ?? [],
    listing.accessCode ?? null,
    listing.permissionDeclared ?? false,
  ];

  const result = await pool.query(query, params);
  return result.rows[0];
}

export async function createBooking({
  listingId,
  driverId,
  from,
  to,
  stripePaymentIntentId,
  checkoutSessionId,
  amountCents,
  currency,
  platformFeeCents,
  payoutAvailableAt,
  vehiclePlate,
}: {
  listingId: string;
  driverId: string;
  from: string;
  to: string;
  stripePaymentIntentId: string;
  checkoutSessionId?: string | null;
  amountCents: number;
  currency: string;
  platformFeeCents: number;
  payoutAvailableAt: Date;
  vehiclePlate?: string | null;
}) {
  const insertWithStatus = `
    INSERT INTO bookings (
      listing_id,
      driver_id,
      start_time,
      end_time,
      payment_intent_id,
      checkout_session_id,
      amount_cents,
      currency,
      status,
      platform_fee_cents,
      payout_available_at,
      payout_status,
      vehicle_plate
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending', $9, $10, 'pending', $11)
    RETURNING id;
  `;
  try {
    const result = await pool.query(insertWithStatus, [
      listingId,
      driverId,
      from,
      to,
      stripePaymentIntentId,
      checkoutSessionId ?? null,
      amountCents,
      currency,
      platformFeeCents,
      payoutAvailableAt,
      vehiclePlate ?? null,
    ]);
    return result.rows[0];
  } catch (err: any) {
    // Fallback for databases that haven't run migration 002 yet.
    if (err?.code === "42703") {
      console.warn("bookings table missing newer columns; inserting with legacy schema. Run migration 002_booking_status.sql.");
      const legacyQuery = `
        INSERT INTO bookings (listing_id, driver_id, start_time, end_time, payment_intent_id)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id;
      `;
      const result = await pool.query(legacyQuery, [listingId, driverId, from, to, stripePaymentIntentId]);
      return result.rows[0];
    }
    throw err;
  }
}

export type UserRecord = {
  id: string;
  email: string;
  password_hash: string;
  host_stripe_account_id?: string | null;
  role?: "driver" | "host" | "admin";
  refresh_token_hash?: string | null;
  refresh_expires?: Date | null;
  terms_version?: string | null;
  terms_accepted_at?: Date | null;
  privacy_version?: string | null;
  privacy_accepted_at?: Date | null;
};

export async function createUser({
  email,
  passwordHash,
  role = "driver",
  verificationToken,
  verificationExpires,
  termsVersion,
  privacyVersion,
}: {
  email: string;
  passwordHash: string;
  role?: UserRecord["role"];
  verificationToken?: string | null;
  verificationExpires?: Date | null;
  termsVersion?: string | null;
  privacyVersion?: string | null;
}) {
  const now = new Date();
  const query = `
    INSERT INTO users (
      email,
      password_hash,
      role,
      verification_token,
      verification_expires,
      terms_version,
      terms_accepted_at,
      privacy_version,
      privacy_accepted_at
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    ON CONFLICT (email) DO NOTHING
    RETURNING id, email, role, password_hash, host_stripe_account_id, email_verified,
      verification_token, verification_expires, terms_version, terms_accepted_at, privacy_version, privacy_accepted_at;
  `;
  const result = await pool.query(query, [
    email.toLowerCase(),
    passwordHash,
    role,
    verificationToken ?? null,
    verificationExpires ?? null,
    termsVersion ?? null,
    termsVersion ? now : null,
    privacyVersion ?? null,
    privacyVersion ? now : null,
  ]);
  return result.rows[0] as UserRecord | undefined;
}

export async function findUserByEmail(email: string) {
  const result = await pool.query(
    `SELECT id, email, password_hash, role, host_stripe_account_id, email_verified, verification_token,
      verification_expires, refresh_token_hash, refresh_expires, terms_version, terms_accepted_at,
      privacy_version, privacy_accepted_at
     FROM users WHERE email = $1 LIMIT 1`,
    [email.toLowerCase()]
  );
  return result.rows[0] as UserRecord | undefined;
}

export async function findUserById(userId: string) {
  const result = await pool.query(
    `SELECT id, email, password_hash, role, host_stripe_account_id, email_verified, verification_token,
      verification_expires, refresh_token_hash, refresh_expires, terms_version, terms_accepted_at,
      privacy_version, privacy_accepted_at
     FROM users WHERE id = $1 LIMIT 1`,
    [userId]
  );
  return result.rows[0] as UserRecord | undefined;
}

export async function findUserByResetToken(token: string) {
  const result = await pool.query(
    `
    SELECT id, email, password_hash, role, host_stripe_account_id
    FROM users
    WHERE reset_token = $1 AND (reset_expires IS NULL OR reset_expires > now())
    LIMIT 1
    `,
    [token]
  );
  return result.rows[0] as UserRecord | undefined;
}

export async function verifyUserEmail(token: string) {
  const result = await pool.query(
    `
    UPDATE users
    SET email_verified = true, verification_token = null, verification_expires = null
    WHERE verification_token = $1 AND (verification_expires IS NULL OR verification_expires > now())
    RETURNING id, email, role, host_stripe_account_id;
    `,
    [token]
  );
  return result.rows[0] as Pick<UserRecord, "id" | "email" | "role" | "host_stripe_account_id"> | undefined;
}

export async function setVerificationToken(userId: string, token: string, expiresAt: Date) {
  await pool.query(
    `
    UPDATE users
    SET verification_token = $1, verification_expires = $2
    WHERE id = $3
    `,
    [token, expiresAt, userId]
  );
}

export async function setPasswordResetToken(userId: string, token: string, expiresAt: Date) {
  await pool.query(
    `
    UPDATE users
    SET reset_token = $1, reset_expires = $2
    WHERE id = $3
    `,
    [token, expiresAt, userId]
  );
}

export async function setRefreshToken(userId: string, tokenHash: string, expiresAt: Date) {
  await pool.query(
    `
    UPDATE users
    SET refresh_token_hash = $1, refresh_expires = $2
    WHERE id = $3
    `,
    [tokenHash, expiresAt, userId]
  );
}

export async function clearRefreshToken(userId: string) {
  await pool.query(
    `
    UPDATE users
    SET refresh_token_hash = null, refresh_expires = null
    WHERE id = $1
    `,
    [userId]
  );
}

export async function findUserByRefreshTokenHash(tokenHash: string) {
  const result = await pool.query(
    `
    SELECT id, email, role, host_stripe_account_id, email_verified, refresh_token_hash, refresh_expires,
      terms_version, terms_accepted_at, privacy_version, privacy_accepted_at
    FROM users
    WHERE refresh_token_hash = $1
      AND (refresh_expires IS NULL OR refresh_expires > now())
    LIMIT 1
    `,
    [tokenHash]
  );
  return result.rows[0] as UserRecord | undefined;
}

export async function setLegalAcceptance({
  userId,
  termsVersion,
  privacyVersion,
}: {
  userId: string;
  termsVersion?: string | null;
  privacyVersion?: string | null;
}) {
  const now = new Date();
  const result = await pool.query(
    `
    UPDATE users
    SET terms_version = COALESCE($2, terms_version),
        terms_accepted_at = CASE WHEN $2 IS NOT NULL THEN $4 ELSE terms_accepted_at END,
        privacy_version = COALESCE($3, privacy_version),
        privacy_accepted_at = CASE WHEN $3 IS NOT NULL THEN $4 ELSE privacy_accepted_at END
    WHERE id = $1
    RETURNING id, email, role, host_stripe_account_id, email_verified, terms_version, terms_accepted_at,
      privacy_version, privacy_accepted_at;
    `,
    [userId, termsVersion ?? null, privacyVersion ?? null, now]
  );
  return result.rows[0] as UserRecord | undefined;
}

export async function updateUserPassword(userId: string, passwordHash: string) {
  const result = await pool.query(
    `
    UPDATE users
    SET password_hash = $1, reset_token = null, reset_expires = null
    WHERE id = $2
    RETURNING id, email, role, host_stripe_account_id
    `,
    [passwordHash, userId]
  );
  return result.rows[0] as Pick<UserRecord, "id" | "email" | "role" | "host_stripe_account_id"> | undefined;
}

export async function setEmailVerified(userId: string, verified: boolean) {
  const result = await pool.query(
    `
    UPDATE users
    SET email_verified = $1, verification_token = null, verification_expires = null
    WHERE id = $2
    RETURNING id, email, role, host_stripe_account_id, email_verified;
    `,
    [verified, userId]
  );
  return result.rows[0] as Pick<UserRecord, "id" | "email" | "role" | "host_stripe_account_id"> &
    { email_verified: boolean };
}

export async function listListingsByHost(hostId: string) {
  const result = await pool.query(
    `
    SELECT
      id,
      title,
      address,
      price_per_day,
      availability_text,
      image_urls,
      access_code,
      ST_X(geom) AS longitude,
      ST_Y(geom) AS latitude
    FROM listings
    WHERE host_id = $1
      AND status <> 'archived'
    ORDER BY created_at DESC
    `,
    [hostId]
  );
  return result.rows.map((row) => ({
    id: row.id,
    title: row.title,
    address: row.address,
    pricePerDay: row.price_per_day,
    availability: row.availability_text,
    imageUrls: row.image_urls ?? [],
    accessCode: row.access_code ?? null,
    longitude: row.longitude,
    latitude: row.latitude,
  }));
}

export async function deleteListing({ listingId, hostId }: { listingId: string; hostId: string }) {
  const result = await pool.query(
    `
    UPDATE listings
    SET status = 'archived'
    WHERE id = $1 AND host_id = $2
    RETURNING id;
    `,
    [listingId, hostId]
  );
  return result.rowCount && result.rowCount > 0;
}

export async function getListingHostId(listingId: string) {
  const res = await pool.query(`SELECT host_id FROM listings WHERE id = $1 LIMIT 1`, [listingId]);
  return res.rows[0]?.host_id as string | undefined;
}

export async function updateListingForHost({
  listingId,
  hostId,
  title,
  address,
  pricePerDay,
  availabilityText,
  latitude,
  longitude,
  imageUrls,
  amenities,
  accessCode,
  permissionDeclared,
}: {
  listingId: string;
  hostId: string;
  title?: string;
  address?: string;
  pricePerDay?: number;
  availabilityText?: string;
  latitude?: number;
  longitude?: number;
  imageUrls?: string[];
  amenities?: string[];
  accessCode?: string | null;
  permissionDeclared?: boolean;
}) {
  const fields: string[] = [];
  const values: any[] = [];
  let idx = 1;

  if (typeof title === "string") {
    fields.push(`title = $${idx++}`);
    values.push(title);
  }
  if (typeof address === "string") {
    fields.push(`address = $${idx++}`);
    values.push(address);
  }
  if (typeof pricePerDay === "number") {
    fields.push(`price_per_day = $${idx++}`);
    values.push(pricePerDay);
  }
  if (typeof availabilityText === "string") {
    fields.push(`availability_text = $${idx++}`);
    values.push(availabilityText);
  }
  if (Array.isArray(imageUrls)) {
    fields.push(`image_urls = $${idx++}`);
    values.push(imageUrls);
  }
  if (Array.isArray(amenities)) {
    fields.push(`amenities = $${idx++}`);
    values.push(amenities);
  }
  if (accessCode !== undefined) {
    fields.push(`access_code = $${idx++}`);
    values.push(accessCode ? accessCode.trim() : null);
  }
  if (typeof permissionDeclared === "boolean") {
    fields.push(`permission_declared = $${idx++}`);
    values.push(permissionDeclared);
  }
  if (typeof latitude === "number" && typeof longitude === "number") {
    fields.push(`geom = ST_SetSRID(ST_MakePoint($${idx++}, $${idx++}), 4326)`);
    values.push(longitude, latitude);
  }

  if (!fields.length) return null;
  values.push(listingId, hostId);
  const result = await pool.query(
    `
    UPDATE listings
    SET ${fields.join(", ")}
    WHERE id = $${idx++} AND host_id = $${idx}
    RETURNING id;
    `,
    values
  );
  return result.rowCount ? result.rows[0] : null;
}

export async function getListingById(listingId: string) {
  const result = await pool.query(
    `
    SELECT
      id,
      title,
      address,
      price_per_day,
      availability_text,
      image_urls,
      amenities,
      access_code,
      permission_declared,
      host_id,
      rating,
      rating_count,
      ST_X(geom) AS longitude,
      ST_Y(geom) AS latitude
    FROM listings
    WHERE id = $1
      AND status <> 'archived'
    LIMIT 1
    `,
    [listingId]
  );

  if (!result.rowCount) return null;
  const row = result.rows[0];
  return {
    id: row.id,
    title: row.title,
    address: row.address,
    pricePerDay: row.price_per_day,
    availability: row.availability_text,
    amenities: row.amenities ?? [],
    imageUrls: row.image_urls ?? [],
    accessCode: row.access_code ?? null,
    permissionDeclared: row.permission_declared ?? false,
    hostId: row.host_id,
    rating: Number(row.rating ?? 5),
    ratingCount: Number(row.rating_count ?? 0),
    latitude: row.latitude,
    longitude: row.longitude,
  };
}

export async function getListingByIdWithAvailability(
  listingId: string,
  from: string,
  to: string
) {
  const availabilityCheck = `
    NOT EXISTS (
      SELECT 1 FROM bookings b
      WHERE b.listing_id = listings.id
      AND (b.status IS NULL OR b.status <> 'canceled')
      AND tstzrange(b.start_time, b.end_time, '[)') && tstzrange($2::timestamptz, $3::timestamptz, '[)')
    )
    AND NOT EXISTS (
      SELECT 1 FROM listing_availability a
      WHERE a.listing_id = listings.id
        AND a.kind = 'blocked'
        AND (
          (a.repeat_weekdays IS NULL AND tstzrange(a.starts_at, a.ends_at, '[)') && tstzrange($2::timestamptz, $3::timestamptz, '[)'))
          OR (
            a.repeat_weekdays IS NOT NULL
            AND (a.repeat_until IS NULL OR a.repeat_until >= $2::date)
            AND EXISTS (
              SELECT 1
              FROM generate_series(date_trunc('day', $2::timestamptz), date_trunc('day', $3::timestamptz), interval '1 day') d
              WHERE extract(dow FROM d) = ANY(a.repeat_weekdays)
                AND tstzrange(d + (a.starts_at::time), d + (a.ends_at::time), '[)') && tstzrange($2::timestamptz, $3::timestamptz, '[)')
            )
          )
        )
    )
    AND (
      NOT EXISTS (SELECT 1 FROM listing_availability o WHERE o.listing_id = listings.id AND o.kind = 'open')
      OR EXISTS (
        SELECT 1 FROM listing_availability o
        WHERE o.listing_id = listings.id
          AND o.kind = 'open'
          AND (
            (o.repeat_weekdays IS NULL AND tstzrange(o.starts_at, o.ends_at, '[)') && tstzrange($2::timestamptz, $3::timestamptz, '[)'))
            OR (
              o.repeat_weekdays IS NOT NULL
              AND (o.repeat_until IS NULL OR o.repeat_until >= $2::date)
              AND EXISTS (
                SELECT 1
                FROM generate_series(date_trunc('day', $2::timestamptz), date_trunc('day', $3::timestamptz), interval '1 day') d
                WHERE extract(dow FROM d) = ANY(o.repeat_weekdays)
                  AND tstzrange(d + (o.starts_at::time), d + (o.ends_at::time), '[)') && tstzrange($2::timestamptz, $3::timestamptz, '[)')
              )
            )
          )
      )
    )
  `;
  const result = await pool.query(
    `
    SELECT
      id,
      title,
      address,
      price_per_day,
      availability_text,
      image_urls,
      amenities,
      access_code,
      permission_declared,
      host_id,
      rating,
      rating_count,
      (${availabilityCheck}) AS is_available,
      ST_X(geom) AS longitude,
      ST_Y(geom) AS latitude
    FROM listings
    WHERE id = $1
      AND status <> 'archived'
    LIMIT 1
    `,
    [listingId, from, to]
  );

  if (!result.rowCount) return null;
  const row = result.rows[0];
  return {
    id: row.id,
    title: row.title,
    address: row.address,
    pricePerDay: row.price_per_day,
    availability: row.availability_text,
    amenities: row.amenities ?? [],
    imageUrls: row.image_urls ?? [],
    accessCode: row.access_code ?? null,
    permissionDeclared: row.permission_declared ?? false,
    hostId: row.host_id,
    rating: Number(row.rating ?? 5),
    ratingCount: Number(row.rating_count ?? 0),
    latitude: row.latitude,
    longitude: row.longitude,
    isAvailable: row.is_available,
  };
}

export async function addFavorite(userId: string, listingId: string) {
  const result = await pool.query(
    `
    INSERT INTO favorites (user_id, listing_id)
    VALUES ($1, $2)
    ON CONFLICT DO NOTHING
    RETURNING listing_id;
    `,
    [userId, listingId]
  );
  return result.rowCount ? result.rows[0].listing_id : null;
}

export async function removeFavorite(userId: string, listingId: string) {
  const result = await pool.query(
    `
    DELETE FROM favorites
    WHERE user_id = $1 AND listing_id = $2
    `,
    [userId, listingId]
  );
  return result.rowCount ? true : false;
}

export async function listFavoritesByUser(userId: string) {
  const result = await pool.query(
    `
    SELECT
      l.id,
      l.title,
      l.address,
      l.price_per_day,
      l.availability_text,
      l.amenities,
      l.rating,
      l.rating_count,
      l.image_urls,
      ST_X(l.geom) AS longitude,
      ST_Y(l.geom) AS latitude
    FROM favorites f
    JOIN listings l ON l.id = f.listing_id
    WHERE f.user_id = $1
      AND l.status <> 'archived'
    ORDER BY f.created_at DESC
    `,
    [userId]
  );
  return result.rows.map((row) => ({
    id: row.id,
    title: row.title,
    address: row.address,
    pricePerDay: row.price_per_day,
    availability: row.availability_text,
    amenities: row.amenities ?? [],
    imageUrls: row.image_urls ?? [],
    rating: row.rating,
    ratingCount: row.rating_count,
    longitude: row.longitude,
    latitude: row.latitude,
  }));
}

export async function upsertPushToken({
  userId,
  expoToken,
  platform,
  deviceId,
}: {
  userId: string;
  expoToken: string;
  platform: string;
  deviceId?: string | null;
}) {
  const res = await pool.query(
    `
    INSERT INTO push_tokens (user_id, expo_token, platform, device_id, updated_at)
    VALUES ($1, $2, $3, $4, NOW())
    ON CONFLICT (expo_token)
    DO UPDATE SET user_id = EXCLUDED.user_id,
                  platform = EXCLUDED.platform,
                  device_id = EXCLUDED.device_id,
                  updated_at = NOW()
    RETURNING id;
    `,
    [userId, expoToken, platform, deviceId ?? null]
  );
  return res.rowCount > 0;
}

export async function deletePushToken({
  userId,
  expoToken,
}: {
  userId: string;
  expoToken: string;
}) {
  const res = await pool.query(
    `
    DELETE FROM push_tokens
    WHERE user_id = $1 AND expo_token = $2
    `,
    [userId, expoToken]
  );
  return res.rowCount > 0;
}

export async function listPushTokensByUserIds(userIds: string[]) {
  if (!userIds.length) return [];
  const res = await pool.query(
    `
    SELECT user_id, expo_token, platform
    FROM push_tokens
    WHERE user_id = ANY($1)
    `,
    [userIds]
  );
  return res.rows as { user_id: string; expo_token: string; platform: string }[];
}

export async function getBookingNotificationTargetsByPaymentIntent(paymentIntentId: string) {
  const res = await pool.query(
    `
    SELECT b.id AS booking_id,
           b.driver_id,
           l.host_id,
           l.title AS listing_title,
           b.start_time,
           b.end_time
    FROM bookings b
    JOIN listings l ON l.id = b.listing_id
    WHERE b.payment_intent_id = $1
    LIMIT 1;
    `,
    [paymentIntentId]
  );
  return res.rows[0] as
    | {
        booking_id: string;
        driver_id: string;
        host_id: string;
        listing_title: string;
        start_time: Date;
        end_time: Date;
      }
    | undefined;
}

export async function getBookingNotificationTargetsByCheckoutSession(checkoutSessionId: string) {
  const res = await pool.query(
    `
    SELECT b.id AS booking_id,
           b.driver_id,
           l.host_id,
           l.title AS listing_title,
           b.start_time,
           b.end_time
    FROM bookings b
    JOIN listings l ON l.id = b.listing_id
    WHERE b.checkout_session_id = $1
    LIMIT 1;
    `,
    [checkoutSessionId]
  );
  return res.rows[0] as
    | {
        booking_id: string;
        driver_id: string;
        host_id: string;
        listing_title: string;
        start_time: Date;
        end_time: Date;
      }
    | undefined;
}

export async function getBookingNotificationTargets(bookingId: string) {
  const res = await pool.query(
    `
    SELECT b.id AS booking_id,
           b.driver_id,
           l.host_id,
           l.title AS listing_title,
           b.start_time,
           b.end_time
    FROM bookings b
    JOIN listings l ON l.id = b.listing_id
    WHERE b.id = $1
    LIMIT 1;
    `,
    [bookingId]
  );
  return res.rows[0] as
    | {
        booking_id: string;
        driver_id: string;
        host_id: string;
        listing_title: string;
        start_time: Date;
        end_time: Date;
      }
    | undefined;
}

export async function insertScheduledNotification({
  userId,
  bookingId,
  type,
  scheduledAt,
  payload,
}: {
  userId: string;
  bookingId: string | null;
  type: string;
  scheduledAt: Date;
  payload?: Record<string, unknown> | null;
}) {
  const res = await pool.query(
    `
    INSERT INTO scheduled_notifications (user_id, booking_id, type, scheduled_at, payload)
    VALUES ($1, $2, $3, $4, $5)
    ON CONFLICT (booking_id, type) DO UPDATE
      SET scheduled_at = EXCLUDED.scheduled_at,
          payload = EXCLUDED.payload
    RETURNING id;
    `,
    [userId, bookingId, type, scheduledAt, payload ?? null]
  );
  return res.rowCount > 0;
}

export async function listDueScheduledNotifications(limit = 50) {
  const res = await pool.query(
    `
    SELECT id, user_id, booking_id, type, scheduled_at, payload
    FROM scheduled_notifications
    WHERE sent_at IS NULL
      AND scheduled_at <= NOW()
    ORDER BY scheduled_at ASC
    LIMIT $1;
    `,
    [limit]
  );
  return res.rows as {
    id: string;
    user_id: string;
    booking_id: string | null;
    type: string;
    scheduled_at: Date;
    payload: Record<string, unknown> | null;
  }[];
}

export async function markScheduledNotificationSent(id: string) {
  const res = await pool.query(
    `
    UPDATE scheduled_notifications
    SET sent_at = NOW()
    WHERE id = $1
    `,
    [id]
  );
  return res.rowCount > 0;
}

export async function deleteScheduledNotificationsByBooking(bookingId: string) {
  const res = await pool.query(
    `
    DELETE FROM scheduled_notifications
    WHERE booking_id = $1
    `,
    [bookingId]
  );
  return res.rowCount > 0;
}

export async function getListingWithHostAccount(listingId: string) {
  const result = await pool.query(
    `
    SELECT
      l.id,
      l.title,
      l.address,
      l.price_per_day,
      l.availability_text,
      l.amenities,
      l.host_id,
      l.rating,
      l.rating_count,
      l.image_urls,
      ST_X(l.geom) AS longitude,
      ST_Y(l.geom) AS latitude,
      u.host_stripe_account_id
    FROM listings l
    JOIN users u ON u.id = l.host_id
    WHERE l.id = $1
      AND l.status <> 'archived'
    LIMIT 1
    `,
    [listingId]
  );
  if (!result.rowCount) return null;
  const row = result.rows[0];
  return {
    id: row.id,
    title: row.title,
    address: row.address,
    pricePerDay: row.price_per_day,
    availability: row.availability_text,
    amenities: row.amenities ?? [],
    hostId: row.host_id,
    hostStripeAccountId: row.host_stripe_account_id,
    rating: Number(row.rating ?? 5),
    ratingCount: Number(row.rating_count ?? 0),
    imageUrls: row.image_urls ?? [],
    latitude: row.latitude,
    longitude: row.longitude,
  };
}


export async function listAvailability(listingId: string) {
  const res = await pool.query(
    `
    SELECT id, kind, starts_at, ends_at, repeat_weekdays, repeat_until, created_at
    FROM listing_availability
    WHERE listing_id = $1
    ORDER BY starts_at ASC;
    `,
    [listingId]
  );
  return res.rows.map((row) => ({
    id: row.id,
    kind: row.kind as "open" | "blocked",
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    repeatWeekdays: row.repeat_weekdays ?? [],
    repeatUntil: row.repeat_until,
    createdAt: row.created_at,
  }));
}

export async function createAvailabilityEntry({
  listingId,
  kind,
  startsAt,
  endsAt,
  repeatWeekdays,
  repeatUntil,
}: {
  listingId: string;
  kind: "open" | "blocked";
  startsAt: string;
  endsAt: string;
  repeatWeekdays?: number[];
  repeatUntil?: string | null;
}) {
  const res = await pool.query(
    `
    INSERT INTO listing_availability (listing_id, kind, starts_at, ends_at, repeat_weekdays, repeat_until)
    VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING id, kind, starts_at, ends_at, repeat_weekdays, repeat_until, created_at;
    `,
    [listingId, kind, startsAt, endsAt, repeatWeekdays ?? null, repeatUntil ?? null]
  );
  const row = res.rows[0];
  return {
    id: row.id,
    kind: row.kind as "open" | "blocked",
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    repeatWeekdays: row.repeat_weekdays ?? [],
    repeatUntil: row.repeat_until,
    createdAt: row.created_at,
  };
}

export async function deleteAvailabilityEntry({ id, hostId }: { id: string; hostId: string }) {
  const res = await pool.query(
    `
    DELETE FROM listing_availability la
    USING listings l
    WHERE la.id = $1
      AND la.listing_id = l.id
      AND l.host_id = $2
    RETURNING la.id;
    `,
    [id, hostId]
  );
  return res.rowCount ? res.rows[0] : null;
}

export async function updateAvailabilityEntry({
  id,
  hostId,
  kind,
  startsAt,
  endsAt,
  repeatWeekdays,
  repeatUntil,
}: {
  id: string;
  hostId: string;
  kind?: "open" | "blocked";
  startsAt?: string;
  endsAt?: string;
  repeatWeekdays?: number[] | null;
  repeatUntil?: string | null;
}) {
  const fields: string[] = [];
  const values: any[] = [];
  let idx = 1;

  if (kind) {
    fields.push(`kind = $${idx++}`);
    values.push(kind);
  }
  if (startsAt) {
    fields.push(`starts_at = $${idx++}`);
    values.push(startsAt);
  }
  if (endsAt) {
    fields.push(`ends_at = $${idx++}`);
    values.push(endsAt);
  }
  if (repeatWeekdays !== undefined) {
    fields.push(`repeat_weekdays = $${idx++}`);
    values.push(repeatWeekdays ?? null);
  }
  if (repeatUntil !== undefined) {
    fields.push(`repeat_until = $${idx++}`);
    values.push(repeatUntil ?? null);
  }

  if (fields.length === 0) return null;

  const query = `
    UPDATE listing_availability la
    SET ${fields.join(", ")}
    FROM listings l
    WHERE la.id = $${idx}
      AND la.listing_id = l.id
      AND l.host_id = $${idx + 1}
    RETURNING la.id, la.kind, la.starts_at, la.ends_at, la.repeat_weekdays, la.repeat_until, la.listing_id, la.created_at;
  `;
  values.push(id, hostId);

  const res = await pool.query(query, values);
  if (!res.rowCount) return null;
  const row = res.rows[0];
  return {
    id: row.id,
    kind: row.kind as "open" | "blocked",
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    repeatWeekdays: row.repeat_weekdays ?? [],
    repeatUntil: row.repeat_until,
    listingId: row.listing_id,
    createdAt: row.created_at,
  };
}

export async function updateBookingStatus({
  checkoutSessionId,
  status,
  paymentIntentId,
  receiptUrl,
}: {
  checkoutSessionId: string;
  status: "confirmed" | "canceled";
  paymentIntentId?: string;
  receiptUrl?: string | null;
}) {
  try {
    const result = await pool.query(
      `
      UPDATE bookings
      SET status = $1::booking_status,
          payment_intent_id = COALESCE($3, payment_intent_id),
          receipt_url = COALESCE($4, receipt_url),
          payout_status = CASE
            WHEN $1 = 'confirmed' THEN COALESCE(payout_status, 'pending')
            ELSE 'canceled'
          END,
          payout_available_at = CASE
            WHEN $1 = 'confirmed' AND payout_available_at IS NULL THEN start_time + interval '24 hours'
            ELSE payout_available_at
          END
      WHERE checkout_session_id = $2
      RETURNING id;
      `,
      [status, checkoutSessionId, paymentIntentId ?? null, receiptUrl ?? null]
    );
    return result.rowCount && result.rowCount > 0;
  } catch (err: any) {
    if (err?.code === "42703") {
      console.warn("bookings table missing status/checkout_session_id columns; webhook status update skipped. Run migration 002_booking_status.sql.");
      return false;
    }
    throw err;
  }
}

export async function updateBookingStatusByPaymentIntent({
  paymentIntentId,
  status,
  receiptUrl,
}: {
  paymentIntentId: string;
  status: "confirmed" | "canceled";
  receiptUrl?: string | null;
}) {
  try {
    const result = await pool.query(
      `
      UPDATE bookings
      SET status = $1::booking_status,
          receipt_url = COALESCE($3, receipt_url),
          payout_status = CASE
            WHEN $1 = 'confirmed' THEN COALESCE(payout_status, 'pending')
            ELSE 'canceled'
          END,
          payout_available_at = CASE
            WHEN $1 = 'confirmed' AND payout_available_at IS NULL THEN start_time + interval '24 hours'
            ELSE payout_available_at
          END
      WHERE payment_intent_id = $2
      RETURNING id;
      `,
      [status, paymentIntentId, receiptUrl ?? null]
    );
    return result.rowCount && result.rowCount > 0;
  } catch (err: any) {
    if (err?.code === "42703") {
      console.warn("bookings table missing status/payment_intent_id columns; status update skipped. Run migration 002_booking_status.sql.");
      return false;
    }
    throw err;
  }
}

export async function markBookingRefundedByPaymentIntent({
  paymentIntentId,
  refundId,
}: {
  paymentIntentId: string;
  refundId: string;
}) {
  const result = await pool.query(
    `
    UPDATE bookings
    SET refund_status = 'succeeded',
        refund_id = $2,
        refunded_at = NOW()
    WHERE payment_intent_id = $1
    RETURNING id;
    `,
    [paymentIntentId, refundId]
  );
  return result.rowCount && result.rowCount > 0;
}

export async function insertEventLog({
  eventType,
  payload,
}: {
  eventType: string;
  payload?: Record<string, unknown> | null;
}) {
  await pool.query(
    `
    INSERT INTO event_log (event_type, payload)
    VALUES ($1, $2)
    `,
    [eventType, payload ?? null]
  );
}

export async function cancelBookingByDriver({
  bookingId,
  driverId,
}: {
  bookingId: string;
  driverId: string;
}) {
  const result = await pool.query(
    `
    UPDATE bookings
    SET status = 'canceled'
    WHERE id = $1
      AND driver_id = $2
      AND end_time > now()
    RETURNING id;
    `,
    [bookingId, driverId]
  );
  return result.rowCount && result.rowCount > 0;
}

export async function getBookingForRefund({
  bookingId,
  driverId,
}: {
  bookingId: string;
  driverId: string;
}) {
  const res = await pool.query(
    `
    SELECT id, status, payment_intent_id, payout_status, end_time
    FROM bookings
    WHERE id = $1
      AND driver_id = $2
    `,
    [bookingId, driverId]
  );
  return res.rows[0] as
    | {
        id: string;
        status: string | null;
        payment_intent_id: string | null;
        payout_status: string | null;
        end_time: Date;
      }
    | undefined;
}

export async function getBookingForExtension({
  bookingId,
  driverId,
}: {
  bookingId: string;
  driverId: string;
}) {
  const res = await pool.query(
    `
    SELECT
      b.id,
      b.listing_id,
      b.start_time,
      b.end_time,
      b.amount_cents,
      b.currency,
      b.status,
      l.price_per_day
    FROM bookings b
    JOIN listings l ON l.id = b.listing_id
    WHERE b.id = $1
      AND b.driver_id = $2
    `,
    [bookingId, driverId]
  );
  return res.rows[0] as
    | {
        id: string;
        listing_id: string;
        start_time: Date;
        end_time: Date;
        amount_cents: number | null;
        currency: string | null;
        status: string | null;
        price_per_day: number;
      }
    | undefined;
}

export async function updateBookingWindow({
  bookingId,
  driverId,
  newStartTime,
  newEndTime,
  newAmountCents,
  paymentIntentId,
  receiptUrl,
}: {
  bookingId: string;
  driverId: string;
  newStartTime: string;
  newEndTime: string;
  newAmountCents: number;
  paymentIntentId?: string | null;
  receiptUrl?: string | null;
}) {
  const res = await pool.query(
    `
    UPDATE bookings
    SET start_time = $1,
        end_time = $2,
        amount_cents = $3,
        payment_intent_id = COALESCE($4, payment_intent_id),
        receipt_url = COALESCE($5, receipt_url)
    WHERE id = $6
      AND driver_id = $7
      AND status = 'confirmed'
      AND end_time > NOW()
    RETURNING id, start_time, end_time, amount_cents;
    `,
    [
      newStartTime,
      newEndTime,
      newAmountCents,
      paymentIntentId ?? null,
      receiptUrl ?? null,
      bookingId,
      driverId,
    ]
  );
  return res.rows[0] as
    | { id: string; start_time: Date; end_time: Date; amount_cents: number }
    | undefined;
}

export async function updateBookingExtension({
  bookingId,
  driverId,
  newEndTime,
  newAmountCents,
  paymentIntentId,
  receiptUrl,
}: {
  bookingId: string;
  driverId: string;
  newEndTime: string;
  newAmountCents: number;
  paymentIntentId?: string | null;
  receiptUrl?: string | null;
}) {
  const res = await pool.query(
    `
    UPDATE bookings
    SET end_time = $1,
        amount_cents = $2,
        payment_intent_id = COALESCE($3, payment_intent_id),
        receipt_url = COALESCE($4, receipt_url)
    WHERE id = $5
      AND driver_id = $6
      AND status = 'confirmed'
      AND end_time > NOW()
    RETURNING id, end_time, amount_cents;
    `,
    [newEndTime, newAmountCents, paymentIntentId ?? null, receiptUrl ?? null, bookingId, driverId]
  );
  return res.rows[0] as { id: string; end_time: Date; amount_cents: number } | undefined;
}

export async function checkInBooking({
  bookingId,
  driverId,
}: {
  bookingId: string;
  driverId: string;
}) {
  const res = await pool.query(
    `
    UPDATE bookings
    SET checked_in_at = COALESCE(checked_in_at, NOW())
    WHERE id = $1
      AND driver_id = $2
      AND status = 'confirmed'
      AND start_time <= NOW() + interval '15 minutes'
      AND end_time >= NOW()
    RETURNING checked_in_at;
    `,
    [bookingId, driverId]
  );
  return res.rows[0]?.checked_in_at as Date | undefined;
}

export async function cancelBookingWithRefund({
  bookingId,
  driverId,
  refundId,
}: {
  bookingId: string;
  driverId: string;
  refundId?: string | null;
}) {
  const res = await pool.query(
    `
    UPDATE bookings
    SET status = 'canceled',
        payout_status = 'canceled',
        refund_status = CASE
          WHEN $3::text IS NOT NULL THEN 'succeeded'
          ELSE refund_status
        END,
        refund_id = COALESCE($3::text, refund_id),
        refunded_at = CASE
          WHEN $3::text IS NOT NULL THEN NOW()
          ELSE refunded_at
        END
    WHERE id = $1
      AND driver_id = $2
      AND end_time > NOW()
    RETURNING id;
    `,
    [bookingId, driverId, refundId ?? null]
  );
  return res.rowCount > 0;
}

export async function listUserBookings(userId: string) {
  const driverRows = await pool.query(
    `
    SELECT
      b.id,
      b.listing_id,
      b.start_time,
      b.end_time,
      b.status,
      b.refund_status,
      b.refunded_at,
      b.receipt_url,
      b.checked_in_at,
      b.no_show_at,
      b.vehicle_plate,
      b.amount_cents,
      b.currency,
      l.title,
      l.address,
      l.image_urls,
      ST_X(l.geom) AS longitude,
      ST_Y(l.geom) AS latitude,
      l.host_id,
      l.access_code
    FROM bookings b
    JOIN listings l ON l.id = b.listing_id
    WHERE b.driver_id = $1
    ORDER BY b.start_time DESC
    LIMIT 50;
    `,
    [userId]
  );

  const hostRows = await pool.query(
    `
    SELECT
      b.id,
      b.listing_id,
      b.start_time,
      b.end_time,
      b.status,
      b.refund_status,
      b.refunded_at,
      b.receipt_url,
      b.checked_in_at,
      b.no_show_at,
      b.vehicle_plate,
      b.amount_cents,
      b.currency,
      l.title,
      l.address,
      l.image_urls,
      ST_X(l.geom) AS longitude,
      ST_Y(l.geom) AS latitude,
      l.host_id,
      l.access_code
    FROM bookings b
    JOIN listings l ON l.id = b.listing_id
    WHERE l.host_id = $1
    ORDER BY b.start_time DESC
    LIMIT 50;
    `,
    [userId]
  );

  const mapRow = (row: any) => ({
    id: row.id,
    listingId: row.listing_id,
    startTime: row.start_time,
    endTime: row.end_time,
    status: row.status ?? "pending",
    refundStatus: row.refund_status ?? null,
    refundedAt: row.refunded_at ?? null,
    receiptUrl: row.receipt_url ?? null,
    checkedInAt: row.checked_in_at ?? null,
    noShowAt: row.no_show_at ?? null,
    vehiclePlate: row.vehicle_plate ?? null,
    amountCents: row.amount_cents ?? 0,
    currency: row.currency ?? "eur",
    address: row.address,
    title: row.title,
    imageUrls: row.image_urls ?? null,
    latitude: row.latitude ?? null,
    longitude: row.longitude ?? null,
    accessCode: row.access_code ?? null,
  });

  return {
    driverBookings: driverRows.rows.map(mapRow),
    hostBookings: hostRows.rows.map(mapRow),
  };
}

export async function getHostEarningsSummary(hostId: string) {
  try {
    const res = await pool.query(
      `
      SELECT
        COALESCE(SUM(b.amount_cents), 0) AS total_cents,
        COALESCE(SUM(COALESCE(b.platform_fee_cents, ROUND(b.amount_cents * 0.10))), 0) AS fee_cents
      FROM bookings b
      JOIN listings l ON l.id = b.listing_id
      WHERE l.host_id = $1
        AND b.status = 'confirmed';
      `,
      [hostId]
    );
    const row = res.rows[0] ?? { total_cents: 0, fee_cents: 0 };
    const totalCents = Number(row.total_cents) || 0;
    const feeCents = Number(row.fee_cents) || 0;
    return {
      totalCents,
      feeCents,
      netCents: Math.max(0, totalCents - feeCents),
      currency: "eur",
    };
  } catch (err: any) {
    if (err?.code === "42703") {
      const res = await pool.query(
        `
        SELECT
          COALESCE(SUM(b.amount_cents), 0) AS total_cents,
          COALESCE(SUM(ROUND(b.amount_cents * 0.10)), 0) AS fee_cents
        FROM bookings b
        JOIN listings l ON l.id = b.listing_id
        WHERE l.host_id = $1
          AND b.status = 'confirmed';
        `,
        [hostId]
      );
      const row = res.rows[0] ?? { total_cents: 0, fee_cents: 0 };
      const totalCents = Number(row.total_cents) || 0;
      const feeCents = Number(row.fee_cents) || 0;
      return {
        totalCents,
        feeCents,
        netCents: Math.max(0, totalCents - feeCents),
        currency: "eur",
      };
    }
    throw err;
  }
}

export async function listDuePayoutsForHost(hostId: string) {
  const res = await pool.query(
    `
    SELECT
      b.id,
      b.amount_cents,
      COALESCE(b.platform_fee_cents, ROUND(b.amount_cents * 0.10)) AS fee_cents,
      b.currency,
      b.payout_available_at
    FROM bookings b
    JOIN listings l ON l.id = b.listing_id
    WHERE l.host_id = $1
      AND b.status = 'confirmed'
      AND (b.payout_status IS NULL OR b.payout_status = 'pending')
      AND b.payout_available_at IS NOT NULL
      AND b.payout_available_at <= NOW();
    `,
    [hostId]
  );
  return res.rows as Array<{
    id: string;
    amount_cents: number;
    fee_cents: number;
    currency: string;
    payout_available_at: Date;
  }>;
}

export async function listDuePayoutsForAllHosts() {
  const res = await pool.query(
    `
    SELECT
      b.id,
      b.amount_cents,
      COALESCE(b.platform_fee_cents, ROUND(b.amount_cents * 0.10)) AS fee_cents,
      b.currency,
      b.payout_available_at,
      l.host_id,
      u.host_stripe_account_id
    FROM bookings b
    JOIN listings l ON l.id = b.listing_id
    JOIN users u ON u.id = l.host_id
    WHERE b.status = 'confirmed'
      AND (b.payout_status IS NULL OR b.payout_status = 'pending')
      AND b.payout_available_at IS NOT NULL
      AND b.payout_available_at <= NOW()
      AND u.host_stripe_account_id IS NOT NULL;
    `
  );
  return res.rows as Array<{
    id: string;
    amount_cents: number;
    fee_cents: number;
    currency: string;
    payout_available_at: Date;
    host_id: string;
    host_stripe_account_id: string;
  }>;
}

export async function markPayoutProcessing(bookingId: string) {
  const res = await pool.query(
    `
    UPDATE bookings
    SET payout_status = 'processing'
    WHERE id = $1
      AND (payout_status IS NULL OR payout_status = 'pending')
    RETURNING id;
    `,
    [bookingId]
  );
  return res.rowCount > 0;
}

export async function markPayoutTransferred({
  bookingId,
  transferId,
}: {
  bookingId: string;
  transferId: string;
}) {
  const res = await pool.query(
    `
    UPDATE bookings
    SET payout_status = 'paid',
        stripe_transfer_id = $2
    WHERE id = $1
    RETURNING id;
    `,
    [bookingId, transferId]
  );
  return res.rowCount > 0;
}

export async function markPayoutPending(bookingId: string) {
  const res = await pool.query(
    `
    UPDATE bookings
    SET payout_status = 'pending'
    WHERE id = $1
    RETURNING id;
    `,
    [bookingId]
  );
  return res.rowCount > 0;
}

export async function setHostStripeAccountId(userId: string, accountId: string) {
  const res = await pool.query(
    `UPDATE users SET host_stripe_account_id = $2 WHERE id = $1 RETURNING id, host_stripe_account_id`,
    [userId, accountId]
  );
  return res.rowCount ? res.rows[0] : null;
}

export async function deleteUserAccount(userId: string) {
  // Clean up related records; tables do not enforce FK constraints.
  await pool.query(
    `DELETE FROM bookings WHERE driver_id = $1 OR listing_id IN (SELECT id FROM listings WHERE host_id = $1)`,
    [userId]
  );
  await pool.query(`DELETE FROM listings WHERE host_id = $1`, [userId]);
  const res = await pool.query(`DELETE FROM users WHERE id = $1 RETURNING id`, [userId]);
  return res.rowCount > 0;
}

// Admin utilities
export async function listUsers({ limit = 50, offset = 0, search }: { limit?: number; offset?: number; search?: string }) {
  const params: any[] = [limit, offset];
  let where = "";
  if (search) {
    params.push(`%${search.toLowerCase()}%`);
    where = "WHERE LOWER(email) LIKE $" + params.length;
  }
  const res = await pool.query(
    `
    SELECT id, email, role, status, created_at
    FROM users
    ${where}
    ORDER BY created_at DESC
    LIMIT $1 OFFSET $2;
    `,
    params
  );
  return res.rows;
}

export async function updateUserStatus({
  userId,
  status,
  role,
  adminNote,
}: {
  userId: string;
  status?: string;
  role?: string;
  adminNote?: string;
}) {
  const fields: string[] = [];
  const values: any[] = [];
  let idx = 1;
  if (status) {
    fields.push(`status = $${idx++}`);
    values.push(status);
  }
  if (role) {
    fields.push(`role = $${idx++}`);
    values.push(role);
  }
  if (adminNote !== undefined) {
    fields.push(`admin_note = $${idx++}`);
    values.push(adminNote);
  }
  if (!fields.length) return null;
  values.push(userId);
  const res = await pool.query(
    `
    UPDATE users
    SET ${fields.join(", ")}
    WHERE id = $${idx}
    RETURNING id, email, role, status;
    `,
    values
  );
  return res.rows[0];
}

export async function listListingsForAdmin({ status, limit = 50, offset = 0 }: { status?: string; limit?: number; offset?: number }) {
  const params: any[] = [limit, offset];
  let where = "";
  if (status) {
    params.push(status);
    where = `WHERE status = $${params.length}`;
  }
  const res = await pool.query(
    `
    SELECT id, title, address, status, moderation_reason, moderation_note, created_at, host_id
    FROM listings
    ${where}
    ORDER BY created_at DESC
    LIMIT $1 OFFSET $2;
    `,
    params
  );
  return res.rows;
}

export async function updateListingStatus({
  listingId,
  status,
  moderationReason,
  moderationNote,
}: {
  listingId: string;
  status: string;
  moderationReason?: string;
  moderationNote?: string;
}) {
  const res = await pool.query(
    `
    UPDATE listings
    SET status = $2,
        moderation_reason = $3,
        moderation_note = $4
    WHERE id = $1
    RETURNING id, status, moderation_reason, moderation_note;
    `,
    [listingId, status, moderationReason ?? null, moderationNote ?? null]
  );
  return res.rows[0];
}

export async function insertAuditLog({
  adminId,
  action,
  targetType,
  targetId,
  beforeState,
  afterState,
  reason,
  ip,
  ua,
}: {
  adminId: string;
  action: string;
  targetType: string;
  targetId?: string;
  beforeState?: any;
  afterState?: any;
  reason?: string;
  ip?: string;
  ua?: string;
}) {
  await pool.query(
    `
    INSERT INTO audit_log (admin_id, action, target_type, target_id, before_state, after_state, reason, ip_address, user_agent)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9);
    `,
    [adminId, action, targetType, targetId ?? null, beforeState ?? null, afterState ?? null, reason ?? null, ip ?? null, ua ?? null]
  );
}

export async function getBookingForReview(bookingId: string) {
  const result = await pool.query(
    `
    SELECT
      b.id,
      b.listing_id,
      b.driver_id,
      b.start_time,
      b.end_time,
      b.status,
      l.host_id
    FROM bookings b
    JOIN listings l ON l.id = b.listing_id
    WHERE b.id = $1
    LIMIT 1;
    `,
    [bookingId]
  );
  return result.rows[0] as
    | {
        id: string;
        listing_id: string;
        driver_id: string;
        start_time: string;
        end_time: string;
        status?: string;
        host_id: string;
      }
    | undefined;
}

export async function hasExistingReview({ bookingId, role }: { bookingId: string; role: "driver_review" | "host_review" }) {
  const result = await pool.query(`SELECT 1 FROM reviews WHERE booking_id = $1 AND role = $2 LIMIT 1`, [bookingId, role]);
  return result.rowCount > 0;
}

export async function insertReview({
  bookingId,
  authorId,
  targetUserId,
  listingId,
  role,
  rating,
  comment,
}: {
  bookingId: string;
  authorId: string;
  targetUserId: string;
  listingId: string;
  role: "driver_review" | "host_review";
  rating: number;
  comment?: string;
}) {
  const result = await pool.query(
    `
    INSERT INTO reviews (booking_id, author_id, target_user_id, listing_id, role, rating, comment)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING id, rating, comment, created_at, role;
    `,
    [bookingId, authorId, targetUserId, listingId, role, rating, comment ?? null]
  );
  return result.rows[0];
}

export async function refreshListingRating(listingId: string) {
  const result = await pool.query(
    `
    WITH agg AS (
      SELECT
        COUNT(*)::int AS rating_count,
        COALESCE(AVG(rating), 0) AS rating
      FROM reviews
      WHERE listing_id = $1 AND role = 'driver_review'
    )
    UPDATE listings
    SET rating = COALESCE(agg.rating, 0),
        rating_count = COALESCE(agg.rating_count, 0)
    FROM agg
    WHERE listings.id = $1
    RETURNING listings.rating, listings.rating_count;
    `,
    [listingId]
  );
  return result.rows[0] as { rating: number; rating_count: number } | undefined;
}

export async function listListingReviews({
  listingId,
  limit = 20,
  offset = 0,
}: {
  listingId: string;
  limit?: number;
  offset?: number;
}) {
  const result = await pool.query(
    `
    SELECT
      r.id,
      r.rating,
      r.comment,
      r.created_at,
      u.email AS author_email
    FROM reviews r
    JOIN users u ON u.id = r.author_id
    WHERE r.listing_id = $1 AND r.role = 'driver_review'
    ORDER BY r.created_at DESC
    LIMIT $2 OFFSET $3;
    `,
    [listingId, limit, offset]
  );
  return result.rows.map((row) => ({
    id: row.id,
    rating: Number(row.rating),
    comment: row.comment ?? "",
    createdAt: row.created_at,
    authorEmail: row.author_email,
  }));
}

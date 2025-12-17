import "../loadEnv.js";
import { Pool } from "pg";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.warn("DATABASE_URL not set. Database calls will fail until configured.");
}

export const pool = new Pool({ connectionString });

type ReviewRole = "driver_review" | "host_review";

export type SpaceSearchInput = {
  lat: number;
  lng: number;
  radiusKm: number;
  from: string;
  to: string;
};

export async function findAvailableSpaces(input: SpaceSearchInput) {
  const { lat, lng, radiusKm, from, to } = input;
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
    AND NOT EXISTS (
      SELECT 1 FROM bookings b
      WHERE b.listing_id = listings.id
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
    LIMIT 50;
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
    AND NOT EXISTS (
      SELECT 1 FROM bookings b
      WHERE b.listing_id = listings.id
      AND tstzrange(b.start_time, b.end_time, '[)') && tstzrange($4::timestamptz, $5::timestamptz, '[)')
    )
    ORDER BY distance_m ASC
    LIMIT 50;
  `;

  const params = [lng, lat, radiusKm * 1000, from, to];
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
};

export async function createListing(listing: NewListing) {
  const query = `
    INSERT INTO listings (title, address, price_per_day, availability_text, host_id, host_stripe_account_id, amenities, geom, image_urls)
    VALUES ($1, $2, $3, $4, $5, $6, $7, ST_SetSRID(ST_MakePoint($8, $9), 4326), $10)
    RETURNING id;
  `;
  const params = [
    listing.title,
    listing.address,
    listing.pricePerDay,
    listing.availabilityText,
    listing.hostId,
    listing.hostStripeAccountId ?? null,
    listing.amenities ?? [],
    listing.longitude,
    listing.latitude,
    listing.imageUrls ?? [],
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
}: {
  listingId: string;
  driverId: string;
  from: string;
  to: string;
  stripePaymentIntentId: string;
  checkoutSessionId: string;
  amountCents: number;
  currency: string;
}) {
  const insertWithStatus = `
    INSERT INTO bookings (listing_id, driver_id, start_time, end_time, payment_intent_id, checkout_session_id, amount_cents, currency, status)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending')
    RETURNING id;
  `;
  try {
    const result = await pool.query(insertWithStatus, [
      listingId,
      driverId,
      from,
      to,
      stripePaymentIntentId,
      checkoutSessionId,
      amountCents,
      currency,
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
};

export async function createUser({
  email,
  passwordHash,
  role = "driver",
}: {
  email: string;
  passwordHash: string;
  role?: UserRecord["role"];
}) {
  const query = `
    INSERT INTO users (email, password_hash, role)
    VALUES ($1, $2, $3)
    ON CONFLICT (email) DO NOTHING
    RETURNING id, email, role, password_hash, host_stripe_account_id;
  `;
  const result = await pool.query(query, [email.toLowerCase(), passwordHash, role]);
  return result.rows[0] as UserRecord | undefined;
}

export async function findUserByEmail(email: string) {
  const result = await pool.query(
    `SELECT id, email, password_hash, role, host_stripe_account_id FROM users WHERE email = $1 LIMIT 1`,
    [email.toLowerCase()]
  );
  return result.rows[0] as UserRecord | undefined;
}

export async function findUserById(userId: string) {
  const result = await pool.query(
    `SELECT id, email, password_hash, role, host_stripe_account_id FROM users WHERE id = $1 LIMIT 1`,
    [userId]
  );
  return result.rows[0] as UserRecord | undefined;
}

export async function listListingsByHost(hostId: string) {
  const result = await pool.query(
    `
    SELECT id, title, address, price_per_day, availability_text, image_urls, ST_X(geom) AS longitude, ST_Y(geom) AS latitude
    FROM listings
    WHERE host_id = $1
    ORDER BY id DESC
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
    longitude: row.longitude,
    latitude: row.latitude,
  }));
}

export async function deleteListing({ listingId, hostId }: { listingId: string; hostId: string }) {
  const result = await pool.query(
    `
    DELETE FROM listings
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
      host_id,
      rating,
      rating_count,
      ST_X(geom) AS longitude,
      ST_Y(geom) AS latitude
    FROM listings
    WHERE id = $1
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
    hostId: row.host_id,
    rating: Number(row.rating ?? 5),
    ratingCount: Number(row.rating_count ?? 0),
    latitude: row.latitude,
    longitude: row.longitude,
  };
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
}: {
  checkoutSessionId: string;
  status: "confirmed" | "canceled";
  paymentIntentId?: string;
}) {
  try {
    const result = await pool.query(
      `
      UPDATE bookings
      SET status = $1,
          payment_intent_id = COALESCE($3, payment_intent_id)
      WHERE checkout_session_id = $2
      RETURNING id;
      `,
      [status, checkoutSessionId, paymentIntentId ?? null]
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

export async function listUserBookings(userId: string) {
  const driverRows = await pool.query(
    `
    SELECT
      b.id,
      b.start_time,
      b.end_time,
      b.status,
      b.amount_cents,
      b.currency,
      l.title,
      l.address,
      l.host_id
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
      b.start_time,
      b.end_time,
      b.status,
      b.amount_cents,
      b.currency,
      l.title,
      l.address,
      l.host_id
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
    startTime: row.start_time,
    endTime: row.end_time,
    status: row.status ?? "pending",
    amountCents: row.amount_cents ?? 0,
    currency: row.currency ?? "eur",
    address: row.address,
    title: row.title,
  });

  return {
    driverBookings: driverRows.rows.map(mapRow),
    hostBookings: hostRows.rows.map(mapRow),
  };
}

export async function setHostStripeAccountId(userId: string, accountId: string) {
  const res = await pool.query(
    `UPDATE users SET host_stripe_account_id = $2 WHERE id = $1 RETURNING id, host_stripe_account_id`,
    [userId, accountId]
  );
  return res.rowCount ? res.rows[0] : null;
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

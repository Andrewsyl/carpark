import { Router } from "express";
import { z } from "zod";
import {
  createListing,
  findAvailableSpaces,
  findSpacesWithAvailability,
  deleteListing,
  listListingsByHost,
  getListingById,
  getListingByIdWithAvailability,
  listAvailability,
  findUserById,
  updateListingForHost,
  getListingHostId,
  countActiveBookingsForListing,
  insertEventLog,
} from "../lib/db.js";
import { getPresignedPostUpload, uploadBufferToS3, MAX_LISTING_IMAGE_BYTES, S3UploadConfigError } from "../lib/s3.js";
import { geocodeAddress } from "../lib/geocode.js";
import { generateListingDescription } from "../lib/generateDescription.js";
import { setListingDescription } from "../lib/db.js";
import { requireAuth, optionalAuth } from "../middleware/auth.js";
import { stripEircode } from "../lib/address.js";
import { enforceBlockedList, getFraudSettings, getUserRiskProfile, shouldEnforceFraud } from "../middleware/fraud.js";
import { createRateLimiter } from "../middleware/rateLimit.js";
import { env } from "../env.js";

const router = Router();
const DEFAULT_DAILY_HOURS = 8;

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

const rateTypeSchema = z.enum(["hourly", "daily"]);

function normalizeListingPricing(input: {
  rateType?: "hourly" | "daily";
  pricePerDay?: number;
  pricePerHour?: number;
  pricePerMonth?: number;
}) {
  const hasDay = typeof input.pricePerDay === "number" && Number.isFinite(input.pricePerDay) && input.pricePerDay > 0;
  const hasHour = typeof input.pricePerHour === "number" && Number.isFinite(input.pricePerHour) && input.pricePerHour > 0;

  if (!hasDay && !hasHour) {
    throw new z.ZodError([
      {
        code: z.ZodIssueCode.custom,
        path: ["pricePerDay"],
        message: "Provide at least an hourly or daily price",
      },
    ]);
  }

  const rateType = input.rateType ?? (hasHour ? "hourly" : "daily");
  const normalizedHourly = hasHour
    ? roundMoney(input.pricePerHour!)
    : roundMoney((input.pricePerDay ?? 0) / DEFAULT_DAILY_HOURS);
  const normalizedDaily = hasDay
    ? roundMoney(input.pricePerDay!)
    : roundMoney((input.pricePerHour ?? 0) * DEFAULT_DAILY_HOURS);

  return {
    rateType,
    pricePerDay: normalizedDaily,
    pricePerHour: normalizedHourly,
    pricePerMonth:
      typeof input.pricePerMonth === "number" &&
      Number.isFinite(input.pricePerMonth) &&
      input.pricePerMonth > 0
        ? roundMoney(input.pricePerMonth)
        : null,
  };
}

const searchLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 60,
  keyPrefix: "listing-search",
});

const listingWriteLimiter = createRateLimiter({
  windowMs: 10 * 60 * 1000,
  max: 20,
  keyPrefix: "listing-write",
  keyGenerator: (req) => req.user?.userId ?? req.ip ?? "unknown",
});

const listingReadLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 120,
  keyPrefix: "listing-read",
});

async function requireActiveHost(userId?: string) {
  if (!userId) return { ok: false, message: "Unauthorized" } as const;
  const settings = await getFraudSettings();
  const enforceFraud = shouldEnforceFraud(settings);
  const profile = await getUserRiskProfile(userId);
  if (!profile) return { ok: false, message: "Unauthorized" } as const;
  if (profile.status === "suspended") {
    return { ok: false, message: "Account suspended. Contact support." } as const;
  }
  if (!profile.email_verified) {
    return { ok: false, message: "Please verify your email before hosting." } as const;
  }
  const accountAgeMinutes = (Date.now() - new Date(profile.created_at).getTime()) / 60000;
  if (accountAgeMinutes < settings.minAccountAgeMinutes) {
    if (!enforceFraud) {
      console.warn("[fraud] host account age below threshold", {
        userId,
        accountAgeMinutes,
        minAccountAgeMinutes: settings.minAccountAgeMinutes,
      });
      return { ok: true } as const;
    }
    return { ok: false, message: "Please wait a few minutes before hosting." } as const;
  }
  return { ok: true } as const;
}

const imageUploadSchema = z.object({
  contentType: z
    .string()
    .trim()
    .toLowerCase()
    .refine(
      (value) => ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"].includes(value),
      "Unsupported file type"
    ),
  fileSizeBytes: z.coerce
    .number()
    .int()
    .positive("File size is required")
    .max(MAX_LISTING_IMAGE_BYTES, `Image must be ${Math.round(MAX_LISTING_IMAGE_BYTES / (1024 * 1024))}MB or smaller`),
});

router.post("/image-upload-url", requireAuth, enforceBlockedList, listingWriteLimiter, async (req, res, next) => {
  try {
    const { contentType, fileSizeBytes } = imageUploadSchema.parse(req.body);
    const userId = req.user!.userId;
    const gate = await requireActiveHost(userId);
    if (!gate.ok) return res.status(403).json({ message: gate.message });
    const upload = await getPresignedPostUpload({ contentType, userId, fileSizeBytes });
    res.json(upload);
  } catch (error) {
    if (error instanceof S3UploadConfigError) {
      return res.status(503).json({ message: error.message });
    }
    next(error);
  }
});

const directUploadSchema = z.object({
  data: z.string().min(1),
  contentType: z.string().min(1),
  fileSizeBytes: z.number().positive().max(MAX_LISTING_IMAGE_BYTES),
});

router.post("/upload-image", requireAuth, enforceBlockedList, listingWriteLimiter, async (req, res, next) => {
  try {
    const { data, contentType, fileSizeBytes } = directUploadSchema.parse(req.body);
    const userId = req.user!.userId;
    const gate = await requireActiveHost(userId);
    if (!gate.ok) return res.status(403).json({ message: gate.message });
    if (fileSizeBytes > MAX_LISTING_IMAGE_BYTES) {
      return res.status(400).json({ message: "Image must be 10MB or smaller." });
    }
    const buffer = Buffer.from(data, "base64");
    const { publicUrl } = await uploadBufferToS3({ buffer, contentType, userId });
    res.json({ publicUrl });
  } catch (error) {
    if (error instanceof S3UploadConfigError) {
      return res.status(503).json({ message: error.message });
    }
    next(error);
  }
});

const createListingSchema = z.object({
  title: z.string().trim().min(3).max(80),
  address: z.string().trim().min(3).max(200),
  rateType: rateTypeSchema.default("daily"),
  pricePerDay: z.coerce.number().positive().max(100000).optional(),
  pricePerHour: z.coerce.number().positive().max(100000).optional(),
  pricePerMonth: z.coerce.number().positive().max(100000).optional(),
  availabilityText: z.string().trim().min(3).max(240),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  amenities: z.array(z.string().trim().max(40)).max(20).optional(),
  imageUrls: z.array(z.string().trim().url()).max(10).optional(),
  accessCode: z.string().trim().min(2).max(40).nullable().optional(),
  arrivalInstructions: z.string().trim().min(3).max(240).nullable().optional(),
  permissionDeclared: z.boolean().optional(),
  capacity: z.coerce.number().int().min(1).max(20).optional(),
  description: z.string().trim().max(2000).nullable().optional(),
  vehicleSizeSuitability: z.enum(["small", "medium", "large", "van"]).nullable().optional(),
});

router.post("/", requireAuth, enforceBlockedList, listingWriteLimiter, async (req, res, next) => {
  try {
    const payload = createListingSchema.parse(req.body);
    const pricing = normalizeListingPricing(payload);
    const hostId = req.user?.userId;
    if (!hostId) return res.status(401).json({ message: "Unauthorized" });
    const gate = await requireActiveHost(hostId);
    if (!gate.ok) return res.status(403).json({ message: gate.message });

    const host = await findUserById(hostId);
    const hostStripeAccountId = host?.host_stripe_account_id ?? `acct_mock_${hostId.slice(0, 8)}`;

    let latitude = payload.latitude;
    let longitude = payload.longitude;

    // If coordinates are zeroed, attempt to geocode server-side.
    if ((!latitude && latitude !== 0) || (!longitude && longitude !== 0)) {
      const geocoded = await geocodeAddress(payload.address);
      if (geocoded) {
        latitude = geocoded.lat;
        longitude = geocoded.lng;
      }
    }

    const created = await createListing({
      ...payload,
      description: payload.description?.trim() || null,
      vehicleSizeSuitability: payload.vehicleSizeSuitability ?? null,
      rateType: pricing.rateType,
      pricePerDay: pricing.pricePerDay,
      pricePerHour: pricing.pricePerHour,
      pricePerMonth: pricing.pricePerMonth,
      hostId,
      latitude,
      longitude,
      imageUrls: payload.imageUrls,
      accessCode: payload.accessCode?.trim() || null,
      arrivalInstructions: payload.arrivalInstructions?.trim() || null,
      permissionDeclared: payload.permissionDeclared ?? false,
      capacity: payload.capacity ?? 1,
      hostStripeAccountId,
    });
    await insertEventLog({
      eventType: "listing_published",
      payload: {
        listingId: created.id,
        hostId,
      },
    });
    res.status(201).json({ id: created.id });

    if (!payload.description?.trim()) {
      generateListingDescription({
        address: payload.address,
        amenities: payload.amenities,
        capacity: payload.capacity,
        availabilityText: payload.availabilityText,
      })
        .then((desc) => {
          if (desc) return setListingDescription(created.id, desc);
        })
        .catch((err) => console.warn("Background description generation failed", created.id, err));
    }
  } catch (error) {
    next(error);
  }
});

const searchSchema = z
  .object({
    lat: z.coerce.number().min(-90).max(90),
    lng: z.coerce.number().min(-180).max(180),
    radiusKm: z.coerce.number().min(0.1).max(50).default(5),
    from: z.string().datetime(),
    to: z.string().datetime(),
    includeUnavailable: z.coerce.boolean().optional().default(false),
    mode: z.enum(["daily", "monthly"]).optional().default("daily"),
    spaceType: z.string().trim().min(2).max(40).optional(),
    priceMin: z.coerce.number().min(0).max(10000).optional(),
    priceMax: z.coerce.number().min(0).max(10000).optional(),
    coveredParking: z.coerce.boolean().optional(),
    evCharging: z.coerce.boolean().optional(),
    securityLevel: z.enum(["basic", "gated", "cctv"]).optional(),
    vehicleSize: z.enum(["motorcycle", "car", "van"]).optional(),
    instantBook: z.coerce.boolean().optional(),
  })
  .superRefine((value, ctx) => {
    const start = Date.parse(value.from);
    const end = Date.parse(value.to);
    if (Number.isNaN(start) || Number.isNaN(end)) return;
    if (end <= start) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["to"],
        message: "End time must be after start time",
      });
    }
    if (value.priceMin !== undefined && value.priceMax !== undefined && value.priceMax < value.priceMin) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["priceMax"],
        message: "Maximum price must be greater than minimum price",
      });
    }
  });

router.get("/search", searchLimiter, optionalAuth, async (req, res, next) => {
  try {
    const query = searchSchema.parse(req.query);
    const excludeHostId = req.user?.userId;
    const results = query.includeUnavailable
      ? await findSpacesWithAvailability({ ...query, excludeHostId })
      : await findAvailableSpaces({ ...query, excludeHostId });
    // Search is the widest public read in the app. An Eircode here would give
    // the exact address of every space in a radius to an unauthenticated
    // caller, which is the opposite of what the rounded coordinates are for.
    res.json({
      spaces: results.map((space) => ({ ...space, address: stripEircode(space.address) })),
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Public listing detail.
 *
 * `optionalAuth` is here for one reason: the row carries the host's access code
 * and arrival instructions, and this route has no auth of its own. Until
 * 2026-08-10 it returned both to anyone who asked, so every gate code on the
 * platform was readable with an unauthenticated GET. They are now redacted for
 * everyone except the listing's own host, and non-owners get booleans instead —
 * the driver-facing page only ever needed to know *whether* a code exists.
 */
router.get("/:id", listingReadLimiter, optionalAuth, async (req, res, next) => {
  try {
    const listingId = z.string().uuid().parse(req.params.id);
    const query = z
      .object({
        from: z.string().datetime().optional(),
        to: z.string().datetime().optional(),
      })
      .parse(req.query);
    if (query.from && query.to) {
      const fromDate = new Date(query.from);
      const toDate = new Date(query.to);
      if (Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime())) {
        return res.status(400).json({ message: "Invalid date range" });
      }
      if (fromDate > toDate) {
        return res.status(400).json({ message: "Invalid date range" });
      }
    }
    const listing =
      query.from && query.to
        ? await getListingByIdWithAvailability(listingId, query.from, query.to)
        : await getListingById(listingId);
    if (!listing) return res.status(404).json({ message: "Listing not found" });
    const availability = await listAvailability(listingId);
    const availabilitySchedule = availability.filter((entry) => entry.kind === "open");
    const isOwner = Boolean(req.user?.userId && req.user.userId === listing.hostId);
    const hasAccessCode = Boolean(listing.accessCode?.trim());
    const hasArrivalInstructions = Boolean(listing.arrivalInstructions?.trim());
    res.json({
      listing: {
        ...listing,
        // The host editing their own space still needs the real values to
        // prefill the form; nobody else ever does before they have booked.
        accessCode: isOwner ? listing.accessCode : null,
        arrivalInstructions: isOwner ? listing.arrivalInstructions : null,
        // Same rule for the Eircode: it names one property, so it is part of
        // the exact address this page withholds until a booking exists. The
        // booking snapshots the full address at creation, so a confirmed
        // driver still gets it.
        address: isOwner ? listing.address : stripEircode(listing.address),
        hasAccessCode,
        hasArrivalInstructions,
        availabilitySchedule,
      },
    });
  } catch (error) {
    next(error);
  }
});

const updateListingSchema = z.object({
  title: z.string().trim().min(3).max(80).optional(),
  address: z.string().trim().min(3).max(200).optional(),
  rateType: rateTypeSchema.optional(),
  pricePerDay: z.coerce.number().positive().max(100000).optional(),
  pricePerHour: z.coerce.number().positive().max(100000).optional(),
  pricePerMonth: z.coerce.number().positive().max(100000).optional(),
  availabilityText: z.string().trim().min(3).max(240).optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  imageUrls: z.array(z.string().trim().url()).max(10).optional(),
  amenities: z.array(z.string().trim().max(40)).max(20).optional(),
  accessCode: z.string().trim().min(2).max(40).nullable().optional(),
  arrivalInstructions: z.string().trim().min(3).max(240).nullable().optional(),
  permissionDeclared: z.boolean().optional(),
  capacity: z.coerce.number().int().min(1).max(20).optional(),
  isActive: z.boolean().optional(),
  description: z.string().trim().max(2000).nullable().optional(),
  vehicleSizeSuitability: z.enum(["small", "medium", "large", "van"]).nullable().optional(),
});

router.patch("/:id", requireAuth, listingWriteLimiter, async (req, res, next) => {
  try {
    const hostId = req.user?.userId;
    if (!hostId) return res.status(401).json({ message: "Unauthorized" });
    const listingId = z.string().uuid().parse(req.params.id);
    const ownerId = await getListingHostId(listingId);
    if (ownerId !== hostId) return res.status(403).json({ message: "Forbidden" });
    const payload = updateListingSchema.parse(req.body);
    if (payload.isActive === true) {
      const gate = await requireActiveHost(hostId);
      if (!gate.ok) return res.status(403).json({ message: gate.message });
    }
    const pricing =
      payload.rateType ||
      typeof payload.pricePerDay === "number" ||
      typeof payload.pricePerHour === "number" ||
      typeof payload.pricePerMonth === "number"
        ? normalizeListingPricing(payload)
        : null;
    const updated = await updateListingForHost({
      listingId,
      hostId,
      title: payload.title,
      address: payload.address,
      rateType: pricing?.rateType,
      pricePerDay: pricing?.pricePerDay,
      pricePerHour: pricing?.pricePerHour,
      pricePerMonth: pricing?.pricePerMonth,
      availabilityText: payload.availabilityText,
      latitude: payload.latitude,
      longitude: payload.longitude,
      imageUrls: payload.imageUrls,
      amenities: payload.amenities,
      accessCode: payload.accessCode ?? undefined,
      arrivalInstructions: payload.arrivalInstructions ?? undefined,
      permissionDeclared: payload.permissionDeclared,
      capacity: payload.capacity,
      isActive: payload.isActive,
      description: payload.description ?? undefined,
      vehicleSizeSuitability: payload.vehicleSizeSuitability ?? undefined,
    });
    if (!updated) return res.status(404).json({ message: "Listing not found" });
    res.json({ listing: updated });
  } catch (error) {
    next(error);
  }
});

router.get("/", requireAuth, async (req, res, next) => {
  try {
    const hostId = req.user?.userId;
    if (!hostId) return res.status(401).json({ message: "Unauthorized" });
    const listings = await listListingsByHost(hostId);
    res.json({ listings });
  } catch (error) {
    next(error);
  }
});

router.delete("/:id", requireAuth, listingWriteLimiter, async (req, res, next) => {
  try {
    const hostId = req.user?.userId;
    if (!hostId) return res.status(401).json({ message: "Unauthorized" });
    const listingId = z.string().uuid().parse(req.params.id);

    // Verify ownership first (404 covers both missing and not-owned, as before),
    // then block deletion while a driver still has a live booking — deleting
    // would strand them. The host can pause the listing instead to stop new
    // bookings, or cancel the booking (refunding the driver) before deleting.
    const ownerId = await getListingHostId(listingId);
    if (!ownerId || ownerId !== hostId) {
      return res.status(404).json({ message: "Listing not found or not owned by host" });
    }
    const activeBookings = await countActiveBookingsForListing(listingId);
    if (activeBookings > 0) {
      return res.status(409).json({
        message: `This listing has ${activeBookings} active booking${activeBookings === 1 ? "" : "s"}. Pause the listing to stop new bookings, or cancel the booking before deleting.`,
        activeBookings,
      });
    }

    const ok = await deleteListing({ listingId, hostId });
    if (!ok) return res.status(404).json({ message: "Listing not found or not owned by host" });
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

export default router;

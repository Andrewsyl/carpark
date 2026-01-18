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
  findUserById,
  updateListingForHost,
  getListingHostId,
} from "../lib/db.js";
import { getPresignedUploadUrl } from "../lib/s3.js";
import { geocodeAddress } from "../lib/geocode.js";
import { requireAuth } from "../middleware/auth.js";
import { createRateLimiter } from "../middleware/rateLimit.js";

const router = Router();

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

const imageUploadSchema = z.object({
  contentType: z.string().trim().min(3).max(100),
});

router.post("/image-upload-url", requireAuth, listingWriteLimiter, async (req, res, next) => {
  try {
    const { contentType } = imageUploadSchema.parse(req.body);
    const userId = req.user!.userId;
    const { signedUrl, publicUrl } = await getPresignedUploadUrl({ contentType, userId });
    res.json({ signedUrl, publicUrl });
  } catch (error) {
    next(error);
  }
});

const createListingSchema = z.object({
  title: z.string().trim().min(3).max(80),
  address: z.string().trim().min(3).max(200),
  pricePerDay: z.coerce.number().positive().max(100000),
  availabilityText: z.string().trim().min(3).max(240),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  amenities: z.array(z.string().trim().max(40)).max(20).optional(),
  imageUrls: z.array(z.string().trim().url()).max(10).optional(),
  accessCode: z.string().trim().min(2).max(40).nullable().optional(),
  permissionDeclared: z.boolean().optional(),
});

router.post("/", requireAuth, listingWriteLimiter, async (req, res, next) => {
  try {
    const payload = createListingSchema.parse(req.body);
    const pricePerDay = Math.max(1, Math.round(payload.pricePerDay));
    const hostId = req.user?.userId;
    if (!hostId) return res.status(401).json({ message: "Unauthorized" });

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
      pricePerDay,
      hostId,
      latitude,
      longitude,
      imageUrls: payload.imageUrls,
      accessCode: payload.accessCode?.trim() || null,
      permissionDeclared: payload.permissionDeclared ?? false,
      hostStripeAccountId,
    });
    res.status(201).json({ id: created.id });
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
  });

router.get("/search", searchLimiter, async (req, res, next) => {
  try {
    const query = searchSchema.parse(req.query);
    const results = query.includeUnavailable
      ? await findSpacesWithAvailability(query)
      : await findAvailableSpaces(query);
    res.json({ spaces: results });
  } catch (error) {
    next(error);
  }
});

router.get("/:id", async (req, res, next) => {
  try {
    const listingId = z.string().uuid().parse(req.params.id);
    const query = z
      .object({
        from: z.string().datetime().optional(),
        to: z.string().datetime().optional(),
      })
      .parse(req.query);
    const listing =
      query.from && query.to
        ? await getListingByIdWithAvailability(listingId, query.from, query.to)
        : await getListingById(listingId);
    if (!listing) return res.status(404).json({ message: "Listing not found" });
    res.json({ listing });
  } catch (error) {
    next(error);
  }
});

const updateListingSchema = z.object({
  title: z.string().trim().min(3).max(80).optional(),
  address: z.string().trim().min(3).max(200).optional(),
  pricePerDay: z.coerce.number().positive().max(100000).optional(),
  availabilityText: z.string().trim().min(3).max(240).optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  imageUrls: z.array(z.string().trim().url()).max(10).optional(),
  amenities: z.array(z.string().trim().max(40)).max(20).optional(),
  accessCode: z.string().trim().min(2).max(40).nullable().optional(),
  permissionDeclared: z.boolean().optional(),
});

router.patch("/:id", requireAuth, listingWriteLimiter, async (req, res, next) => {
  try {
    const hostId = req.user?.userId;
    if (!hostId) return res.status(401).json({ message: "Unauthorized" });
    const listingId = z.string().uuid().parse(req.params.id);
    const ownerId = await getListingHostId(listingId);
    if (ownerId !== hostId) return res.status(403).json({ message: "Forbidden" });
    const payload = updateListingSchema.parse(req.body);
    const pricePerDay =
      typeof payload.pricePerDay === "number"
        ? Math.max(1, Math.round(payload.pricePerDay))
        : undefined;
    const updated = await updateListingForHost({
      listingId,
      hostId,
      title: payload.title,
      address: payload.address,
      pricePerDay,
      availabilityText: payload.availabilityText,
      latitude: payload.latitude,
      longitude: payload.longitude,
      imageUrls: payload.imageUrls,
      amenities: payload.amenities,
      accessCode: payload.accessCode ?? undefined,
      permissionDeclared: payload.permissionDeclared,
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
    const ok = await deleteListing({ listingId, hostId });
    if (!ok) return res.status(404).json({ message: "Listing not found or not owned by host" });
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

export default router;

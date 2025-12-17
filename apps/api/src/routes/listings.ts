import { Router } from "express";
import { z } from "zod";
import {
  createListing,
  findAvailableSpaces,
  deleteListing,
  listListingsByHost,
  getListingById,
  findUserById,
} from "../lib/db.js";
import { getPresignedUploadUrl } from "../lib/s3.js";
import { geocodeAddress } from "../lib/geocode.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

const imageUploadSchema = z.object({
  contentType: z.string(),
});

router.post("/image-upload-url", requireAuth, async (req, res, next) => {
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
  title: z.string().min(3),
  address: z.string().min(3),
  pricePerDay: z.number().positive(),
  availabilityText: z.string().min(3),
  latitude: z.number(),
  longitude: z.number(),
  amenities: z.array(z.string()).optional(),
  imageUrls: z.array(z.string()).optional(),
});

router.post("/", requireAuth, async (req, res, next) => {
  try {
    const payload = createListingSchema.parse(req.body);
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
      hostId,
      latitude,
      longitude,
      imageUrls: payload.imageUrls,
      hostStripeAccountId,
    });
    res.status(201).json({ id: created.id });
  } catch (error) {
    next(error);
  }
});

const searchSchema = z.object({
  lat: z.coerce.number(),
  lng: z.coerce.number(),
  radiusKm: z.coerce.number().default(5),
  from: z.string(),
  to: z.string(),
});

router.get("/search", async (req, res, next) => {
  try {
    const query = searchSchema.parse(req.query);
    const results = await findAvailableSpaces(query);
    res.json({ spaces: results });
  } catch (error) {
    next(error);
  }
});

router.get("/:id", async (req, res, next) => {
  try {
    const listing = await getListingById(req.params.id);
    if (!listing) return res.status(404).json({ message: "Listing not found" });
    res.json({ listing });
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

router.delete("/:id", requireAuth, async (req, res, next) => {
  try {
    const hostId = req.user?.userId;
    if (!hostId) return res.status(401).json({ message: "Unauthorized" });
    const ok = await deleteListing({ listingId: req.params.id, hostId });
    if (!ok) return res.status(404).json({ message: "Listing not found or not owned by host" });
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

export default router;

import { Router } from "express";
import { z } from "zod";
import { addFavorite, getListingById, listFavoritesByUser, removeFavorite } from "../lib/db.js";
import { stripEircode } from "../lib/address.js";
import { requireAuth } from "../middleware/auth.js";
import { enforceBlockedList } from "../middleware/fraud.js";
import { createRateLimiter } from "../middleware/rateLimit.js";

const router = Router();

const favoritesLimiter = createRateLimiter({
  windowMs: 10 * 60 * 1000,
  max: 60,
  keyPrefix: "favorites",
  keyGenerator: (req) => req.user?.userId ?? req.ip ?? "unknown",
});

const favoriteSchema = z.object({
  listingId: z.string().uuid(),
});

router.get("/", requireAuth, enforceBlockedList, favoritesLimiter, async (req, res, next) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    const favorites = await listFavoritesByUser(userId);
    // Saving a space is not booking it: a favourite is still a pre-booking
    // read, so it carries the same address the listing page shows.
    res.json({
      favorites: favorites.map((favorite) => ({
        ...favorite,
        address: stripEircode(favorite.address),
      })),
    });
  } catch (error) {
    next(error);
  }
});

router.post("/", requireAuth, enforceBlockedList, favoritesLimiter, async (req, res, next) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    const payload = favoriteSchema.parse(req.body);
    const listing = await getListingById(payload.listingId);
    if (!listing) return res.status(404).json({ message: "Listing not found" });
    const added = await addFavorite(userId, payload.listingId);
    res.status(added ? 201 : 200).json({ listingId: payload.listingId });
  } catch (error) {
    next(error);
  }
});

router.delete("/:listingId", requireAuth, enforceBlockedList, favoritesLimiter, async (req, res, next) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    const listingId = z.string().uuid().parse(req.params.listingId);
    await removeFavorite(userId, listingId);
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

export default router;

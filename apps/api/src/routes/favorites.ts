import { Router } from "express";
import { z } from "zod";
import { addFavorite, getListingById, listFavoritesByUser, removeFavorite } from "../lib/db.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

const favoriteSchema = z.object({
  listingId: z.string().uuid(),
});

router.get("/", requireAuth, async (req, res, next) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    const favorites = await listFavoritesByUser(userId);
    res.json({ favorites });
  } catch (error) {
    next(error);
  }
});

router.post("/", requireAuth, async (req, res, next) => {
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

router.delete("/:listingId", requireAuth, async (req, res, next) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    const listingId = req.params.listingId;
    await removeFavorite(userId, listingId);
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

export default router;

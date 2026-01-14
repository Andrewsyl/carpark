import { Router } from "express";
import { z } from "zod";
import {
  getBookingForReview,
  hasExistingReview,
  insertReview,
  refreshListingRating,
  listListingReviews,
} from "../lib/db.js";
import { requireAuth } from "../middleware/auth.js";
import { createRateLimiter } from "../middleware/rateLimit.js";

const router = Router();

const reviewWriteLimiter = createRateLimiter({
  windowMs: 10 * 60 * 1000,
  max: 20,
  keyPrefix: "review-write",
  keyGenerator: (req) => req.user?.userId ?? req.ip ?? "unknown",
});

const reviewReadLimiter = createRateLimiter({
  windowMs: 5 * 60 * 1000,
  max: 120,
  keyPrefix: "review-read",
});

const createReviewSchema = z.object({
  bookingId: z.string().uuid(),
  rating: z.number().min(1).max(5).refine((val) => Number.isInteger(val * 2), {
    message: "Rating must be in 0.5 increments",
  }),
  comment: z
    .preprocess((value) => (typeof value === "string" ? value.trim() : value), z.string().min(3).max(1000))
    .optional(),
});

router.post("/", requireAuth, reviewWriteLimiter, async (req, res, next) => {
  try {
    const { bookingId, rating, comment } = createReviewSchema.parse(req.body);
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const booking = await getBookingForReview(bookingId);
    if (!booking) return res.status(404).json({ message: "Booking not found" });

    const now = new Date();
    const bookingEnd = new Date(booking.end_time);
    if (bookingEnd > now) {
      return res.status(400).json({ message: "Reviews are available after the booking ends." });
    }

    let role: "driver_review" | "host_review";
    let targetUserId: string;
    if (booking.driver_id === userId) {
      role = "driver_review";
      targetUserId = booking.host_id;
    } else if (booking.host_id === userId) {
      role = "host_review";
      targetUserId = booking.driver_id;
    } else {
      return res.status(403).json({ message: "You cannot review this booking." });
    }

    const alreadyLeft = await hasExistingReview({ bookingId, role });
    if (alreadyLeft) {
      return res.status(400).json({ message: "Review already submitted for this booking." });
    }

    const created = await insertReview({
      bookingId,
      authorId: userId,
      targetUserId,
      listingId: booking.listing_id,
      role,
      rating,
      comment,
    });

    let listingRating = undefined as { rating: number; rating_count: number } | undefined;
    if (role === "driver_review") {
      listingRating = await refreshListingRating(booking.listing_id);
    }

    res.status(201).json({
      review: {
        id: created.id,
        rating: created.rating,
        comment: created.comment,
        createdAt: created.created_at,
        role: created.role,
      },
      listingRating,
    });
  } catch (error) {
    next(error);
  }
});

const listReviewsSchema = z.object({
  limit: z.coerce.number().min(1).max(50).default(20),
  offset: z.coerce.number().min(0).default(0),
});

router.get("/listing/:id", reviewReadLimiter, async (req, res, next) => {
  try {
    const { limit, offset } = listReviewsSchema.parse(req.query);
    const reviews = await listListingReviews({ listingId: req.params.id, limit, offset });
    res.json({ reviews });
  } catch (error) {
    next(error);
  }
});

export default router;

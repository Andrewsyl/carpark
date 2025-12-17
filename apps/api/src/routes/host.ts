import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.js";
import {
  findUserById,
  setHostStripeAccountId,
  getListingHostId,
  listAvailability,
  createAvailabilityEntry,
  deleteAvailabilityEntry,
  updateAvailabilityEntry,
} from "../lib/db.js";
import { stripe } from "../lib/stripe.js";

const router = Router();

router.get("/payout", requireAuth, async (req, res, next) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    const user = await findUserById(userId);
    res.json({ accountId: user?.host_stripe_account_id ?? null });
  } catch (error) {
    next(error);
  }
});

router.post("/payout", requireAuth, async (req, res, next) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    let accountId = req.body?.accountId as string | undefined;

    if (!accountId) {
      if (stripe) {
        const account = await stripe.accounts.create({ type: "express" });
        accountId = account.id;
      } else {
        accountId = `acct_mock_${userId.slice(0, 8)}`;
      }
    }

    await setHostStripeAccountId(userId, accountId);
    res.json({ accountId, onboardingUrl: null });
  } catch (error) {
    next(error);
  }
});

const availabilitySchema = z.object({
  kind: z.enum(["open", "blocked"]),
  startsAt: z.string(),
  endsAt: z.string(),
  repeatWeekdays: z.array(z.number().int().min(0).max(6)).optional(),
  repeatUntil: z.string().optional().nullable(),
});

router.get("/listings/:id/availability", requireAuth, async (req, res, next) => {
  try {
    const hostId = req.user?.userId;
    if (!hostId) return res.status(401).json({ message: "Unauthorized" });
    const ownerId = await getListingHostId(req.params.id);
    if (ownerId !== hostId) return res.status(403).json({ message: "Forbidden" });
    const availability = await listAvailability(req.params.id);
    res.json({ availability });
  } catch (error) {
    next(error);
  }
});

router.post("/listings/:id/availability", requireAuth, async (req, res, next) => {
  try {
    const hostId = req.user?.userId;
    if (!hostId) return res.status(401).json({ message: "Unauthorized" });
    const ownerId = await getListingHostId(req.params.id);
    if (ownerId !== hostId) return res.status(403).json({ message: "Forbidden" });
    const payload = availabilitySchema.parse(req.body);
    const created = await createAvailabilityEntry({
      listingId: req.params.id,
      kind: payload.kind,
      startsAt: payload.startsAt,
      endsAt: payload.endsAt,
      repeatWeekdays: payload.repeatWeekdays,
      repeatUntil: payload.repeatUntil ?? null,
    });
    res.status(201).json({ availability: created });
  } catch (error) {
    next(error);
  }
});

router.patch("/availability/:availabilityId", requireAuth, async (req, res, next) => {
  try {
    const hostId = req.user?.userId;
    if (!hostId) return res.status(401).json({ message: "Unauthorized" });
    const payload = availabilitySchema.partial().parse(req.body);
    const updated = await updateAvailabilityEntry({
      id: req.params.availabilityId,
      hostId,
      kind: payload.kind,
      startsAt: payload.startsAt,
      endsAt: payload.endsAt,
      repeatWeekdays: payload.repeatWeekdays,
      repeatUntil: payload.repeatUntil ?? null,
    });
    if (!updated) return res.status(404).json({ message: "Not found" });
    res.json({ availability: updated });
  } catch (error) {
    next(error);
  }
});

router.delete("/availability/:availabilityId", requireAuth, async (req, res, next) => {
  try {
    const hostId = req.user?.userId;
    if (!hostId) return res.status(401).json({ message: "Unauthorized" });
    const deleted = await deleteAvailabilityEntry({ id: req.params.availabilityId, hostId });
    if (!deleted) return res.status(404).json({ message: "Not found" });
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

export default router;

import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.js";
import { requireAdmin } from "../middleware/admin.js";
import {
  listUsers,
  updateUserStatus,
  listListingsForAdmin,
  updateListingStatus,
  insertAuditLog,
  deleteUserAccount,
  listDuePayoutsForAllHosts,
  markPayoutProcessing,
  markPayoutTransferred,
  markPayoutPending,
} from "../lib/db.js";
import { stripe } from "../lib/stripe.js";

const router = Router();

const userStatusSchema = z.object({
  status: z.enum(["active", "suspended"]).optional(),
  role: z.enum(["driver", "host", "admin"]).optional(),
  adminNote: z.string().trim().max(200).optional(),
  reason: z.string().trim().max(200).optional(),
});

const adminDeleteSchema = z.object({
  reason: z.string().trim().max(200).optional(),
});

const idParamSchema = z.object({
  id: z.string().uuid(),
});

const listUsersQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
  search: z.string().trim().min(1).max(100).optional(),
});

const listListingsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
  status: z.enum(["approved", "pending", "rejected", "disabled"]).optional(),
});

router.get("/users", requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const { limit, offset, search } = listUsersQuerySchema.parse(req.query);
    const users = await listUsers({ limit, offset, search });
    res.json({ users });
  } catch (error) {
    next(error);
  }
});

router.patch("/users/:id", requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const { id } = idParamSchema.parse(req.params);
    const payload = userStatusSchema.parse(req.body);
    const updated = await updateUserStatus({
      userId: id,
      status: payload.status,
      role: payload.role,
      adminNote: payload.adminNote,
    });
    if (!updated) return res.status(404).json({ message: "User not found or no changes" });
    await insertAuditLog({
      adminId: req.user!.userId,
      action: "update_user",
      targetType: "user",
      targetId: id,
      afterState: updated,
      reason: payload.reason,
      ip: req.ip,
      ua: req.headers["user-agent"] as string,
    });
    res.json({ user: updated });
  } catch (error) {
    next(error);
  }
});

router.delete("/users/:id", requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const { id } = idParamSchema.parse(req.params);
    const { reason } = adminDeleteSchema.parse(req.body ?? {});
    const deleted = await deleteUserAccount(id);
    if (!deleted) return res.status(404).json({ message: "User not found" });
    await insertAuditLog({
      adminId: req.user!.userId,
      action: "delete_user",
      targetType: "user",
      targetId: id,
      reason,
      ip: req.ip,
      ua: req.headers["user-agent"] as string,
    });
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

const listingStatusSchema = z.object({
  status: z.enum(["approved", "pending", "rejected", "disabled"]),
  moderationReason: z.string().trim().max(200).optional(),
  moderationNote: z.string().trim().max(500).optional(),
  reason: z.string().trim().max(200).optional(),
});

router.get("/listings", requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const { limit, offset, status } = listListingsQuerySchema.parse(req.query);
    const listings = await listListingsForAdmin({ status, limit, offset });
    res.json({ listings });
  } catch (error) {
    next(error);
  }
});

router.patch("/listings/:id", requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const { id } = idParamSchema.parse(req.params);
    const payload = listingStatusSchema.parse(req.body);
    const updated = await updateListingStatus({
      listingId: id,
      status: payload.status,
      moderationReason: payload.moderationReason,
      moderationNote: payload.moderationNote,
    });
    if (!updated) return res.status(404).json({ message: "Listing not found" });
    await insertAuditLog({
      adminId: req.user!.userId,
      action: "update_listing",
      targetType: "listing",
      targetId: id,
      afterState: updated,
      reason: payload.reason ?? payload.moderationReason,
      ip: req.ip,
      ua: req.headers["user-agent"] as string,
    });
    res.json({ listing: updated });
  } catch (error) {
    next(error);
  }
});

// TODO: Wire this to a daily cron (e.g. CloudWatch/EventBridge) to automate payouts.
router.post("/payouts/run", requireAuth, requireAdmin, async (req, res, next) => {
  try {
    if (!stripe) return res.json({ processed: 0, skipped: true });

    const due = await listDuePayoutsForAllHosts();
    let processed = 0;
    for (const booking of due) {
      const locked = await markPayoutProcessing(booking.id);
      if (!locked) continue;
      const net = Math.max(0, Number(booking.amount_cents) - Number(booking.fee_cents));
      if (net <= 0) {
        await markPayoutPending(booking.id);
        continue;
      }
      try {
        const transfer = await stripe.transfers.create({
          amount: net,
          currency: booking.currency ?? "eur",
          destination: booking.host_stripe_account_id,
          metadata: { booking_id: booking.id, host_id: booking.host_id },
        });
        await markPayoutTransferred({ bookingId: booking.id, transferId: transfer.id });
        processed += 1;
      } catch {
        await markPayoutPending(booking.id);
      }
    }
    res.json({ processed });
  } catch (error) {
    next(error);
  }
});

export default router;

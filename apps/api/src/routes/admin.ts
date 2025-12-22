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
} from "../lib/db.js";

const router = Router();

const userStatusSchema = z.object({
  status: z.enum(["active", "suspended"]).optional(),
  role: z.enum(["driver", "host", "admin"]).optional(),
  adminNote: z.string().optional(),
  reason: z.string().optional(),
});

router.get("/users", requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const limit = Number(req.query.limit ?? 50);
    const offset = Number(req.query.offset ?? 0);
    const search = typeof req.query.search === "string" ? req.query.search : undefined;
    const users = await listUsers({ limit, offset, search });
    res.json({ users });
  } catch (error) {
    next(error);
  }
});

router.patch("/users/:id", requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const payload = userStatusSchema.parse(req.body);
    const updated = await updateUserStatus({
      userId: req.params.id,
      status: payload.status,
      role: payload.role,
      adminNote: payload.adminNote,
    });
    if (!updated) return res.status(404).json({ message: "User not found or no changes" });
    await insertAuditLog({
      adminId: req.user!.userId,
      action: "update_user",
      targetType: "user",
      targetId: req.params.id,
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
    const deleted = await deleteUserAccount(req.params.id);
    if (!deleted) return res.status(404).json({ message: "User not found" });
    await insertAuditLog({
      adminId: req.user!.userId,
      action: "delete_user",
      targetType: "user",
      targetId: req.params.id,
      reason: req.body?.reason,
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
  moderationReason: z.string().optional(),
  moderationNote: z.string().optional(),
  reason: z.string().optional(),
});

router.get("/listings", requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const limit = Number(req.query.limit ?? 50);
    const offset = Number(req.query.offset ?? 0);
    const status = typeof req.query.status === "string" ? req.query.status : undefined;
    const listings = await listListingsForAdmin({ status, limit, offset });
    res.json({ listings });
  } catch (error) {
    next(error);
  }
});

router.patch("/listings/:id", requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const payload = listingStatusSchema.parse(req.body);
    const updated = await updateListingStatus({
      listingId: req.params.id,
      status: payload.status,
      moderationReason: payload.moderationReason,
      moderationNote: payload.moderationNote,
    });
    if (!updated) return res.status(404).json({ message: "Listing not found" });
    await insertAuditLog({
      adminId: req.user!.userId,
      action: "update_listing",
      targetType: "listing",
      targetId: req.params.id,
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

export default router;

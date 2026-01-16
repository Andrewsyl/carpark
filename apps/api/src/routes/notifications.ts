import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.js";
import { deletePushToken, upsertPushToken } from "../lib/db.js";
import { processScheduledNotifications } from "../lib/notifications.js";

const router = Router();

const registerSchema = z.object({
  expoToken: z.string().trim().min(10),
  platform: z.enum(["ios", "android", "web"]).or(z.string().min(2)),
  deviceId: z.string().trim().optional(),
});

router.post("/register", requireAuth, async (req, res, next) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    const payload = registerSchema.parse(req.body);
    await upsertPushToken({
      userId,
      expoToken: payload.expoToken,
      platform: payload.platform,
      deviceId: payload.deviceId ?? null,
    });
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

router.delete("/register", requireAuth, async (req, res, next) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    const payload = registerSchema.pick({ expoToken: true }).parse(req.body);
    const removed = await deletePushToken({ userId, expoToken: payload.expoToken });
    res.json({ ok: true, removed });
  } catch (error) {
    next(error);
  }
});

router.post("/process", async (req, res, next) => {
  try {
    const secret = process.env.NOTIFICATION_PROCESS_SECRET;
    if (secret && req.headers["x-notification-secret"] !== secret) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const sent = await processScheduledNotifications(50);
    res.json({ ok: true, sent });
  } catch (error) {
    next(error);
  }
});

export default router;

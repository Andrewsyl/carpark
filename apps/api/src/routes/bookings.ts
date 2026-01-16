import express, { Router } from "express";
import { z } from "zod";
import {
  createBooking,
  pool,
  updateBookingStatus,
  updateBookingStatusByPaymentIntent,
  insertEventLog,
  markBookingRefundedByPaymentIntent,
  listUserBookings,
  getListingWithHostAccount,
  findUserById,
  cancelBookingByDriver,
  cancelBookingWithRefund,
  getBookingForRefund,
  getBookingForExtension,
  getBookingNotificationTargets,
  getBookingNotificationTargetsByCheckoutSession,
  getBookingNotificationTargetsByPaymentIntent,
  deleteScheduledNotificationsByBooking,
  insertScheduledNotification,
  listPushTokensByUserIds,
  updateBookingExtension,
  checkInBooking,
  updateBookingWindow,
} from "../lib/db.js";
import { createCheckoutSession, stripe } from "../lib/stripe.js";
import { sendBookingEmail } from "../lib/email.js";
import { sendPushNotification } from "../lib/notifications.js";
import { requireAuth } from "../middleware/auth.js";
import { createRateLimiter } from "../middleware/rateLimit.js";
import "../loadEnv.js";

const router = Router();
const bookingLimiter = createRateLimiter({
  windowMs: 5 * 60 * 1000,
  max: 10,
  keyPrefix: "booking",
  keyGenerator: (req) => req.user?.userId ?? req.ip ?? "unknown",
});

const bookingSchemaBase = z.object({
  listingId: z.string().uuid(),
  from: z.string().datetime(),
  to: z.string().datetime(),
  amountCents: z.number().int().positive().max(10000000),
  currency: z.string().trim().length(3).default("eur"),
  platformFeePercent: z.number().min(0).max(0.3).default(0.1),
  vehiclePlate: z
    .string()
    .trim()
    .min(2)
    .max(12)
    .regex(/^[A-Za-z0-9 ]+$/, "Only letters, numbers, and spaces")
    .optional()
    .nullable(),
});

const bookingSchema = bookingSchemaBase.superRefine((value, ctx) => {
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

const paymentIntentSchema = bookingSchemaBase.pick({
  listingId: true,
  from: true,
  to: true,
  amountCents: true,
  currency: true,
  platformFeePercent: true,
  vehiclePlate: true,
});

function formatBookingWindow(start: Date, end: Date) {
  const startText = start.toLocaleString("en-IE", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
  const endText = end.toLocaleString("en-IE", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
  return `${startText} → ${endText}`;
}

async function hasBookingOverlap({
  listingId,
  bookingId,
  startTime,
  endTime,
}: {
  listingId: string;
  bookingId: string;
  startTime: Date;
  endTime: Date;
}) {
  const overlap = await pool.query(
    `
    SELECT 1 FROM bookings
    WHERE listing_id = $1
      AND id <> $2
      AND (status IS NULL OR status <> 'canceled')
      AND tstzrange(start_time, end_time, '[)') && tstzrange($3::timestamptz, $4::timestamptz, '[)')
    LIMIT 1
    `,
    [listingId, bookingId, startTime, endTime]
  );
  return overlap.rowCount && overlap.rowCount > 0;
}

async function sendBookingStatusPush({
  bookingId,
  driverId,
  hostId,
  listingTitle,
  startTime,
  endTime,
  status,
}: {
  bookingId: string;
  driverId: string;
  hostId: string;
  listingTitle: string;
  startTime: Date;
  endTime: Date;
  status: "confirmed" | "canceled";
}) {
  const tokens = await listPushTokensByUserIds([driverId, hostId]);
  if (!tokens.length) return;

  const byUser = new Map<string, string[]>();
  for (const token of tokens) {
    const list = byUser.get(token.user_id) ?? [];
    list.push(token.expo_token);
    byUser.set(token.user_id, list);
  }

  const windowText = formatBookingWindow(startTime, endTime);
  const driverTokens = byUser.get(driverId) ?? [];
  const hostTokens = byUser.get(hostId) ?? [];

  if (driverTokens.length) {
    await sendPushNotification({
      tokens: driverTokens,
      title: status === "confirmed" ? "Booking confirmed" : "Booking canceled",
      body: `${listingTitle} · ${windowText}`,
      data: { bookingId, status, role: "driver" },
    });
  }

  if (hostTokens.length) {
    await sendPushNotification({
      tokens: hostTokens,
      title: status === "confirmed" ? "New booking confirmed" : "Booking canceled",
      body: `${listingTitle} · ${windowText}`,
      data: { bookingId, status, role: "host" },
    });
  }
}

async function sendPaymentReceivedPush({
  bookingId,
  hostId,
  listingTitle,
}: {
  bookingId: string;
  hostId: string;
  listingTitle: string;
}) {
  const tokens = await listPushTokensByUserIds([hostId]);
  const hostTokens = tokens
    .filter((token) => token.user_id === hostId)
    .map((token) => token.expo_token);
  if (!hostTokens.length) return;

  await sendPushNotification({
    tokens: hostTokens,
    title: "Payment received",
    body: `${listingTitle} booking payment received.`,
    data: { bookingId, status: "confirmed", role: "host" },
  });
}

async function scheduleBookingNotifications({
  bookingId,
  driverId,
  startTime,
  endTime,
}: {
  bookingId: string;
  driverId: string;
  startTime: Date;
  endTime: Date;
}) {
  const now = Date.now();
  const startSoon = new Date(startTime.getTime() - 60 * 60 * 1000);
  // Always queue a "starting soon" reminder; if the booking is very soon, schedule it immediately.
  const scheduledStartSoon =
    startTime.getTime() > now + 5 * 60 * 1000
      ? startSoon.getTime() > now + 60 * 1000
        ? startSoon
        : new Date(now + 60 * 1000)
      : new Date(now + 10 * 1000);
  await insertScheduledNotification({
    userId: driverId,
    bookingId,
    type: "booking_start_soon",
    scheduledAt: scheduledStartSoon,
  });

  const endSoon = new Date(endTime.getTime() - 30 * 60 * 1000);
  if (endSoon.getTime() > now + 5 * 60 * 1000) {
    await insertScheduledNotification({
      userId: driverId,
      bookingId,
      type: "booking_end_soon",
      scheduledAt: endSoon,
    });
  }

  const reviewTime = new Date(endTime.getTime() + 60 * 60 * 1000);
  await insertScheduledNotification({
    userId: driverId,
    bookingId,
    type: "review_reminder",
    scheduledAt: reviewTime,
  });
}

async function getOrCreateCustomer(email: string) {
  if (!stripe) throw new Error("Stripe not configured");
  const existing = await stripe.customers.list({ email, limit: 1 });
  if (existing.data.length > 0) return existing.data[0].id;
  const customer = await stripe.customers.create({ email });
  return customer.id;
}

router.post("/", requireAuth, bookingLimiter, async (req, res, next) => {
  try {
    const payload = bookingSchema.parse(req.body);
    const driverId = req.user?.userId;
    if (!driverId) return res.status(401).json({ message: "Unauthorized" });

    const overlapCheck = await pool.query(
      `SELECT 1 FROM bookings
       WHERE listing_id = $1
         AND (status IS NULL OR status <> 'canceled')
         AND tstzrange(start_time, end_time, '[)') && tstzrange($2::timestamptz, $3::timestamptz, '[)')
       LIMIT 1`,
      [payload.listingId, payload.from, payload.to]
    );

    if (overlapCheck.rowCount && overlapCheck.rowCount > 0) {
      return res.status(409).json({ message: "Time slot already booked" });
    }

    const listingWithHost = await getListingWithHostAccount(payload.listingId);
    const payoutAvailableAt = new Date(
      new Date(payload.from).getTime() + 24 * 60 * 60 * 1000
    );

    const platformFeeCents = Math.round(payload.amountCents * payload.platformFeePercent);
    const session = await createCheckoutSession({
      amount: payload.amountCents,
      currency: payload.currency,
      listingId: payload.listingId,
      hostStripeAccountId: listingWithHost?.hostStripeAccountId ?? null,
      platformFeePercent: payload.platformFeePercent,
      successUrl: `${process.env.WEB_BASE_URL ?? "http://localhost:3000"}/booking/success?session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${process.env.WEB_BASE_URL ?? "http://localhost:3000"}/booking/cancel?session_id={CHECKOUT_SESSION_ID}`,
    });

    await sendBookingEmail({
      to: "driver@example.com",
      subject: "Parking booking created",
      body: `Booking for listing ${payload.listingId} from ${payload.from} to ${payload.to}`,
    });

    // Persist reservation as pending; confirm via Stripe webhook in production.
    await createBooking({
      listingId: payload.listingId,
      driverId,
      from: payload.from,
      to: payload.to,
      stripePaymentIntentId: session.payment_intent as string,
      checkoutSessionId: session.id,
      amountCents: payload.amountCents,
      currency: payload.currency,
      platformFeeCents,
      payoutAvailableAt,
      vehiclePlate: payload.vehiclePlate ? payload.vehiclePlate.toUpperCase() : null,
    });

    res.status(201).json({ checkoutUrl: session.url, sessionId: session.id });
  } catch (error: any) {
    if (error?.code === "23P01") {
      return res.status(409).json({ message: "Time slot already booked" });
    }
    next(error);
  }
});

router.post("/payment-intent", requireAuth, bookingLimiter, async (req, res, next) => {
  try {
    if (!stripe) return res.status(500).json({ message: "Stripe not configured" });
    const payload = paymentIntentSchema.parse(req.body);
    const driverId = req.user?.userId;
    if (!driverId) return res.status(401).json({ message: "Unauthorized" });

    const overlapCheck = await pool.query(
      `SELECT 1 FROM bookings
       WHERE listing_id = $1
         AND (status IS NULL OR status <> 'canceled')
         AND tstzrange(start_time, end_time, '[)') && tstzrange($2::timestamptz, $3::timestamptz, '[)')
       LIMIT 1`,
      [payload.listingId, payload.from, payload.to]
    );

    if (overlapCheck.rowCount && overlapCheck.rowCount > 0) {
      return res.status(409).json({ message: "Time slot already booked" });
    }

    const user = await findUserById(driverId);
    if (!user) return res.status(401).json({ message: "Unauthorized" });

    const listingWithHost = await getListingWithHostAccount(payload.listingId);
    const payoutAvailableAt = new Date(
      new Date(payload.from).getTime() + 24 * 60 * 60 * 1000
    );
    const customerId = await getOrCreateCustomer(user.email);
    const ephemeralKey = await stripe.ephemeralKeys.create(
      { customer: customerId },
      { apiVersion: "2024-06-20" }
    );

    const platformFeeCents = Math.round(payload.amountCents * payload.platformFeePercent);
    const intentParams: any = {
      amount: payload.amountCents,
      currency: payload.currency,
      customer: customerId,
      automatic_payment_methods: { enabled: true, allow_redirects: "never" },
      metadata: {
        listing_id: payload.listingId,
        driver_id: driverId,
        platform_fee_cents: String(platformFeeCents),
        host_account_id: listingWithHost?.hostStripeAccountId ?? "",
      },
    };

    const intent = await stripe.paymentIntents.create(intentParams);

    await createBooking({
      listingId: payload.listingId,
      driverId,
      from: payload.from,
      to: payload.to,
      stripePaymentIntentId: intent.id,
      checkoutSessionId: null,
      amountCents: payload.amountCents,
      currency: payload.currency,
      platformFeeCents,
      payoutAvailableAt,
      vehiclePlate: payload.vehiclePlate ? payload.vehiclePlate.toUpperCase() : null,
    });

    res.json({
      paymentIntentClientSecret: intent.client_secret,
      paymentIntentId: intent.id,
      customerId,
      ephemeralKeySecret: ephemeralKey.secret,
    });
  } catch (error: any) {
    if (error?.code === "23P01") {
      return res.status(409).json({ message: "Time slot already booked" });
    }
    next(error);
  }
});

router.post("/:id/extend-intent", requireAuth, bookingLimiter, async (req, res, next) => {
  try {
    if (!stripe) return res.status(500).json({ message: "Stripe not configured" });
    const bookingId = z.string().uuid().parse(req.params.id);
    const schema = z.object({
      newEndTime: z.string().datetime(),
    });
    const { newEndTime } = schema.parse(req.body);
    const driverId = req.user?.userId;
    if (!driverId) return res.status(401).json({ message: "Unauthorized" });

    const booking = await getBookingForExtension({ bookingId, driverId });
    if (!booking) return res.status(404).json({ message: "Booking not found" });
    if (booking.status !== "confirmed") {
      return res.status(400).json({ message: "Only confirmed bookings can be extended" });
    }

    const currentEnd = new Date(booking.end_time);
    const startTime = new Date(booking.start_time);
    const requestedEnd = new Date(newEndTime);
    if (Number.isNaN(requestedEnd.getTime())) {
      return res.status(400).json({ message: "Invalid end time" });
    }
    if (requestedEnd.getTime() <= currentEnd.getTime()) {
      return res.status(400).json({ message: "New end time must be after current end time" });
    }

    const overlapCheck = await pool.query(
      `SELECT 1 FROM bookings
       WHERE listing_id = $1
         AND id <> $2
         AND (status IS NULL OR status <> 'canceled')
         AND tstzrange(start_time, end_time, '[)') && tstzrange($3::timestamptz, $4::timestamptz, '[)')
       LIMIT 1`,
      [booking.listing_id, booking.id, booking.start_time, requestedEnd.toISOString()]
    );
    if (overlapCheck.rowCount && overlapCheck.rowCount > 0) {
      return res.status(409).json({ message: "Time slot already booked" });
    }

    const durationHours = Math.max(
      1,
      Math.ceil((requestedEnd.getTime() - startTime.getTime()) / (1000 * 60 * 60))
    );
    const currentHours = Math.max(
      1,
      Math.ceil((currentEnd.getTime() - startTime.getTime()) / (1000 * 60 * 60))
    );
    const newDays = Math.max(1, Math.ceil(durationHours / 24));
    const currentDays = Math.max(1, Math.ceil(currentHours / 24));
    const newTotalCents = booking.price_per_day * newDays * 100;
    const currentTotalCents =
      booking.amount_cents ?? booking.price_per_day * currentDays * 100;
    const additionalAmountCents = newTotalCents - currentTotalCents;

    if (additionalAmountCents <= 0) {
      try {
        const updated = await updateBookingExtension({
          bookingId,
          driverId,
          newEndTime: requestedEnd.toISOString(),
          newAmountCents: newTotalCents,
        });
        if (!updated) {
          return res.status(400).json({ message: "Booking cannot be extended" });
        }
        return res.json({
          noCharge: true,
          newEndTime: requestedEnd.toISOString(),
          newTotalCents,
        });
      } catch (error: any) {
        if (error?.code === "23P01") {
          return res.status(409).json({ message: "Time slot already booked" });
        }
        throw error;
      }
    }

    const user = await findUserById(driverId);
    if (!user) return res.status(401).json({ message: "Unauthorized" });
    const customerId = await getOrCreateCustomer(user.email);
    const ephemeralKey = await stripe.ephemeralKeys.create(
      { customer: customerId },
      { apiVersion: "2024-06-20" }
    );

    const intent = await stripe.paymentIntents.create({
      amount: additionalAmountCents,
      currency: booking.currency ?? "eur",
      customer: customerId,
      automatic_payment_methods: { enabled: true, allow_redirects: "never" },
      metadata: {
        booking_id: bookingId,
        type: "extension",
      },
    });

    res.json({
      paymentIntentClientSecret: intent.client_secret,
      paymentIntentId: intent.id,
      customerId,
      ephemeralKeySecret: ephemeralKey.secret,
      additionalAmountCents,
      newTotalCents,
      newEndTime: requestedEnd.toISOString(),
    });
  } catch (error) {
    next(error);
  }
});

router.post("/:id/extend-confirm", requireAuth, bookingLimiter, async (req, res, next) => {
  try {
    if (!stripe) return res.status(500).json({ message: "Stripe not configured" });
    const bookingId = z.string().uuid().parse(req.params.id);
    const schema = z.object({
      paymentIntentId: z.string().trim().min(5).max(200),
      newEndTime: z.string().datetime(),
      newTotalCents: z.number().int().positive().max(10000000),
    });
    const { paymentIntentId, newEndTime, newTotalCents } = schema.parse(req.body);
    const driverId = req.user?.userId;
    if (!driverId) return res.status(401).json({ message: "Unauthorized" });

    const booking = await getBookingForExtension({ bookingId, driverId });
    if (!booking) return res.status(404).json({ message: "Booking not found" });
    if (booking.status !== "confirmed") {
      return res.status(400).json({ message: "Only confirmed bookings can be extended" });
    }

    const currentEnd = new Date(booking.end_time);
    const requestedEnd = new Date(newEndTime);
    if (requestedEnd.getTime() <= currentEnd.getTime()) {
      return res.status(400).json({ message: "New end time must be after current end time" });
    }

    const intent = await stripe.paymentIntents.retrieve(paymentIntentId, {
      expand: ["charges.data.balance_transaction"],
    });
    if (intent.status !== "succeeded") {
      return res.status(400).json({ message: `Payment not completed (${intent.status})` });
    }

    try {
      const updated = await updateBookingExtension({
        bookingId,
        driverId,
        newEndTime: requestedEnd.toISOString(),
        newAmountCents: newTotalCents,
        paymentIntentId,
        receiptUrl: intent.charges?.data?.[0]?.receipt_url ?? null,
      });
      if (!updated) {
        return res.status(400).json({ message: "Booking cannot be extended" });
      }
      res.json({
        ok: true,
        newEndTime: updated.end_time.toISOString(),
        newTotalCents: updated.amount_cents,
      });
    } catch (error: any) {
      if (error?.code === "23P01") {
        return res.status(409).json({ message: "Time slot already booked" });
      }
      throw error;
    }
  } catch (error) {
    next(error);
  }
});

router.post("/:id/change-intent", requireAuth, bookingLimiter, async (req, res, next) => {
  try {
    if (!stripe) return res.status(500).json({ message: "Stripe not configured" });
    const bookingId = z.string().uuid().parse(req.params.id);
    const schema = z.object({
      newStartTime: z.string().datetime(),
      newEndTime: z.string().datetime(),
    });
    const { newStartTime, newEndTime } = schema.parse(req.body);
    const driverId = req.user?.userId;
    if (!driverId) return res.status(401).json({ message: "Unauthorized" });

    const booking = await getBookingForExtension({ bookingId, driverId });
    if (!booking) return res.status(404).json({ message: "Booking not found" });
    if (booking.status !== "confirmed") {
      return res.status(400).json({ message: "Only confirmed bookings can be updated" });
    }

    const currentEnd = new Date(booking.end_time);
    const requestedStart = new Date(newStartTime);
    const requestedEnd = new Date(newEndTime);
    if (Number.isNaN(requestedStart.getTime()) || Number.isNaN(requestedEnd.getTime())) {
      return res.status(400).json({ message: "Invalid booking times" });
    }
    if (requestedEnd.getTime() <= requestedStart.getTime()) {
      return res.status(400).json({ message: "End time must be after start time" });
    }
    if (requestedStart.getTime() < Date.now() - 5 * 60 * 1000) {
      return res.status(400).json({ message: "Start time must be in the future" });
    }
    if (currentEnd.getTime() <= Date.now()) {
      return res.status(400).json({ message: "Only upcoming bookings can be updated" });
    }

    const overlapCheck = await pool.query(
      `SELECT 1 FROM bookings
       WHERE listing_id = $1
         AND id <> $2
         AND (status IS NULL OR status <> 'canceled')
         AND tstzrange(start_time, end_time, '[)') && tstzrange($3::timestamptz, $4::timestamptz, '[)')
       LIMIT 1`,
      [booking.listing_id, booking.id, requestedStart.toISOString(), requestedEnd.toISOString()]
    );
    if (overlapCheck.rowCount && overlapCheck.rowCount > 0) {
      return res.status(409).json({ message: "Time slot already booked" });
    }

    const durationHours = Math.max(
      1,
      Math.ceil((requestedEnd.getTime() - requestedStart.getTime()) / (1000 * 60 * 60))
    );
    const currentHours = Math.max(
      1,
      Math.ceil((currentEnd.getTime() - new Date(booking.start_time).getTime()) / (1000 * 60 * 60))
    );
    const newDays = Math.max(1, Math.ceil(durationHours / 24));
    const currentDays = Math.max(1, Math.ceil(currentHours / 24));
    const newTotalCents = booking.price_per_day * newDays * 100;
    const currentTotalCents =
      booking.amount_cents ?? booking.price_per_day * currentDays * 100;
    const effectiveTotalCents = Math.max(currentTotalCents, newTotalCents);
    const additionalAmountCents = effectiveTotalCents - currentTotalCents;

    if (additionalAmountCents === 0) {
      try {
        const updated = await updateBookingWindow({
          bookingId,
          driverId,
          newStartTime: requestedStart.toISOString(),
          newEndTime: requestedEnd.toISOString(),
          newAmountCents: effectiveTotalCents,
        });
        if (!updated) {
          return res.status(400).json({ message: "Booking cannot be updated" });
        }
        return res.json({
          noCharge: true,
          newStartTime: requestedStart.toISOString(),
          newEndTime: requestedEnd.toISOString(),
          newTotalCents: effectiveTotalCents,
        });
      } catch (error: any) {
        if (error?.code === "23P01") {
          return res.status(409).json({ message: "Time slot already booked" });
        }
        throw error;
      }
    }

    const user = await findUserById(driverId);
    if (!user) return res.status(401).json({ message: "Unauthorized" });
    const customerId = await getOrCreateCustomer(user.email);
    const ephemeralKey = await stripe.ephemeralKeys.create(
      { customer: customerId },
      { apiVersion: "2024-06-20" }
    );

    const intent = await stripe.paymentIntents.create({
      amount: additionalAmountCents,
      currency: booking.currency ?? "eur",
      customer: customerId,
      automatic_payment_methods: { enabled: true },
      metadata: {
        booking_id: bookingId,
        type: "change",
      },
    });

    res.json({
      paymentIntentClientSecret: intent.client_secret,
      paymentIntentId: intent.id,
      customerId,
      ephemeralKeySecret: ephemeralKey.secret,
      additionalAmountCents,
      newTotalCents: effectiveTotalCents,
      newStartTime: requestedStart.toISOString(),
      newEndTime: requestedEnd.toISOString(),
    });
  } catch (error) {
    next(error);
  }
});

router.post("/:id/change-confirm", requireAuth, bookingLimiter, async (req, res, next) => {
  try {
    if (!stripe) return res.status(500).json({ message: "Stripe not configured" });
    const bookingId = z.string().uuid().parse(req.params.id);
    const schema = z.object({
      paymentIntentId: z.string().trim().min(5).max(200),
      newStartTime: z.string().datetime(),
      newEndTime: z.string().datetime(),
      newTotalCents: z.number().int().positive().max(10000000),
    });
    const { paymentIntentId, newStartTime, newEndTime, newTotalCents } = schema.parse(req.body);
    const driverId = req.user?.userId;
    if (!driverId) return res.status(401).json({ message: "Unauthorized" });

    const booking = await getBookingForExtension({ bookingId, driverId });
    if (!booking) return res.status(404).json({ message: "Booking not found" });
    if (booking.status !== "confirmed") {
      return res.status(400).json({ message: "Only confirmed bookings can be updated" });
    }

    const requestedStart = new Date(newStartTime);
    const requestedEnd = new Date(newEndTime);
    if (requestedEnd.getTime() <= requestedStart.getTime()) {
      return res.status(400).json({ message: "End time must be after start time" });
    }

    const intent = await stripe.paymentIntents.retrieve(paymentIntentId, {
      expand: ["charges.data.balance_transaction"],
    });
    if (intent.status !== "succeeded") {
      return res.status(400).json({ message: `Payment not completed (${intent.status})` });
    }

    try {
      const updated = await updateBookingWindow({
        bookingId,
        driverId,
        newStartTime: requestedStart.toISOString(),
        newEndTime: requestedEnd.toISOString(),
        newAmountCents: newTotalCents,
        paymentIntentId,
        receiptUrl: intent.charges?.data?.[0]?.receipt_url ?? null,
      });
      if (!updated) {
        return res.status(400).json({ message: "Booking cannot be updated" });
      }
      res.json({
        ok: true,
        newStartTime: updated.start_time.toISOString(),
        newEndTime: updated.end_time.toISOString(),
        newTotalCents: updated.amount_cents,
      });
    } catch (error: any) {
      if (error?.code === "23P01") {
        return res.status(409).json({ message: "Time slot already booked" });
      }
      throw error;
    }
  } catch (error) {
    next(error);
  }
});

router.post("/confirm", requireAuth, bookingLimiter, async (req, res, next) => {
  try {
    const schema = z.object({
      paymentIntentId: z.string().trim().min(5).max(200),
      status: z.enum(["confirmed", "canceled"]).optional(),
    });
    const { paymentIntentId, status = "confirmed" } = schema.parse(req.body);
    let receiptUrl: string | null = null;
    if (status === "confirmed") {
      const bookingRow = await pool.query(
        `
        SELECT id, listing_id, start_time, end_time
        FROM bookings
        WHERE payment_intent_id = $1
        LIMIT 1
        `,
        [paymentIntentId]
      );
      const booking = bookingRow.rows[0] as
        | { id: string; listing_id: string; start_time: Date; end_time: Date }
        | undefined;
      if (!booking) return res.status(404).json({ message: "Booking not found" });
      const overlapCheck = await pool.query(
        `
        SELECT 1 FROM bookings
        WHERE listing_id = $1
          AND id <> $2
          AND (status IS NULL OR status <> 'canceled')
          AND tstzrange(start_time, end_time, '[)') && tstzrange($3::timestamptz, $4::timestamptz, '[)')
        LIMIT 1
        `,
        [booking.listing_id, booking.id, booking.start_time, booking.end_time]
      );
      if (overlapCheck.rowCount && overlapCheck.rowCount > 0) {
        await updateBookingStatusByPaymentIntent({
          paymentIntentId,
          status: "canceled",
        });
        return res.status(409).json({ message: "Time slot already booked" });
      }
    }
    if (status === "confirmed" && stripe) {
      const intent = await stripe.paymentIntents.retrieve(paymentIntentId, {
        expand: ["charges.data.balance_transaction"],
      });
      if (intent.status !== "succeeded") {
        return res.status(400).json({ message: `Payment not completed (${intent.status})` });
      }
      receiptUrl = intent.charges?.data?.[0]?.receipt_url ?? null;
    }
    const ok = await updateBookingStatusByPaymentIntent({ paymentIntentId, status, receiptUrl });
    if (!ok) return res.status(404).json({ message: "Booking not found" });
    const targets = await getBookingNotificationTargetsByPaymentIntent(paymentIntentId);
    if (targets) {
      await sendBookingStatusPush({
        bookingId: targets.booking_id,
        driverId: targets.driver_id,
        hostId: targets.host_id,
        listingTitle: targets.listing_title,
        startTime: new Date(targets.start_time),
        endTime: new Date(targets.end_time),
        status,
      });
      if (status === "confirmed") {
        await sendPaymentReceivedPush({
          bookingId: targets.booking_id,
          hostId: targets.host_id,
          listingTitle: targets.listing_title,
        });
        await scheduleBookingNotifications({
          bookingId: targets.booking_id,
          driverId: targets.driver_id,
          startTime: new Date(targets.start_time),
          endTime: new Date(targets.end_time),
        });
      } else {
        await deleteScheduledNotificationsByBooking(targets.booking_id);
      }
    }
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

router.post("/:id/cancel", requireAuth, bookingLimiter, async (req, res, next) => {
  try {
    const bookingId = z.string().uuid().parse(req.params.id);
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    const booking = await getBookingForRefund({ bookingId, driverId: userId });
    if (!booking) return res.status(404).json({ message: "Booking not found" });
    if (booking.status === "canceled") {
      return res.json({ ok: true, alreadyCanceled: true });
    }

    let refundId: string | null = null;
    if (booking.payment_intent_id && stripe && booking.status === "confirmed") {
      const refund = await stripe.refunds.create({
        payment_intent: booking.payment_intent_id,
      });
      refundId = refund.id;
    }

    const ok = refundId
      ? await cancelBookingWithRefund({ bookingId, driverId: userId, refundId })
      : await cancelBookingByDriver({ bookingId, driverId: userId });

    if (!ok) return res.status(400).json({ message: "Booking cannot be canceled" });
    const targets = await getBookingNotificationTargets(bookingId);
    if (targets) {
      await sendBookingStatusPush({
        bookingId: targets.booking_id,
        driverId: targets.driver_id,
        hostId: targets.host_id,
        listingTitle: targets.listing_title,
        startTime: new Date(targets.start_time),
        endTime: new Date(targets.end_time),
        status: "canceled",
      });
      await deleteScheduledNotificationsByBooking(targets.booking_id);
    }
    res.json({ ok: true, refunded: Boolean(refundId) });
  } catch (error) {
    next(error);
  }
});

router.post("/:id/check-in", requireAuth, bookingLimiter, async (req, res, next) => {
  try {
    const bookingId = z.string().uuid().parse(req.params.id);
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    const checkedInAt = await checkInBooking({ bookingId, driverId: userId });
    if (!checkedInAt) {
      return res.status(400).json({ message: "Check-in not available" });
    }
    res.json({ ok: true, checkedInAt });
  } catch (error) {
    next(error);
  }
});

router.post("/webhook", express.raw({ type: "application/json" }), async (req, res) => {
  const signature = req.headers["stripe-signature"];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!stripe || !webhookSecret) {
    console.warn("Stripe webhook skipped (missing secret or stripe client).");
    return res.json({ received: true, skipped: true });
  }

  if (!signature) {
    return res.status(400).json({ message: "Missing signature" });
  }

  try {
    const event = stripe.webhooks.constructEvent(req.body, signature, webhookSecret);

    if (event.type === "checkout.session.completed") {
      const session = event.data.object as any;
      const paymentIntentId = session.payment_intent as string;
      const bookingRow = await pool.query(
        `
        SELECT id, listing_id, start_time, end_time
        FROM bookings
        WHERE checkout_session_id = $1
        LIMIT 1
        `,
        [session.id]
      );
      const booking = bookingRow.rows[0] as
        | { id: string; listing_id: string; start_time: Date; end_time: Date }
        | undefined;
      if (booking) {
        const conflict = await hasBookingOverlap({
          listingId: booking.listing_id,
          bookingId: booking.id,
          startTime: booking.start_time,
          endTime: booking.end_time,
        });
        if (conflict) {
          const conflictPayload = {
            bookingId: booking.id,
            listingId: booking.listing_id,
            paymentIntentId,
            source: "checkout.session.completed",
          };
          console.warn("Booking conflict on checkout.session.completed", conflictPayload);
          await insertEventLog({
            eventType: "booking_conflict",
            payload: conflictPayload,
          });
          if (stripe && paymentIntentId) {
            const refund = await stripe.refunds.create({
              payment_intent: paymentIntentId,
            });
            await markBookingRefundedByPaymentIntent({
              paymentIntentId,
              refundId: refund.id,
            });
          }
          await updateBookingStatus({
            checkoutSessionId: session.id,
            status: "canceled",
            paymentIntentId,
          });
          const conflictTargets = await getBookingNotificationTargetsByCheckoutSession(session.id);
          if (conflictTargets) {
            await sendBookingStatusPush({
              bookingId: conflictTargets.booking_id,
              driverId: conflictTargets.driver_id,
              hostId: conflictTargets.host_id,
              listingTitle: conflictTargets.listing_title,
              startTime: new Date(conflictTargets.start_time),
              endTime: new Date(conflictTargets.end_time),
              status: "canceled",
            });
            await deleteScheduledNotificationsByBooking(conflictTargets.booking_id);
          }
          return res.json({ received: true, conflict: true });
        }
      }
      let receiptUrl: string | null = null;
      if (stripe && session.payment_intent) {
        const intent = await stripe.paymentIntents.retrieve(session.payment_intent as string, {
          expand: ["charges.data.balance_transaction"],
        });
        receiptUrl = intent.charges?.data?.[0]?.receipt_url ?? null;
      }
      await updateBookingStatus({
        checkoutSessionId: session.id,
        status: "confirmed",
        paymentIntentId: session.payment_intent as string,
        receiptUrl,
      });
      const targets = await getBookingNotificationTargetsByCheckoutSession(session.id);
      if (targets) {
        await sendBookingStatusPush({
          bookingId: targets.booking_id,
          driverId: targets.driver_id,
          hostId: targets.host_id,
          listingTitle: targets.listing_title,
          startTime: new Date(targets.start_time),
          endTime: new Date(targets.end_time),
          status: "confirmed",
        });
        await sendPaymentReceivedPush({
          bookingId: targets.booking_id,
          hostId: targets.host_id,
          listingTitle: targets.listing_title,
        });
        await scheduleBookingNotifications({
          bookingId: targets.booking_id,
          driverId: targets.driver_id,
          startTime: new Date(targets.start_time),
          endTime: new Date(targets.end_time),
        });
      }
    }

    if (event.type === "checkout.session.expired" || event.type === "checkout.session.async_payment_failed") {
      const session = event.data.object as any;
      await updateBookingStatus({
        checkoutSessionId: session.id,
        status: "canceled",
        paymentIntentId: session.payment_intent as string,
      });
      const targets = await getBookingNotificationTargetsByCheckoutSession(session.id);
      if (targets) {
        await sendBookingStatusPush({
          bookingId: targets.booking_id,
          driverId: targets.driver_id,
          hostId: targets.host_id,
          listingTitle: targets.listing_title,
          startTime: new Date(targets.start_time),
          endTime: new Date(targets.end_time),
          status: "canceled",
        });
        await deleteScheduledNotificationsByBooking(targets.booking_id);
      }
    }

    if (event.type === "payment_intent.succeeded") {
      const intent = event.data.object as any;
      const paymentIntentId = intent.id as string;
      const bookingRow = await pool.query(
        `
        SELECT id, listing_id, start_time, end_time
        FROM bookings
        WHERE payment_intent_id = $1
        LIMIT 1
        `,
        [paymentIntentId]
      );
      const booking = bookingRow.rows[0] as
        | { id: string; listing_id: string; start_time: Date; end_time: Date }
        | undefined;
      if (booking) {
        const conflict = await hasBookingOverlap({
          listingId: booking.listing_id,
          bookingId: booking.id,
          startTime: booking.start_time,
          endTime: booking.end_time,
        });
        if (conflict) {
          const conflictPayload = {
            bookingId: booking.id,
            listingId: booking.listing_id,
            paymentIntentId,
            source: "payment_intent.succeeded",
          };
          console.warn("Booking conflict on payment_intent.succeeded", conflictPayload);
          await insertEventLog({
            eventType: "booking_conflict",
            payload: conflictPayload,
          });
          if (stripe && paymentIntentId) {
            const refund = await stripe.refunds.create({
              payment_intent: paymentIntentId,
            });
            await markBookingRefundedByPaymentIntent({
              paymentIntentId,
              refundId: refund.id,
            });
          }
          await updateBookingStatusByPaymentIntent({
            paymentIntentId,
            status: "canceled",
          });
          const conflictTargets = await getBookingNotificationTargetsByPaymentIntent(paymentIntentId);
          if (conflictTargets) {
            await sendBookingStatusPush({
              bookingId: conflictTargets.booking_id,
              driverId: conflictTargets.driver_id,
              hostId: conflictTargets.host_id,
              listingTitle: conflictTargets.listing_title,
              startTime: new Date(conflictTargets.start_time),
              endTime: new Date(conflictTargets.end_time),
              status: "canceled",
            });
            await deleteScheduledNotificationsByBooking(conflictTargets.booking_id);
          }
          return res.json({ received: true, conflict: true });
        }
      }
      await updateBookingStatusByPaymentIntent({
        paymentIntentId,
        status: "confirmed",
        receiptUrl: intent.charges?.data?.[0]?.receipt_url ?? null,
      });
      const targets = await getBookingNotificationTargetsByPaymentIntent(paymentIntentId);
      if (targets) {
        await sendBookingStatusPush({
          bookingId: targets.booking_id,
          driverId: targets.driver_id,
          hostId: targets.host_id,
          listingTitle: targets.listing_title,
          startTime: new Date(targets.start_time),
          endTime: new Date(targets.end_time),
          status: "confirmed",
        });
        await sendPaymentReceivedPush({
          bookingId: targets.booking_id,
          hostId: targets.host_id,
          listingTitle: targets.listing_title,
        });
        await scheduleBookingNotifications({
          bookingId: targets.booking_id,
          driverId: targets.driver_id,
          startTime: new Date(targets.start_time),
          endTime: new Date(targets.end_time),
        });
      }
    }

    if (event.type === "payment_intent.payment_failed" || event.type === "payment_intent.canceled") {
      const intent = event.data.object as any;
      await updateBookingStatusByPaymentIntent({
        paymentIntentId: intent.id,
        status: "canceled",
      });
      const targets = await getBookingNotificationTargetsByPaymentIntent(intent.id);
      if (targets) {
        await sendBookingStatusPush({
          bookingId: targets.booking_id,
          driverId: targets.driver_id,
          hostId: targets.host_id,
          listingTitle: targets.listing_title,
          startTime: new Date(targets.start_time),
          endTime: new Date(targets.end_time),
          status: "canceled",
        });
        await deleteScheduledNotificationsByBooking(targets.booking_id);
      }
    }

    res.json({ received: true });
  } catch (err) {
    console.error("Stripe webhook error", err);
    return res.status(400).json({ message: "Invalid webhook" });
  }
});

router.get("/me", requireAuth, async (req, res, next) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    const bookings = await listUserBookings(userId);
    res.json(bookings);
  } catch (error) {
    next(error);
  }
});

export default router;

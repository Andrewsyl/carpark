import express, { Router } from "express";
import { z } from "zod";
import {
  createBooking,
  pool,
  updateBookingStatus,
  updateBookingStatusByPaymentIntent,
  listUserBookings,
  getListingWithHostAccount,
  findUserById,
  cancelBookingByDriver,
} from "../lib/db.js";
import { createCheckoutSession, stripe } from "../lib/stripe.js";
import { sendBookingEmail } from "../lib/email.js";
import { requireAuth } from "../middleware/auth.js";
import "../loadEnv.js";

const router = Router();

const bookingSchema = z.object({
  listingId: z.string(),
  from: z.string(),
  to: z.string(),
  amountCents: z.number().positive(),
  currency: z.string().default("eur"),
  platformFeePercent: z.number().min(0).max(1).default(0.1),
});

const paymentIntentSchema = bookingSchema.pick({
  listingId: true,
  from: true,
  to: true,
  amountCents: true,
  currency: true,
  platformFeePercent: true,
});

async function getOrCreateCustomer(email: string) {
  if (!stripe) throw new Error("Stripe not configured");
  const existing = await stripe.customers.list({ email, limit: 1 });
  if (existing.data.length > 0) return existing.data[0].id;
  const customer = await stripe.customers.create({ email });
  return customer.id;
}

router.post("/", requireAuth, async (req, res, next) => {
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
    });

    res.status(201).json({ checkoutUrl: session.url, sessionId: session.id });
  } catch (error) {
    next(error);
  }
});

router.post("/payment-intent", requireAuth, async (req, res, next) => {
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
    const customerId = await getOrCreateCustomer(user.email);
    const ephemeralKey = await stripe.ephemeralKeys.create(
      { customer: customerId },
      { apiVersion: "2024-06-20" }
    );

    const feeAmount = Math.round(payload.amountCents * payload.platformFeePercent);
    const intentParams: any = {
      amount: payload.amountCents,
      currency: payload.currency,
      customer: customerId,
      automatic_payment_methods: { enabled: true },
      metadata: {
        listing_id: payload.listingId,
        driver_id: driverId,
      },
    };

    if (listingWithHost?.hostStripeAccountId) {
      intentParams.application_fee_amount = feeAmount;
      intentParams.transfer_data = {
        destination: listingWithHost.hostStripeAccountId,
      };
    }

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
    });

    res.json({
      paymentIntentClientSecret: intent.client_secret,
      paymentIntentId: intent.id,
      customerId,
      ephemeralKeySecret: ephemeralKey.secret,
    });
  } catch (error) {
    next(error);
  }
});

router.post("/confirm", requireAuth, async (req, res, next) => {
  try {
    const schema = z.object({ paymentIntentId: z.string(), status: z.enum(["confirmed", "canceled"]).optional() });
    const { paymentIntentId, status = "confirmed" } = schema.parse(req.body);
    const ok = await updateBookingStatusByPaymentIntent({ paymentIntentId, status });
    if (!ok) return res.status(404).json({ message: "Booking not found" });
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

router.post("/:id/cancel", requireAuth, async (req, res, next) => {
  try {
    const bookingId = req.params.id;
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    const ok = await cancelBookingByDriver({ bookingId, driverId: userId });
    if (!ok) return res.status(400).json({ message: "Booking cannot be canceled" });
    res.json({ ok: true });
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
      await updateBookingStatus({
        checkoutSessionId: session.id,
        status: "confirmed",
        paymentIntentId: session.payment_intent as string,
      });
    }

    if (event.type === "checkout.session.expired" || event.type === "checkout.session.async_payment_failed") {
      const session = event.data.object as any;
      await updateBookingStatus({
        checkoutSessionId: session.id,
        status: "canceled",
        paymentIntentId: session.payment_intent as string,
      });
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

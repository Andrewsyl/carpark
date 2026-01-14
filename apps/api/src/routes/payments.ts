import express from "express";
import { z } from "zod";
import Stripe from "stripe";
import { requireAuth } from "../middleware/auth.js";
import { findUserById, findUserByEmail } from "../lib/db.js";

const router = express.Router();

const stripeSecret = process.env.STRIPE_SECRET_KEY;
const stripe = stripeSecret ? new Stripe(stripeSecret) : null;

if (!stripeSecret) {
  console.warn("Stripe secret key not set; payments endpoints will return 500.");
}

async function getOrCreateCustomer(email: string) {
  if (!stripe) throw new Error("Stripe not configured");
  const existing = await stripe.customers.list({ email, limit: 1 });
  if (existing.data.length > 0) return existing.data[0].id;
  const customer = await stripe.customers.create({ email });
  return customer.id;
}

router.post("/payment-methods", requireAuth, async (req, res, next) => {
  try {
    if (!stripe) return res.status(500).json({ message: "Stripe not configured" });
    console.log("POST /api/payment-methods user:", req.user);
    const userFromId = await findUserById(req.user!.id);
    const user = userFromId ?? (req.user?.email ? await findUserByEmail(req.user.email) : undefined);
    if (!user) return res.status(401).json({ message: "Unauthorized" });
    const customerId = await getOrCreateCustomer(user.email);
    const intent = await stripe.setupIntents.create({
      customer: customerId,
      payment_method_types: ["card"],
    });
    res.json({ clientSecret: intent.client_secret });
  } catch (err) {
    next(err);
  }
});

router.get("/payment-methods", requireAuth, async (req, res, next) => {
  try {
    if (!stripe) return res.status(500).json({ message: "Stripe not configured" });
    const userFromId = await findUserById(req.user!.id);
    const user = userFromId ?? (req.user?.email ? await findUserByEmail(req.user.email) : undefined);
    if (!user) return res.status(401).json({ message: "Unauthorized" });
    const customerId = await getOrCreateCustomer(user.email);
    const [methods, customer] = await Promise.all([
      stripe.paymentMethods.list({ customer: customerId, type: "card" }),
      stripe.customers.retrieve(customerId),
    ]);
    const defaultPm = (customer as Stripe.Customer).invoice_settings?.default_payment_method;
    res.json({
      paymentMethods: methods.data.map((pm) => ({
        id: pm.id,
        brand: pm.card?.brand ?? "",
        last4: pm.card?.last4 ?? "",
        exp_month: pm.card?.exp_month ?? 0,
        exp_year: pm.card?.exp_year ?? 0,
        is_default: pm.id === defaultPm,
        created_at: pm.created ? new Date(pm.created * 1000).toISOString() : undefined,
      })),
    });
  } catch (err) {
    next(err);
  }
});

router.put("/payment-methods/:id", requireAuth, async (req, res, next) => {
  try {
    if (!stripe) return res.status(500).json({ message: "Stripe not configured" });
    const userFromId = await findUserById(req.user!.id);
    const user = userFromId ?? (req.user?.email ? await findUserByEmail(req.user.email) : undefined);
    if (!user) return res.status(401).json({ message: "Unauthorized" });
    const customerId = await getOrCreateCustomer(user.email);
    const pmId = z.string().trim().min(5).max(200).parse(req.params.id);
    await stripe.paymentMethods.attach(pmId, { customer: customerId });
    await stripe.customers.update(customerId, {
      invoice_settings: { default_payment_method: pmId },
    });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

router.delete("/payment-methods/:id", requireAuth, async (req, res, next) => {
  try {
    if (!stripe) return res.status(500).json({ message: "Stripe not configured" });
    const pmId = z.string().trim().min(5).max(200).parse(req.params.id);
    await stripe.paymentMethods.detach(pmId);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

router.get("/payments/history", requireAuth, async (req, res, next) => {
  try {
    if (!stripe) return res.status(500).json({ message: "Stripe not configured" });
    const userFromId = await findUserById(req.user!.id);
    const user = userFromId ?? (req.user?.email ? await findUserByEmail(req.user.email) : undefined);
    if (!user) return res.status(401).json({ message: "Unauthorized" });
    const customerId = await getOrCreateCustomer(user.email);
    const paymentIntents = await stripe.paymentIntents.list({
      customer: customerId,
      limit: 20,
    });
    const payments = paymentIntents.data.map((pi) => {
      const charge = Array.isArray(pi.charges?.data) ? pi.charges.data[0] : undefined;
      return {
        id: pi.id,
        booking_id: pi.metadata?.booking_id ?? undefined,
        amount: pi.amount_received || pi.amount,
        currency: pi.currency,
        status: pi.status,
        description: pi.description ?? charge?.description ?? "Payment",
        created_at: new Date(pi.created * 1000).toISOString(),
        receipt_url: charge?.receipt_url,
      };
    });
    res.json({ payments });
  } catch (err) {
    next(err);
  }
});

router.post("/payments/:id/retry", requireAuth, async (req, res, next) => {
  try {
    if (!stripe) return res.status(500).json({ message: "Stripe not configured" });
    const paymentIntentId = z.string().trim().min(5).max(200).parse(req.params.id);
    await stripe.paymentIntents.confirm(paymentIntentId);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

export default router;

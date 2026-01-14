import "../loadEnv.js";
import Stripe from "stripe";

const secret = process.env.STRIPE_SECRET_KEY;

if (!secret || secret === "sk_test_placeholder" || secret === "sk_test_replace") {
  console.warn("STRIPE_SECRET_KEY not set; using mock Stripe responses for local development.");
}

export const stripe = secret ? new Stripe(secret, { apiVersion: "2024-06-20" }) : null;

export type PaymentInput = {
  amount: number;
  currency: string;
  listingId: string;
  hostStripeAccountId?: string | null;
  platformFeePercent: number;
  successUrl: string;
  cancelUrl: string;
};

export async function createCheckoutSession(input: PaymentInput) {
  const { amount, currency, listingId, hostStripeAccountId, platformFeePercent, successUrl, cancelUrl } = input;
  const feeAmount = Math.round(amount * platformFeePercent);

  const mockResponse = () => {
    const fakeId = `cs_test_mock_${Date.now()}`;
    return {
      id: fakeId,
      url: successUrl.replace("{CHECKOUT_SESSION_ID}", fakeId),
      payment_intent: `pi_test_mock_${Date.now()}`,
    } as any;
  };

  if (!stripe) {
    return mockResponse();
  }

  try {
    const base: Stripe.Checkout.SessionCreateParams = {
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency,
            product_data: {
              name: `Parking booking ${listingId}`,
            },
            unit_amount: amount,
          },
          quantity: 1,
        },
      ],
      metadata: {
        listing_id: listingId,
        platform_fee_cents: String(feeAmount),
        host_account_id: hostStripeAccountId ?? "",
      },
      success_url: successUrl,
      cancel_url: cancelUrl,
    };

    return await stripe.checkout.sessions.create(base);
  } catch (err: any) {
    if (err?.statusCode === 401 || err?.code === "authentication_required" || err?.type === "StripeAuthenticationError") {
      console.warn("Stripe auth failed; returning mock checkout session. Set a valid STRIPE_SECRET_KEY to enable live calls.");
      return mockResponse();
    }
    throw err;
  }
}

import Stripe from "stripe";
import { env } from "../../config/env";

// In test/dev mode without a real Stripe secret key we fall back to a stub so
// the whole payment flow (create intent -> pay -> release -> payout) remains
// runnable end-to-end without external credentials.
export const isStripeConfigured = env.stripeSecretKey.startsWith("sk_test_") && env.stripeSecretKey !== "sk_test_placeholder";

export const stripe = isStripeConfigured
  ? new Stripe(env.stripeSecretKey, { apiVersion: "2024-06-20" })
  : null;

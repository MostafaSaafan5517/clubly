import "server-only";
import Stripe from "stripe";

const secretKey = process.env.STRIPE_SECRET_KEY;

if (!secretKey) {
  throw new Error(
    "Missing STRIPE_SECRET_KEY. Add your Stripe test-mode secret key to .env.local (see .env.example).",
  );
}
// This project only ever runs in Stripe test mode. Refusing live keys outright means a
// misconfigured environment can't move real money.
if (!secretKey.startsWith("sk_test_")) {
  throw new Error("STRIPE_SECRET_KEY must be a test-mode key (sk_test_...).");
}

export const stripe = new Stripe(secretKey);

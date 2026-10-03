import type { JwtPayload } from "@supabase/supabase-js";

/** What a demo account is told when it tries to change something. */
export const DEMO_READ_ONLY_MESSAGE =
  "Demo accounts can look around but not change anything. Sign out and create your own account to try it.";

/**
 * The live demo's shared accounts (the README publishes their password) are marked with
 * `demo: true` in their app metadata, which only the server can set (`pnpm seed:demo`). Actions
 * check it first so the user gets a plain answer, and some changes happen only in Stripe
 * (Checkout, onboarding), out of the database's reach. For everything stored, the database
 * refuses demo accounts' writes itself (`private.reject_demo_writes`).
 */
export function isDemoAccount(claims: JwtPayload) {
  return claims.app_metadata?.demo === true;
}

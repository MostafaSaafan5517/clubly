import "server-only";
import { stripe } from "@/lib/stripe/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

async function storedAccountId(businessId: string) {
  const { data, error } = await supabaseAdmin
    .from("businesses")
    .select("stripe_account_id")
    .eq("id", businessId)
    .single();
  if (error) throw new Error(`Could not read the business: ${error.message}`);
  return data.stripe_account_id;
}

/**
 * The business's connected Stripe account, created on first use. Callers must have checked
 * that the signed-in user owns the business: this runs with the service role.
 */
export async function getOrCreateConnectedAccount(businessId: string) {
  const existing = await storedAccountId(businessId);
  if (existing) return existing;

  const account = await stripe.accounts.create(
    {
      country: "US",
      // What "Express" means: Stripe hosts onboarding and a light dashboard, and the platform
      // pays Stripe's fees and covers negative balances. (`type: "express"` is the deprecated
      // way to ask for the same thing.)
      controller: {
        stripe_dashboard: { type: "express" },
        fees: { payer: "application" },
        losses: { payments: "application" },
        requirement_collection: "stripe",
      },
      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true },
      },
      metadata: { business_id: businessId },
    },
    // A double-click or a retry gets the same account back instead of creating a second one.
    { idempotencyKey: `connected-account-${businessId}` },
  );

  // Only fill an empty slot, so a racing request can never replace a stored account.
  const { error } = await supabaseAdmin
    .from("businesses")
    .update({ stripe_account_id: account.id })
    .eq("id", businessId)
    .is("stripe_account_id", null);
  if (error) {
    throw new Error(`Could not save the Stripe account: ${error.message}`);
  }

  const stored = await storedAccountId(businessId);
  if (!stored) throw new Error("The Stripe account was not saved.");
  return stored;
}

/** A single-use link to Stripe's hosted onboarding for this account. */
export async function createOnboardingUrl(
  accountId: string,
  slug: string,
  origin: string,
) {
  const link = await stripe.accountLinks.create({
    account: accountId,
    type: "account_onboarding",
    // Links expire after a few minutes; Stripe sends the user here to get a fresh one.
    refresh_url: `${origin}/dashboard/b/${slug}/stripe/refresh`,
    // Coming back doesn't mean onboarding is finished: only Stripe's account.updated event
    // decides when the business can take payments.
    return_url: `${origin}/dashboard/b/${slug}?stripe=returned`,
  });
  return link.url;
}

import "server-only";
import { appConfig } from "@/config/app";
import { stripe } from "@/lib/stripe/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

/** The member's Stripe customer id, or null before their first checkout (service role). */
export async function storedCustomerId(memberId: string) {
  const { data, error } = await supabaseAdmin
    .from("members")
    .select("stripe_customer_id")
    .eq("id", memberId)
    .single();
  if (error) throw new Error(`Could not read the member: ${error.message}`);
  return data.stripe_customer_id;
}

/**
 * The member's Stripe customer on the business's own Stripe account, created on first use.
 * Callers must have checked the membership belongs to the signed-in user (service role).
 */
export async function getOrCreateCustomer(
  member: { id: string; email: string; name: string | null },
  accountId: string,
) {
  const existing = await storedCustomerId(member.id);
  if (existing) return existing;

  const customer = await stripe.customers.create(
    {
      email: member.email,
      name: member.name ?? undefined,
      metadata: { member_id: member.id },
    },
    { stripeAccount: accountId, idempotencyKey: `customer-${member.id}` },
  );

  // Only fill an empty slot, so a racing request can never replace a stored customer.
  const { error } = await supabaseAdmin
    .from("members")
    .update({ stripe_customer_id: customer.id })
    .eq("id", member.id)
    .is("stripe_customer_id", null);
  if (error) {
    throw new Error(`Could not save the Stripe customer: ${error.message}`);
  }

  const stored = await storedCustomerId(member.id);
  if (!stored) throw new Error("The Stripe customer was not saved.");
  return stored;
}

/** The plan's Stripe price id (server-only). */
export async function planPriceId(planId: string) {
  const { data, error } = await supabaseAdmin
    .from("plans")
    .select("stripe_price_id")
    .eq("id", planId)
    .single();
  if (error) throw new Error(`Could not read the plan: ${error.message}`);
  if (!data.stripe_price_id) throw new Error("The plan has no Stripe price.");
  return data.stripe_price_id;
}

/**
 * A Stripe Checkout page for subscribing to the plan, on the business's own Stripe account
 * (a direct charge), with the platform's fee. Paying here does not activate anything by itself:
 * the subscription only appears in our database when Stripe's webhooks say so.
 */
export async function createSubscriptionCheckout(options: {
  accountId: string;
  customerId: string;
  priceId: string;
  businessId: string;
  memberId: string;
  planId: string;
  successUrl: string;
  cancelUrl: string;
}) {
  // Lets the webhooks link Stripe's subscription back to our member and plan.
  const metadata = {
    business_id: options.businessId,
    member_id: options.memberId,
    plan_id: options.planId,
  };
  const session = await stripe.checkout.sessions.create(
    {
      mode: "subscription",
      customer: options.customerId,
      line_items: [{ price: options.priceId, quantity: 1 }],
      subscription_data: {
        application_fee_percent: appConfig.applicationFeePercent,
        metadata,
      },
      metadata,
      client_reference_id: options.memberId,
      success_url: options.successUrl,
      cancel_url: options.cancelUrl,
    },
    { stripeAccount: options.accountId },
  );
  if (!session.url) {
    throw new Error("Stripe returned a Checkout session without a URL.");
  }
  return session.url;
}

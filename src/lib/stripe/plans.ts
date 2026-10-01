import "server-only";
import { stripe } from "@/lib/stripe/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { Database } from "@/lib/supabase/database.types";

type NewPlan = {
  id: string;
  name: string;
  amount: number;
  currency: string;
  billingInterval: Database["public"]["Enums"]["billing_interval"];
};

/**
 * Creates the plan's Stripe product and recurring price on the business's own Stripe account
 * (members are charged directly on that account), then stores the price id. Runs with the
 * service role: callers must have created the plan through RLS first.
 */
export async function createPlanPrice(plan: NewPlan, accountId: string) {
  const price = await stripe.prices.create(
    {
      currency: plan.currency,
      unit_amount: plan.amount,
      recurring: { interval: plan.billingInterval },
      product_data: { name: plan.name, metadata: { plan_id: plan.id } },
      metadata: { plan_id: plan.id },
    },
    // A retry for the same plan returns the same price instead of creating another.
    { stripeAccount: accountId, idempotencyKey: `plan-price-${plan.id}` },
  );

  const { error } = await supabaseAdmin
    .from("plans")
    .update({ stripe_price_id: price.id })
    .eq("id", plan.id)
    .is("stripe_price_id", null);
  if (error) {
    throw new Error(`Could not save the Stripe price: ${error.message}`);
  }
}

/**
 * Makes the plan's Stripe product match whether the plan can be sold. Callers must have changed
 * the plan through RLS first. Plans that never got a price have nothing in Stripe.
 *
 * Only the product is archived: the price is its product's default price, which Stripe refuses
 * to archive, and a price on an archived product can't start new subscriptions anyway.
 */
export async function setPlanProductActive(
  planId: string,
  accountId: string,
  active: boolean,
) {
  const { data, error } = await supabaseAdmin
    .from("plans")
    .select("stripe_price_id")
    .eq("id", planId)
    .single();
  if (error) throw new Error(`Could not read the plan: ${error.message}`);
  if (!data.stripe_price_id) return;

  const options = { stripeAccount: accountId };
  const price = await stripe.prices.retrieve(data.stripe_price_id, {}, options);
  const productId =
    typeof price.product === "string" ? price.product : price.product.id;
  await stripe.products.update(productId, { active }, options);
}

/**
 * Removes a plan whose Stripe price couldn't be created, so a half-made plan doesn't linger.
 * Safe because such a plan can't have subscriptions yet.
 */
export async function discardUnpricedPlan(planId: string) {
  const { error } = await supabaseAdmin
    .from("plans")
    .delete()
    .eq("id", planId)
    .is("stripe_price_id", null);
  if (error) {
    throw new Error(`Could not remove the unfinished plan: ${error.message}`);
  }
}

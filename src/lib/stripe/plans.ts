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

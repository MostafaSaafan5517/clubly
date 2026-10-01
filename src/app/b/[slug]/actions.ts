"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { ActionState } from "@/components/action-button";
import {
  createSubscriptionCheckout,
  getOrCreateCustomer,
  planPriceId,
} from "@/lib/stripe/checkout";
import { storedAccountId } from "@/lib/stripe/connect";
import { createServerActionClient } from "@/lib/supabase/server";

// Subscription statuses that already count as being a member.
const LIVE_STATUSES = ["active", "trialing", "past_due"] as const;
const UNIQUE_VIOLATION = "23505";

/** Joins a business on a plan: creates the membership if needed, then opens Stripe Checkout. */
export async function joinPlan(
  slug: string,
  planId: string,
): Promise<ActionState> {
  const supabase = await createServerActionClient();
  const { data } = await supabase.auth.getClaims();
  if (!data) redirect(`/login?next=${encodeURIComponent(`/b/${slug}`)}`);
  const userId = data.claims.sub;

  // The business and plan exactly as the public page shows them; both may have changed since
  // the page was loaded, and the ids came from the browser.
  const { data: business, error: businessError } = await supabase
    .from("businesses")
    .select("id, name")
    .eq("slug", slug)
    .eq("charges_enabled", true)
    .maybeSingle();
  if (businessError) throw new Error(businessError.message);
  if (!business) {
    return { error: "This business isn't taking new members right now." };
  }
  const { data: plan, error: planError } = await supabase
    .from("plans")
    .select("id")
    .eq("id", planId)
    .eq("business_id", business.id)
    .eq("active", true)
    .eq("has_stripe_price", true)
    .maybeSingle();
  if (planError) throw new Error(planError.message);
  if (!plan) return { error: "That plan isn't available anymore." };

  // The user's membership at this business, created on their first join (through RLS, which
  // only lets people join for themselves).
  const findMember = () =>
    supabase
      .from("members")
      .select("id, status")
      .eq("business_id", business.id)
      .eq("user_id", userId)
      .maybeSingle();
  let { data: member, error: memberError } = await findMember();
  if (memberError) throw new Error(memberError.message);
  if (!member) {
    const { error: insertError } = await supabase
      .from("members")
      .insert({ business_id: business.id, user_id: userId });
    // A double-click may have created it already; either way, read it back.
    if (insertError && insertError.code !== UNIQUE_VIOLATION) {
      throw new Error(insertError.message);
    }
    ({ data: member, error: memberError } = await findMember());
    if (memberError) throw new Error(memberError.message);
    if (!member) throw new Error("The membership was not created.");
  }
  if (member.status === "suspended") {
    return {
      error: `Your membership at ${business.name} is suspended. Please contact them.`,
    };
  }

  // One live subscription per membership.
  const { data: live, error: liveError } = await supabase
    .from("subscriptions")
    .select("id")
    .eq("member_id", member.id)
    .in("status", LIVE_STATUSES)
    .limit(1);
  if (liveError) throw new Error(liveError.message);
  if (live.length > 0) {
    return { error: `You already have a membership at ${business.name}.` };
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("email, full_name")
    .eq("id", userId)
    .single();
  if (profileError) throw new Error(profileError.message);

  // Next.js has already checked that this Server Action call comes from our own origin.
  const origin = (await headers()).get("origin");
  if (!origin) {
    throw new Error("Server Action request without an Origin header.");
  }

  let checkoutUrl: string;
  try {
    const accountId = await storedAccountId(business.id);
    if (!accountId) throw new Error("The business has no Stripe account.");
    const customerId = await getOrCreateCustomer(
      { id: member.id, email: profile.email, name: profile.full_name },
      accountId,
    );
    checkoutUrl = await createSubscriptionCheckout({
      accountId,
      customerId,
      priceId: await planPriceId(plan.id),
      businessId: business.id,
      memberId: member.id,
      planId: plan.id,
      successUrl: `${origin}/b/${slug}?checkout=success`,
      cancelUrl: `${origin}/b/${slug}?checkout=canceled`,
    });
  } catch (error) {
    console.error("Starting checkout failed", {
      memberId: member.id,
      planId: plan.id,
      message: error instanceof Error ? error.message : String(error),
    });
    return { error: "We couldn't start checkout. Please try again." };
  }

  redirect(checkoutUrl);
}

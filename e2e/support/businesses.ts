import { createClient } from "@supabase/supabase-js";
import { slugify } from "@/lib/slug";
import { adminClient, supabaseSettings } from "./supabase";

export function uniqueBusinessName(base: string) {
  return `${base} ${crypto.randomUUID().slice(0, 8)}`;
}

/**
 * Creates a business owned by `owner` through the same database function the app uses, signed
 * in as that owner (so RLS and the function's own checks apply).
 */
export async function createBusinessFor(
  owner: { email: string; password: string },
  name: string,
) {
  const { url, publishableKey } = supabaseSettings();
  const client = createClient(url, publishableKey, {
    auth: { persistSession: false },
  });
  const { error: signInError } = await client.auth.signInWithPassword(owner);
  if (signInError) throw signInError;

  const slug = slugify(name);
  const { data: id, error } = await client.rpc("create_business", {
    business_name: name,
    business_slug: slug,
  });
  if (error) throw error;
  return { id: id as string, name, slug };
}

/** Marks a business as able to take payments, which is what the Stripe webhook will do. */
export async function enableCharges(businessId: string) {
  const { error } = await adminClient()
    .from("businesses")
    .update({ charges_enabled: true })
    .eq("id", businessId);
  if (error) throw error;
}

/**
 * Adds a plan straight to the database, for tests that only need it listed. A fake Stripe price
 * id makes it look ready to sell; without one it's an unfinished plan.
 */
export async function addPlan(
  businessId: string,
  name: string,
  options: {
    amount?: number;
    billingInterval?: "month" | "year";
    active?: boolean;
    stripePriceId?: string;
  } = {},
) {
  const { data, error } = await adminClient()
    .from("plans")
    .insert({
      business_id: businessId,
      name,
      billing_interval: options.billingInterval ?? "month",
      amount: options.amount ?? 2000,
      active: options.active ?? true,
      stripe_price_id: options.stripePriceId ?? null,
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}

/** Adds an existing user to a business's staff (what an owner or admin can do). */
export async function addStaff(
  businessId: string,
  email: string,
  role: "admin" | "staff",
) {
  const admin = adminClient();
  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("id")
    .eq("email", email)
    .single();
  if (profileError) throw profileError;
  const { error } = await admin
    .from("business_staff")
    .insert({ business_id: businessId, user_id: profile.id, role });
  if (error) throw error;
}

/** The user's membership at a business (service role), or null if they haven't joined. */
export async function findMembership(businessId: string, email: string) {
  const admin = adminClient();
  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("id")
    .eq("email", email)
    .single();
  if (profileError) throw profileError;
  const { data, error } = await admin
    .from("members")
    .select("id, status, stripe_customer_id")
    .eq("business_id", businessId)
    .eq("user_id", profile.id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

/** Suspends (or creates as suspended) a user's membership, as an owner or admin could. */
export async function suspendMembership(businessId: string, email: string) {
  const admin = adminClient();
  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("id")
    .eq("email", email)
    .single();
  if (profileError) throw profileError;
  const { error } = await admin
    .from("members")
    .upsert(
      { business_id: businessId, user_id: profile.id, status: "suspended" },
      { onConflict: "business_id,user_id" },
    );
  if (error) throw error;
}

/** Makes the user a member of the business, as joining does (service role). Returns its id. */
export async function addMember(
  businessId: string,
  email: string,
  options: { stripeCustomerId?: string } = {},
) {
  const admin = adminClient();
  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("id")
    .eq("email", email)
    .single();
  if (profileError) throw profileError;
  const { data, error } = await admin
    .from("members")
    .insert({
      business_id: businessId,
      user_id: profile.id,
      stripe_customer_id: options.stripeCustomerId ?? null,
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}

/** Records a subscription the way Stripe's webhook does (service role). */
export async function addSubscription(
  businessId: string,
  memberId: string,
  planId: string,
  subscription: {
    status: "active" | "trialing" | "past_due" | "canceled";
    currentPeriodEnd?: string;
    cancelAt?: string;
  },
) {
  const { error } = await adminClient()
    .from("subscriptions")
    .insert({
      business_id: businessId,
      member_id: memberId,
      plan_id: planId,
      stripe_subscription_id: `sub_test_${crypto.randomUUID()}`,
      status: subscription.status,
      current_period_end: subscription.currentPeriodEnd ?? null,
      cancel_at: subscription.cancelAt ?? null,
    });
  if (error) throw error;
}

import { adminClient } from "./supabase";

// Talks to the Stripe sandbox directly (plain REST, like the Stripe CLI) to set up and check
// what tests need. The app itself only ever uses the server-only Stripe SDK client.

async function stripeRequest<T>(
  method: "GET" | "POST" | "DELETE",
  path: string,
  options: { body?: URLSearchParams; account?: string } = {},
): Promise<T> {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey?.startsWith("sk_test_")) {
    throw new Error("STRIPE_SECRET_KEY must be a test-mode key.");
  }
  const headers: Record<string, string> = {
    Authorization: `Bearer ${secretKey}`,
  };
  if (options.account) headers["Stripe-Account"] = options.account;
  const response = await fetch(`https://api.stripe.com${path}`, {
    method,
    headers,
    body: options.body,
  });
  if (!response.ok) {
    throw new Error(`Stripe ${method} ${path} failed: ${response.status}`);
  }
  return (await response.json()) as T;
}

/** The Stripe account id stored for a business (read with the service role, like the app). */
export async function getStripeAccountId(businessId: string) {
  const { data, error } = await adminClient()
    .from("businesses")
    .select("stripe_account_id")
    .eq("id", businessId)
    .single();
  if (error) throw error;
  return data.stripe_account_id;
}

/**
 * Gives a business a connected account the same way the app does, without going through
 * Stripe's hosted onboarding in the browser.
 */
export async function connectStripeAccount(businessId: string) {
  const account = await stripeRequest<{ id: string }>("POST", "/v1/accounts", {
    body: new URLSearchParams({
      country: "US",
      "controller[stripe_dashboard][type]": "express",
      "controller[fees][payer]": "application",
      "controller[losses][payments]": "application",
      "controller[requirement_collection]": "stripe",
      "capabilities[card_payments][requested]": "true",
      "capabilities[transfers][requested]": "true",
      "metadata[business_id]": businessId,
    }),
  });
  const { error } = await adminClient()
    .from("businesses")
    .update({ stripe_account_id: account.id })
    .eq("id", businessId);
  if (error) throw error;
  return account.id;
}

/** Removes a connected account (and everything on it) that a test created. */
export async function deleteStripeAccount(accountId: string) {
  await stripeRequest("DELETE", `/v1/accounts/${accountId}`);
}

export type StripePrice = {
  id: string;
  unit_amount: number;
  currency: string;
  active: boolean;
  recurring: { interval: string };
  metadata: Record<string, string>;
  product: { name: string; active: boolean };
};

/** A plan's Stripe price as Stripe has it on the business's account. */
export async function getPlanStripePrice(planId: string, accountId: string) {
  const { data, error } = await adminClient()
    .from("plans")
    .select("stripe_price_id")
    .eq("id", planId)
    .single();
  if (error) throw error;
  if (!data.stripe_price_id)
    throw new Error(`Plan ${planId} has no Stripe price`);
  return stripeRequest<StripePrice>(
    "GET",
    `/v1/prices/${data.stripe_price_id}?expand[]=product`,
    { account: accountId },
  );
}

/** The id of the business's plan with this name. */
export async function getPlanId(businessId: string, name: string) {
  const { data, error } = await adminClient()
    .from("plans")
    .select("id")
    .eq("business_id", businessId)
    .eq("name", name)
    .single();
  if (error) throw error;
  return data.id as string;
}

import { createClient } from "@supabase/supabase-js";

/** The Stripe account id stored for a business (read with the service role, like the app). */
export async function getStripeAccountId(businessId: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  if (!url || !secretKey) {
    throw new Error("Missing Supabase settings: run `pnpm env:local` first.");
  }
  const admin = createClient(url, secretKey, {
    auth: { persistSession: false },
  });
  const { data, error } = await admin
    .from("businesses")
    .select("stripe_account_id")
    .eq("id", businessId)
    .single();
  if (error) throw error;
  return data.stripe_account_id;
}

/** Removes a connected account a test created in the Stripe sandbox. */
export async function deleteStripeAccount(accountId: string) {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey?.startsWith("sk_test_")) {
    throw new Error("STRIPE_SECRET_KEY must be a test-mode key.");
  }
  const response = await fetch(
    `https://api.stripe.com/v1/accounts/${accountId}`,
    { method: "DELETE", headers: { Authorization: `Bearer ${secretKey}` } },
  );
  if (!response.ok) {
    throw new Error(`Deleting ${accountId} failed: ${response.status}`);
  }
}

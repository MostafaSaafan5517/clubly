import { createClient } from "@supabase/supabase-js";
import { slugify } from "@/lib/slug";

function supabaseSettings() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  if (!url || !publishableKey || !secretKey) {
    throw new Error("Missing Supabase settings: run `pnpm env:local` first.");
  }
  return { url, publishableKey, secretKey };
}

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

function adminClient() {
  const { url, secretKey } = supabaseSettings();
  return createClient(url, secretKey, { auth: { persistSession: false } });
}

/** Marks a business as able to take payments, which is what the Stripe webhook will do. */
export async function enableCharges(businessId: string) {
  const { error } = await adminClient()
    .from("businesses")
    .update({ charges_enabled: true })
    .eq("id", businessId);
  if (error) throw error;
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

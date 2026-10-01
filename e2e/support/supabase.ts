import { createClient } from "@supabase/supabase-js";

export function supabaseSettings() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  if (!url || !publishableKey || !secretKey) {
    throw new Error("Missing Supabase settings: run `pnpm env:local` first.");
  }
  return { url, publishableKey, secretKey };
}

/** Service-role client for test setup and checks, like the app's server-only admin client. */
export function adminClient() {
  const { url, secretKey } = supabaseSettings();
  return createClient(url, secretKey, { auth: { persistSession: false } });
}

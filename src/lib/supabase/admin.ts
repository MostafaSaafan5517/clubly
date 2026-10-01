import "server-only";
import { createClient } from "@supabase/supabase-js";
import { supabaseConfig } from "@/lib/supabase/config";
import type { Database } from "@/lib/supabase/database.types";

const secretKey = process.env.SUPABASE_SECRET_KEY;
if (!secretKey) {
  throw new Error(
    "Missing SUPABASE_SECRET_KEY. Run `pnpm env:local`, or fill .env.local from .env.example.",
  );
}

/**
 * Bypasses RLS. Only for server code that has already checked who is asking (or that answers
 * to Stripe, like webhooks), and only for what API roles are never allowed to touch: the Stripe
 * identifiers on businesses, plans and members.
 */
export const supabaseAdmin = createClient<Database>(
  supabaseConfig.url,
  secretKey,
  { auth: { persistSession: false, autoRefreshToken: false } },
);

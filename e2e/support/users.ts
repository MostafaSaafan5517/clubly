import { createClient } from "@supabase/supabase-js";

export const TEST_PASSWORD = "correct-horse-1";

export function uniqueEmail(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}@example.com`;
}

/**
 * Creates a user whose email is already confirmed, through the Supabase admin API. Faster than
 * the sign-up flow for tests that are about something else; the sign-up flow has its own test.
 */
export async function createConfirmedUser(fullName = "Test User") {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  if (!url || !secretKey) {
    throw new Error("Missing Supabase settings: run `pnpm env:local` first.");
  }

  const admin = createClient(url, secretKey, {
    auth: { persistSession: false },
  });
  const email = uniqueEmail("user");
  const { error } = await admin.auth.admin.createUser({
    email,
    password: TEST_PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });
  if (error) throw error;

  return { email, password: TEST_PASSWORD, fullName };
}

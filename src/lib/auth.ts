import { redirect } from "next/navigation";
import { createServerComponentClient } from "@/lib/supabase/server";

/**
 * For pages that need a signed-in user. Returns a Supabase client acting as that user, and
 * their id; visitors are sent to sign in and brought back to `currentPath` afterwards.
 */
export async function requireUser(currentPath: string) {
  const supabase = await createServerComponentClient();
  const { data } = await supabase.auth.getClaims();
  if (!data) redirect(`/login?next=${encodeURIComponent(currentPath)}`);
  return { supabase, userId: data.claims.sub };
}

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

/**
 * The business with this slug and the user's role there, or null when they aren't staff.
 * Reads through RLS as the user. Checking the staff row (not just reading the business) matters:
 * once a business takes payments, every signed-in user may read its public details.
 */
export async function getStaffBusiness(
  supabase: SupabaseClient<Database>,
  userId: string,
  slug: string,
) {
  const { data, error } = await supabase
    .from("business_staff")
    .select(
      "role, businesses!inner(id, name, slug, charges_enabled, has_stripe_account)",
    )
    .eq("user_id", userId)
    .eq("businesses.slug", slug)
    .maybeSingle();
  if (error) throw new Error(`Could not load the business: ${error.message}`);
  if (!data) return null;
  return { role: data.role, business: data.businesses };
}

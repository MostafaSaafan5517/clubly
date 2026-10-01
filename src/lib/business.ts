import type { SupabaseClient } from "@supabase/supabase-js";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
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

type StaffRole = Database["public"]["Enums"]["staff_role"];

/**
 * For pages under /dashboard/b/[slug]: the signed-in user's Supabase client, the business and
 * their role there. Visitors are sent to sign in (and back to `currentPath`). Anyone who isn't
 * staff, or whose role isn't in `roles`, gets a 404, which also avoids confirming the business
 * (or the page) exists.
 */
export async function requireStaffBusiness(
  slug: string,
  currentPath: string,
  roles: readonly StaffRole[] = ["owner", "admin", "staff"],
) {
  const { supabase, userId } = await requireUser(currentPath);
  const staff = await getStaffBusiness(supabase, userId, slug);
  if (!staff || !roles.includes(staff.role)) notFound();
  return { supabase, userId, ...staff };
}

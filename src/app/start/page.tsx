import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";

// Where signing in leads when no page asked to have the user back (SIGNED_IN_HOME): staff go to
// their businesses, people who are only members go to their memberships, and everyone else to
// the dashboard, where they can create a business.
export default async function StartPage() {
  const { supabase, userId } = await requireUser("/start");
  const [staffResult, membersResult] = await Promise.all([
    supabase
      .from("business_staff")
      .select("business_id", { count: "exact", head: true })
      .eq("user_id", userId),
    supabase
      .from("members")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId),
  ]);
  if (staffResult.error) {
    throw new Error(`Could not check businesses: ${staffResult.error.message}`);
  }
  if (membersResult.error) {
    throw new Error(
      `Could not check memberships: ${membersResult.error.message}`,
    );
  }

  const onlyAMember = !staffResult.count && Boolean(membersResult.count);
  redirect(onlyAMember ? "/account" : "/dashboard");
}

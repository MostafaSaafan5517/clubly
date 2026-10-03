"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import type { ActionState } from "@/components/action-button";
import { getStaffBusiness } from "@/lib/business";
import { DEMO_READ_ONLY_MESSAGE, isDemoAccount } from "@/lib/demo";
import type { Enums } from "@/lib/supabase/database.types";
import { createServerActionClient } from "@/lib/supabase/server";

/**
 * Suspends or reactivates a member. It's the business's decision about access (a suspended
 * member can't start a new membership); billing stays as it is in Stripe.
 */
export async function setMemberStatus(
  slug: string,
  memberId: string,
  status: Enums<"member_status">,
): Promise<ActionState> {
  const supabase = await createServerActionClient();
  const { data } = await supabase.auth.getClaims();
  if (!data) {
    redirect(
      `/login?next=${encodeURIComponent(`/dashboard/b/${slug}/members`)}`,
    );
  }

  if (isDemoAccount(data.claims)) return { error: DEMO_READ_ONLY_MESSAGE };

  // The arguments come from the browser, so check the role again; RLS checks once more.
  const staff = await getStaffBusiness(supabase, data.claims.sub, slug);
  if (!staff || staff.role === "staff") {
    return { error: "Only owners and admins can change a member's status." };
  }

  const { data: updated, error } = await supabase
    .from("members")
    .update({ status })
    .eq("id", memberId)
    .eq("business_id", staff.business.id)
    .select("id")
    .maybeSingle();
  if (error) {
    console.error("Updating a member failed", { memberId, code: error.code });
    return { error: "We couldn't update the member. Please try again." };
  }
  if (!updated) return { error: "That member isn't part of this business." };

  refresh();
  return { error: null };
}

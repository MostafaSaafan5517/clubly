"use server";

import { redirect } from "next/navigation";
import type { ActionState } from "@/components/action-button";
import { getStaffBusiness } from "@/lib/business";
import { errorMessage } from "@/lib/redact";
import { storedAccountId } from "@/lib/stripe/connect";
import { createDashboardLoginUrl } from "@/lib/stripe/payouts";
import { createServerActionClient } from "@/lib/supabase/server";

/** Signs the owner in to their Stripe Express dashboard. */
export async function openStripeDashboard(slug: string): Promise<ActionState> {
  const supabase = await createServerActionClient();
  const { data } = await supabase.auth.getClaims();
  if (!data) {
    redirect(
      `/login?next=${encodeURIComponent(`/dashboard/b/${slug}/payouts`)}`,
    );
  }

  // The dashboard shows the bank account and moves money, so it's for the owner only.
  const staff = await getStaffBusiness(supabase, data.claims.sub, slug);
  if (staff?.role !== "owner") {
    return { error: "Only the owner can open the Stripe dashboard." };
  }

  let loginUrl: string;
  try {
    const accountId = await storedAccountId(staff.business.id);
    if (!accountId) return { error: "Connect payouts first." };
    loginUrl = await createDashboardLoginUrl(accountId);
  } catch (error) {
    console.error("Opening the Stripe dashboard failed", {
      businessId: staff.business.id,
      message: errorMessage(error),
    });
    return { error: "Stripe couldn't open your dashboard. Please try again." };
  }

  redirect(loginUrl);
}

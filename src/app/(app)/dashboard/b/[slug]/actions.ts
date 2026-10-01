"use server";

import { refresh } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { ActionState } from "@/components/action-button";
import { getStaffBusiness } from "@/lib/business";
import {
  createOnboardingUrl,
  getOrCreateConnectedAccount,
  storedAccountId,
} from "@/lib/stripe/connect";
import { setPlanProductActive } from "@/lib/stripe/plans";
import { createServerActionClient } from "@/lib/supabase/server";

// These actions are bound to their arguments on the server; useActionState's previous-state
// argument isn't needed. Every argument still comes from the browser, so each action checks the
// user's role again, and RLS checks once more in the database.

async function requireStaff(slug: string) {
  const supabase = await createServerActionClient();
  const { data } = await supabase.auth.getClaims();
  if (!data) {
    redirect(`/login?next=${encodeURIComponent(`/dashboard/b/${slug}`)}`);
  }
  const staff = await getStaffBusiness(supabase, data.claims.sub, slug);
  return { supabase, staff };
}

export async function startStripeOnboarding(
  slug: string,
): Promise<ActionState> {
  const { staff } = await requireStaff(slug);
  // Payouts go to the owner's bank account, so only the owner may connect one.
  if (staff?.role !== "owner") {
    return { error: "Only the owner can set up payouts." };
  }

  // Next.js has already checked that this Server Action call comes from our own origin.
  const origin = (await headers()).get("origin");
  if (!origin) {
    throw new Error("Server Action request without an Origin header.");
  }

  let onboardingUrl: string;
  try {
    const accountId = await getOrCreateConnectedAccount(staff.business.id);
    onboardingUrl = await createOnboardingUrl(accountId, slug, origin);
  } catch (error) {
    console.error("Starting Stripe onboarding failed", {
      businessId: staff.business.id,
      message: error instanceof Error ? error.message : String(error),
    });
    return { error: "Stripe couldn't start the setup. Please try again." };
  }

  redirect(onboardingUrl);
}

/** Archives (active = false) or restores a plan, in the database and in Stripe. */
export async function setPlanActive(
  slug: string,
  planId: string,
  active: boolean,
): Promise<ActionState> {
  const { supabase, staff } = await requireStaff(slug);
  if (!staff || staff.role === "staff") {
    return { error: "Only owners and admins can change plans." };
  }

  // Through RLS as the user: only owners and admins of this business can update its plans.
  const { data: updated, error } = await supabase
    .from("plans")
    .update({ active })
    .eq("id", planId)
    .eq("business_id", staff.business.id)
    .select("id")
    .maybeSingle();
  if (error) {
    console.error("Updating a plan failed", { planId, code: error.code });
    return { error: "We couldn't update the plan. Please try again." };
  }
  if (!updated) return { error: "That plan no longer exists." };

  try {
    const accountId = await storedAccountId(staff.business.id);
    if (accountId) await setPlanProductActive(planId, accountId, active);
  } catch (stripeError) {
    console.error("Updating the plan in Stripe failed", {
      planId,
      message:
        stripeError instanceof Error
          ? stripeError.message
          : String(stripeError),
    });
    // Put the plan back, so the app and Stripe never disagree about whether it can be sold.
    const { error: revertError } = await supabase
      .from("plans")
      .update({ active: !active })
      .eq("id", planId);
    if (revertError) {
      console.error("Reverting the plan failed", {
        planId,
        code: revertError.code,
      });
    }
    return { error: "Stripe couldn't update this plan. Please try again." };
  }

  refresh();
  return { error: null };
}

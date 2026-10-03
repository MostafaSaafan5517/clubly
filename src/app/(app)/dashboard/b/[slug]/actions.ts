"use server";

import { refresh } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { ActionState } from "@/components/action-button";
import { getStaffBusiness } from "@/lib/business";
import { DEMO_READ_ONLY_MESSAGE, isDemoAccount } from "@/lib/demo";
import { errorMessage } from "@/lib/redact";
import {
  createOnboardingUrl,
  getOrCreateConnectedAccount,
  storedAccountId,
} from "@/lib/stripe/connect";
import { updatePlanProduct } from "@/lib/stripe/plans";
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
  return { supabase, staff, demo: isDemoAccount(data.claims) };
}

export async function startStripeOnboarding(
  slug: string,
): Promise<ActionState> {
  const { staff, demo } = await requireStaff(slug);
  if (demo) return { error: DEMO_READ_ONLY_MESSAGE };
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
      message: errorMessage(error),
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
  const { supabase, staff, demo } = await requireStaff(slug);
  if (demo) return { error: DEMO_READ_ONLY_MESSAGE };
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
    if (accountId) await updatePlanProduct(planId, accountId, { active });
  } catch (stripeError) {
    console.error("Updating the plan in Stripe failed", {
      planId,
      message: errorMessage(stripeError),
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

/** What a rename form shows after saving: an error, or that the new name was saved. */
export type RenameState = { error: string | null; saved: boolean };

function formName(formData: FormData) {
  const value = formData.get("name");
  return typeof value === "string" ? value.trim() : "";
}

/** Renames the business. Its web address (the slug) stays: it's in links people have shared. */
export async function renameBusiness(
  slug: string,
  _previous: RenameState,
  formData: FormData,
): Promise<RenameState> {
  const { supabase, staff, demo } = await requireStaff(slug);
  if (demo) return { error: DEMO_READ_ONLY_MESSAGE, saved: false };
  if (!staff || staff.role === "staff") {
    return {
      error: "Only owners and admins can rename the business.",
      saved: false,
    };
  }
  const name = formName(formData);
  if (name.length < 1 || name.length > 100) {
    return { error: "Use 1 to 100 characters for the name.", saved: false };
  }

  // Through RLS as the user: owners and admins may change the name, and only the name.
  const { data: updated, error } = await supabase
    .from("businesses")
    .update({ name })
    .eq("id", staff.business.id)
    .select("id")
    .maybeSingle();
  if (error || !updated) {
    console.error("Renaming a business failed", { code: error?.code });
    return {
      error: "We couldn't rename the business. Please try again.",
      saved: false,
    };
  }

  refresh();
  return { error: null, saved: true };
}

/** Renames a plan, in the database and on its Stripe product (what Checkout shows). */
export async function renamePlan(
  slug: string,
  planId: string,
  _previous: RenameState,
  formData: FormData,
): Promise<RenameState> {
  const { supabase, staff, demo } = await requireStaff(slug);
  if (demo) return { error: DEMO_READ_ONLY_MESSAGE, saved: false };
  if (!staff || staff.role === "staff") {
    return { error: "Only owners and admins can rename plans.", saved: false };
  }
  const name = formName(formData);
  if (name.length < 1 || name.length > 60) {
    return { error: "Use 1 to 60 characters for the name.", saved: false };
  }

  const { data: plan, error: readError } = await supabase
    .from("plans")
    .select("name")
    .eq("id", planId)
    .eq("business_id", staff.business.id)
    .maybeSingle();
  if (readError) throw new Error(readError.message);
  if (!plan) return { error: "That plan no longer exists.", saved: false };

  const { error } = await supabase
    .from("plans")
    .update({ name })
    .eq("id", planId)
    .eq("business_id", staff.business.id);
  if (error) {
    console.error("Renaming a plan failed", { planId, code: error.code });
    return {
      error: "We couldn't rename the plan. Please try again.",
      saved: false,
    };
  }

  try {
    const accountId = await storedAccountId(staff.business.id);
    if (accountId) await updatePlanProduct(planId, accountId, { name });
  } catch (stripeError) {
    console.error("Renaming the plan in Stripe failed", {
      planId,
      message: errorMessage(stripeError),
    });
    // Put the old name back, so members never see one name here and another at Checkout.
    const { error: revertError } = await supabase
      .from("plans")
      .update({ name: plan.name })
      .eq("id", planId);
    if (revertError) {
      console.error("Reverting the plan's name failed", {
        planId,
        code: revertError.code,
      });
    }
    return {
      error: "Stripe couldn't rename this plan. Please try again.",
      saved: false,
    };
  }

  refresh();
  return { error: null, saved: true };
}

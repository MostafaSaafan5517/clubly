"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getStaffBusiness } from "@/lib/business";
import {
  createOnboardingUrl,
  getOrCreateConnectedAccount,
} from "@/lib/stripe/connect";
import { createServerActionClient } from "@/lib/supabase/server";

export type PayoutsFormState = { error: string | null };

// Bound to a slug on the server; useActionState's previous-state argument isn't needed.
export async function startStripeOnboarding(
  slug: string,
): Promise<PayoutsFormState> {
  const supabase = await createServerActionClient();
  const { data } = await supabase.auth.getClaims();
  if (!data) {
    redirect(`/login?next=${encodeURIComponent(`/dashboard/b/${slug}`)}`);
  }

  // The slug comes from the browser, so ownership is checked again here, through RLS.
  // Payouts go to the owner's bank account, so only the owner may connect one.
  const staff = await getStaffBusiness(supabase, data.claims.sub, slug);
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

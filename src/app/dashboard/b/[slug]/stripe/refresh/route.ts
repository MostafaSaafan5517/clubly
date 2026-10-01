import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";
import { getStaffBusiness } from "@/lib/business";
import {
  createOnboardingUrl,
  getOrCreateConnectedAccount,
} from "@/lib/stripe/connect";
import { createServerActionClient } from "@/lib/supabase/server";

// Stripe sends the owner here when an onboarding link has expired or was already used.
// Hand out a fresh link for the same account.
export async function GET(
  request: NextRequest,
  { params }: RouteContext<"/dashboard/b/[slug]/stripe/refresh">,
) {
  const { slug } = await params;
  const businessPath = `/dashboard/b/${slug}`;

  const supabase = await createServerActionClient();
  const { data } = await supabase.auth.getClaims();
  if (!data) redirect(`/login?next=${encodeURIComponent(businessPath)}`);

  const staff = await getStaffBusiness(supabase, data.claims.sub, slug);
  if (staff?.role !== "owner" || !staff.business.has_stripe_account) {
    redirect(businessPath);
  }

  const accountId = await getOrCreateConnectedAccount(staff.business.id);
  redirect(await createOnboardingUrl(accountId, slug, request.nextUrl.origin));
}

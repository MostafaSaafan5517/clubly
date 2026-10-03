"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { ActionState } from "@/components/action-button";
import { isDemoAccount } from "@/lib/demo";
import { errorMessage } from "@/lib/redact";
import { storedCustomerId } from "@/lib/stripe/checkout";
import { storedAccountId } from "@/lib/stripe/connect";
import {
  createPortalUrl,
  getOrCreatePortalConfiguration,
  getOrCreateViewOnlyPortalConfiguration,
} from "@/lib/stripe/portal";
import { createServerActionClient } from "@/lib/supabase/server";

/** Opens Stripe's Customer Portal for one of the signed-in user's memberships. */
export async function openBillingPortal(
  memberId: string,
): Promise<ActionState> {
  const supabase = await createServerActionClient();
  const { data } = await supabase.auth.getClaims();
  if (!data) redirect(`/login?next=${encodeURIComponent("/account")}`);

  // RLS lets staff read their business's members too, so also insist the membership is the
  // user's own: a portal session acts as the member, with their card and invoices.
  const { data: member, error } = await supabase
    .from("members")
    .select("id, business_id")
    .eq("id", memberId)
    .eq("user_id", data.claims.sub)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!member) return { error: "We couldn't find that membership." };

  // Next.js has already checked that this Server Action call comes from our own origin.
  const origin = (await headers()).get("origin");
  if (!origin) {
    throw new Error("Server Action request without an Origin header.");
  }

  let portalUrl: string;
  try {
    const [accountId, customerId] = await Promise.all([
      storedAccountId(member.business_id),
      storedCustomerId(member.id),
    ]);
    if (!accountId || !customerId) {
      return { error: "There's no billing to manage for this membership yet." };
    }
    portalUrl = await createPortalUrl({
      accountId,
      // Demo members share one account, so their portal shows billing without changing it.
      configurationId: isDemoAccount(data.claims)
        ? await getOrCreateViewOnlyPortalConfiguration(accountId)
        : await getOrCreatePortalConfiguration(member.business_id, accountId),
      customerId,
      returnUrl: `${origin}/account`,
    });
  } catch (portalError) {
    console.error("Opening the billing portal failed", {
      memberId: member.id,
      message: errorMessage(portalError),
    });
    return { error: "We couldn't open billing. Please try again." };
  }

  redirect(portalUrl);
}

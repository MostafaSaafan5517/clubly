"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { getStaffBusiness } from "@/lib/business";
import {
  MAX_PLAN_AMOUNT,
  MIN_PLAN_AMOUNT,
  parseDollarsToCents,
} from "@/lib/money";
import { errorMessage } from "@/lib/redact";
import { storedAccountId } from "@/lib/stripe/connect";
import { createPlanPrice, discardUnpricedPlan } from "@/lib/stripe/plans";
import { createServerActionClient } from "@/lib/supabase/server";

export type NewPlanFormState = {
  error: string | null;
  fields: { name?: string; price?: string; billingInterval?: string };
};

const newPlanSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Enter a name for the plan.")
    .max(60, "Keep the name under 60 characters."),
  // Typed in dollars, validated and turned into whole cents in one place.
  price: z.string().transform((value, ctx) => {
    const cents = parseDollarsToCents(value);
    if (cents === null) {
      ctx.addIssue("Enter a price like 30 or 29.99.");
      return z.NEVER;
    }
    if (cents < MIN_PLAN_AMOUNT) {
      ctx.addIssue("The price must be at least $0.50.");
      return z.NEVER;
    }
    if (cents > MAX_PLAN_AMOUNT) {
      ctx.addIssue("The price must be at most $999,999.99.");
      return z.NEVER;
    }
    return cents;
  }),
  billingInterval: z.enum(["month", "year"], "Choose monthly or yearly."),
});

function formText(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

export async function createPlan(
  slug: string,
  _previous: NewPlanFormState,
  formData: FormData,
): Promise<NewPlanFormState> {
  const fields = {
    name: formText(formData, "name"),
    price: formText(formData, "price"),
    billingInterval: formText(formData, "billingInterval"),
  };

  const supabase = await createServerActionClient();
  const { data } = await supabase.auth.getClaims();
  if (!data) {
    redirect(
      `/login?next=${encodeURIComponent(`/dashboard/b/${slug}/plans/new`)}`,
    );
  }

  const staff = await getStaffBusiness(supabase, data.claims.sub, slug);
  if (!staff || staff.role === "staff") {
    return { error: "Only owners and admins can create plans.", fields };
  }
  if (!staff.business.has_stripe_account) {
    return { error: "Connect payouts before creating plans.", fields };
  }

  const parsed = newPlanSchema.safeParse(fields);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? null, fields };
  }
  const { name, price: amount, billingInterval } = parsed.data;

  // 1. The row, through RLS as the signed-in user: the database decides who may create plans.
  const { data: plan, error: insertError } = await supabase
    .from("plans")
    .insert({
      business_id: staff.business.id,
      name,
      amount,
      billing_interval: billingInterval,
      currency: "usd",
    })
    .select("id, currency")
    .single();
  if (insertError) {
    console.error("Creating a plan failed", { code: insertError.code });
    return { error: "We couldn't create the plan. Please try again.", fields };
  }

  // 2. The matching Stripe product and price on the business's own Stripe account.
  try {
    const accountId = await storedAccountId(staff.business.id);
    if (!accountId) throw new Error("The business has no Stripe account.");
    await createPlanPrice(
      { id: plan.id, name, amount, currency: plan.currency, billingInterval },
      accountId,
    );
  } catch (error) {
    console.error("Creating the plan's Stripe price failed", {
      planId: plan.id,
      message: errorMessage(error),
    });
    await discardUnpricedPlan(plan.id);
    return {
      error: "Stripe couldn't create this plan. Please try again.",
      fields,
    };
  }

  redirect(`/dashboard/b/${slug}`);
}

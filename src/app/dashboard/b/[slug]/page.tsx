import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { startStripeOnboarding } from "@/app/dashboard/b/[slug]/actions";
import { PayoutsButton } from "@/app/dashboard/b/[slug]/payouts-button";
import { appConfig } from "@/config/app";
import { requireUser } from "@/lib/auth";
import { getStaffBusiness } from "@/lib/business";
import { formatAmount } from "@/lib/money";

export const metadata: Metadata = { title: "Business" };

const roleDescriptions = {
  owner: "You own this business.",
  admin: "You're an admin here.",
  staff: "You're on the staff here.",
} as const;

export default async function BusinessPage({
  params,
  searchParams,
}: PageProps<"/dashboard/b/[slug]">) {
  const { slug } = await params;
  const { stripe: stripeReturn } = await searchParams;
  const { supabase, userId } = await requireUser(`/dashboard/b/${slug}`);

  // Staff only; a 404 (not a 403) also avoids confirming the business exists to outsiders.
  const staff = await getStaffBusiness(supabase, userId, slug);
  if (!staff) notFound();
  const { business, role } = staff;

  const { data: plans, error: plansError } = await supabase
    .from("plans")
    .select("id, name, billing_interval, amount, currency, active")
    .eq("business_id", business.id)
    .order("created_at");
  if (plansError) {
    throw new Error(`Could not load plans: ${plansError.message}`);
  }

  const isOwner = role === "owner";
  const connectPayouts = startStripeOnboarding.bind(null, business.slug);

  return (
    <>
      <div className="grid gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">
          {business.name}
        </h1>
        <p className="text-muted-foreground">{roleDescriptions[role]}</p>
      </div>

      <section className="grid gap-3" aria-labelledby="payments-heading">
        <h2 id="payments-heading" className="text-lg font-semibold">
          Payments
        </h2>
        <div className="grid gap-3 rounded-lg border p-4">
          {business.charges_enabled ? (
            <p>
              Ready to take payments. Members pay straight into your Stripe
              account.
            </p>
          ) : business.has_stripe_account ? (
            <>
              <p>Stripe setup isn&apos;t finished yet.</p>
              {stripeReturn === "returned" && (
                <p role="status" className="text-sm text-muted-foreground">
                  Thanks! Stripe is checking your details. This page shows
                  &ldquo;Ready to take payments&rdquo; as soon as Stripe
                  confirms, which can take a minute.
                </p>
              )}
              {isOwner && (
                <PayoutsButton action={connectPayouts} label="Continue setup" />
              )}
            </>
          ) : (
            <>
              <p>
                Connect a Stripe account to get paid. Members&apos; payments go
                straight to it, and {appConfig.name} keeps a small fee on each
                one.
              </p>
              {isOwner && (
                <PayoutsButton
                  action={connectPayouts}
                  label="Connect payouts"
                />
              )}
            </>
          )}
          {!isOwner && !business.charges_enabled && (
            <p className="text-sm text-muted-foreground">
              Only the owner can set up payouts.
            </p>
          )}
        </div>
      </section>

      <section className="grid gap-3" aria-labelledby="plans-heading">
        <h2 id="plans-heading" className="text-lg font-semibold">
          Plans
        </h2>
        {plans.length === 0 ? (
          <p className="rounded-lg border p-4 text-sm text-muted-foreground">
            No plans yet.
          </p>
        ) : (
          <ul className="grid gap-3">
            {plans.map((plan) => (
              <li
                key={plan.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-4"
              >
                <div className="grid gap-0.5">
                  <span className="font-medium">{plan.name}</span>
                  <span className="text-sm text-muted-foreground">
                    {formatAmount(plan.amount, plan.currency)} per{" "}
                    {plan.billing_interval}
                  </span>
                </div>
                {!plan.active && (
                  <span className="rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground">
                    Archived
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

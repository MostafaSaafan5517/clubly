import type { Metadata } from "next";
import Link from "next/link";
import {
  renameBusiness,
  renamePlan,
  setPlanActive,
  startStripeOnboarding,
} from "@/app/(app)/dashboard/b/[slug]/actions";
import { BusinessHeader } from "@/app/(app)/dashboard/b/[slug]/business-header";
import { RenameForm } from "@/app/(app)/dashboard/b/[slug]/rename-form";
import { ActionButton } from "@/components/action-button";
import { buttonVariants } from "@/components/ui/button";
import { appConfig } from "@/config/app";
import { requireStaffBusiness } from "@/lib/business";
import { formatAmount } from "@/lib/money";

export const metadata: Metadata = { title: "Business" };

export default async function BusinessPage({
  params,
  searchParams,
}: PageProps<"/dashboard/b/[slug]">) {
  const { slug } = await params;
  const { stripe: stripeReturn } = await searchParams;
  const { supabase, business, role } = await requireStaffBusiness(
    slug,
    `/dashboard/b/${slug}`,
  );

  const { data: plans, error: plansError } = await supabase
    .from("plans")
    .select(
      "id, name, billing_interval, amount, currency, active, has_stripe_price",
    )
    .eq("business_id", business.id)
    .order("created_at");
  if (plansError) {
    throw new Error(`Could not load plans: ${plansError.message}`);
  }

  const isOwner = role === "owner";
  const canManagePlans = role !== "staff";
  const connectPayouts = startStripeOnboarding.bind(null, business.slug);

  return (
    <>
      <BusinessHeader business={business} role={role} current="overview" />

      <section className="grid gap-3" aria-labelledby="payments-heading">
        <h2 id="payments-heading" className="text-lg font-semibold">
          Payments
        </h2>
        <div className="grid gap-3 rounded-lg border p-4">
          {business.charges_enabled ? (
            <>
              <p>
                Ready to take payments. Members pay straight into your Stripe
                account.
              </p>
              <p className="text-sm">
                Your join page:{" "}
                <Link href={`/b/${business.slug}`} className="underline">
                  /b/{business.slug}
                </Link>
              </p>
            </>
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
                <ActionButton
                  action={connectPayouts}
                  label="Continue setup"
                  pendingLabel="Opening Stripe..."
                />
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
                <ActionButton
                  action={connectPayouts}
                  label="Connect payouts"
                  pendingLabel="Opening Stripe..."
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
        <div className="flex items-center justify-between gap-4">
          <h2 id="plans-heading" className="text-lg font-semibold">
            Plans
          </h2>
          {canManagePlans && business.has_stripe_account && (
            <Link
              href={`/dashboard/b/${business.slug}/plans/new`}
              className={buttonVariants({ variant: "outline" })}
            >
              New plan
            </Link>
          )}
        </div>
        {plans.length === 0 ? (
          <p className="rounded-lg border p-4 text-sm text-muted-foreground">
            No plans yet.
          </p>
        ) : (
          <ul className="grid gap-3">
            {plans.map((plan) => (
              <li key={plan.id} className="grid gap-3 rounded-lg border p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="grid gap-0.5">
                    <span className="font-medium">{plan.name}</span>
                    <span className="text-sm text-muted-foreground">
                      {formatAmount(plan.amount, plan.currency)} per{" "}
                      {plan.billing_interval}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {!plan.active ? (
                      <span className="rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground">
                        Archived
                      </span>
                    ) : (
                      !plan.has_stripe_price && (
                        // Only seen if creating the Stripe price was interrupted.
                        <span className="rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground">
                          Not ready
                        </span>
                      )
                    )}
                    {canManagePlans && (
                      // Archiving stops new sign-ups; members already on the plan keep it.
                      <ActionButton
                        action={setPlanActive.bind(
                          null,
                          business.slug,
                          plan.id,
                          !plan.active,
                        )}
                        label={plan.active ? "Archive" : "Restore"}
                        pendingLabel={
                          plan.active ? "Archiving..." : "Restoring..."
                        }
                        variant="outline"
                      />
                    )}
                  </div>
                </div>
                {canManagePlans && (
                  <details className="text-sm">
                    <summary className="w-fit cursor-pointer text-muted-foreground hover:text-foreground">
                      Rename
                    </summary>
                    <div className="pt-3">
                      <RenameForm
                        action={renamePlan.bind(null, business.slug, plan.id)}
                        label="Plan name"
                        currentName={plan.name}
                        maxLength={60}
                      />
                    </div>
                  </details>
                )}
              </li>
            ))}
          </ul>
        )}
        {canManagePlans && plans.length > 0 && (
          <p className="text-sm text-muted-foreground">
            A new name shows everywhere at once, Stripe Checkout and the billing
            portal included. The price and the plan&apos;s members stay as they
            are.
          </p>
        )}
      </section>

      {canManagePlans && (
        <section className="grid gap-3" aria-labelledby="details-heading">
          <h2 id="details-heading" className="text-lg font-semibold">
            Details
          </h2>
          <div className="grid gap-2 rounded-lg border p-4">
            <RenameForm
              action={renameBusiness.bind(null, business.slug)}
              label="Business name"
              currentName={business.name}
              maxLength={100}
            />
            <p className="text-sm text-muted-foreground">
              Your join page stays at /b/{business.slug}, so links you&apos;ve
              shared keep working.
            </p>
          </div>
        </section>
      )}
    </>
  );
}

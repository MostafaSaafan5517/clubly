import {
  IconAlertTriangle,
  IconArchive,
  IconPlus,
  IconTicket,
} from "@tabler/icons-react";
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
import { Badge } from "@/components/badge";
import { EmptyState } from "@/components/empty-state";
import { Notice } from "@/components/notice";
import { PageBody } from "@/components/page-body";
import { SectionHeader } from "@/components/section-header";
import { textLinkClass } from "@/components/text-link";
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

  // Plans take the wide column; payments and the business's details sit beside them on wide
  // screens, and payments come first on phones (setting them up is the first thing to do).
  return (
    <>
      <BusinessHeader business={business} role={role} current="overview" />
      <PageBody>
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_22rem] lg:grid-rows-[auto_1fr] lg:items-start">
          <section
            className="grid gap-4 lg:col-start-2 lg:row-start-1"
            aria-labelledby="payments-heading"
          >
            <SectionHeader id="payments-heading" title="Payments" />
            {business.charges_enabled ? (
              <div className="grid gap-3">
                <Notice tone="success">
                  Ready to take payments. Members pay straight into your Stripe
                  account.
                </Notice>
                <p className="text-small text-ink-2">
                  Your join page:{" "}
                  <Link href={`/b/${business.slug}`} className={textLinkClass}>
                    /b/{business.slug}
                  </Link>
                </p>
              </div>
            ) : business.has_stripe_account ? (
              <div className="grid justify-items-start gap-3">
                <Notice tone="warning">
                  Stripe setup isn&apos;t finished yet.
                </Notice>
                {stripeReturn === "returned" && (
                  <p role="status" className="text-small text-ink-2">
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
              </div>
            ) : (
              <div className="grid justify-items-start gap-3 rounded-surface bg-card p-5 shadow-level-1">
                <p className="text-body">
                  Connect a Stripe account to get paid. Members&apos; payments
                  go straight to it, and {appConfig.name} keeps a small fee on
                  each one.
                </p>
                {isOwner && (
                  <ActionButton
                    action={connectPayouts}
                    label="Connect payouts"
                    pendingLabel="Opening Stripe..."
                  />
                )}
              </div>
            )}
            {!isOwner && !business.charges_enabled && (
              <p className="text-small text-ink-2">
                Only the owner can set up payouts.
              </p>
            )}
          </section>

          <section
            className="grid gap-4 lg:col-start-1 lg:row-span-2 lg:row-start-1"
            aria-labelledby="plans-heading"
          >
            <SectionHeader
              id="plans-heading"
              title="Plans"
              action={
                canManagePlans &&
                business.has_stripe_account && (
                  <Link
                    href={`/dashboard/b/${business.slug}/plans/new`}
                    className={buttonVariants({ variant: "outline" })}
                  >
                    <IconPlus stroke={1.75} aria-hidden />
                    New plan
                  </Link>
                )
              }
            />
            {plans.length === 0 ? (
              <EmptyState
                icon={IconTicket}
                title="No plans yet."
                titleAs="h3"
              />
            ) : (
              <ul className="divide-y rounded-surface bg-card shadow-level-1">
                {plans.map((plan) => (
                  <li key={plan.id} className="grid gap-3 px-5 py-4">
                    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
                      <div className="grid gap-1">
                        <span className="text-heading">{plan.name}</span>
                        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-small text-ink-2">
                          <span>
                            <span className="font-semibold text-foreground">
                              {formatAmount(plan.amount, plan.currency)}
                            </span>{" "}
                            per {plan.billing_interval}
                          </span>
                          {!plan.active ? (
                            <Badge tone="neutral" icon={IconArchive}>
                              Archived
                            </Badge>
                          ) : (
                            !plan.has_stripe_price && (
                              // Only seen if creating the Stripe price was interrupted.
                              <Badge tone="warning" icon={IconAlertTriangle}>
                                Not ready
                              </Badge>
                            )
                          )}
                        </p>
                      </div>
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
                    {canManagePlans && (
                      <details className="text-small">
                        <summary className="w-fit cursor-pointer rounded-control font-semibold text-ink-2 hover:text-foreground">
                          Rename
                        </summary>
                        <div className="pt-3">
                          <RenameForm
                            action={renamePlan.bind(
                              null,
                              business.slug,
                              plan.id,
                            )}
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
              <p className="max-w-[68ch] text-small text-ink-2">
                A new name shows everywhere at once, Stripe Checkout and the
                billing portal included. The price and the plan&apos;s members
                stay as they are.
              </p>
            )}
          </section>

          {canManagePlans && (
            <section
              className="grid gap-4 lg:col-start-2"
              aria-labelledby="details-heading"
            >
              <SectionHeader id="details-heading" title="Details" />
              <div className="grid gap-3 rounded-surface bg-card p-5 shadow-level-1">
                <RenameForm
                  action={renameBusiness.bind(null, business.slug)}
                  label="Business name"
                  currentName={business.name}
                  maxLength={100}
                />
                <p className="text-small text-ink-2">
                  Your join page stays at /b/{business.slug}, so links
                  you&apos;ve shared keep working.
                </p>
              </div>
            </section>
          )}
        </div>
      </PageBody>
    </>
  );
}

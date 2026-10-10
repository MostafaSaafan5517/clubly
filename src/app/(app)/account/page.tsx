import { IconAlertTriangle, IconId } from "@tabler/icons-react";
import type { Metadata } from "next";
import Link from "next/link";
import { openBillingPortal } from "@/app/(app)/account/actions";
import { ConfirmingPayment } from "@/app/(app)/account/confirming-payment";
import { ActionButton } from "@/components/action-button";
import { EmptyState } from "@/components/empty-state";
import { Notice } from "@/components/notice";
import { PageBody } from "@/components/page-body";
import { SubscriptionBadge } from "@/components/subscription-badge";
import { buttonVariants } from "@/components/ui/button";
import { requireUser } from "@/lib/auth";
import {
  currentSubscription,
  describeSubscription,
  isLive,
} from "@/lib/membership";
import { formatAmount } from "@/lib/money";

export const metadata: Metadata = { title: "Your memberships" };

export default async function AccountPage({
  searchParams,
}: PageProps<"/account">) {
  const { supabase, userId } = await requireUser("/account");
  const { joined } = await searchParams;

  // Everything below is read through RLS as the user. The user_id filter matters on its own:
  // staff may also read their business's members, and this page is only about the user's.
  const { data: memberships, error } = await supabase
    .from("members")
    .select(
      `id, status,
       businesses (name, slug),
       subscriptions (
         status, current_period_end, cancel_at, created_at,
         plans (name, amount, currency, billing_interval)
       )`,
    )
    .eq("user_id", userId)
    .order("created_at");
  if (error) {
    throw new Error(`Could not load your memberships: ${error.message}`);
  }

  const rows = memberships.map((membership) => ({
    ...membership,
    subscription: currentSubscription(membership.subscriptions),
  }));
  // Where Stripe Checkout sends people back to. The membership counts as joined only once the
  // webhook has stored a live subscription, never because of this URL.
  const justJoined = rows.find((row) => row.businesses.slug === joined);
  const joinConfirmed =
    justJoined?.subscription && isLive(justJoined.subscription.status);

  return (
    <PageBody width="narrow">
      <h1 className="text-title">Your memberships</h1>

      {justJoined &&
        (joinConfirmed ? (
          <Notice tone="success" role="status">
            Welcome to {justJoined.businesses.name}! Your membership is active.
          </Notice>
        ) : (
          <ConfirmingPayment businessName={justJoined.businesses.name} />
        ))}

      {rows.length === 0 ? (
        <EmptyState icon={IconId} title="You're not a member anywhere yet">
          Businesses share their own join page with you. Your memberships show
          up here once you join.
        </EmptyState>
      ) : (
        <ul className="grid gap-4">
          {rows.map(({ id, status, businesses: business, subscription }) => {
            const summary = subscription && describeSubscription(subscription);
            return (
              <li
                key={id}
                className="grid gap-4 rounded-surface bg-card p-5 shadow-level-1 sm:p-6"
              >
                <div className="grid gap-2">
                  <h2 className="text-heading">{business.name}</h2>
                  {subscription ? (
                    <p className="text-body">
                      {subscription.plans.name},{" "}
                      <span className="font-semibold">
                        {formatAmount(
                          subscription.plans.amount,
                          subscription.plans.currency,
                        )}
                      </span>{" "}
                      per {subscription.plans.billing_interval}
                    </p>
                  ) : (
                    <p className="text-body text-ink-3">
                      You haven&apos;t chosen a plan yet.
                    </p>
                  )}
                  {/* The status, then what happens next ("Active", "Renews on ..."). */}
                  {subscription && (
                    <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-small text-ink-2">
                      <SubscriptionBadge subscription={subscription} />
                      {summary?.detail}
                    </p>
                  )}
                </div>

                {status === "suspended" && (
                  <p className="flex items-start gap-1.5 text-small text-destructive">
                    <IconAlertTriangle
                      size={16}
                      stroke={1.75}
                      aria-hidden
                      className="mt-px shrink-0"
                    />
                    {business.name} has suspended your membership. Please
                    contact them.
                  </p>
                )}

                <div className="flex flex-wrap items-start gap-3">
                  {subscription && (
                    <ActionButton
                      action={openBillingPortal.bind(null, id)}
                      label="Manage billing"
                      pendingLabel="Opening billing..."
                      variant="outline"
                    />
                  )}
                  {!(subscription && isLive(subscription.status)) && (
                    <Link
                      href={`/b/${business.slug}`}
                      className={buttonVariants({ variant: "outline" })}
                    >
                      See plans
                    </Link>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </PageBody>
  );
}

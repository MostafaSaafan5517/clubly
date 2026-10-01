import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { BusinessHeader } from "@/app/(app)/dashboard/b/[slug]/business-header";
import { openStripeDashboard } from "@/app/(app)/dashboard/b/[slug]/payouts/actions";
import { ActionButton } from "@/components/action-button";
import { requireStaffBusiness } from "@/lib/business";
import { formatDate } from "@/lib/dates";
import { formatAmount } from "@/lib/money";
import { errorMessage } from "@/lib/redact";
import { storedAccountId } from "@/lib/stripe/connect";
import {
  getPayoutSummary,
  type Money,
  type PayoutSummary,
} from "@/lib/stripe/payouts";

export const metadata: Metadata = { title: "Payouts" };

const payoutStatusLabels: Record<
  PayoutSummary["payouts"][number]["status"],
  string
> = {
  paid: "Paid",
  pending: "Pending",
  in_transit: "On its way",
  canceled: "Canceled",
  failed: "Failed",
};

function amounts(balances: Money[]) {
  if (balances.length === 0) return formatAmount(0, "usd");
  return balances
    .map(({ amount, currency }) => formatAmount(amount, currency))
    .join(" + ");
}

/**
 * The balance and latest payouts, read live from Stripe. It streams in after the page: the
 * page has already checked who's asking (so a 404 is still a real 404), and only this part
 * waits on Stripe.
 */
async function PayoutDetails({
  businessId,
  accountId,
}: {
  businessId: string;
  accountId: string;
}) {
  let summary: PayoutSummary;
  try {
    summary = await getPayoutSummary(accountId);
  } catch (error) {
    console.error("Loading payouts failed", {
      businessId,
      message: errorMessage(error),
    });
    return (
      <p role="alert" className="rounded-lg border p-4 text-sm">
        We couldn&apos;t reach Stripe to load your balance. Please try again in
        a moment.
      </p>
    );
  }

  return (
    <>
      <dl className="grid gap-3 sm:grid-cols-2">
        <div className="grid gap-1 rounded-lg border p-4">
          <dt className="text-sm text-muted-foreground">
            Available to pay out
          </dt>
          <dd className="text-2xl font-semibold tracking-tight">
            {amounts(summary.available)}
          </dd>
        </div>
        <div className="grid gap-1 rounded-lg border p-4">
          <dt className="text-sm text-muted-foreground">
            On the way to your balance
          </dt>
          <dd className="text-2xl font-semibold tracking-tight">
            {amounts(summary.pending)}
          </dd>
        </div>
      </dl>

      <section className="grid gap-3" aria-labelledby="payouts-heading">
        <h2 id="payouts-heading" className="text-lg font-semibold">
          Recent payouts
        </h2>
        {summary.payouts.length === 0 ? (
          <p className="rounded-lg border p-4 text-sm text-muted-foreground">
            No payouts yet. Stripe pays out your available balance on its
            schedule.
          </p>
        ) : (
          <ul className="grid gap-2">
            {summary.payouts.map((payout) => (
              <li
                key={payout.id}
                className="grid grid-cols-[1fr_auto] items-center gap-3 rounded-lg border p-3"
              >
                <div className="grid gap-0.5">
                  <span className="font-medium">
                    {formatAmount(payout.amount, payout.currency)}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    Arrives {formatDate(new Date(payout.arrivalDate * 1000))}
                  </span>
                </div>
                <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium">
                  {payoutStatusLabels[payout.status]}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

function PayoutDetailsLoading() {
  return (
    <div
      aria-busy="true"
      aria-label="Loading your balance"
      className="grid gap-3 sm:grid-cols-2"
    >
      <div className="h-22 animate-pulse rounded-lg bg-muted" />
      <div className="h-22 animate-pulse rounded-lg bg-muted" />
    </div>
  );
}

export default async function PayoutsPage({
  params,
}: PageProps<"/dashboard/b/[slug]/payouts">) {
  const { slug } = await params;
  // Payouts go to the owner's bank account, so this page is theirs alone.
  const { business, role } = await requireStaffBusiness(
    slug,
    `/dashboard/b/${slug}/payouts`,
    ["owner"],
  );
  const accountId = business.has_stripe_account
    ? await storedAccountId(business.id)
    : null;

  return (
    <>
      <BusinessHeader business={business} role={role} current="payouts" />

      <section className="grid gap-3" aria-labelledby="balance-heading">
        <h2 id="balance-heading" className="text-lg font-semibold">
          Balance
        </h2>
        {accountId ? (
          <Suspense fallback={<PayoutDetailsLoading />}>
            <PayoutDetails businessId={business.id} accountId={accountId} />
          </Suspense>
        ) : (
          <p className="rounded-lg border p-4 text-sm text-muted-foreground">
            Connect payouts first.{" "}
            <Link
              href={`/dashboard/b/${business.slug}`}
              className="text-foreground underline"
            >
              Set up payouts
            </Link>
          </p>
        )}
      </section>

      {business.charges_enabled && (
        <div className="grid justify-items-start gap-2 rounded-lg border p-4">
          <p className="text-sm">
            Change your bank account or payout schedule in your Stripe
            dashboard.
          </p>
          <ActionButton
            action={openStripeDashboard.bind(null, business.slug)}
            label="Open Stripe dashboard"
            pendingLabel="Opening Stripe..."
            variant="outline"
          />
        </div>
      )}
    </>
  );
}

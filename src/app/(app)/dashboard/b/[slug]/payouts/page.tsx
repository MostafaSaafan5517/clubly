import {
  IconAlertTriangle,
  IconBuildingBank,
  IconCircleCheck,
  IconCircleX,
  IconClock,
  IconTruckDelivery,
  type TablerIcon,
} from "@tabler/icons-react";
import type { Metadata } from "next";
import Link from "next/link";
import { type ReactNode, Suspense } from "react";
import { BusinessHeader } from "@/app/(app)/dashboard/b/[slug]/business-header";
import { openStripeDashboard } from "@/app/(app)/dashboard/b/[slug]/payouts/actions";
import { ActionButton } from "@/components/action-button";
import { Badge } from "@/components/badge";
import { EmptyState } from "@/components/empty-state";
import { Notice } from "@/components/notice";
import { PageBody } from "@/components/page-body";
import { SectionHeader } from "@/components/section-header";
import { textLinkClass } from "@/components/text-link";
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

type PayoutStatus = PayoutSummary["payouts"][number]["status"];

const payoutStatuses: Record<
  PayoutStatus,
  {
    label: string;
    tone: "success" | "info" | "danger" | "neutral";
    icon: TablerIcon;
  }
> = {
  paid: { label: "Paid", tone: "success", icon: IconCircleCheck },
  pending: { label: "Pending", tone: "info", icon: IconClock },
  in_transit: { label: "On its way", tone: "info", icon: IconTruckDelivery },
  canceled: { label: "Canceled", tone: "neutral", icon: IconCircleX },
  failed: { label: "Failed", tone: "danger", icon: IconAlertTriangle },
};

function amounts(balances: Money[]) {
  if (balances.length === 0) return formatAmount(0, "usd");
  return balances
    .map(({ amount, currency }) => formatAmount(amount, currency))
    .join(" + ");
}

function BalanceSection({ children }: { children: ReactNode }) {
  return (
    <section className="grid gap-4" aria-labelledby="balance-heading">
      <SectionHeader id="balance-heading" title="Balance" />
      {children}
    </section>
  );
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
      <BalanceSection>
        <Notice tone="danger" role="alert">
          We couldn&apos;t reach Stripe to load your balance. Please try again
          in a moment.
        </Notice>
      </BalanceSection>
    );
  }

  return (
    <>
      <BalanceSection>
        <dl className="grid gap-6 rounded-surface bg-card p-5 shadow-level-1 sm:grid-cols-[auto_auto] sm:justify-start sm:gap-16 sm:p-6">
          <div className="grid content-end gap-2">
            <dt className="text-label text-ink-2">Available to pay out</dt>
            <dd className="text-figure-xl">{amounts(summary.available)}</dd>
          </div>
          <div className="grid content-end gap-1">
            <dt className="text-small text-ink-2">
              On the way to your balance
            </dt>
            <dd className="text-figure text-ink-2">
              {amounts(summary.pending)}
            </dd>
          </div>
        </dl>
      </BalanceSection>

      <section className="grid gap-4" aria-labelledby="payouts-heading">
        <SectionHeader id="payouts-heading" title="Recent payouts" />
        {summary.payouts.length === 0 ? (
          <p className="text-body text-ink-2">
            No payouts yet. Stripe pays out your available balance on its
            schedule.
          </p>
        ) : (
          <ul className="divide-y rounded-surface bg-card shadow-level-1">
            {summary.payouts.map((payout) => {
              // Stripe types the status as any string; one we don't know shows as it is.
              const status = payoutStatuses[payout.status] ?? {
                label: payout.status,
                tone: "neutral",
                icon: IconClock,
              };
              return (
                <li
                  key={payout.id}
                  className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 sm:px-5"
                >
                  <div className="grid gap-0.5">
                    <span className="font-semibold">
                      {formatAmount(payout.amount, payout.currency)}
                    </span>
                    <span className="text-small text-ink-3">
                      Arrives {formatDate(new Date(payout.arrivalDate * 1000))}
                    </span>
                  </div>
                  <Badge tone={status.tone} icon={status.icon}>
                    {status.label}
                  </Badge>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </>
  );
}

/** While Stripe answers: the figures' shape, shimmering only when motion is welcome. */
function PayoutDetailsLoading() {
  return (
    <BalanceSection>
      <div
        aria-busy="true"
        aria-label="Loading your balance"
        className="h-32 rounded-surface bg-surface-2 motion-safe:animate-pulse"
      />
    </BalanceSection>
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
      <PageBody>
        {accountId ? (
          <Suspense fallback={<PayoutDetailsLoading />}>
            <PayoutDetails businessId={business.id} accountId={accountId} />
          </Suspense>
        ) : (
          <BalanceSection>
            <EmptyState
              icon={IconBuildingBank}
              title="Connect payouts first."
              titleAs="h3"
              action={
                <Link
                  href={`/dashboard/b/${business.slug}`}
                  className={textLinkClass}
                >
                  Set up payouts
                </Link>
              }
            />
          </BalanceSection>
        )}

        {business.charges_enabled && (
          <div className="grid justify-items-start gap-3 rounded-surface bg-card p-5 shadow-level-1">
            <p className="text-body">
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
      </PageBody>
    </>
  );
}

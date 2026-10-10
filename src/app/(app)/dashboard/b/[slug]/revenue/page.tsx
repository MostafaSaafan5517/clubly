import { IconAlertTriangle, IconChartBar } from "@tabler/icons-react";
import type { Metadata } from "next";
import { BusinessHeader } from "@/app/(app)/dashboard/b/[slug]/business-header";
import { Badge } from "@/components/badge";
import { EmptyState } from "@/components/empty-state";
import { Notice } from "@/components/notice";
import { PageBody } from "@/components/page-body";
import { SectionHeader } from "@/components/section-header";
import { appConfig } from "@/config/app";
import { requireStaffBusiness } from "@/lib/business";
import { formatDate } from "@/lib/dates";
import { formatAmount } from "@/lib/money";

export const metadata: Metadata = { title: "Revenue" };

const WINDOW_DAYS = 30;
const RECENT_PAYMENTS = 20;

export default async function RevenuePage({
  params,
}: PageProps<"/dashboard/b/[slug]/revenue">) {
  const { slug } = await params;
  // Revenue is for owners and admins; RLS also hides payments from everyone else.
  const { supabase, business, role } = await requireStaffBusiness(
    slug,
    `/dashboard/b/${slug}/revenue`,
    ["owner", "admin"],
  );

  const [summaryResult, paymentsResult] = await Promise.all([
    supabase.rpc("business_revenue", {
      target_business_id: business.id,
      window_days: WINDOW_DAYS,
    }),
    supabase
      .from("payments")
      .select(
        `id, amount, application_fee, currency, status, paid_at, created_at,
         members (profiles (full_name, email))`,
      )
      .eq("business_id", business.id)
      .order("created_at", { ascending: false })
      .limit(RECENT_PAYMENTS),
  ]);
  if (summaryResult.error) {
    throw new Error(`Could not load revenue: ${summaryResult.error.message}`);
  }
  if (paymentsResult.error) {
    throw new Error(`Could not load payments: ${paymentsResult.error.message}`);
  }
  const summaries = summaryResult.data;
  const payments = paymentsResult.data;

  return (
    <>
      <BusinessHeader business={business} role={role} current="revenue" />
      <PageBody>
        <section className="grid gap-4" aria-labelledby="revenue-heading">
          <SectionHeader
            id="revenue-heading"
            title="Revenue"
            description="Recurring revenue counts active subscriptions (yearly plans at a twelfth of their price), including ones whose payment Stripe is retrying. Trials count once they pay."
          />
          {summaries.length === 0 ? (
            <EmptyState
              icon={IconChartBar}
              title="No revenue yet."
              titleAs="h3"
            >
              Figures appear here once members subscribe.
            </EmptyState>
          ) : (
            summaries.map((summary) => (
              // One number leads (DESIGN.md, Figures); the rest read as an equation: paid, minus
              // the fee, is what reaches the balance. Two plain lists, so each holds only its
              // term and description pairs; the signs are drawn by CSS and not read out.
              <div
                key={summary.currency}
                role="group"
                aria-label={`Revenue in ${summary.currency.toUpperCase()}`}
                className="grid gap-4"
              >
                <div className="grid gap-6 rounded-surface bg-card p-5 shadow-level-1 sm:p-6">
                  <dl>
                    <div className="grid gap-2">
                      <dt className="text-label text-ink-2">
                        Monthly recurring revenue
                      </dt>
                      <dd className="text-figure-xl">
                        {formatAmount(
                          summary.monthly_recurring_revenue,
                          summary.currency,
                        )}
                      </dd>
                    </div>
                  </dl>
                  <dl className="grid gap-4 border-t pt-5 sm:grid-cols-3 sm:gap-10">
                    <div className="grid content-end gap-1">
                      <dt className="text-small text-ink-2">
                        Paid in the last {WINDOW_DAYS} days
                      </dt>
                      <dd className="text-figure">
                        {formatAmount(summary.gross_revenue, summary.currency)}
                      </dd>
                    </div>
                    <div className="relative grid content-end gap-1 sm:before:absolute sm:before:bottom-0.5 sm:before:-left-7 sm:before:text-heading sm:before:text-ink-3 sm:before:content-['−'_/_'']">
                      <dt className="text-small text-ink-2">
                        {appConfig.name} fees ({appConfig.applicationFeePercent}
                        %)
                      </dt>
                      <dd className="text-figure text-ink-2">
                        {formatAmount(summary.platform_fees, summary.currency)}
                      </dd>
                    </div>
                    <div className="relative -m-2 grid content-end gap-1 rounded-control bg-volt-soft p-2 sm:before:absolute sm:before:bottom-2.5 sm:before:-left-5 sm:before:text-heading sm:before:text-ink-3 sm:before:content-['='_/_'']">
                      <dt className="text-small">Net to your Stripe balance</dt>
                      <dd className="text-figure">
                        {formatAmount(
                          summary.gross_revenue - summary.platform_fees,
                          summary.currency,
                        )}
                      </dd>
                    </div>
                  </dl>
                </div>
                {summary.failed_payments > 0 && (
                  <Notice tone="danger">
                    {summary.failed_payments} failed{" "}
                    {summary.failed_payments === 1 ? "payment" : "payments"} in
                    the last {WINDOW_DAYS} days. Stripe retries them
                    automatically, and the members can update their card from
                    their account page.
                  </Notice>
                )}
              </div>
            ))
          )}
        </section>

        <section className="grid gap-4" aria-labelledby="payments-heading">
          <SectionHeader id="payments-heading" title="Recent payments" />
          {payments.length === 0 ? (
            <p className="text-body text-ink-2">No payments yet.</p>
          ) : (
            <ul className="divide-y rounded-surface bg-card shadow-level-1">
              {payments.map((payment) => {
                const profile = payment.members.profiles;
                return (
                  <li
                    key={payment.id}
                    className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 px-4 py-3 sm:px-5"
                  >
                    <span className="truncate font-semibold">
                      {profile.full_name ?? profile.email}
                    </span>
                    <span className="text-right font-semibold">
                      {formatAmount(payment.amount, payment.currency)}
                    </span>
                    <span className="text-small text-ink-3">
                      {formatDate(payment.paid_at ?? payment.created_at)}
                    </span>
                    <span className="justify-self-end text-small text-ink-2">
                      {payment.status === "paid" ? (
                        <>
                          Paid,{" "}
                          {formatAmount(
                            payment.application_fee,
                            payment.currency,
                          )}{" "}
                          fee
                        </>
                      ) : (
                        <Badge tone="danger" icon={IconAlertTriangle}>
                          Failed
                        </Badge>
                      )}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </PageBody>
    </>
  );
}

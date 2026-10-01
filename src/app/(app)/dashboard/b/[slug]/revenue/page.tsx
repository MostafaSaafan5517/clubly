import type { Metadata } from "next";
import { BusinessHeader } from "@/app/(app)/dashboard/b/[slug]/business-header";
import { appConfig } from "@/config/app";
import { requireStaffBusiness } from "@/lib/business";
import { formatDate } from "@/lib/dates";
import { formatAmount } from "@/lib/money";

export const metadata: Metadata = { title: "Revenue" };

const WINDOW_DAYS = 30;
const RECENT_PAYMENTS = 20;

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-1 rounded-lg border p-4">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="text-2xl font-semibold tracking-tight">{value}</dd>
    </div>
  );
}

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

      <section className="grid gap-3" aria-labelledby="revenue-heading">
        <h2 id="revenue-heading" className="text-lg font-semibold">
          Revenue
        </h2>
        {summaries.length === 0 ? (
          <p className="rounded-lg border p-4 text-sm text-muted-foreground">
            No revenue yet. Figures appear here once members subscribe.
          </p>
        ) : (
          summaries.map((summary) => (
            <dl
              key={summary.currency}
              className="grid gap-3 sm:grid-cols-2"
              aria-label={`Revenue in ${summary.currency.toUpperCase()}`}
            >
              <Figure
                label="Monthly recurring revenue"
                value={formatAmount(
                  summary.monthly_recurring_revenue,
                  summary.currency,
                )}
              />
              <Figure
                label={`Paid in the last ${WINDOW_DAYS} days`}
                value={formatAmount(summary.gross_revenue, summary.currency)}
              />
              <Figure
                label={`${appConfig.name} fees (${appConfig.applicationFeePercent}%)`}
                value={formatAmount(summary.platform_fees, summary.currency)}
              />
              <Figure
                label="Net to your Stripe balance"
                value={formatAmount(
                  summary.gross_revenue - summary.platform_fees,
                  summary.currency,
                )}
              />
              {summary.failed_payments > 0 && (
                <p className="text-sm text-destructive sm:col-span-2">
                  {summary.failed_payments} failed{" "}
                  {summary.failed_payments === 1 ? "payment" : "payments"} in
                  the last {WINDOW_DAYS} days. Stripe retries them
                  automatically, and the members can update their card from
                  their account page.
                </p>
              )}
            </dl>
          ))
        )}
        <p className="text-sm text-muted-foreground">
          Recurring revenue counts active subscriptions (yearly plans at a
          twelfth of their price), including ones whose payment Stripe is
          retrying. Trials count once they pay.
        </p>
      </section>

      <section className="grid gap-3" aria-labelledby="payments-heading">
        <h2 id="payments-heading" className="text-lg font-semibold">
          Recent payments
        </h2>
        {payments.length === 0 ? (
          <p className="rounded-lg border p-4 text-sm text-muted-foreground">
            No payments yet.
          </p>
        ) : (
          <ul className="grid gap-2">
            {payments.map((payment) => {
              const profile = payment.members.profiles;
              return (
                <li
                  key={payment.id}
                  className="grid grid-cols-[1fr_auto] items-center gap-3 rounded-lg border p-3"
                >
                  <div className="grid min-w-0 gap-0.5">
                    <span className="truncate font-medium">
                      {profile.full_name ?? profile.email}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {formatDate(payment.paid_at ?? payment.created_at)}
                    </span>
                  </div>
                  <div className="grid justify-items-end gap-0.5 text-sm">
                    <span className="font-medium">
                      {formatAmount(payment.amount, payment.currency)}
                    </span>
                    {payment.status === "paid" ? (
                      <span className="text-xs text-muted-foreground">
                        Paid,{" "}
                        {formatAmount(
                          payment.application_fee,
                          payment.currency,
                        )}{" "}
                        fee
                      </span>
                    ) : (
                      <span className="text-xs font-medium text-destructive">
                        Failed
                      </span>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </>
  );
}

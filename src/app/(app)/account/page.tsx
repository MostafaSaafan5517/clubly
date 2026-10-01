import type { Metadata } from "next";
import Link from "next/link";
import { openBillingPortal } from "@/app/(app)/account/actions";
import { ConfirmingPayment } from "@/app/(app)/account/confirming-payment";
import { ActionButton } from "@/components/action-button";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
         status, current_period_end, cancel_at_period_end, created_at,
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
    <>
      <h1 className="text-2xl font-semibold tracking-tight">
        Your memberships
      </h1>

      {justJoined &&
        (joinConfirmed ? (
          <p role="status" className="rounded-lg border p-4">
            Welcome to {justJoined.businesses.name}! Your membership is active.
          </p>
        ) : (
          <ConfirmingPayment businessName={justJoined.businesses.name} />
        ))}

      {rows.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>You&apos;re not a member anywhere yet</CardTitle>
            <CardDescription>
              Businesses share their own join page with you. Your memberships
              show up here once you join.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <ul className="grid gap-4">
          {rows.map(({ id, status, businesses: business, subscription }) => {
            const summary = subscription && describeSubscription(subscription);
            return (
              <li key={id} className="grid gap-3 rounded-lg border p-5">
                <div className="grid gap-1">
                  <h2 className="font-medium">{business.name}</h2>
                  {subscription ? (
                    <p className="text-sm">
                      {subscription.plans.name},{" "}
                      {formatAmount(
                        subscription.plans.amount,
                        subscription.plans.currency,
                      )}{" "}
                      per {subscription.plans.billing_interval}
                    </p>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      You haven&apos;t chosen a plan yet.
                    </p>
                  )}
                </div>

                {summary && (
                  <p className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium">
                      {summary.label}
                    </span>
                    {summary.detail && (
                      <span className="text-muted-foreground">
                        {summary.detail}
                      </span>
                    )}
                  </p>
                )}
                {status === "suspended" && (
                  <p className="text-sm text-destructive">
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
    </>
  );
}

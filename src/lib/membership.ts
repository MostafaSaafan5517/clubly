import { formatDate } from "@/lib/dates";
import type { Enums } from "@/lib/supabase/database.types";

type SubscriptionStatus = Enums<"subscription_status">;

/**
 * Subscription statuses that still make someone a paying member. `past_due` counts: Stripe is
 * retrying the payment, and the member can fix it from the billing portal.
 */
export const LIVE_SUBSCRIPTION_STATUSES = [
  "active",
  "trialing",
  "past_due",
] as const satisfies readonly SubscriptionStatus[];

export function isLive(status: SubscriptionStatus) {
  return (LIVE_SUBSCRIPTION_STATUSES as readonly SubscriptionStatus[]).includes(
    status,
  );
}

/**
 * The subscription a membership is about right now: its live one if there is one, otherwise the
 * most recent (a canceled or expired one, kept as history). Null if the member never subscribed.
 */
export function currentSubscription<
  Subscription extends { status: SubscriptionStatus; created_at: string },
>(subscriptions: readonly Subscription[]): Subscription | null {
  const newestFirst = [...subscriptions].sort(
    (a, b) => Date.parse(b.created_at) - Date.parse(a.created_at),
  );
  return (
    newestFirst.find((subscription) => isLive(subscription.status)) ??
    newestFirst[0] ??
    null
  );
}

/** How a subscription reads to the member: a short status and, when useful, what happens next. */
export function describeSubscription(subscription: {
  status: SubscriptionStatus;
  current_period_end: string | null;
  cancel_at: string | null;
}): { label: string; detail: string | null } {
  const format = (date: string | null) => (date ? formatDate(date) : null);
  const periodEnd = format(subscription.current_period_end);
  const endsOn = format(subscription.cancel_at);
  // A scheduled end wins over the next renewal: that renewal won't happen.
  const endsOrRenews = (renewal: string) => {
    if (endsOn) return `Ends on ${endsOn}`;
    return periodEnd ? `${renewal} ${periodEnd}` : null;
  };

  switch (subscription.status) {
    case "active":
      return {
        label: endsOn ? "Canceling" : "Active",
        detail: endsOrRenews("Renews on"),
      };
    case "trialing":
      return { label: "Trial", detail: endsOrRenews("First payment on") };
    case "past_due":
      return {
        label: "Payment failed",
        detail: "Update your payment method to keep your membership.",
      };
    case "unpaid":
      return {
        label: "Unpaid",
        detail: "On hold until the latest invoice is paid.",
      };
    case "incomplete":
      return { label: "Payment pending", detail: null };
    case "incomplete_expired":
      return { label: "Payment not completed", detail: null };
    case "paused":
      return { label: "Paused", detail: null };
    case "canceled":
      return { label: "Ended", detail: null };
  }
}

/**
 * The badge tone for a subscription (DESIGN.md, Money and membership states): success while it
 * runs, warning while it's ending or not yet paid, info in a trial, danger when a payment failed,
 * and neutral once it's over or paused.
 */
export function subscriptionTone(subscription: {
  status: SubscriptionStatus;
  cancel_at: string | null;
}): "success" | "warning" | "info" | "danger" | "neutral" {
  switch (subscription.status) {
    case "active":
      return subscription.cancel_at ? "warning" : "success";
    case "trialing":
      return "info";
    case "past_due":
    case "unpaid":
      return "danger";
    case "incomplete":
      return "warning";
    case "incomplete_expired":
    case "paused":
    case "canceled":
      return "neutral";
  }
}

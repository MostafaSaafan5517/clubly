import {
  IconAlertTriangle,
  IconCircleCheck,
  IconCircleX,
  IconClockPause,
  IconHourglass,
  IconPlayerPause,
  type TablerIcon,
} from "@tabler/icons-react";
import { Badge } from "@/components/badge";
import type { Enums } from "@/lib/supabase/database.types";
import { describeSubscription, subscriptionTone } from "@/lib/membership";

const icons: Record<Enums<"subscription_status">, TablerIcon> = {
  active: IconCircleCheck,
  trialing: IconHourglass,
  past_due: IconAlertTriangle,
  unpaid: IconAlertTriangle,
  incomplete: IconHourglass,
  incomplete_expired: IconCircleX,
  paused: IconPlayerPause,
  canceled: IconCircleX,
};

/** A subscription's status as a badge: "Active", "Canceling", "Payment failed" and so on. */
export function SubscriptionBadge({
  subscription,
}: {
  subscription: Parameters<typeof describeSubscription>[0];
}) {
  const ending =
    subscription.status === "active" && subscription.cancel_at !== null;
  return (
    <Badge
      tone={subscriptionTone(subscription)}
      icon={ending ? IconClockPause : icons[subscription.status]}
    >
      {describeSubscription(subscription).label}
    </Badge>
  );
}

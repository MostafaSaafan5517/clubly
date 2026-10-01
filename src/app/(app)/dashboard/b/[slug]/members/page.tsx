import type { Metadata } from "next";
import { BusinessHeader } from "@/app/(app)/dashboard/b/[slug]/business-header";
import { setMemberStatus } from "@/app/(app)/dashboard/b/[slug]/members/actions";
import { ActionButton } from "@/components/action-button";
import { requireStaffBusiness } from "@/lib/business";
import { formatDate } from "@/lib/dates";
import {
  currentSubscription,
  describeSubscription,
  isLive,
} from "@/lib/membership";

export const metadata: Metadata = { title: "Members" };

function plural(count: number, noun: string) {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}

export default async function MembersPage({
  params,
}: PageProps<"/dashboard/b/[slug]/members">) {
  const { slug } = await params;
  const { supabase, business, role } = await requireStaffBusiness(
    slug,
    `/dashboard/b/${slug}/members`,
  );

  // Through RLS as the user: staff may read their business's members, the members' profiles,
  // their subscriptions and the plans those are for.
  const { data: members, error } = await supabase
    .from("members")
    .select(
      `id, status, created_at,
       profiles (full_name, email),
       subscriptions (
         status, current_period_end, cancel_at, created_at,
         plans (name)
       )`,
    )
    .eq("business_id", business.id)
    .order("created_at", { ascending: false });
  if (error) throw new Error(`Could not load members: ${error.message}`);

  const rows = members.map((member) => ({
    ...member,
    subscription: currentSubscription(member.subscriptions),
  }));
  const subscribed = rows.filter(
    (row) => row.subscription && isLive(row.subscription.status),
  ).length;
  const canManage = role !== "staff";

  return (
    <>
      <BusinessHeader business={business} role={role} current="members" />

      <section className="grid gap-3" aria-labelledby="members-heading">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="members-heading" className="text-lg font-semibold">
            Members
          </h2>
          <p className="text-sm text-muted-foreground">
            {plural(rows.length, "member")}, {subscribed} subscribed
          </p>
        </div>

        {rows.length === 0 ? (
          <p className="rounded-lg border p-4 text-sm text-muted-foreground">
            No members yet. People join from your public page.
          </p>
        ) : (
          <ul className="grid gap-3">
            {rows.map((row) => {
              const summary =
                row.subscription && describeSubscription(row.subscription);
              // The member-facing advice (e.g. "update your payment method") isn't for staff;
              // dates are.
              const showDetail =
                row.subscription?.status === "active" ||
                row.subscription?.status === "trialing";
              const suspended = row.status === "suspended";
              return (
                <li
                  key={row.id}
                  className="grid grid-cols-[1fr_auto] items-start gap-3 rounded-lg border p-4"
                >
                  <div className="grid min-w-0 gap-1">
                    <span className="font-medium">
                      {row.profiles.full_name ?? row.profiles.email}
                    </span>
                    {row.profiles.full_name && (
                      <span className="text-sm wrap-anywhere text-muted-foreground">
                        {row.profiles.email}
                      </span>
                    )}
                    <span className="text-sm">
                      {row.subscription?.plans.name ?? "No plan yet"}
                    </span>
                    <p className="flex flex-wrap items-center gap-2 text-sm">
                      {summary && (
                        <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium">
                          {summary.label}
                        </span>
                      )}
                      {suspended && (
                        <span className="rounded-full bg-destructive/10 px-2.5 py-1 text-xs font-medium text-destructive">
                          Suspended
                        </span>
                      )}
                      {showDetail && summary?.detail && (
                        <span className="text-muted-foreground">
                          {summary.detail}
                        </span>
                      )}
                    </p>
                    <span className="text-xs text-muted-foreground">
                      Joined {formatDate(row.created_at)}
                    </span>
                  </div>
                  {canManage && (
                    <ActionButton
                      action={setMemberStatus.bind(
                        null,
                        business.slug,
                        row.id,
                        suspended ? "active" : "suspended",
                      )}
                      label={suspended ? "Reactivate" : "Suspend"}
                      pendingLabel={
                        suspended ? "Reactivating..." : "Suspending..."
                      }
                      variant="outline"
                    />
                  )}
                </li>
              );
            })}
          </ul>
        )}

        {canManage && rows.length > 0 && (
          <p className="text-sm text-muted-foreground">
            A suspended member can&apos;t start a new membership here.
            Suspending doesn&apos;t change their billing: Stripe keeps charging
            any subscription they have until it&apos;s canceled.
          </p>
        )}
      </section>
    </>
  );
}

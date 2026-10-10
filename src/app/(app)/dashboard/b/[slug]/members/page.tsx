import { IconBan, IconUserPlus } from "@tabler/icons-react";
import type { Metadata } from "next";
import { BusinessHeader } from "@/app/(app)/dashboard/b/[slug]/business-header";
import { setMemberStatus } from "@/app/(app)/dashboard/b/[slug]/members/actions";
import { ActionButton } from "@/components/action-button";
import { Badge } from "@/components/badge";
import { EmptyState } from "@/components/empty-state";
import { PageBody } from "@/components/page-body";
import { SectionHeader } from "@/components/section-header";
import { SubscriptionBadge } from "@/components/subscription-badge";
import { requireStaffBusiness } from "@/lib/business";
import { formatDate } from "@/lib/dates";
import { initials } from "@/lib/names";
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
      <PageBody>
        <section className="grid gap-4" aria-labelledby="members-heading">
          <SectionHeader
            id="members-heading"
            title="Members"
            action={
              <p className="text-small text-ink-2">
                {plural(rows.length, "member")}, {subscribed} subscribed
              </p>
            }
          />

          {rows.length === 0 ? (
            <EmptyState
              icon={IconUserPlus}
              title="No members yet."
              titleAs="h3"
            >
              People join from your public page.
            </EmptyState>
          ) : (
            <ul className="divide-y rounded-surface bg-card shadow-level-1">
              {rows.map((row) => {
                const name = row.profiles.full_name ?? row.profiles.email;
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
                    className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-x-3 gap-y-2 px-4 py-4 sm:px-5 md:grid-cols-[auto_minmax(0,1.3fr)_minmax(0,1.6fr)_7.5rem] md:items-center md:[&_[role=alert]]:col-span-full md:[&>div>form>button]:justify-self-end"
                  >
                    <span
                      aria-hidden
                      className="grid size-10 place-items-center rounded-control bg-surface-3 text-label text-ink-2"
                    >
                      {initials(name)}
                    </span>
                    <div className="grid min-w-0 gap-0.5">
                      <span className="font-semibold">{name}</span>
                      {row.profiles.full_name && (
                        <span className="text-small wrap-anywhere text-ink-2">
                          {row.profiles.email}
                        </span>
                      )}
                      <span className="text-caption text-ink-3">
                        Joined {formatDate(row.created_at)}
                      </span>
                    </div>
                    <div className="col-span-2 grid gap-1.5 md:col-span-1">
                      <span className="text-small">
                        {row.subscription?.plans.name ?? "No plan yet"}
                      </span>
                      {(summary || suspended) && (
                        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-small text-ink-2">
                          {row.subscription && (
                            <SubscriptionBadge
                              subscription={row.subscription}
                            />
                          )}
                          {suspended && (
                            <Badge tone="danger" icon={IconBan}>
                              Suspended
                            </Badge>
                          )}
                          {showDetail && summary?.detail}
                        </p>
                      )}
                    </div>
                    {canManage && (
                      // On phones the button and any refusal stack under the member; from 768px
                      // the button takes the last column and a refusal gets a line of its own.
                      <div className="col-span-2 grid justify-items-start gap-2 md:contents">
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
                          variant={
                            suspended ? "outline" : "destructive-outline"
                          }
                          className="contents"
                        />
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}

          {canManage && rows.length > 0 && (
            <p className="max-w-[68ch] text-small text-ink-2">
              A suspended member can&apos;t start a new membership here.
              Suspending doesn&apos;t change their billing: Stripe keeps
              charging any subscription they have until it&apos;s canceled.
            </p>
          )}
        </section>
      </PageBody>
    </>
  );
}

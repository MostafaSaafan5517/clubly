import { IconArrowLeft, IconArrowRight } from "@tabler/icons-react";
import type { Metadata } from "next";
import Link from "next/link";
import { BusinessHeader } from "@/app/(app)/dashboard/b/[slug]/business-header";
import { PageBody } from "@/components/page-body";
import { SectionHeader } from "@/components/section-header";
import { buttonVariants } from "@/components/ui/button";
import {
  describeActor,
  describeChange,
  type Names,
  peopleIn,
} from "@/lib/audit";
import { requireStaffBusiness } from "@/lib/business";
import { formatDateTime } from "@/lib/dates";

export const metadata: Metadata = { title: "History" };

const PAGE_SIZE = 50;

export default async function HistoryPage({
  params,
  searchParams,
}: PageProps<"/dashboard/b/[slug]/history">) {
  const { slug } = await params;
  const { before } = await searchParams;
  // The history includes payments, so it's for owners and admins (RLS agrees).
  const { supabase, business, role } = await requireStaffBusiness(
    slug,
    `/dashboard/b/${slug}/history`,
    ["owner", "admin"],
  );

  // Pages go back from the oldest entry shown (`?before=<id>`), so entries added while
  // someone reads never shift what the next page shows.
  const beforeId =
    typeof before === "string" && /^\d{1,15}$/.test(before)
      ? Number(before)
      : null;
  let query = supabase
    .from("audit_log")
    .select(
      "id, actor, actor_user_id, table_name, action, changed_columns, old_data, new_data, created_at",
    )
    .eq("business_id", business.id)
    .order("id", { ascending: false })
    .limit(PAGE_SIZE + 1);
  if (beforeId !== null) query = query.lt("id", beforeId);
  const { data, error } = await query;
  if (error) throw new Error(`Could not load the history: ${error.message}`);
  const entries = data.slice(0, PAGE_SIZE);
  const olderFrom = data.length > PAGE_SIZE ? entries.at(-1)?.id : undefined;

  // Names for everyone the entries mention, read through RLS: someone this user can't see
  // (a former staff member, say) shows as "Someone".
  const { userIds, memberIds } = peopleIn(entries);
  const membersResult = memberIds.length
    ? await supabase.from("members").select("id, user_id").in("id", memberIds)
    : { data: [], error: null };
  if (membersResult.error) {
    throw new Error(`Could not load members: ${membersResult.error.message}`);
  }
  const userIdOfMember = new Map(
    membersResult.data.map((member) => [member.id, member.user_id]),
  );
  const allUserIds = [...new Set([...userIds, ...userIdOfMember.values()])];
  const profilesResult = allUserIds.length
    ? await supabase
        .from("profiles")
        .select("id, full_name, email")
        .in("id", allUserIds)
    : { data: [], error: null };
  if (profilesResult.error) {
    throw new Error(`Could not load names: ${profilesResult.error.message}`);
  }
  const nameOfUser = new Map(
    profilesResult.data.map((profile) => [
      profile.id,
      profile.full_name ?? profile.email,
    ]),
  );
  const names: Names = {
    user: (userId) => nameOfUser.get(userId) ?? "Someone",
    member: (memberId) => {
      const userId = userIdOfMember.get(memberId);
      return (userId && nameOfUser.get(userId)) || "A member";
    },
  };

  return (
    <>
      <BusinessHeader business={business} role={role} current="history" />
      <PageBody>
        <section className="grid gap-4" aria-labelledby="history-heading">
          <SectionHeader
            id="history-heading"
            title="History"
            description="Every change to this business, newest first. Entries can't be edited or deleted."
          />
          {entries.length === 0 ? (
            <p className="text-body text-ink-2">Nothing here yet.</p>
          ) : (
            <ol className="divide-y rounded-surface bg-card shadow-level-1">
              {entries.map((entry) => (
                <li key={entry.id} className="grid gap-1 px-4 py-3 sm:px-5">
                  <span className="font-semibold">
                    {describeChange(entry, names)}
                  </span>
                  <span className="text-small text-ink-3">
                    <span className="font-semibold text-ink-2">
                      {describeActor(entry, names)}
                    </span>{" "}
                    · {formatDateTime(entry.created_at)}
                  </span>
                </li>
              ))}
            </ol>
          )}
          {(beforeId !== null || olderFrom !== undefined) && (
            <div className="flex flex-wrap gap-3">
              {beforeId !== null && (
                <Link
                  href={`/dashboard/b/${business.slug}/history`}
                  className={buttonVariants({ variant: "outline" })}
                >
                  <IconArrowLeft stroke={1.75} aria-hidden />
                  Newest
                </Link>
              )}
              {olderFrom !== undefined && (
                <Link
                  href={`/dashboard/b/${business.slug}/history?before=${olderFrom}`}
                  className={buttonVariants({ variant: "outline" })}
                >
                  Older
                  <IconArrowRight stroke={1.75} aria-hidden />
                </Link>
              )}
            </div>
          )}
        </section>
      </PageBody>
    </>
  );
}

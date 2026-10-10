import type { Metadata } from "next";
import { BusinessHeader } from "@/app/(app)/dashboard/b/[slug]/business-header";
import {
  createInvite,
  removeFromTeam,
  revokeInvite,
  setStaffRole,
} from "@/app/(app)/dashboard/b/[slug]/team/actions";
import { InviteForm } from "@/app/(app)/dashboard/b/[slug]/team/invite-form";
import { ActionButton } from "@/components/action-button";
import { Badge } from "@/components/badge";
import { PageBody } from "@/components/page-body";
import { SectionHeader } from "@/components/section-header";
import { requireStaffBusiness } from "@/lib/business";
import { formatDate } from "@/lib/dates";
import { INVITE_LIFETIME_DAYS, isPending } from "@/lib/invites";
import { initials } from "@/lib/names";

export const metadata: Metadata = { title: "Team" };

const roleNames = { owner: "Owner", admin: "Admin", staff: "Staff" } as const;

export default async function TeamPage({
  params,
}: PageProps<"/dashboard/b/[slug]/team">) {
  const { slug } = await params;
  const { supabase, userId, business, role } = await requireStaffBusiness(
    slug,
    `/dashboard/b/${slug}/team`,
  );
  const canInvite = role !== "staff";

  // Through RLS as the user: staff see their colleagues and their profiles; only owners and
  // admins see invites (and never their token hashes).
  const [{ data: team, error }, { data: invites, error: invitesError }] =
    await Promise.all([
      supabase
        .from("business_staff")
        .select("user_id, role, created_at, profiles (full_name, email)")
        .eq("business_id", business.id)
        .order("role")
        .order("created_at"),
      canInvite
        ? supabase
            .from("staff_invites")
            .select("id, role, created_at, expires_at, accepted_at")
            .eq("business_id", business.id)
            .is("accepted_at", null)
            .order("created_at", { ascending: false })
        : Promise.resolve({ data: [], error: null }),
    ]);
  if (error) throw new Error(`Could not load the team: ${error.message}`);
  if (invitesError) {
    throw new Error(`Could not load invites: ${invitesError.message}`);
  }
  const openInvites = invites.filter((invite) => isPending(invite));

  // The team takes the wide column; inviting sits beside it on wide screens. Rows wrap rather
  // than keep columns, so a refused action's message takes a line of its own.
  return (
    <>
      <BusinessHeader business={business} role={role} current="team" />
      <PageBody>
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_24rem] lg:items-start">
          <section className="grid gap-4" aria-labelledby="team-heading">
            <SectionHeader id="team-heading" title="Team" />
            <ul className="divide-y rounded-surface bg-card shadow-level-1">
              {team.map((person) => {
                const isYou = person.user_id === userId;
                const name = person.profiles.full_name ?? person.profiles.email;
                // What the viewer may do to this person, mirroring the business_staff policies.
                const canChangeRole =
                  role === "owner" && person.role !== "owner";
                const canRemove =
                  !isYou &&
                  person.role !== "owner" &&
                  (role === "owner" ||
                    (role === "admin" && person.role === "staff"));
                const canLeave = isYou && person.role !== "owner";
                return (
                  <li
                    key={person.user_id}
                    className="flex flex-wrap items-center gap-3 px-4 py-4 sm:px-5"
                  >
                    <span
                      aria-hidden
                      className="hidden size-10 shrink-0 place-items-center rounded-control bg-surface-3 text-label text-ink-2 sm:grid"
                    >
                      {initials(name)}
                    </span>
                    <div className="grid min-w-0 flex-1 basis-56 gap-1">
                      <span className="font-semibold">
                        {name}
                        {isYou && (
                          <span className="font-normal text-ink-3"> (you)</span>
                        )}
                      </span>
                      {person.profiles.full_name && (
                        <span className="text-small wrap-anywhere text-ink-2">
                          {person.profiles.email}
                        </span>
                      )}
                      <p className="flex flex-wrap items-center gap-2 text-caption text-ink-3">
                        <Badge tone="neutral">{roleNames[person.role]}</Badge>
                        Since {formatDate(person.created_at)}
                      </p>
                    </div>
                    {(canChangeRole || canRemove || canLeave) && (
                      <div className="flex flex-wrap gap-2">
                        {canChangeRole && (
                          <ActionButton
                            action={setStaffRole.bind(
                              null,
                              business.slug,
                              person.user_id,
                              person.role === "admin" ? "staff" : "admin",
                            )}
                            label={
                              person.role === "admin"
                                ? "Make staff"
                                : "Make admin"
                            }
                            pendingLabel="Changing..."
                            variant="outline"
                          />
                        )}
                        {canRemove && (
                          <ActionButton
                            action={removeFromTeam.bind(
                              null,
                              business.slug,
                              person.user_id,
                            )}
                            label="Remove"
                            pendingLabel="Removing..."
                            variant="destructive-outline"
                          />
                        )}
                        {canLeave && (
                          <ActionButton
                            action={removeFromTeam.bind(
                              null,
                              business.slug,
                              person.user_id,
                            )}
                            label="Leave this business"
                            pendingLabel="Leaving..."
                            variant="destructive-outline"
                          />
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>

          {canInvite && (
            <div className="grid gap-10">
              <section className="grid gap-4" aria-labelledby="invite-heading">
                <SectionHeader
                  id="invite-heading"
                  title="Invite someone"
                  description="Create a link and send it to them. They sign in (or sign up), open it, and join with the role you chose."
                />
                <div className="rounded-surface bg-card p-5 shadow-level-1">
                  <InviteForm
                    action={createInvite.bind(null, business.slug)}
                    roles={role === "owner" ? ["staff", "admin"] : ["staff"]}
                    lifetimeDays={INVITE_LIFETIME_DAYS}
                  />
                </div>
              </section>

              {openInvites.length > 0 && (
                <section
                  className="grid gap-4"
                  aria-labelledby="open-invites-heading"
                >
                  <SectionHeader
                    id="open-invites-heading"
                    title="Open invites"
                  />
                  <ul className="divide-y rounded-surface bg-card shadow-level-1">
                    {openInvites.map((invite) => (
                      <li
                        key={invite.id}
                        className="flex flex-wrap items-center gap-3 px-4 py-3 sm:px-5"
                      >
                        <div className="grid min-w-0 flex-1 basis-48 gap-0.5">
                          <span className="font-semibold">
                            Invite for a new {invite.role}
                          </span>
                          <span className="text-small text-ink-2">
                            Created {formatDate(invite.created_at)}, works until{" "}
                            {formatDate(invite.expires_at)}
                          </span>
                        </div>
                        {(role === "owner" || invite.role === "staff") && (
                          <ActionButton
                            action={revokeInvite.bind(
                              null,
                              business.slug,
                              invite.id,
                            )}
                            label="Revoke"
                            pendingLabel="Revoking..."
                            variant="destructive-outline"
                          />
                        )}
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </div>
          )}
        </div>
      </PageBody>
    </>
  );
}

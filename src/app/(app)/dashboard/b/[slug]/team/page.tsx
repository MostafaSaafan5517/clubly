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
import { requireStaffBusiness } from "@/lib/business";
import { formatDate } from "@/lib/dates";
import { INVITE_LIFETIME_DAYS, isPending } from "@/lib/invites";

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

  return (
    <>
      <BusinessHeader business={business} role={role} current="team" />

      <section className="grid gap-3" aria-labelledby="team-heading">
        <h2 id="team-heading" className="text-lg font-semibold">
          Team
        </h2>
        <ul className="grid gap-3">
          {team.map((person) => {
            const isYou = person.user_id === userId;
            // What the viewer may do to this person, mirroring the business_staff policies.
            const canChangeRole = role === "owner" && person.role !== "owner";
            const canRemove =
              !isYou &&
              person.role !== "owner" &&
              (role === "owner" ||
                (role === "admin" && person.role === "staff"));
            const canLeave = isYou && person.role !== "owner";
            return (
              <li
                key={person.user_id}
                className="grid gap-3 rounded-lg border p-4 sm:grid-cols-[1fr_auto] sm:items-start"
              >
                <div className="grid min-w-0 gap-1">
                  <span className="font-medium">
                    {person.profiles.full_name ?? person.profiles.email}
                    {isYou && (
                      <span className="text-muted-foreground"> (you)</span>
                    )}
                  </span>
                  {person.profiles.full_name && (
                    <span className="text-sm wrap-anywhere text-muted-foreground">
                      {person.profiles.email}
                    </span>
                  )}
                  <p className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium">
                      {roleNames[person.role]}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      Since {formatDate(person.created_at)}
                    </span>
                  </p>
                </div>
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
                        person.role === "admin" ? "Make staff" : "Make admin"
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
                      variant="outline"
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
                      variant="outline"
                    />
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      {canInvite && (
        <section className="grid gap-3" aria-labelledby="invite-heading">
          <div className="grid gap-1">
            <h2 id="invite-heading" className="text-lg font-semibold">
              Invite someone
            </h2>
            <p className="text-sm text-muted-foreground">
              Create a link and send it to them. They sign in (or sign up), open
              it, and join with the role you chose.
            </p>
          </div>
          <InviteForm
            action={createInvite.bind(null, business.slug)}
            roles={role === "owner" ? ["staff", "admin"] : ["staff"]}
            lifetimeDays={INVITE_LIFETIME_DAYS}
          />
        </section>
      )}

      {canInvite && openInvites.length > 0 && (
        <section className="grid gap-3" aria-labelledby="open-invites-heading">
          <h2 id="open-invites-heading" className="text-lg font-semibold">
            Open invites
          </h2>
          <ul className="grid gap-3">
            {openInvites.map((invite) => (
              <li
                key={invite.id}
                className="grid grid-cols-[1fr_auto] items-center gap-3 rounded-lg border p-4"
              >
                <div className="grid gap-1 text-sm">
                  <span className="font-medium">
                    Invite for a new {invite.role}
                  </span>
                  <span className="text-muted-foreground">
                    Created {formatDate(invite.created_at)}, works until{" "}
                    {formatDate(invite.expires_at)}
                  </span>
                </div>
                {(role === "owner" || invite.role === "staff") && (
                  <ActionButton
                    action={revokeInvite.bind(null, business.slug, invite.id)}
                    label="Revoke"
                    pendingLabel="Revoking..."
                    variant="outline"
                  />
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}

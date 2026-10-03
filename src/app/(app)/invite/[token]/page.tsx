import type { Metadata } from "next";
import { acceptInvite } from "@/app/(app)/invite/[token]/actions";
import { ActionButton } from "@/components/action-button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { requireUser } from "@/lib/auth";
import { formatDate } from "@/lib/dates";

export const metadata: Metadata = { title: "Join a team" };

const roleDescriptions = {
  admin:
    "As an admin you'll manage plans, members and staff, and see revenue and history.",
  staff: "As staff you'll see the business's members.",
} as const;

// Where invite links lead. Visitors sign in (or sign up) first and come back here.
export default async function InvitePage({
  params,
}: PageProps<"/invite/[token]">) {
  const { token } = await params;
  const { supabase } = await requireUser(`/invite/${token}`);

  // Only the holder of a valid link learns what it's for; nothing comes back otherwise.
  const { data, error } = await supabase.rpc("staff_invite_details", {
    invite_token: token,
  });
  if (error) throw new Error(`Could not read the invite: ${error.message}`);
  const invite = data[0];

  if (!invite || invite.role === "owner") {
    return (
      <Card className="mx-auto w-full max-w-md">
        <CardHeader>
          <CardTitle>This invite link doesn&apos;t work</CardTitle>
          <CardDescription>
            It may have been used already, revoked, or expired. Ask whoever sent
            it for a new one.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card className="mx-auto w-full max-w-md">
      <CardHeader>
        <CardTitle>Join {invite.business_name}</CardTitle>
        <CardDescription>
          You&apos;ve been invited to join the team as {invite.role}.{" "}
          {roleDescriptions[invite.role]}
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <ActionButton
          action={acceptInvite.bind(null, token)}
          label="Accept invite"
          pendingLabel="Joining..."
        />
        <p className="text-sm text-muted-foreground">
          The link works once, until {formatDate(invite.expires_at)}.
        </p>
      </CardContent>
    </Card>
  );
}

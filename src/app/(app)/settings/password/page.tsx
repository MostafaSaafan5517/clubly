import type { Metadata } from "next";
import { PasswordForm } from "@/app/(app)/settings/password/password-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { requireUser, SIGNED_IN_HOME } from "@/lib/auth";
import { cameFromEmailLink } from "@/lib/password";

export const metadata: Metadata = { title: "Change your password" };

// Also where a password reset link lands (/auth/confirm signs the user in first). The action
// makes the same check again: what the page shows is only a convenience.
export default async function PasswordPage() {
  const { claims } = await requireUser("/settings/password");
  const fromEmailLink = cameFromEmailLink(claims);

  return (
    <Card className="mx-auto w-full max-w-md">
      <CardHeader>
        <CardTitle as="h1">
          {fromEmailLink ? "Choose a new password" : "Change your password"}
        </CardTitle>
        <CardDescription>
          {fromEmailLink
            ? "You came from a link in your email, so your current password isn't needed."
            : "Enter your current password, then the new one."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <PasswordForm
          askForCurrent={!fromEmailLink}
          continueHref={SIGNED_IN_HOME}
        />
      </CardContent>
    </Card>
  );
}

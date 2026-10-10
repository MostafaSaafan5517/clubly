import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ForgotPasswordForm } from "@/app/(auth)/forgot-password/forgot-password-form";
import { textLinkClass } from "@/components/text-link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { appConfig } from "@/config/app";

export const metadata: Metadata = { title: "Reset your password" };

export default function ForgotPasswordPage() {
  // Where this deployment can't send email, there's no such page. Signed-in users may want it
  // too (they've forgotten the password their session doesn't need), so it doesn't send them
  // away.
  if (!appConfig.authEmails) notFound();

  return (
    <Card>
      <CardHeader>
        <CardTitle as="h1">Reset your password</CardTitle>
        <CardDescription>
          We&apos;ll email you a link to choose a new one.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <ForgotPasswordForm />
        <p className="text-center text-small text-ink-2">
          <Link href="/login" className={textLinkClass}>
            Back to sign in
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}

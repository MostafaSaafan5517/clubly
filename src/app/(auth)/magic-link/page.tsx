import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { MagicLinkForm } from "@/app/(auth)/magic-link/magic-link-form";
import { readNext, withNext } from "@/app/(auth)/next-param";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { appConfig } from "@/config/app";
import { SIGNED_IN_HOME } from "@/lib/auth";
import { safeRedirectPath } from "@/lib/safe-redirect";
import { createServerComponentClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Sign in with an email link" };

export default async function MagicLinkPage({
  searchParams,
}: PageProps<"/magic-link">) {
  // Where this deployment can't send email, there's no such page.
  if (!appConfig.authEmails) notFound();
  const nextPath = readNext((await searchParams).next);
  const supabase = await createServerComponentClient();
  const { data } = await supabase.auth.getClaims();
  if (data) redirect(safeRedirectPath(nextPath, SIGNED_IN_HOME));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Sign in with an email link</CardTitle>
        <CardDescription>
          No password needed. We&apos;ll email you a link that signs you in.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <MagicLinkForm next={nextPath} />
        <p className="text-center text-sm text-muted-foreground">
          <Link
            href={withNext("/login", nextPath)}
            className="text-foreground underline"
          >
            Sign in with your password instead
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}

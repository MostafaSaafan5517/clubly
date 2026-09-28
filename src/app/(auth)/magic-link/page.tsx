import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { MagicLinkForm } from "@/app/(auth)/magic-link/magic-link-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { createServerComponentClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Sign in with an email link" };

export default async function MagicLinkPage() {
  const supabase = await createServerComponentClient();
  const { data } = await supabase.auth.getClaims();
  if (data) redirect("/dashboard");

  return (
    <Card>
      <CardHeader>
        <CardTitle>Sign in with an email link</CardTitle>
        <CardDescription>
          No password needed. We&apos;ll email you a link that signs you in.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <MagicLinkForm />
        <p className="text-center text-sm text-muted-foreground">
          <Link href="/login" className="text-foreground underline">
            Sign in with your password instead
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}

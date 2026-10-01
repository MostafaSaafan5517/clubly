import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { readNext, withNext } from "@/app/(auth)/next-param";
import { SignUpForm } from "@/app/(auth)/signup/signup-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { safeRedirectPath } from "@/lib/safe-redirect";
import { createServerComponentClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Create your account" };

export default async function SignUpPage({
  searchParams,
}: PageProps<"/signup">) {
  const nextPath = readNext((await searchParams).next);
  const supabase = await createServerComponentClient();
  const { data } = await supabase.auth.getClaims();
  if (data) redirect(safeRedirectPath(nextPath, "/dashboard"));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Create your account</CardTitle>
        <CardDescription>
          Run your memberships, or join a club you love.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <SignUpForm next={nextPath} />
        <p className="text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link
            href={withNext("/login", nextPath)}
            className="text-foreground underline"
          >
            Sign in
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}

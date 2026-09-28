import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { SignUpForm } from "@/app/(auth)/signup/signup-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { createServerComponentClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Create your account" };

export default async function SignUpPage() {
  const supabase = await createServerComponentClient();
  const { data } = await supabase.auth.getClaims();
  if (data) redirect("/dashboard");

  return (
    <Card>
      <CardHeader>
        <CardTitle>Create your account</CardTitle>
        <CardDescription>
          Run your memberships, or join a club you love.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <SignUpForm />
        <p className="text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link href="/login" className="text-foreground underline">
            Sign in
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}

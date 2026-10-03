import type { Metadata } from "next";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { requireUser } from "@/lib/auth";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const { supabase, userId } = await requireUser("/settings");
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("email, full_name")
    .eq("id", userId)
    .single();
  if (error) throw new Error(`Could not load your profile: ${error.message}`);

  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>

      <section aria-labelledby="account-heading" className="grid gap-3">
        <h2 id="account-heading" className="text-lg font-semibold">
          Your account
        </h2>
        <dl className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-[auto_1fr]">
          <dt className="text-muted-foreground">Name</dt>
          <dd>{profile.full_name ?? "Not set"}</dd>
          <dt className="text-muted-foreground">Email</dt>
          <dd className="break-all">{profile.email}</dd>
        </dl>
      </section>

      <section aria-labelledby="password-heading" className="grid gap-3">
        <h2 id="password-heading" className="text-lg font-semibold">
          Password
        </h2>
        <div>
          <Link
            href="/settings/password"
            className={buttonVariants({ variant: "outline" })}
          >
            Change password
          </Link>
        </div>
      </section>
    </>
  );
}

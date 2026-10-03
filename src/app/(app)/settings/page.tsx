import type { Metadata } from "next";
import Link from "next/link";
import {
  DeleteAccountForm,
  NameForm,
} from "@/app/(app)/settings/settings-forms";
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
        <div className="grid gap-4 rounded-lg border p-4">
          <NameForm currentName={profile.full_name ?? ""} />
          <p className="grid gap-1 text-sm">
            <span className="font-medium">Email</span>
            <span className="break-all text-muted-foreground">
              {profile.email}
            </span>
          </p>
        </div>
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

      <section aria-labelledby="delete-heading" className="grid gap-3">
        <h2 id="delete-heading" className="text-lg font-semibold">
          Delete your account
        </h2>
        <div className="grid gap-4 rounded-lg border p-4">
          <p className="text-sm text-muted-foreground">
            This can&apos;t be undone. You&apos;ll be taken off any team
            you&apos;re on. While you own a business or hold a membership, your
            account stays: a business needs its owner, and businesses keep their
            members&apos; billing records.
          </p>
          <DeleteAccountForm email={profile.email} />
        </div>
      </section>
    </>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import {
  DeleteAccountForm,
  NameForm,
} from "@/app/(app)/settings/settings-forms";
import { PageBody } from "@/components/page-body";
import { SectionHeader } from "@/components/section-header";
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
    <PageBody width="narrow">
      <h1 className="text-title">Settings</h1>

      <section aria-labelledby="account-heading" className="grid gap-4">
        <SectionHeader id="account-heading" title="Your account" />
        <div className="grid gap-5 rounded-surface bg-card p-5 shadow-level-1">
          <NameForm currentName={profile.full_name ?? ""} />
          <p className="grid gap-1">
            <span className="text-label">Email</span>
            <span className="text-body break-all text-ink-2">
              {profile.email}
            </span>
          </p>
        </div>
      </section>

      <section aria-labelledby="password-heading" className="grid gap-4">
        <SectionHeader id="password-heading" title="Password" />
        <div>
          <Link
            href="/settings/password"
            className={buttonVariants({ variant: "outline" })}
          >
            Change password
          </Link>
        </div>
      </section>

      <section aria-labelledby="delete-heading" className="grid gap-4">
        <SectionHeader
          id="delete-heading"
          title="Delete your account"
          description="This can't be undone. You'll be taken off any team you're on. While you own a business or hold a membership, your account stays: a business needs its owner, and businesses keep their members' billing records."
        />
        {/* Danger-toned (DESIGN.md, The pages): the one thing on this page that can't be undone. */}
        <div className="rounded-surface bg-danger-soft p-5">
          <DeleteAccountForm email={profile.email} />
        </div>
      </section>
    </PageBody>
  );
}

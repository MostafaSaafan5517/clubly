import {
  IconAlertTriangle,
  IconBuildingStore,
  IconPlus,
} from "@tabler/icons-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Badge } from "@/components/badge";
import { EmptyState } from "@/components/empty-state";
import { PageBody } from "@/components/page-body";
import { SectionHeader } from "@/components/section-header";
import { buttonVariants } from "@/components/ui/button";
import { requireUser } from "@/lib/auth";

export const metadata: Metadata = { title: "Dashboard" };

const roleLabels = { owner: "Owner", admin: "Admin", staff: "Staff" } as const;

export default async function DashboardPage() {
  const { supabase, userId } = await requireUser("/dashboard");

  // Both reads go through RLS as the signed-in user: their own profile, and only the
  // businesses where they are staff.
  const [profileResult, staffResult] = await Promise.all([
    supabase
      .from("profiles")
      .select("full_name, email")
      .eq("id", userId)
      .single(),
    supabase
      .from("business_staff")
      .select("role, businesses(id, name, slug, charges_enabled)")
      .eq("user_id", userId)
      .order("created_at"),
  ]);
  if (profileResult.error) {
    throw new Error(
      `Could not load your profile: ${profileResult.error.message}`,
    );
  }
  if (staffResult.error) {
    throw new Error(
      `Could not load your businesses: ${staffResult.error.message}`,
    );
  }
  const profile = profileResult.data;
  const staffRoles = staffResult.data;

  return (
    <PageBody width="narrow">
      <div className="grid gap-1">
        <h1 className="text-title">
          Welcome{profile.full_name ? `, ${profile.full_name}` : ""}
        </h1>
        <p className="text-body break-all text-ink-2">
          Signed in as {profile.email}
        </p>
      </div>

      {staffRoles.length === 0 ? (
        <EmptyState
          icon={IconBuildingStore}
          title="You don't have a business yet"
          action={
            <Link href="/dashboard/new-business" className={buttonVariants()}>
              <IconPlus stroke={1.75} aria-hidden />
              Create a business
            </Link>
          }
        >
          Create one to set up membership plans and start taking members.
        </EmptyState>
      ) : (
        <section className="grid gap-4" aria-labelledby="businesses-heading">
          <SectionHeader
            id="businesses-heading"
            title="Your businesses"
            action={
              <Link
                href="/dashboard/new-business"
                className={buttonVariants({ variant: "outline" })}
              >
                <IconPlus stroke={1.75} aria-hidden />
                New business
              </Link>
            }
          />
          <ul className="divide-y rounded-surface bg-card shadow-level-1">
            {staffRoles.map(({ role, businesses: business }) => (
              <li
                key={business.id}
                className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3 sm:px-5"
              >
                <div className="grid gap-0.5">
                  <Link
                    href={`/dashboard/b/${business.slug}`}
                    className="font-semibold underline-offset-4 hover:underline"
                  >
                    {business.name}
                  </Link>
                  <span className="text-small text-ink-2">
                    {roleLabels[role]}
                  </span>
                </div>
                {!business.charges_enabled && (
                  <Badge tone="warning" icon={IconAlertTriangle}>
                    Payments not set up
                  </Badge>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </PageBody>
  );
}

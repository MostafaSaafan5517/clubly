import type { Metadata } from "next";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
    <>
      <div className="grid gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">
          Welcome{profile.full_name ? `, ${profile.full_name}` : ""}
        </h1>
        <p className="text-muted-foreground">Signed in as {profile.email}</p>
      </div>

      {staffRoles.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>You don&apos;t have a business yet</CardTitle>
            <CardDescription>
              Create one to set up membership plans and start taking members.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/dashboard/new-business" className={buttonVariants()}>
              Create a business
            </Link>
          </CardContent>
        </Card>
      ) : (
        <section className="grid gap-3" aria-labelledby="businesses-heading">
          <div className="flex items-center justify-between gap-4">
            <h2 id="businesses-heading" className="text-lg font-semibold">
              Your businesses
            </h2>
            <Link
              href="/dashboard/new-business"
              className={buttonVariants({ variant: "outline" })}
            >
              New business
            </Link>
          </div>
          <ul className="grid gap-3">
            {staffRoles.map(({ role, businesses: business }) => (
              <li
                key={business.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-4"
              >
                <div className="grid gap-0.5">
                  <Link
                    href={`/dashboard/b/${business.slug}`}
                    className="font-medium underline-offset-4 hover:underline"
                  >
                    {business.name}
                  </Link>
                  <span className="text-sm text-muted-foreground">
                    {roleLabels[role]}
                  </span>
                </div>
                {!business.charges_enabled && (
                  <span className="rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground">
                    Payments not set up
                  </span>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}

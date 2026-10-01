import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { formatAmount } from "@/lib/money";

export const metadata: Metadata = { title: "Business" };

const roleDescriptions = {
  owner: "You own this business.",
  admin: "You're an admin here.",
  staff: "You're on the staff here.",
} as const;

export default async function BusinessPage({
  params,
}: PageProps<"/dashboard/b/[slug]">) {
  const { slug } = await params;
  const { supabase, userId } = await requireUser(`/dashboard/b/${slug}`);

  // Staff only. Reading the business alone isn't enough: once a business takes payments, RLS
  // lets every signed-in user read its public details for the join page. A 404 (not a 403)
  // also avoids confirming that a business exists to someone who doesn't work there.
  const { data: staffRow, error } = await supabase
    .from("business_staff")
    .select("role, businesses!inner(id, name, slug, charges_enabled)")
    .eq("user_id", userId)
    .eq("businesses.slug", slug)
    .maybeSingle();
  if (error) throw new Error(`Could not load the business: ${error.message}`);
  if (!staffRow) notFound();

  const business = staffRow.businesses;
  const { data: plans, error: plansError } = await supabase
    .from("plans")
    .select("id, name, billing_interval, amount, currency, active")
    .eq("business_id", business.id)
    .order("created_at");
  if (plansError) {
    throw new Error(`Could not load plans: ${plansError.message}`);
  }

  return (
    <>
      <div className="grid gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">
          {business.name}
        </h1>
        <p className="text-muted-foreground">
          {roleDescriptions[staffRow.role]}
        </p>
      </div>

      <section className="grid gap-3" aria-labelledby="plans-heading">
        <h2 id="plans-heading" className="text-lg font-semibold">
          Plans
        </h2>
        {plans.length === 0 ? (
          <p className="rounded-lg border p-4 text-sm text-muted-foreground">
            No plans yet.
          </p>
        ) : (
          <ul className="grid gap-3">
            {plans.map((plan) => (
              <li
                key={plan.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-4"
              >
                <div className="grid gap-0.5">
                  <span className="font-medium">{plan.name}</span>
                  <span className="text-sm text-muted-foreground">
                    {formatAmount(plan.amount, plan.currency)} per{" "}
                    {plan.billing_interval}
                  </span>
                </div>
                {!plan.active && (
                  <span className="rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground">
                    Archived
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

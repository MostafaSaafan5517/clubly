import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import { appConfig } from "@/config/app";
import { formatAmount } from "@/lib/money";
import { createServerComponentClient } from "@/lib/supabase/server";

// The public join page. Everyone sees the same thing, signed in or not: a business that can
// take payments, and its plans that can actually be bought. RLS already limits visitors to
// that; the explicit filters keep staff (who can see more) on the same page.
const getJoinPage = cache(async (slug: string) => {
  const supabase = await createServerComponentClient();
  const { data: business, error } = await supabase
    .from("businesses")
    .select("id, name, slug")
    .eq("slug", slug)
    .eq("charges_enabled", true)
    .maybeSingle();
  if (error) throw new Error(`Could not load the business: ${error.message}`);
  if (!business) return null;

  const { data: plans, error: plansError } = await supabase
    .from("plans")
    .select("id, name, billing_interval, amount, currency")
    .eq("business_id", business.id)
    .eq("active", true)
    .eq("has_stripe_price", true)
    .order("amount");
  if (plansError) {
    throw new Error(`Could not load plans: ${plansError.message}`);
  }
  return { business, plans };
});

export async function generateMetadata({
  params,
}: PageProps<"/b/[slug]">): Promise<Metadata> {
  const page = await getJoinPage((await params).slug);
  if (!page) return { title: "Not found" };
  return {
    title: `Join ${page.business.name}`,
    description: `Memberships at ${page.business.name}, billed through ${appConfig.name}.`,
  };
}

export default async function JoinPage({ params }: PageProps<"/b/[slug]">) {
  const page = await getJoinPage((await params).slug);
  if (!page) notFound();
  const { business, plans } = page;

  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b px-4 py-3 sm:px-6">
        <Link href="/" className="font-semibold tracking-tight">
          {appConfig.name}
        </Link>
      </header>
      <main className="mx-auto grid w-full max-w-3xl gap-8 p-4 sm:p-6">
        <div className="grid gap-1">
          <h1 className="text-3xl font-semibold tracking-tight">
            {business.name}
          </h1>
          <p className="text-muted-foreground">Choose a membership.</p>
        </div>

        {plans.length === 0 ? (
          <p className="rounded-lg border p-4 text-sm text-muted-foreground">
            No memberships are available right now.
          </p>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2">
            {plans.map((plan) => (
              <li key={plan.id} className="grid gap-2 rounded-lg border p-5">
                <h2 className="font-medium">{plan.name}</h2>
                <p>
                  <span className="text-2xl font-semibold">
                    {formatAmount(plan.amount, plan.currency)}
                  </span>{" "}
                  <span className="text-muted-foreground">
                    per {plan.billing_interval}
                  </span>
                </p>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}

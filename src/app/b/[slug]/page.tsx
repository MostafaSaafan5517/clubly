import { IconTicket } from "@tabler/icons-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import { joinPlan } from "@/app/b/[slug]/actions";
import { ActionButton } from "@/components/action-button";
import { AppMark } from "@/components/app-mark";
import { EmptyState } from "@/components/empty-state";
import { Notice } from "@/components/notice";
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

export default async function JoinPage({
  params,
  searchParams,
}: PageProps<"/b/[slug]">) {
  const page = await getJoinPage((await params).slug);
  const { checkout } = await searchParams;
  if (!page) notFound();
  const { business, plans } = page;

  // The business leads (DESIGN.md, The join page): its name is the sign on the band, and the app
  // is only the small mark that leads home. Plans read like the price board at the front desk.
  return (
    <div className="flex flex-1 flex-col">
      <header className="band">
        <div className="mx-auto max-w-[960px] px-4 pt-4 sm:px-8">
          <Link href="/" className="inline-flex rounded-control">
            <AppMark />
          </Link>
        </div>
      </header>
      <main className="flex flex-1 flex-col">
        <div className="band">
          <div className="mx-auto grid max-w-[960px] gap-3 px-4 pt-10 pb-10 sm:px-8 sm:pt-16">
            <h1 className="text-display text-balance">{business.name}</h1>
            <p className="text-lead text-on-band-2">Choose a membership.</p>
          </div>
        </div>

        <div className="mx-auto grid w-full max-w-[960px] gap-4 px-4 py-8 sm:px-8">
          {/* Where Stripe Checkout sends people who back out. (A completed checkout goes to the
              account page instead.) */}
          {checkout === "canceled" && (
            <Notice tone="info" role="status">
              Checkout was canceled, and you haven&apos;t been charged.
            </Notice>
          )}

          {plans.length === 0 ? (
            <EmptyState
              icon={IconTicket}
              title="No memberships are available right now."
            />
          ) : (
            <ul className="divide-y rounded-surface bg-card shadow-level-1">
              {plans.map((plan) => (
                <li
                  key={plan.id}
                  className="grid items-center gap-x-8 gap-y-3 px-5 py-5 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:px-6 [&_[role=alert]]:col-span-full"
                >
                  <h2 className="text-heading">{plan.name}</h2>
                  <p className="flex flex-wrap items-baseline gap-x-2">
                    <span className="text-figure">
                      {formatAmount(plan.amount, plan.currency)}
                    </span>{" "}
                    <span className="text-small text-ink-3">
                      per {plan.billing_interval}
                    </span>
                  </p>
                  <ActionButton
                    action={joinPlan.bind(null, business.slug, plan.id)}
                    label="Join"
                    pendingLabel="Opening checkout..."
                    size="lg"
                    // The row's grid places the button in its own column, and a refusal on a
                    // line of its own below, so the prices stay in line.
                    className="contents"
                  />
                </li>
              ))}
            </ul>
          )}
        </div>
      </main>
    </div>
  );
}

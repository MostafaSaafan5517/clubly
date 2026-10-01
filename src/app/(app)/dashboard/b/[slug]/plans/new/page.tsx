import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createPlan } from "@/app/(app)/dashboard/b/[slug]/plans/new/actions";
import { NewPlanForm } from "@/app/(app)/dashboard/b/[slug]/plans/new/new-plan-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { requireUser } from "@/lib/auth";
import { getStaffBusiness } from "@/lib/business";

export const metadata: Metadata = { title: "New plan" };

export default async function NewPlanPage({
  params,
}: PageProps<"/dashboard/b/[slug]/plans/new">) {
  const { slug } = await params;
  const { supabase, userId } = await requireUser(
    `/dashboard/b/${slug}/plans/new`,
  );
  const staff = await getStaffBusiness(supabase, userId, slug);
  if (!staff) notFound();
  const { business, role } = staff;

  let content: React.ReactNode;
  if (role === "staff") {
    content = (
      <p className="text-sm text-muted-foreground">
        Only owners and admins can create plans.
      </p>
    );
  } else if (!business.has_stripe_account) {
    content = (
      <p className="text-sm text-muted-foreground">
        Connect payouts before creating plans: each plan becomes a product in
        your Stripe account.{" "}
        <Link
          href={`/dashboard/b/${slug}`}
          className="text-foreground underline"
        >
          Back to {business.name}
        </Link>
      </p>
    );
  } else {
    content = <NewPlanForm action={createPlan.bind(null, slug)} />;
  }

  return (
    <Card className="mx-auto w-full max-w-md">
      <CardHeader>
        <CardTitle>New plan</CardTitle>
        <CardDescription>For {business.name}</CardDescription>
      </CardHeader>
      <CardContent>{content}</CardContent>
    </Card>
  );
}

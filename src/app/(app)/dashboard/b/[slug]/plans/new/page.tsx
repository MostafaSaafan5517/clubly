import type { Metadata } from "next";
import Link from "next/link";
import { createPlan } from "@/app/(app)/dashboard/b/[slug]/plans/new/actions";
import { NewPlanForm } from "@/app/(app)/dashboard/b/[slug]/plans/new/new-plan-form";
import { Notice } from "@/components/notice";
import { PageBody } from "@/components/page-body";
import { textLinkClass } from "@/components/text-link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { requireStaffBusiness } from "@/lib/business";

export const metadata: Metadata = { title: "New plan" };

export default async function NewPlanPage({
  params,
}: PageProps<"/dashboard/b/[slug]/plans/new">) {
  const { slug } = await params;
  const { business, role } = await requireStaffBusiness(
    slug,
    `/dashboard/b/${slug}/plans/new`,
  );

  let content: React.ReactNode;
  if (role === "staff") {
    content = (
      <Notice tone="info">Only owners and admins can create plans.</Notice>
    );
  } else if (!business.has_stripe_account) {
    content = (
      <Notice tone="warning">
        Connect payouts before creating plans: each plan becomes a product in
        your Stripe account.{" "}
        <Link href={`/dashboard/b/${slug}`} className={textLinkClass}>
          Back to {business.name}
        </Link>
      </Notice>
    );
  } else {
    content = <NewPlanForm action={createPlan.bind(null, slug)} />;
  }

  return (
    <PageBody width="narrow">
      <Card className="mx-auto w-full max-w-md">
        <CardHeader>
          <CardTitle as="h1">New plan</CardTitle>
          <CardDescription>For {business.name}</CardDescription>
        </CardHeader>
        <CardContent>{content}</CardContent>
      </Card>
    </PageBody>
  );
}

import type { Metadata } from "next";
import { NewBusinessForm } from "@/app/(app)/dashboard/new-business/new-business-form";
import { PageBody } from "@/components/page-body";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { requireUser } from "@/lib/auth";

export const metadata: Metadata = { title: "Create a business" };

export default async function NewBusinessPage() {
  await requireUser("/dashboard/new-business");

  return (
    <PageBody width="narrow">
      <Card className="mx-auto w-full max-w-md">
        <CardHeader>
          <CardTitle as="h1">Create a business</CardTitle>
          <CardDescription>
            You&apos;ll be its owner. You can connect payments and add plans
            next.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <NewBusinessForm />
        </CardContent>
      </Card>
    </PageBody>
  );
}

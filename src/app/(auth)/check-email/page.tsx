import type { Metadata } from "next";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const metadata: Metadata = { title: "Check your email" };

export default function CheckEmailPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Check your email</CardTitle>
        <CardDescription>
          We sent you a link. Open it on any device to continue.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">
          Nothing arrived after a few minutes? Check your spam folder, or{" "}
          <Link href="/signup" className="text-foreground underline">
            try again
          </Link>
          .
        </p>
      </CardContent>
    </Card>
  );
}

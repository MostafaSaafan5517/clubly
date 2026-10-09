import { IconMailCheck } from "@tabler/icons-react";
import type { Metadata } from "next";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { textLinkClass } from "@/components/text-link";

export const metadata: Metadata = { title: "Check your email" };

export default function CheckEmailPage() {
  return (
    <Card>
      <CardHeader>
        <span className="mb-2 grid size-10 place-items-center rounded-control bg-volt-soft text-foreground">
          <IconMailCheck size={20} stroke={1.75} aria-hidden />
        </span>
        <CardTitle as="h1">Check your email</CardTitle>
        <CardDescription>
          We sent you a link. Open it on any device to continue.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-small text-ink-2">
          Nothing arrived after a few minutes? Check your spam folder, or{" "}
          <Link href="/signup" className={textLinkClass}>
            try again
          </Link>
          .
        </p>
      </CardContent>
    </Card>
  );
}

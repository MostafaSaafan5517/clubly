"use client";

import { Button } from "@/components/ui/button";

// Shown inside the signed-in layout when a page throws. The server has already logged the
// error; its digest lets a report be matched with that log entry.
export default function SignedInError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <div
      role="alert"
      className="grid justify-items-start gap-3 rounded-lg border p-6"
    >
      <h1 className="text-lg font-semibold">Something went wrong</h1>
      <p className="text-sm text-muted-foreground">
        We couldn&apos;t load this page. Please try again in a moment.
      </p>
      {error.digest && (
        <p className="text-xs text-muted-foreground">
          Reference: {error.digest}
        </p>
      )}
      <Button onClick={() => retry()}>Try again</Button>
    </div>
  );
}

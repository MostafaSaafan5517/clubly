"use client";

import { IconAlertTriangle, IconRefresh } from "@tabler/icons-react";
import { PageBody } from "@/components/page-body";
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
    <PageBody width="narrow">
      <div
        role="alert"
        className="grid justify-items-start gap-3 rounded-surface bg-card p-6 shadow-level-1"
      >
        <span className="grid size-10 place-items-center rounded-control bg-danger-soft text-danger">
          <IconAlertTriangle size={20} stroke={1.75} aria-hidden />
        </span>
        <h1 className="text-title">Something went wrong</h1>
        <p className="text-body text-ink-2">
          We couldn&apos;t load this page. Please try again in a moment.
        </p>
        {error.digest && (
          <p className="text-caption break-all text-ink-3">
            Reference: {error.digest}
          </p>
        )}
        <Button onClick={() => retry()}>
          <IconRefresh stroke={1.75} aria-hidden />
          Try again
        </Button>
      </div>
    </PageBody>
  );
}

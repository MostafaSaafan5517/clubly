"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const REFRESH_EVERY_MS = 2_000;
const GIVE_UP_AFTER_MS = 30_000;

/**
 * Shown after Stripe Checkout while the membership isn't active yet. Coming back from Checkout
 * proves nothing (anyone can open that URL), so the page re-reads the database until Stripe's
 * webhook has recorded the subscription; then the server renders the membership instead.
 */
export function ConfirmingPayment({ businessName }: { businessName: string }) {
  const router = useRouter();
  const [gaveUp, setGaveUp] = useState(false);

  useEffect(() => {
    const startedAt = Date.now();
    const timer = setInterval(() => {
      if (Date.now() - startedAt > GIVE_UP_AFTER_MS) {
        clearInterval(timer);
        setGaveUp(true);
        return;
      }
      router.refresh();
    }, REFRESH_EVERY_MS);
    return () => clearInterval(timer);
  }, [router]);

  return (
    <p role="status" className="rounded-lg border p-4">
      {gaveUp
        ? `Stripe hasn't confirmed your payment to ${businessName} yet. If you were charged, your membership will appear here shortly; refresh the page in a minute.`
        : `Thanks! Stripe is confirming your payment to ${businessName}. This page updates on its own.`}
    </p>
  );
}

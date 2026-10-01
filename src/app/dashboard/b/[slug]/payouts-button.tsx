"use client";

import { useActionState } from "react";
import type { PayoutsFormState } from "@/app/dashboard/b/[slug]/actions";
import { Button } from "@/components/ui/button";

const initialState: PayoutsFormState = { error: null };

export function PayoutsButton({
  action,
  label,
}: {
  action: () => Promise<PayoutsFormState>;
  label: string;
}) {
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="grid justify-items-start gap-2">
      <Button type="submit" disabled={pending}>
        {pending ? "Opening Stripe..." : label}
      </Button>
      {state.error && (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      )}
    </form>
  );
}

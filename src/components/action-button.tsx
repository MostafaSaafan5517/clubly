"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";

/** What a Server Action behind an ActionButton returns. */
export type ActionState = { error: string | null };

const initialState: ActionState = { error: null };

/** A one-click Server Action (already bound to its arguments) that may report an error. */
export function ActionButton({
  action,
  label,
  pendingLabel,
  variant = "default",
}: {
  action: () => Promise<ActionState>;
  label: string;
  pendingLabel: string;
  variant?: "default" | "outline";
}) {
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="grid justify-items-start gap-2">
      <Button type="submit" variant={variant} disabled={pending}>
        {pending ? pendingLabel : label}
      </Button>
      {state.error && (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      )}
    </form>
  );
}

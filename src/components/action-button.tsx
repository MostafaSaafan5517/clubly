"use client";

import { IconAlertTriangle } from "@tabler/icons-react";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** What a Server Action behind an ActionButton returns. */
export type ActionState = { error: string | null };

const initialState: ActionState = { error: null };

/** A one-click Server Action (already bound to its arguments) that may report an error. */
export function ActionButton({
  action,
  label,
  pendingLabel,
  variant = "default",
  size = "default",
  className,
}: {
  action: () => Promise<ActionState>;
  label: string;
  pendingLabel: string;
  variant?: "default" | "outline";
  size?: "default" | "lg";
  /** For the form: `contents` lets a row's grid place the button and its error itself. */
  className?: string;
}) {
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <form
      action={formAction}
      className={cn("grid justify-items-start gap-2", className)}
    >
      <Button type="submit" variant={variant} size={size} disabled={pending}>
        {pending ? pendingLabel : label}
      </Button>
      {state.error && (
        <p
          role="alert"
          className="flex items-start gap-1.5 text-small text-destructive"
        >
          <IconAlertTriangle
            size={16}
            stroke={1.75}
            aria-hidden
            className="mt-px shrink-0"
          />
          {state.error}
        </p>
      )}
    </form>
  );
}

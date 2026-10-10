import { IconAlertTriangle } from "@tabler/icons-react";
import type { ReactNode } from "react";

/**
 * What a form (or a one-click action) says when it couldn't do what was asked: danger text with an
 * icon, announced as an alert. It sits right under the fields or the button it's about.
 */
export function FormError({ children }: { children: ReactNode }) {
  return (
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
      {children}
    </p>
  );
}

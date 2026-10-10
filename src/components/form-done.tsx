import { IconCircleCheck } from "@tabler/icons-react";
import type { ReactNode } from "react";

/** What a form says when it saved: success text with a check, announced as a status. */
export function FormDone({ children }: { children: ReactNode }) {
  return (
    <p
      role="status"
      className="flex items-center gap-1.5 text-small text-success"
    >
      <IconCircleCheck
        size={16}
        stroke={1.75}
        aria-hidden
        className="shrink-0"
      />
      {children}
    </p>
  );
}

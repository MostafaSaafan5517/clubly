import {
  IconAlertTriangle,
  IconCircleCheck,
  IconInfoCircle,
  type TablerIcon,
} from "@tabler/icons-react";
import type { AriaRole, ReactNode } from "react";
import { cn } from "@/lib/utils";

type NoticeTone = "success" | "info" | "warning" | "danger";

const tones: Record<
  NoticeTone,
  { fill: string; ink: string; icon: TablerIcon }
> = {
  success: {
    fill: "bg-success-soft",
    ink: "text-success",
    icon: IconCircleCheck,
  },
  info: { fill: "bg-info-soft", ink: "text-info", icon: IconInfoCircle },
  warning: {
    fill: "bg-warning-soft",
    ink: "text-warning",
    icon: IconAlertTriangle,
  },
  danger: {
    fill: "bg-danger-soft",
    ink: "text-danger",
    icon: IconAlertTriangle,
  },
};

/**
 * A message a page shows about itself (DESIGN.md, Notices): its tone's soft fill, an icon in the
 * tone, and the sentence in the text color. Pass `role="status"` or `role="alert"` where the
 * message appears after something happened.
 */
export function Notice({
  tone,
  icon,
  role,
  children,
}: {
  tone: NoticeTone;
  icon?: TablerIcon;
  role?: AriaRole;
  children: ReactNode;
}) {
  const { fill, ink, icon: toneIcon } = tones[tone];
  const Icon = icon ?? toneIcon;
  return (
    <p
      role={role}
      className={cn(
        "flex items-start gap-2.5 rounded-surface px-4 py-3 text-body text-foreground",
        fill,
      )}
    >
      <Icon
        size={18}
        stroke={1.75}
        aria-hidden
        className={cn("mt-0.5 shrink-0", ink)}
      />
      <span>{children}</span>
    </p>
  );
}

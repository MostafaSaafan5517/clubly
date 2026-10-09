import type { TablerIcon } from "@tabler/icons-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type BadgeTone = "success" | "warning" | "info" | "danger" | "neutral";

const tones: Record<BadgeTone, string> = {
  success: "bg-success-soft text-success",
  warning: "bg-warning-soft text-warning",
  info: "bg-info-soft text-info",
  danger: "bg-danger-soft text-danger",
  neutral: "bg-surface-2 text-ink-2",
};

/**
 * A status: its tone, an icon and its word, so nothing depends on color alone (DESIGN.md, Money
 * and membership states).
 */
export function Badge({
  tone,
  icon: Icon,
  children,
}: {
  tone: BadgeTone;
  icon?: TablerIcon;
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center gap-1 rounded-badge px-2 text-caption font-semibold whitespace-nowrap",
        tones[tone],
      )}
    >
      {Icon && <Icon size={14} stroke={1.75} aria-hidden />}
      {children}
    </span>
  );
}

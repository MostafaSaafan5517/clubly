import type { TablerIcon } from "@tabler/icons-react";
import type { ReactNode } from "react";

/**
 * What a list shows before it has anything in it (DESIGN.md, Empty states): an icon on a soft
 * volt square, a short title, and what to do next.
 */
export function EmptyState({
  icon: Icon,
  title,
  children,
}: {
  icon: TablerIcon;
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="grid justify-items-start gap-3 rounded-surface bg-card p-6 shadow-level-1">
      <span className="grid size-10 place-items-center rounded-control bg-volt-soft text-foreground">
        <Icon size={20} stroke={1.75} aria-hidden />
      </span>
      <h2 className="text-heading">{title}</h2>
      {children && (
        <p className="max-w-[60ch] text-body text-ink-2">{children}</p>
      )}
    </div>
  );
}

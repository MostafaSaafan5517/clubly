import type { TablerIcon } from "@tabler/icons-react";
import type { ReactNode } from "react";

/**
 * What a list shows before it has anything in it (DESIGN.md, Empty states): an icon on a soft
 * volt square, a short title, what to do next, and the action the page already offers. Inside a
 * section that has its own heading, the title is an h3; when it's all the page has, an h1.
 */
export function EmptyState({
  icon: Icon,
  title,
  titleAs: Title = "h2",
  children,
  action,
}: {
  icon: TablerIcon;
  title: string;
  titleAs?: "h1" | "h2" | "h3";
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="grid justify-items-start gap-3 rounded-surface bg-card p-6 shadow-level-1">
      <span className="grid size-10 place-items-center rounded-control bg-volt-soft text-foreground">
        <Icon size={20} stroke={1.75} aria-hidden />
      </span>
      <Title className="text-heading">{title}</Title>
      {children && (
        <p className="max-w-[60ch] text-body text-ink-2">{children}</p>
      )}
      {action}
    </div>
  );
}

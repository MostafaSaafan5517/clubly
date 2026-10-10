import type { ReactNode } from "react";

/**
 * A section's heading (an h2, which names the section for screen readers through its id), what
 * the section is for, and its one action, at the end of the line. The heading's line is a
 * button's height, so headings in side-by-side columns line up whether or not they have an
 * action or a description.
 */
export function SectionHeader({
  id,
  title,
  description,
  action,
}: {
  id: string;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
      <div className="grid max-w-[68ch]">
        <h2 id={id} className="flex min-h-10 items-center text-heading">
          {title}
        </h2>
        {description && <p className="text-small text-ink-2">{description}</p>}
      </div>
      {action && <div className="flex min-h-10 items-center">{action}</div>}
    </div>
  );
}

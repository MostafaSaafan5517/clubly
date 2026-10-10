import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * A signed-in page's content area (DESIGN.md, Space): 1120px for a business's pages, which use
 * the width, 768px for pages about one person or one form.
 */
export function PageBody({
  width = "wide",
  children,
}: {
  width?: "wide" | "narrow";
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "mx-auto grid w-full content-start gap-10 px-4 py-8 sm:px-6 lg:px-8 lg:py-10",
        width === "wide" ? "max-w-[1120px]" : "max-w-3xl",
      )}
    >
      {children}
    </div>
  );
}

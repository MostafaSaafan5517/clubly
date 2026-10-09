"use client";

import { cn } from "@/lib/utils";
import Link from "next/link";
import { useEffect, useRef } from "react";

/**
 * One row of tabs that scrolls sideways on narrow screens, with the current tab scrolled into
 * view. The baseline is an inset shadow, not a border, so the current tab's underline sits on
 * it without overflowing the scrolling row.
 */
export function BusinessTabs({
  tabs,
}: {
  tabs: { href: string; label: string; current: boolean }[];
}) {
  const navRef = useRef<HTMLElement>(null);

  useEffect(() => {
    navRef.current
      ?.querySelector('[aria-current="page"]')
      ?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, []);

  return (
    <nav
      ref={navRef}
      aria-label="Business"
      className="flex [scrollbar-width:none] gap-1 overflow-x-auto shadow-[inset_0_-1px_0_var(--color-border)]"
    >
      {tabs.map((tab) => (
        <Link
          key={tab.href}
          href={tab.href}
          aria-current={tab.current ? "page" : undefined}
          className={cn(
            "shrink-0 border-b-2 px-3 py-2 text-sm whitespace-nowrap",
            tab.current
              ? "border-foreground font-medium"
              : "border-transparent text-muted-foreground hover:text-foreground",
          )}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}

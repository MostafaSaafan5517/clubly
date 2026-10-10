"use client";

import {
  IconBuildingBank,
  IconChartBar,
  IconHistory,
  IconLayoutDashboard,
  IconUsers,
  IconUsersGroup,
  type TablerIcon,
} from "@tabler/icons-react";
import Link from "next/link";
import { useEffect, useRef } from "react";
import type { BusinessSection } from "@/app/(app)/dashboard/b/[slug]/business-header";
import { cn } from "@/lib/utils";

const icons: Record<BusinessSection, TablerIcon> = {
  overview: IconLayoutDashboard,
  members: IconUsers,
  revenue: IconChartBar,
  payouts: IconBuildingBank,
  history: IconHistory,
  team: IconUsersGroup,
};

/**
 * One row of tabs on the band, the current one bright with a volt bar under it. On narrow
 * screens the row scrolls sideways, fading at its end to show there's more, with the current tab
 * scrolled into view. A spacer at the end (and the scroll padding) lets the last tab, and the
 * current one, scroll clear of the fade.
 */
export function BusinessTabs({
  tabs,
}: {
  tabs: {
    key: BusinessSection;
    href: string;
    label: string;
    current: boolean;
  }[];
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
      className="flex scroll-pe-8 [scrollbar-width:none] gap-1 overflow-x-auto mask-r-from-[calc(100%-2rem)] after:w-8 after:shrink-0 after:content-[''] md:scroll-pe-0 md:mask-none md:after:hidden"
    >
      {tabs.map((tab) => {
        const Icon = icons[tab.key];
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={tab.current ? "page" : undefined}
            className={cn(
              // The row scrolls, which clips anything outside it, so focus draws inside the tab.
              "inline-flex h-11 shrink-0 items-center gap-1.5 border-b-3 px-3 text-body font-semibold whitespace-nowrap transition-[color,background-color,border-color] focus-visible:-outline-offset-4",
              tab.current
                ? "border-volt text-on-band"
                : "border-transparent text-on-band-2 hover:text-on-band",
            )}
          >
            <Icon size={16} stroke={1.75} aria-hidden />
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}

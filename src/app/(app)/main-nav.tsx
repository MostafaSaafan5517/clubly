"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const links = [
  { href: "/dashboard", label: "Businesses" },
  { href: "/account", label: "Memberships" },
  { href: "/settings", label: "Settings" },
];

/**
 * The signed-in navigation on the band, with the section you're in marked. Only its own page is
 * announced as the current page; deeper in the section (a business's pages, which mark their own
 * tab) it's announced as the current location instead.
 */
export function MainNav() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Main"
      className="order-last flex w-full gap-1 sm:order-none sm:w-auto sm:flex-1"
    >
      {links.map(({ href, label }) => {
        const onPage = pathname === href;
        const current = onPage || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            aria-current={onPage ? "page" : current ? "true" : undefined}
            className={cn(
              "rounded-control px-2.5 py-2 text-body font-semibold transition-[color,background-color,border-color] sm:py-1.5",
              current
                ? "bg-band-2 text-on-band"
                : "text-on-band-2 hover:text-on-band",
            )}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

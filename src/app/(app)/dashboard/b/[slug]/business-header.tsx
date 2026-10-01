import { cn } from "cn";
import Link from "next/link";
import type { Enums } from "@/lib/supabase/database.types";

type StaffRole = Enums<"staff_role">;

const roleDescriptions: Record<StaffRole, string> = {
  owner: "You own this business.",
  admin: "You're an admin here.",
  staff: "You're on the staff here.",
};

// Each section's page checks the role again on the server; hiding a tab is only a convenience.
const sections = [
  {
    key: "overview",
    label: "Overview",
    path: "",
    roles: ["owner", "admin", "staff"],
  },
  {
    key: "members",
    label: "Members",
    path: "/members",
    roles: ["owner", "admin", "staff"],
  },
  {
    key: "revenue",
    label: "Revenue",
    path: "/revenue",
    roles: ["owner", "admin"],
  },
] as const satisfies readonly {
  key: string;
  label: string;
  path: string;
  roles: readonly StaffRole[];
}[];

export type BusinessSection = (typeof sections)[number]["key"];

/** The business's name, the user's role there, and the tabs their role can open. */
export function BusinessHeader({
  business,
  role,
  current,
}: {
  business: { name: string; slug: string };
  role: StaffRole;
  current: BusinessSection;
}) {
  return (
    <div className="grid gap-4">
      <div className="grid gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">
          {business.name}
        </h1>
        <p className="text-muted-foreground">{roleDescriptions[role]}</p>
      </div>
      <nav aria-label="Business" className="flex flex-wrap gap-1 border-b">
        {sections
          .filter((section) =>
            (section.roles as readonly StaffRole[]).includes(role),
          )
          .map((section) => (
            <Link
              key={section.key}
              href={`/dashboard/b/${business.slug}${section.path}`}
              aria-current={section.key === current ? "page" : undefined}
              className={cn(
                "-mb-px border-b-2 px-3 py-2 text-sm",
                section.key === current
                  ? "border-foreground font-medium"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {section.label}
            </Link>
          ))}
      </nav>
    </div>
  );
}

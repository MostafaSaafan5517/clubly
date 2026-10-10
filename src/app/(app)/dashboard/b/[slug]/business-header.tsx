import { BusinessTabs } from "@/app/(app)/dashboard/b/[slug]/business-tabs";
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
  {
    key: "payouts",
    label: "Payouts",
    path: "/payouts",
    roles: ["owner"],
  },
  {
    key: "history",
    label: "History",
    path: "/history",
    roles: ["owner", "admin"],
  },
  {
    key: "team",
    label: "Team",
    path: "/team",
    roles: ["owner", "admin", "staff"],
  },
] as const satisfies readonly {
  key: string;
  label: string;
  path: string;
  roles: readonly StaffRole[];
}[];

export type BusinessSection = (typeof sections)[number]["key"];

/**
 * The business's name, the user's role there, and the tabs their role can open: the band
 * continuing under the app's header (DESIGN.md, The pages).
 */
export function BusinessHeader({
  business,
  role,
  current,
}: {
  business: { name: string; slug: string };
  role: StaffRole;
  current: BusinessSection;
}) {
  const tabs = sections
    .filter((section) => (section.roles as readonly StaffRole[]).includes(role))
    .map((section) => ({
      key: section.key,
      href: `/dashboard/b/${business.slug}${section.path}`,
      label: section.label,
      current: section.key === current,
    }));

  return (
    <div className="band">
      <div className="mx-auto grid max-w-[1120px] gap-1 px-4 pt-6 sm:px-6 sm:pt-8 lg:px-8">
        <h1 className="text-title text-balance">{business.name}</h1>
        <p className="text-small text-on-band-2">{roleDescriptions[role]}</p>
      </div>
      <div className="mx-auto mt-4 max-w-[1120px] px-2 sm:px-4 lg:px-6">
        <BusinessTabs tabs={tabs} />
      </div>
    </div>
  );
}

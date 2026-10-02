import { expect, test } from "@playwright/test";
import {
  addMember,
  addStaff,
  createBusinessFor,
  uniqueBusinessName,
} from "./support/businesses";
import { signInAs } from "./support/forms";
import { createConfirmedUser } from "./support/users";

// Who may open which business page. 200: the page; 404: as if it didn't exist (outsiders can't
// tell a business or a page is there); "sign in": sent to sign in first, and brought back.
// Each page checks this on the server; the tabs a role sees only mirror it.
const pages = {
  Overview: "",
  Members: "/members",
  Revenue: "/revenue",
  Payouts: "/payouts",
  History: "/history",
  "New plan": "/plans/new",
} as const;
type Page = keyof typeof pages;
type Outcome = 200 | 404 | "sign in";

// prettier-ignore
const expected: Record<string, Record<Page, Outcome>> = {
  owner:    { Overview: 200, Members: 200, Revenue: 200, Payouts: 200, History: 200, "New plan": 200 },
  admin:    { Overview: 200, Members: 200, Revenue: 200, Payouts: 404, History: 200, "New plan": 200 },
  staff:    { Overview: 200, Members: 200, Revenue: 404, Payouts: 404, History: 404, "New plan": 200 },
  member:   { Overview: 404, Members: 404, Revenue: 404, Payouts: 404, History: 404, "New plan": 404 },
  outsider: { Overview: 404, Members: 404, Revenue: 404, Payouts: 404, History: 404, "New plan": 404 },
  visitor:  {
    Overview: "sign in", Members: "sign in", Revenue: "sign in",
    Payouts: "sign in", History: "sign in", "New plan": "sign in",
  },
};

test("every business page answers each kind of visitor as it should", async ({
  browser,
}) => {
  test.setTimeout(120_000);
  const users = {
    owner: await createConfirmedUser(),
    admin: await createConfirmedUser(),
    staff: await createConfirmedUser(),
    member: await createConfirmedUser(),
    outsider: await createConfirmedUser(),
  };
  const business = await createBusinessFor(
    users.owner,
    uniqueBusinessName("Access Matrix Gym"),
  );
  await addStaff(business.id, users.admin.email, "admin");
  await addStaff(business.id, users.staff.email, "staff");
  await addMember(business.id, users.member.email);

  for (const [role, outcomes] of Object.entries(expected)) {
    const context = await browser.newContext();
    const page = await context.newPage();
    if (role !== "visitor")
      await signInAs(page, users[role as keyof typeof users]);

    for (const [name, outcome] of Object.entries(outcomes) as [
      Page,
      Outcome,
    ][]) {
      const path = `/dashboard/b/${business.slug}${pages[name]}`;
      const response = await page.goto(path);
      const cell = `${role} → ${name}`;
      if (outcome === "sign in") {
        expect
          .soft(new URL(page.url()).pathname + new URL(page.url()).search, cell)
          .toBe(`/login?next=${encodeURIComponent(path)}`);
      } else {
        expect.soft(response?.status(), cell).toBe(outcome);
      }
    }
    await context.close();
  }
});

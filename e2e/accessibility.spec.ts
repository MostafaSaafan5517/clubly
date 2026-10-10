import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";
import { hashInviteToken } from "@/lib/invites";
import {
  addMember,
  addPayment,
  addPlan,
  addStaff,
  addSubscription,
  createBusinessFor,
  enableCharges,
  suspendMembership,
  uniqueBusinessName,
} from "./support/businesses";
import { signInAs } from "./support/forms";
import { adminClient } from "./support/supabase";
import { createConfirmedUser } from "./support/users";

// Every page, checked by axe for what can be found automatically: WCAG 2.1 A and AA rules such as
// contrast, names for buttons and fields, landmarks and heading order. That's roughly a third of
// accessibility problems; the rest (keyboard flow, what a screen reader announces) still needs
// a person.

async function violationsOn(page: Page, path: string) {
  await page.goto(path);
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    // The Next.js dev tools badge only exists on the dev server.
    .exclude("nextjs-portal")
    .analyze();
  return results.violations.map(
    (violation) =>
      `${path}: ${violation.id} (${violation.help}) at ${violation.nodes
        .map((node) => node.target.join(" "))
        .join(", ")}`,
  );
}

test("every page passes axe's WCAG 2.1 AA checks, for visitors, owners and members", async ({
  browser,
}) => {
  test.setTimeout(300_000);
  const owner = await createConfirmedUser("Olive Owner");
  const member = await createConfirmedUser("Mona Member");
  const staff = await createConfirmedUser("Sam Staff");
  const suspended = await createConfirmedUser("Sue Suspended");
  const business = await createBusinessFor(
    owner,
    uniqueBusinessName("Accessible Gym"),
  );
  // A second business that hasn't set up payments: its pages show what to do first.
  const newBusiness = await createBusinessFor(
    owner,
    uniqueBusinessName("Unpaid Gym"),
  );
  await enableCharges(business.id);
  const planId = await addPlan(business.id, "Monthly", {
    stripePriceId: `price_test_${crypto.randomUUID()}`,
  });
  await addPlan(business.id, "Yearly", {
    amount: 20000,
    billingInterval: "year",
    stripePriceId: `price_test_${crypto.randomUUID()}`,
  });
  // Every state a plan, a member and a payment can show.
  await addPlan(business.id, "Drop-in", {
    active: false,
    stripePriceId: `price_test_${crypto.randomUUID()}`,
  });
  await addPlan(business.id, "Unfinished");
  await addStaff(business.id, staff.email, "staff");
  const memberId = await addMember(business.id, member.email);
  await addSubscription(business.id, memberId, planId, {
    status: "active",
    currentPeriodEnd: new Date(Date.now() + 20 * 86_400_000).toISOString(),
  });
  await suspendMembership(business.id, suspended.email);
  await addPayment(business.id, memberId, {
    amount: 2000,
    applicationFee: 100,
    status: "paid",
  });
  await addPayment(business.id, memberId, { amount: 2000, status: "failed" });
  const inviteToken = crypto.randomUUID();
  const { error } = await adminClient()
    .from("staff_invites")
    .insert({
      business_id: business.id,
      role: "staff",
      token_hash: hashInviteToken(inviteToken),
    });
  if (error) throw error;

  const dashboard = `/dashboard/b/${business.slug}`;
  const visits = [
    {
      user: null,
      paths: [
        "/",
        "/login",
        "/signup",
        "/magic-link",
        "/forgot-password",
        "/check-email",
        `/b/${business.slug}`,
        "/no-such-page",
      ],
    },
    {
      user: owner,
      paths: [
        "/dashboard",
        "/dashboard/new-business",
        dashboard,
        `${dashboard}/members`,
        `${dashboard}/revenue`,
        `${dashboard}/payouts`,
        `${dashboard}/history`,
        `${dashboard}/team`,
        `${dashboard}/plans/new`,
        `/dashboard/b/${newBusiness.slug}`,
        `/dashboard/b/${newBusiness.slug}/payouts`,
        `/dashboard/b/${newBusiness.slug}/plans/new`,
        "/dashboard/b/no-such-business",
        "/settings",
        "/settings/password",
      ],
    },
    {
      user: staff,
      paths: [dashboard, `${dashboard}/members`, `${dashboard}/plans/new`],
    },
    {
      user: member,
      paths: [
        "/account",
        "/dashboard",
        `/invite/${inviteToken}`,
        "/invite/not-a-real-link",
      ],
    },
  ];

  const violations: string[] = [];
  for (const { user, paths } of visits) {
    const page = await (await browser.newContext()).newPage();
    if (user) await signInAs(page, user);
    for (const path of paths)
      violations.push(...(await violationsOn(page, path)));
    await page.context().close();
  }
  expect(violations).toEqual([]);
});

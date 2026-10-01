import { expect, test } from "@playwright/test";
import {
  addMember,
  addPayment,
  addPlan,
  addStaff,
  addSubscription,
  createBusinessFor,
  uniqueBusinessName,
} from "./support/businesses";
import { signInAs } from "./support/forms";
import { createConfirmedUser } from "./support/users";

const DAY = 24 * 60 * 60 * 1000;

test("owners see recurring revenue, the last 30 days and recent payments", async ({
  page,
}) => {
  const owner = await createConfirmedUser();
  const mona = await createConfirmedUser("Mona Member");
  const sam = await createConfirmedUser("Sam Saver");
  const pat = await createConfirmedUser("Pat Pastdue");
  const business = await createBusinessFor(
    owner,
    uniqueBusinessName("Revenue Gym"),
  );
  const monthly = await addPlan(business.id, "Monthly", { amount: 3000 });
  const yearly = await addPlan(business.id, "Yearly", {
    amount: 36000,
    billingInterval: "year",
  });
  const monaId = await addMember(business.id, mona.email);
  const samId = await addMember(business.id, sam.email);
  const patId = await addMember(business.id, pat.email);
  await addSubscription(business.id, monaId, monthly, { status: "active" });
  await addSubscription(business.id, samId, yearly, { status: "active" });
  await addPayment(business.id, monaId, {
    amount: 3000,
    applicationFee: 150,
    status: "paid",
    paidAt: new Date(Date.now() - 2 * DAY).toISOString(),
  });
  await addPayment(business.id, samId, {
    amount: 36000,
    applicationFee: 1800,
    status: "paid",
    paidAt: new Date(Date.now() - 3 * DAY).toISOString(),
  });
  // Paid before the 30-day window: listed, but not in the window's totals.
  await addPayment(business.id, monaId, {
    amount: 3000,
    applicationFee: 150,
    status: "paid",
    paidAt: new Date(Date.now() - 45 * DAY).toISOString(),
  });
  await addPayment(business.id, patId, { amount: 3000, status: "failed" });

  await signInAs(page, owner);
  await page.goto(`/dashboard/b/${business.slug}`);
  await page
    .getByRole("navigation", { name: "Business" })
    .getByRole("link", { name: "Revenue" })
    .click();
  await expect(page).toHaveURL(
    new RegExp(`/dashboard/b/${business.slug}/revenue$`),
  );

  const figures = page.getByRole("definition");
  // $30.00 a month plus $360.00 a year (a twelfth: $30.00).
  await expect(figures.nth(0)).toHaveText("$60.00");
  await expect(figures.nth(1)).toHaveText("$390.00");
  await expect(figures.nth(2)).toHaveText("$19.50");
  await expect(figures.nth(3)).toHaveText("$370.50");
  await expect(
    page.getByText("1 failed payment in the last 30 days."),
  ).toBeVisible();

  const payments = page
    .getByRole("region", { name: "Recent payments" })
    .getByRole("listitem");
  await expect(payments).toHaveCount(4);
  await expect(payments.filter({ hasText: "Pat Pastdue" })).toContainText(
    "Failed",
  );
  await expect(payments.filter({ hasText: "Sam Saver" })).toContainText(
    "Paid, $18.00 fee",
  );
});

test("admins see revenue; plain staff don't get the tab or the page", async ({
  page,
  browser,
}) => {
  const owner = await createConfirmedUser();
  const admin = await createConfirmedUser();
  const staff = await createConfirmedUser();
  const business = await createBusinessFor(
    owner,
    uniqueBusinessName("Front Desk Revenue"),
  );
  await addStaff(business.id, admin.email, "admin");
  await addStaff(business.id, staff.email, "staff");

  await signInAs(page, admin);
  await page.goto(`/dashboard/b/${business.slug}/revenue`);
  await expect(page.getByText("No revenue yet.")).toBeVisible();

  const staffPage = await (await browser.newContext()).newPage();
  await signInAs(staffPage, staff);
  await staffPage.goto(`/dashboard/b/${business.slug}`);
  await expect(
    staffPage
      .getByRole("navigation", { name: "Business" })
      .getByRole("link", { name: "Revenue" }),
  ).toHaveCount(0);
  const response = await staffPage.goto(
    `/dashboard/b/${business.slug}/revenue`,
  );
  expect(response?.status()).toBe(404);
});

import { expect, test } from "@playwright/test";
import {
  addMember,
  addPlan,
  addStaff,
  createBusinessFor,
  uniqueBusinessName,
} from "./support/businesses";
import { signInAs } from "./support/forms";
import { createConfirmedUser } from "./support/users";

test("owners see who changed what, newest first", async ({ page }) => {
  const owner = await createConfirmedUser("Olive Owner");
  const mona = await createConfirmedUser("Mona Member");
  const business = await createBusinessFor(
    owner,
    uniqueBusinessName("History Gym"),
  );
  // Test helpers write as server code (the service role), like the app's own server code.
  await addPlan(business.id, "Gold");
  await addMember(business.id, mona.email);

  await signInAs(page, owner);
  await page.goto(`/dashboard/b/${business.slug}/members`);
  await page
    .getByRole("listitem")
    .filter({ hasText: "Mona Member" })
    .getByRole("button", { name: "Suspend" })
    .click();
  await expect(page.getByRole("button", { name: "Reactivate" })).toBeVisible();

  await page
    .getByRole("navigation", { name: "Business" })
    .getByRole("link", { name: "History" })
    .click();
  const entries = page
    .getByRole("region", { name: "History" })
    .getByRole("listitem");
  await expect(entries).toHaveCount(5);
  const expected: [change: string, actor: string][] = [
    ["Suspended Mona Member", "Olive Owner"],
    ["Mona Member joined", "Clubly"],
    ['Created plan "Gold"', "Clubly"],
    ["Added Olive Owner as owner", "Olive Owner"],
    ["Created the business", "Olive Owner"],
  ];
  for (const [index, [change, actor]] of expected.entries()) {
    await expect(entries.nth(index)).toContainText(change);
    await expect(entries.nth(index)).toContainText(`${actor} ·`);
  }
});

test("the history pages back through older entries", async ({ page }) => {
  const owner = await createConfirmedUser();
  const business = await createBusinessFor(
    owner,
    uniqueBusinessName("Busy History Gym"),
  );
  // 2 entries from creating the business, 55 from the plans: 57 in all.
  await Promise.all(
    Array.from({ length: 55 }, (_, index) =>
      addPlan(business.id, `Plan ${index + 1}`),
    ),
  );

  await signInAs(page, owner);
  await page.goto(`/dashboard/b/${business.slug}/history`);
  const entries = page
    .getByRole("region", { name: "History" })
    .getByRole("listitem");
  await expect(entries).toHaveCount(50);
  await expect(page.getByText("Created the business")).toHaveCount(0);

  await page.getByRole("link", { name: "Older" }).click();
  await expect(page).toHaveURL(/\/history\?before=\d+$/);
  await expect(entries).toHaveCount(7);
  await expect(entries.last()).toContainText("Created the business");
  await expect(page.getByRole("link", { name: "Older" })).toHaveCount(0);

  await page.getByRole("link", { name: "Newest" }).click();
  await expect(entries).toHaveCount(50);
});

test("admins see the history; plain staff don't get the tab or the page", async ({
  page,
  browser,
}) => {
  const owner = await createConfirmedUser();
  const admin = await createConfirmedUser();
  const staff = await createConfirmedUser();
  const business = await createBusinessFor(
    owner,
    uniqueBusinessName("Front Desk History"),
  );
  await addStaff(business.id, admin.email, "admin");
  await addStaff(business.id, staff.email, "staff");

  await signInAs(page, admin);
  await page.goto(`/dashboard/b/${business.slug}/history`);
  await expect(page.getByText("Created the business")).toBeVisible();

  const staffPage = await (await browser.newContext()).newPage();
  await signInAs(staffPage, staff);
  await staffPage.goto(`/dashboard/b/${business.slug}`);
  await expect(
    staffPage
      .getByRole("navigation", { name: "Business" })
      .getByRole("link", { name: "History" }),
  ).toHaveCount(0);
  const response = await staffPage.goto(
    `/dashboard/b/${business.slug}/history`,
  );
  expect(response?.status()).toBe(404);
});

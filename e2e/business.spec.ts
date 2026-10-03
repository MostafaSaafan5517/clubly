import { expect, test } from "@playwright/test";
import { slugify } from "@/lib/slug";
import {
  addStaff,
  createBusinessFor,
  enableCharges,
  uniqueBusinessName,
} from "./support/businesses";
import { formError, signInAs } from "./support/forms";
import { createConfirmedUser } from "./support/users";

test("a new owner creates their business from the dashboard", async ({
  page,
}) => {
  const owner = await createConfirmedUser("Olivia Owner");
  const businessName = uniqueBusinessName("Iron Gym");

  await signInAs(page, owner);
  await expect(page.getByText("You don't have a business yet")).toBeVisible();
  await page.getByRole("link", { name: "Create a business" }).click();
  await expect(page).toHaveURL(/\/dashboard\/new-business$/);

  await page.getByLabel("Business name").fill(businessName);
  // The web address follows the name until the user edits it.
  await expect(page.getByLabel("Web address")).toHaveValue(
    slugify(businessName),
  );
  await page.getByRole("button", { name: "Create business" }).click();

  await expect(page).toHaveURL(/\/dashboard$/);
  const business = page.getByRole("listitem").filter({ hasText: businessName });
  await expect(business).toContainText("Owner");
  await expect(business).toContainText("Payments not set up");
});

test("two owners: web addresses are unique, and each sees only their own business", async ({
  page,
  browser,
}) => {
  const firstOwner = await createConfirmedUser("First Owner");
  const secondOwner = await createConfirmedUser("Second Owner");
  const firstName = uniqueBusinessName("Harbor Yoga");
  const secondName = uniqueBusinessName("Summit Climbing");

  await signInAs(page, firstOwner);
  await page.goto("/dashboard/new-business");
  await page.getByLabel("Business name").fill(firstName);
  await page.getByRole("button", { name: "Create business" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);

  const secondPage = await (await browser.newContext()).newPage();
  await signInAs(secondPage, secondOwner);
  await secondPage.goto("/dashboard/new-business");
  await secondPage.getByLabel("Business name").fill(secondName);
  await secondPage.getByLabel("Web address").fill(slugify(firstName));
  await secondPage.getByRole("button", { name: "Create business" }).click();
  await expect(formError(secondPage)).toHaveText(
    "That web address is taken. Try another one.",
  );
  // What the user typed is still there after the error.
  await expect(secondPage.getByLabel("Business name")).toHaveValue(secondName);

  await secondPage.getByLabel("Web address").fill(slugify(secondName));
  await secondPage.getByRole("button", { name: "Create business" }).click();
  await expect(secondPage).toHaveURL(/\/dashboard$/);
  await expect(secondPage.getByText(secondName)).toBeVisible();
  await expect(secondPage.getByText(firstName)).toHaveCount(0);

  await page.reload();
  await expect(page.getByText(firstName)).toBeVisible();
  await expect(page.getByText(secondName)).toHaveCount(0);
});

test("creating a business requires signing in", async ({ page }) => {
  await page.goto("/dashboard/new-business");
  await expect(page).toHaveURL(/\/login\?next=%2Fdashboard%2Fnew-business$/);
});

test("staff open their business page from the dashboard", async ({ page }) => {
  const owner = await createConfirmedUser("Bianca Business");
  const business = await createBusinessFor(
    owner,
    uniqueBusinessName("Riverside Boxing"),
  );

  await signInAs(page, owner);
  await page.getByRole("link", { name: business.name }).click();
  await expect(page).toHaveURL(new RegExp(`/dashboard/b/${business.slug}$`));
  await expect(
    page.getByRole("heading", { level: 1, name: business.name }),
  ).toBeVisible();
  await expect(page.getByText("You own this business.")).toBeVisible();
  await expect(page.getByText("No plans yet.")).toBeVisible();
});

test("another business's page is a 404, even once that business is public", async ({
  page,
}) => {
  const owner = await createConfirmedUser();
  const outsider = await createConfirmedUser();
  const business = await createBusinessFor(
    owner,
    uniqueBusinessName("Private Pilates"),
  );
  // Once a business takes payments, every signed-in user may read its public details (for the
  // join page). Its admin page must still refuse anyone who isn't staff.
  await enableCharges(business.id);

  await signInAs(page, outsider);
  const response = await page.goto(`/dashboard/b/${business.slug}`);
  expect(response?.status()).toBe(404);
  await expect(page.getByText(business.name)).toHaveCount(0);
});

test("owners and admins rename the business; its web address stays", async ({
  page,
  browser,
}) => {
  const owner = await createConfirmedUser();
  const staff = await createConfirmedUser();
  const business = await createBusinessFor(
    owner,
    uniqueBusinessName("Old Name Gym"),
  );
  await addStaff(business.id, staff.email, "staff");

  await signInAs(page, owner);
  await page.goto(`/dashboard/b/${business.slug}`);
  await page.getByLabel("Business name").fill("New Name Gym");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("status")).toHaveText("Saved.");
  await expect(
    page.getByRole("heading", { level: 1, name: "New Name Gym" }),
  ).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`/dashboard/b/${business.slug}$`));

  const staffPage = await (await browser.newContext()).newPage();
  await signInAs(staffPage, staff);
  await staffPage.goto(`/dashboard/b/${business.slug}`);
  await expect(
    staffPage.getByRole("heading", { level: 1, name: "New Name Gym" }),
  ).toBeVisible();
  await expect(staffPage.getByLabel("Business name")).toHaveCount(0);
});

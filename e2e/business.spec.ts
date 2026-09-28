import { expect, test } from "@playwright/test";
import { slugify } from "@/lib/slug";
import { formError, signInToDashboard } from "./support/forms";
import { createConfirmedUser } from "./support/users";

function uniqueName(base: string) {
  return `${base} ${crypto.randomUUID().slice(0, 8)}`;
}

test("a new owner creates their business from the dashboard", async ({
  page,
}) => {
  const owner = await createConfirmedUser("Olivia Owner");
  const businessName = uniqueName("Iron Gym");

  await signInToDashboard(page, owner);
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
  const firstName = uniqueName("Harbor Yoga");
  const secondName = uniqueName("Summit Climbing");

  await signInToDashboard(page, firstOwner);
  await page.goto("/dashboard/new-business");
  await page.getByLabel("Business name").fill(firstName);
  await page.getByRole("button", { name: "Create business" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);

  const secondPage = await (await browser.newContext()).newPage();
  await signInToDashboard(secondPage, secondOwner);
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

import { expect, test } from "@playwright/test";
import {
  addPlan,
  createBusinessFor,
  enableCharges,
  uniqueBusinessName,
} from "./support/businesses";
import { signInToDashboard } from "./support/forms";
import { createConfirmedUser } from "./support/users";

test("visitors see a business's plans that can be bought, cheapest first", async ({
  page,
}) => {
  const owner = await createConfirmedUser();
  const business = await createBusinessFor(
    owner,
    uniqueBusinessName("Cedar Climbing"),
  );
  await enableCharges(business.id);
  await addPlan(business.id, "Yearly", {
    amount: 30000,
    billingInterval: "year",
    stripePriceId: `price_test_${crypto.randomUUID()}`,
  });
  await addPlan(business.id, "Monthly", {
    amount: 3000,
    stripePriceId: `price_test_${crypto.randomUUID()}`,
  });
  await addPlan(business.id, "Retired plan", {
    active: false,
    stripePriceId: `price_test_${crypto.randomUUID()}`,
  });
  await addPlan(business.id, "Half-made plan");

  const response = await page.goto(`/b/${business.slug}`);
  expect(response?.status()).toBe(200);
  await expect(page).toHaveTitle(`Join ${business.name} | Clubly`);
  await expect(
    page.getByRole("heading", { level: 1, name: business.name }),
  ).toBeVisible();
  await expect(page.getByRole("heading", { level: 2 })).toHaveText([
    "Monthly",
    "Yearly",
  ]);
  await expect(page.getByText("$30.00 per month")).toBeVisible();
  await expect(page.getByText("$300.00 per year")).toBeVisible();
});

test("signed-in staff see the same public page as visitors", async ({
  page,
}) => {
  const owner = await createConfirmedUser();
  const business = await createBusinessFor(
    owner,
    uniqueBusinessName("Harbor Pilates"),
  );
  await enableCharges(business.id);
  await addPlan(business.id, "Monthly", {
    stripePriceId: `price_test_${crypto.randomUUID()}`,
  });
  await addPlan(business.id, "Half-made plan");

  await signInToDashboard(page, owner);
  await page.goto(`/dashboard/b/${business.slug}`);
  await page.getByRole("link", { name: `/b/${business.slug}` }).click();
  await expect(page).toHaveURL(new RegExp(`/b/${business.slug}$`));
  await expect(page.getByRole("heading", { level: 2 })).toHaveText(["Monthly"]);
});

test("a business that can't take payments yet has no public page", async ({
  page,
}) => {
  const owner = await createConfirmedUser();
  const business = await createBusinessFor(
    owner,
    uniqueBusinessName("Not Ready Rowing"),
  );

  expect((await page.goto(`/b/${business.slug}`))?.status()).toBe(404);
  expect((await page.goto("/b/no-such-business-anywhere"))?.status()).toBe(404);
});

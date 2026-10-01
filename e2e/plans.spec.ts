import { expect, test } from "@playwright/test";
import {
  addStaff,
  createBusinessFor,
  uniqueBusinessName,
} from "./support/businesses";
import { formError, signInToDashboard } from "./support/forms";
import {
  connectStripeAccount,
  deleteStripeAccount,
  getPlanId,
  getPlanStripePrice,
} from "./support/stripe";
import { createConfirmedUser } from "./support/users";

// Plans live in the Stripe sandbox too; each test deletes the connected account it created,
// which removes its products and prices with it.

test("an owner creates a plan, and Stripe gets a matching product and price", async ({
  page,
}) => {
  const owner = await createConfirmedUser("Priya Planner");
  const business = await createBusinessFor(
    owner,
    uniqueBusinessName("Tidewater Tennis"),
  );
  const accountId = await connectStripeAccount(business.id);

  try {
    await signInToDashboard(page, owner);
    await page.goto(`/dashboard/b/${business.slug}`);
    await page.getByRole("link", { name: "New plan" }).click();
    await expect(page).toHaveURL(/\/plans\/new$/);

    await page.getByLabel("Plan name").fill("Monthly membership");
    await page.getByLabel("Price (USD)").fill("29.99");
    await page.getByLabel("Billed").selectOption("month");
    await page.getByRole("button", { name: "Create plan" }).click();

    await expect(page).toHaveURL(new RegExp(`/dashboard/b/${business.slug}$`));
    const plan = page
      .getByRole("listitem")
      .filter({ hasText: "Monthly membership" });
    await expect(plan).toContainText("$29.99 per month");
    await expect(plan).not.toContainText("Not ready");

    // Stripe has the same plan, on the business's own account, in exact cents.
    const planId = await getPlanId(business.id, "Monthly membership");
    const price = await getPlanStripePrice(planId, accountId);
    expect(price).toMatchObject({
      unit_amount: 2999,
      currency: "usd",
      active: true,
      recurring: { interval: "month" },
      metadata: { plan_id: planId },
      product: { name: "Monthly membership", active: true },
    });
  } finally {
    await deleteStripeAccount(accountId);
  }
});

test("the server rejects a price below Stripe's minimum, even if the browser is bypassed", async ({
  page,
}) => {
  const owner = await createConfirmedUser();
  const business = await createBusinessFor(
    owner,
    uniqueBusinessName("Lantern Lifting"),
  );
  const accountId = await connectStripeAccount(business.id);

  try {
    await signInToDashboard(page, owner);
    await page.goto(`/dashboard/b/${business.slug}/plans/new`);
    // Turn off the browser's own checks to prove the server enforces the rule too.
    await page
      .locator("form")
      .filter({ has: page.getByLabel("Plan name") })
      .evaluate((form) => {
        (form as HTMLFormElement).noValidate = true;
      });
    await page.getByLabel("Plan name").fill("Too cheap");
    await page.getByLabel("Price (USD)").fill("0.10");
    await page.getByRole("button", { name: "Create plan" }).click();

    await expect(formError(page)).toHaveText(
      "The price must be at least $0.50.",
    );
    await expect(page.getByLabel("Plan name")).toHaveValue("Too cheap");
  } finally {
    await deleteStripeAccount(accountId);
  }
});

test("plans can't be created before payouts are connected", async ({
  page,
}) => {
  const owner = await createConfirmedUser();
  const business = await createBusinessFor(
    owner,
    uniqueBusinessName("Quiet Quarry Climbing"),
  );

  await signInToDashboard(page, owner);
  await page.goto(`/dashboard/b/${business.slug}`);
  await expect(page.getByRole("link", { name: "New plan" })).toHaveCount(0);

  await page.goto(`/dashboard/b/${business.slug}/plans/new`);
  await expect(
    page.getByText("Connect payouts before creating plans"),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Create plan" })).toHaveCount(
    0,
  );
});

test("staff members can't create plans", async ({ page }) => {
  const owner = await createConfirmedUser();
  const staffMember = await createConfirmedUser("Sid Staff");
  const business = await createBusinessFor(
    owner,
    uniqueBusinessName("Morning Mile Run Club"),
  );
  await addStaff(business.id, staffMember.email, "staff");
  const accountId = await connectStripeAccount(business.id);

  try {
    await signInToDashboard(page, staffMember);
    await page.goto(`/dashboard/b/${business.slug}`);
    await expect(page.getByRole("link", { name: "New plan" })).toHaveCount(0);

    await page.goto(`/dashboard/b/${business.slug}/plans/new`);
    await expect(
      page.getByText("Only owners and admins can create plans."),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Create plan" })).toHaveCount(
      0,
    );
  } finally {
    await deleteStripeAccount(accountId);
  }
});

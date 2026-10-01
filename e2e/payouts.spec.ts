import { expect, test } from "@playwright/test";
import {
  addStaff,
  createBusinessFor,
  uniqueBusinessName,
} from "./support/businesses";
import { signInToDashboard } from "./support/forms";
import { deleteStripeAccount, getStripeAccountId } from "./support/stripe";
import { createConfirmedUser } from "./support/users";

// These tests talk to the real Stripe sandbox (test mode) and clean up the accounts they create.

test("the owner starts Stripe onboarding, and continuing reuses the same account", async ({
  page,
}) => {
  const owner = await createConfirmedUser("Oscar Owner");
  const business = await createBusinessFor(
    owner,
    uniqueBusinessName("Harbor Rowing"),
  );
  let accountId: string | null = null;

  try {
    await signInToDashboard(page, owner);
    await page.goto(`/dashboard/b/${business.slug}`);
    await page.getByRole("button", { name: "Connect payouts" }).click();
    // Stripe's hosted onboarding; no need to wait for the external page to finish loading.
    await page.waitForURL(/^https:\/\/connect\.stripe\.com\//, {
      waitUntil: "commit",
    });
    accountId = await getStripeAccountId(business.id);
    expect(accountId).toMatch(/^acct_/);

    // Coming back from Stripe doesn't mean onboarding is done; only Stripe's webhook decides.
    await page.goto(`/dashboard/b/${business.slug}?stripe=returned`);
    await expect(
      page.getByText("Stripe setup isn't finished yet."),
    ).toBeVisible();
    await expect(page.getByRole("status")).toContainText(
      "Stripe is checking your details",
    );

    await page.getByRole("button", { name: "Continue setup" }).click();
    await page.waitForURL(/^https:\/\/connect\.stripe\.com\//, {
      waitUntil: "commit",
    });
    expect(await getStripeAccountId(business.id)).toBe(accountId);
  } finally {
    if (accountId) await deleteStripeAccount(accountId);
  }
});

test("staff who aren't the owner see the payments status but can't connect payouts", async ({
  page,
}) => {
  const owner = await createConfirmedUser();
  const admin = await createConfirmedUser("Ada Admin");
  const business = await createBusinessFor(
    owner,
    uniqueBusinessName("Canal Cycling"),
  );
  await addStaff(business.id, admin.email, "admin");

  await signInToDashboard(page, admin);
  await page.goto(`/dashboard/b/${business.slug}`);
  await expect(
    page.getByText("Only the owner can set up payouts."),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Connect payouts" }),
  ).toHaveCount(0);
});

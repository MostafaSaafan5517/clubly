import { expect, test } from "@playwright/test";
import {
  addStaff,
  createBusinessFor,
  uniqueBusinessName,
} from "./support/businesses";
import { signInAs } from "./support/forms";
import {
  connectStripeAccount,
  deleteStripeAccount,
  getStripeAccountId,
} from "./support/stripe";
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
    await signInAs(page, owner);
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

  await signInAs(page, admin);
  await page.goto(`/dashboard/b/${business.slug}`);
  await expect(
    page.getByText("Only the owner can set up payouts."),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Connect payouts" }),
  ).toHaveCount(0);
});

test("an expired onboarding link sends the owner back to Stripe, and nobody else", async ({
  page,
  browser,
}) => {
  const owner = await createConfirmedUser();
  const admin = await createConfirmedUser();
  const business = await createBusinessFor(
    owner,
    uniqueBusinessName("Ridge Runners"),
  );
  await addStaff(business.id, admin.email, "admin");
  const accountId = await connectStripeAccount(business.id);
  const refreshUrl = `/dashboard/b/${business.slug}/stripe/refresh`;

  try {
    // Where Stripe sends the owner when an onboarding link has expired or was already used.
    await signInAs(page, owner);
    await page.goto(refreshUrl, { waitUntil: "commit" });
    await page.waitForURL(/^https:\/\/connect\.stripe\.com\//, {
      waitUntil: "commit",
    });
    expect(await getStripeAccountId(business.id)).toBe(accountId);

    const adminPage = await (await browser.newContext()).newPage();
    await signInAs(adminPage, admin);
    await adminPage.goto(refreshUrl);
    await expect(adminPage).toHaveURL(
      new RegExp(`/dashboard/b/${business.slug}$`),
    );
  } finally {
    await deleteStripeAccount(accountId);
  }
});

test("only the owner has a Payouts page, and it asks for payouts to be connected first", async ({
  page,
  browser,
}) => {
  const owner = await createConfirmedUser();
  const admin = await createConfirmedUser();
  const business = await createBusinessFor(
    owner,
    uniqueBusinessName("Owner Only Payouts"),
  );
  await addStaff(business.id, admin.email, "admin");

  await signInAs(page, owner);
  await page.goto(`/dashboard/b/${business.slug}/payouts`);
  await expect(page.getByText("Connect payouts first.")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Open Stripe dashboard" }),
  ).toHaveCount(0);

  const adminPage = await (await browser.newContext()).newPage();
  await signInAs(adminPage, admin);
  await adminPage.goto(`/dashboard/b/${business.slug}`);
  await expect(
    adminPage
      .getByRole("navigation", { name: "Business" })
      .getByRole("link", { name: "Payouts" }),
  ).toHaveCount(0);
  const response = await adminPage.goto(
    `/dashboard/b/${business.slug}/payouts`,
  );
  expect(response?.status()).toBe(404);
});

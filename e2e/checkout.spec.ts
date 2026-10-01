import { expect, test } from "@playwright/test";
import {
  addPlan,
  createBusinessFor,
  enableCharges,
  findMembership,
  suspendMembership,
  uniqueBusinessName,
} from "./support/businesses";
import { formError, signInToDashboard } from "./support/forms";
import {
  archiveStripeProduct,
  createPricedPlan,
  latestCheckoutSession,
  useChargeReadyAccount,
} from "./support/stripe";
import { createConfirmedUser } from "./support/users";

// These tests share one charge-ready Stripe account, so they run one at a time.
test.describe.configure({ mode: "serial" });

test("a signed-in member joins a plan and is sent to Stripe Checkout for it", async ({
  page,
}) => {
  // Creating the shared account the very first time takes Stripe over a minute.
  test.setTimeout(240_000);
  const owner = await createConfirmedUser();
  const member = await createConfirmedUser("Mona Member");
  const business = await createBusinessFor(
    owner,
    uniqueBusinessName("Checkout Club"),
  );
  const accountId = await useChargeReadyAccount(business.id);
  const plan = await createPricedPlan(business.id, accountId, {
    name: "Monthly membership",
    amount: 3500,
  });

  try {
    await signInToDashboard(page, member);
    await page.goto(`/b/${business.slug}`);
    await page.getByRole("button", { name: "Join" }).click();
    await page.waitForURL(/^https:\/\/checkout\.stripe\.com\//, {
      waitUntil: "commit",
    });

    // Joining created the membership and its Stripe customer on the business's account...
    const membership = await findMembership(business.id, member.email);
    expect(membership).toMatchObject({ status: "active" });
    expect(membership?.stripe_customer_id).toMatch(/^cus_/);

    // ...and a subscription Checkout for exactly this plan, that comes back to the join page.
    const session = await latestCheckoutSession(
      accountId,
      membership?.stripe_customer_id ?? "",
    );
    expect(session).toMatchObject({
      mode: "subscription",
      metadata: {
        business_id: business.id,
        member_id: membership?.id,
        plan_id: plan.id,
      },
    });
    expect(session.success_url).toMatch(
      new RegExp(`/b/${business.slug}\\?checkout=success$`),
    );
    expect(session.cancel_url).toMatch(
      new RegExp(`/b/${business.slug}\\?checkout=canceled$`),
    );
    expect(session.line_items.data).toHaveLength(1);
  } finally {
    await archiveStripeProduct(accountId, plan.productId);
  }
});

test("visitors are asked to sign in before joining, and come back to the page", async ({
  page,
}) => {
  const owner = await createConfirmedUser();
  const business = await createBusinessFor(
    owner,
    uniqueBusinessName("Sign In First Studio"),
  );
  await enableCharges(business.id);
  await addPlan(business.id, "Monthly", {
    stripePriceId: `price_test_${crypto.randomUUID()}`,
  });

  await page.goto(`/b/${business.slug}`);
  await page.getByRole("button", { name: "Join" }).click();
  await expect(page).toHaveURL(
    new RegExp(`/login\\?next=%2Fb%2F${business.slug}$`),
  );
});

test("a suspended member can't start a new subscription", async ({ page }) => {
  const owner = await createConfirmedUser();
  const member = await createConfirmedUser();
  const business = await createBusinessFor(
    owner,
    uniqueBusinessName("Strict Boxing"),
  );
  await enableCharges(business.id);
  await addPlan(business.id, "Monthly", {
    stripePriceId: `price_test_${crypto.randomUUID()}`,
  });
  await suspendMembership(business.id, member.email);

  await signInToDashboard(page, member);
  await page.goto(`/b/${business.slug}`);
  await page.getByRole("button", { name: "Join" }).click();
  await expect(formError(page)).toHaveText(
    `Your membership at ${business.name} is suspended. Please contact them.`,
  );
  await expect(page).toHaveURL(new RegExp(`/b/${business.slug}$`));
});

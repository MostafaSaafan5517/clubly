import { expect, test } from "@playwright/test";
import {
  addMember,
  addPlan,
  addSubscription,
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
  createStripeCustomer,
  retirePortalConfiguration,
  deleteStripeCustomer,
  getPortalConfiguration,
  getPortalConfigurationId,
  latestCheckoutSession,
  useChargeReadyAccount,
} from "./support/stripe";
import { createConfirmedUser } from "./support/users";

// Everything that needs the shared charge-ready Stripe account lives in this file, so those
// tests run one at a time.
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

    // ...and a subscription Checkout for exactly this plan. Paying returns to the account page
    // (which waits for the webhook); backing out returns to the join page.
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
      new RegExp(`/account\\?joined=${business.slug}$`),
    );
    expect(session.cancel_url).toMatch(
      new RegExp(`/b/${business.slug}\\?checkout=canceled$`),
    );
    expect(session.line_items.data).toHaveLength(1);
  } finally {
    await archiveStripeProduct(accountId, plan.productId);
    // Joining created a Stripe customer on the shared account; it goes too.
    const customerId = (await findMembership(business.id, member.email))
      ?.stripe_customer_id;
    if (customerId) await deleteStripeCustomer(accountId, customerId);
  }
});

test("Manage billing opens Stripe's Customer Portal, configured once per business", async ({
  page,
}) => {
  test.setTimeout(240_000);
  const owner = await createConfirmedUser();
  const member = await createConfirmedUser();
  const business = await createBusinessFor(
    owner,
    uniqueBusinessName("Portal Gym"),
  );
  const accountId = await useChargeReadyAccount(business.id);
  const customerId = await createStripeCustomer(accountId, member.email);
  await addSubscription(
    business.id,
    await addMember(business.id, member.email, {
      stripeCustomerId: customerId,
    }),
    await addPlan(business.id, "Monthly", {
      stripePriceId: `price_test_${crypto.randomUUID()}`,
    }),
    { status: "active" },
  );

  let configurationId: string | null = null;
  try {
    await signInToDashboard(page, member);
    const openPortal = async () => {
      await page.goto("/account");
      await page.getByRole("button", { name: "Manage billing" }).click();
      await page.waitForURL(/^https:\/\/billing\.stripe\.com\//, {
        waitUntil: "commit",
      });
    };

    await openPortal();
    configurationId = await getPortalConfigurationId(business.id);
    expect(configurationId).toMatch(/^bpc_/);
    expect(
      await getPortalConfiguration(accountId, configurationId ?? ""),
    ).toMatchObject({
      active: true,
      metadata: { business_id: business.id },
      features: {
        customer_update: { enabled: false },
        invoice_history: { enabled: true },
        payment_method_update: { enabled: true },
        subscription_cancel: { enabled: true, mode: "at_period_end" },
      },
    });

    // The next visit reuses the business's configuration instead of creating another.
    await openPortal();
    expect(await getPortalConfigurationId(business.id)).toBe(configurationId);
  } finally {
    if (configurationId) {
      await retirePortalConfiguration(accountId, configurationId);
    }
    await deleteStripeCustomer(accountId, customerId);
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

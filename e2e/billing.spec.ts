import { expect, test } from "@playwright/test";
import { formatAmount } from "@/lib/money";
import {
  addMember,
  addPlan,
  addSubscription,
  createBusinessFor,
  disableCharges,
  enableCharges,
  findMembership,
  linkStripeCustomer,
  paymentsOf,
  suspendMembership,
  uniqueBusinessName,
} from "./support/businesses";
import {
  deliverSignedEvent,
  deliveryOutcome,
  payWithTestCard,
} from "./support/checkout";
import { formError, signInAs } from "./support/forms";
import {
  reconciliationCorrections,
  runReconciliation,
} from "./support/reconciliation";
import {
  archiveStripeProduct,
  createPaidSubscription,
  createPricedPlan,
  createStripeCustomer,
  retirePortalConfiguration,
  deleteStripeCustomer,
  getPortalConfiguration,
  getPortalConfigurationId,
  getStripeBalanceAndPayouts,
  countRecordedEvents,
  latestCheckoutSession,
  useChargeReadyAccount,
} from "./support/stripe";
import { createConfirmedUser } from "./support/users";

// Everything that needs the shared charge-ready Stripe account (Checkout, the billing portal,
// payouts, reconciliation, paying for real) lives in this file, so those tests run one at a time.
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
    await signInAs(page, member);
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
    await signInAs(page, member);
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

  await signInAs(page, member);
  await page.goto(`/b/${business.slug}`);
  await page.getByRole("button", { name: "Join" }).click();
  await expect(formError(page)).toHaveText(
    `Your membership at ${business.name} is suspended. Please contact them.`,
  );
  await expect(page).toHaveURL(new RegExp(`/b/${business.slug}$`));
});

test("reconciliation fills in what the webhooks couldn't apply, and a second run changes nothing", async ({
  request,
}) => {
  test.setTimeout(240_000);
  const owner = await createConfirmedUser();
  const member = await createConfirmedUser();
  const business = await createBusinessFor(
    owner,
    uniqueBusinessName("Reconciled Gym"),
  );
  const accountId = await useChargeReadyAccount(business.id);
  const plan = await createPricedPlan(business.id, accountId, {
    name: "Monthly",
    amount: 2000,
  });
  const customerId = await createStripeCustomer(accountId, member.email);
  // Joined, but the Stripe customer's id wasn't saved (as if the app had crashed right after
  // creating it), so the app can't tell whose events these are.
  const memberId = await addMember(business.id, member.email);

  try {
    await disableCharges(business.id);
    const eventsBefore = await Promise.all([
      countRecordedEvents(accountId, "customer.subscription.created"),
      countRecordedEvents(accountId, "invoice.paid"),
    ]);
    const subscriptionId = await createPaidSubscription(
      accountId,
      customerId,
      plan.priceId,
    );
    // The webhooks arrive and are recorded, but can't be applied: nothing links them to a member.
    // (At least one more of each: a run elsewhere may share this sandbox account.)
    await expect
      .poll(
        async () => {
          const [subscriptions, invoices] = await Promise.all([
            countRecordedEvents(accountId, "customer.subscription.created"),
            countRecordedEvents(accountId, "invoice.paid"),
          ]);
          return subscriptions > eventsBefore[0] && invoices > eventsBefore[1];
        },
        { timeout: 30_000 },
      )
      .toBe(true);
    expect(await findMembership(business.id, member.email)).toMatchObject({
      stripe_customer_id: null,
    });
    await linkStripeCustomer(memberId, customerId);

    const first = await runReconciliation(request);
    const corrections = await reconciliationCorrections(
      first.runId,
      business.id,
    );
    expect(corrections).toEqual([
      {
        object_type: "account",
        stripe_id: accountId,
        old_data: { charges_enabled: false },
        new_data: { charges_enabled: true },
      },
      {
        object_type: "subscription",
        stripe_id: subscriptionId,
        old_data: null,
        new_data: expect.objectContaining({
          status: "active",
          plan_id: plan.id,
          cancel_at: null,
        }),
      },
      {
        object_type: "payment",
        stripe_id: expect.stringMatching(/^in_/),
        old_data: null,
        // 5% of $20.00 is the platform's fee.
        new_data: expect.objectContaining({
          status: "paid",
          amount: 2000,
          application_fee: 100,
          currency: "usd",
        }),
      },
    ]);

    const second = await runReconciliation(request);
    expect(await reconciliationCorrections(second.runId, business.id)).toEqual(
      [],
    );
  } finally {
    // Deleting the customer cancels its subscription.
    await deleteStripeCustomer(accountId, customerId);
    await archiveStripeProduct(accountId, plan.productId);
  }
});

test("the owner sees their Stripe balance and recent payouts, read live from Stripe", async ({
  page,
}) => {
  test.setTimeout(240_000);
  const owner = await createConfirmedUser();
  const business = await createBusinessFor(
    owner,
    uniqueBusinessName("Payout Gym"),
  );
  const accountId = await useChargeReadyAccount(business.id);
  const stripeSide = await getStripeBalanceAndPayouts(accountId);
  const shown = (balance: { amount: number; currency: string }[]) =>
    balance
      .map(({ amount, currency }) => formatAmount(amount, currency))
      .join(" + ");

  await signInAs(page, owner);
  await page.goto(`/dashboard/b/${business.slug}`);
  await page
    .getByRole("navigation", { name: "Business" })
    .getByRole("link", { name: "Payouts" })
    .click();
  await expect(page).toHaveURL(
    new RegExp(`/dashboard/b/${business.slug}/payouts$`),
  );

  const figures = page.getByRole("definition");
  await expect(figures.nth(0)).toHaveText(shown(stripeSide.available));
  await expect(figures.nth(1)).toHaveText(shown(stripeSide.pending));
  if (stripeSide.payoutCount === 0) {
    await expect(page.getByText("No payouts yet.")).toBeVisible();
  } else {
    await expect(
      page
        .getByRole("region", { name: "Recent payouts" })
        .getByRole("listitem"),
    ).toHaveCount(stripeSide.payoutCount);
  }

  // Stripe only signs owners in to an Express dashboard their account has. This shared test
  // account has none, so Stripe refuses, and the owner gets a message instead of an error page.
  await page.getByRole("button", { name: "Open Stripe dashboard" }).click();
  await expect(formError(page)).toHaveText(
    "Stripe couldn't open your dashboard. Please try again.",
  );
});

test("a member pays on Stripe Checkout and turns active once Stripe's webhook arrives; replayed events change nothing", async ({
  page,
  browser,
  request,
}) => {
  test.setTimeout(240_000);
  const owner = await createConfirmedUser("Olive Owner");
  const member = await createConfirmedUser("Mona Member");
  const business = await createBusinessFor(
    owner,
    uniqueBusinessName("Paid Gym"),
  );
  const accountId = await useChargeReadyAccount(business.id);
  const plan = await createPricedPlan(business.id, accountId, {
    name: "Monthly",
    amount: 2500,
  });

  try {
    // The member pays on Stripe's own Checkout page, with Stripe's test card.
    await signInAs(page, member);
    await page.goto(`/b/${business.slug}`);
    await page.getByRole("button", { name: "Join" }).click();
    await payWithTestCard(page, "Mona Member");

    // Back on the app, the membership turns active only once the webhook has been processed.
    await page.waitForURL(new RegExp(`/account\\?joined=${business.slug}$`), {
      timeout: 60_000,
    });
    await expect(page.getByRole("status")).toHaveText(
      `Welcome to ${business.name}! Your membership is active.`,
      { timeout: 30_000 },
    );
    const membership = page
      .getByRole("listitem")
      .filter({ hasText: business.name });
    await expect(membership).toContainText("Monthly, $25.00 per month");
    await expect(membership).toContainText("Active");

    // The owner sees the payment and the platform's 5% fee, and who recorded them.
    const ownerPage = await (await browser.newContext()).newPage();
    await signInAs(ownerPage, owner);
    await ownerPage.goto(`/dashboard/b/${business.slug}/revenue`);
    const figures = ownerPage.getByRole("definition");
    await expect(figures.nth(0)).toHaveText("$25.00");
    await expect(figures.nth(1)).toHaveText("$25.00");
    await expect(figures.nth(2)).toHaveText("$1.25");
    await expect(
      ownerPage
        .getByRole("region", { name: "Recent payments" })
        .getByRole("listitem")
        .filter({ hasText: "Mona Member" }),
    ).toContainText("Paid, $1.25 fee");
    await ownerPage.goto(`/dashboard/b/${business.slug}/history`);
    await expect(
      ownerPage
        .getByRole("region", { name: "History" })
        .getByRole("listitem")
        .filter({ hasText: "Mona Member subscribed" }),
    ).toContainText("Stripe ·");

    // Stripe may deliver an event more than once: the second delivery changes nothing.
    const payments = await paymentsOf(business.id);
    expect(payments).toEqual([
      expect.objectContaining({
        status: "paid",
        amount: 2500,
        application_fee: 125,
      }),
    ]);
    const event = {
      id: `evt_e2e_${crypto.randomUUID()}`,
      object: "event",
      type: "invoice.paid",
      account: accountId,
      data: {
        object: { id: payments[0]?.stripe_invoice_id, object: "invoice" },
      },
    };
    expect(
      await deliveryOutcome(await deliverSignedEvent(request, event)),
    ).toBe("applied");
    expect(
      await deliveryOutcome(await deliverSignedEvent(request, event)),
    ).toBe("duplicate");
    expect(await paymentsOf(business.id)).toHaveLength(1);

    // And a delivery that isn't signed with the endpoint's secret is refused.
    const forged = await deliverSignedEvent(
      request,
      { ...event, id: `evt_e2e_${crypto.randomUUID()}` },
      "whsec_not_the_real_secret",
    );
    expect(forged.status()).toBe(400);
  } finally {
    const customerId = (await findMembership(business.id, member.email))
      ?.stripe_customer_id;
    // Deleting the customer cancels its subscription.
    if (customerId) await deleteStripeCustomer(accountId, customerId);
    await archiveStripeProduct(accountId, plan.productId);
  }
});

test("members cancel and renew in Stripe's billing portal, and their account page follows Stripe", async ({
  page,
}) => {
  test.setTimeout(240_000);
  const owner = await createConfirmedUser();
  const member = await createConfirmedUser("Mona Member");
  const business = await createBusinessFor(
    owner,
    uniqueBusinessName("Portal Flow Gym"),
  );
  const accountId = await useChargeReadyAccount(business.id);
  const plan = await createPricedPlan(business.id, accountId, {
    name: "Monthly",
    amount: 2500,
  });
  const customerId = await createStripeCustomer(accountId, member.email);
  await addMember(business.id, member.email, { stripeCustomerId: customerId });

  // The account page shows what Stripe's webhooks have recorded, so it's reloaded until the
  // expected state arrives.
  const membership = page
    .getByRole("listitem")
    .filter({ hasText: business.name });
  async function expectOnAccountPage(text: string | RegExp) {
    await expect(async () => {
      await page.goto("/account");
      await expect(membership).toContainText(text, { timeout: 1_000 });
    }).toPass({ timeout: 30_000 });
  }
  async function openPortal() {
    await membership.getByRole("button", { name: "Manage billing" }).click();
    await page.waitForURL(/^https:\/\/billing\.stripe\.com\//);
  }
  async function backToTheApp() {
    await page.getByTestId("return-to-business-link").click();
    await page.waitForURL(/\/account$/);
  }

  try {
    await createPaidSubscription(accountId, customerId, plan.priceId);
    await signInAs(page, member);
    await expectOnAccountPage(/Active\s*Renews on/);

    // Cancel: Stripe keeps the membership until the end of the period it was paid for.
    await openPortal();
    await page.getByRole("link", { name: "Cancel subscription" }).click();
    await page.getByTestId("confirm").click();
    await expect(
      page.getByRole("link", { name: "Don't cancel subscription" }),
    ).toBeVisible();
    await backToTheApp();
    await expectOnAccountPage(/Canceling\s*Ends on/);

    // Change of mind: renewing clears the end date again.
    await openPortal();
    await page.getByRole("link", { name: "Don't cancel subscription" }).click();
    await page.getByTestId("confirm").click();
    await expect(
      page.getByRole("link", { name: "Cancel subscription" }),
    ).toBeVisible();
    await backToTheApp();
    await expectOnAccountPage(/Active\s*Renews on/);
  } finally {
    const configurationId = await getPortalConfigurationId(business.id);
    if (configurationId) {
      await retirePortalConfiguration(accountId, configurationId);
    }
    // Deleting the customer cancels its subscription.
    await deleteStripeCustomer(accountId, customerId);
    await archiveStripeProduct(accountId, plan.productId);
  }
});

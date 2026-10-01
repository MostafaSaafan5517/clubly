import { adminClient } from "./supabase";

// Talks to the Stripe sandbox directly (plain REST, like the Stripe CLI) to set up and check
// what tests need. The app itself only ever uses the server-only Stripe SDK client.

async function stripeRequest<T>(
  method: "GET" | "POST" | "DELETE",
  path: string,
  options: { body?: URLSearchParams; account?: string } = {},
): Promise<T> {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey?.startsWith("sk_test_")) {
    throw new Error("STRIPE_SECRET_KEY must be a test-mode key.");
  }
  const headers: Record<string, string> = {
    Authorization: `Bearer ${secretKey}`,
  };
  if (options.account) headers["Stripe-Account"] = options.account;
  const response = await fetch(`https://api.stripe.com${path}`, {
    method,
    headers,
    body: options.body,
  });
  if (!response.ok) {
    throw new Error(`Stripe ${method} ${path} failed: ${response.status}`);
  }
  return (await response.json()) as T;
}

/** The Stripe account id stored for a business (read with the service role, like the app). */
export async function getStripeAccountId(businessId: string) {
  const { data, error } = await adminClient()
    .from("businesses")
    .select("stripe_account_id")
    .eq("id", businessId)
    .single();
  if (error) throw error;
  return data.stripe_account_id;
}

/**
 * Gives a business a connected account the same way the app does, without going through
 * Stripe's hosted onboarding in the browser.
 */
export async function connectStripeAccount(businessId: string) {
  const account = await stripeRequest<{ id: string }>("POST", "/v1/accounts", {
    body: new URLSearchParams({
      country: "US",
      "controller[stripe_dashboard][type]": "express",
      "controller[fees][payer]": "application",
      "controller[losses][payments]": "application",
      "controller[requirement_collection]": "stripe",
      "capabilities[card_payments][requested]": "true",
      "capabilities[transfers][requested]": "true",
      "metadata[business_id]": businessId,
    }),
  });
  const { error } = await adminClient()
    .from("businesses")
    .update({ stripe_account_id: account.id })
    .eq("id", businessId);
  if (error) throw error;
  return account.id;
}

/**
 * Removes a connected account (and everything on it) that a test created, and detaches it from
 * its business, so later reconciliation runs don't keep asking Stripe for it.
 */
export async function deleteStripeAccount(accountId: string) {
  await stripeRequest("DELETE", `/v1/accounts/${accountId}`);
  const { error } = await adminClient()
    .from("businesses")
    .update({ stripe_account_id: null })
    .eq("stripe_account_id", accountId);
  if (error) throw error;
}

export type StripePrice = {
  id: string;
  unit_amount: number;
  currency: string;
  active: boolean;
  recurring: { interval: string };
  metadata: Record<string, string>;
  product: { name: string; active: boolean };
};

/** A plan's Stripe price as Stripe has it on the business's account. */
export async function getPlanStripePrice(planId: string, accountId: string) {
  const { data, error } = await adminClient()
    .from("plans")
    .select("stripe_price_id")
    .eq("id", planId)
    .single();
  if (error) throw error;
  if (!data.stripe_price_id)
    throw new Error(`Plan ${planId} has no Stripe price`);
  return stripeRequest<StripePrice>(
    "GET",
    `/v1/prices/${data.stripe_price_id}?expand[]=product`,
    { account: accountId },
  );
}

/** The id of the business's plan with this name. */
export async function getPlanId(businessId: string, name: string) {
  const { data, error } = await adminClient()
    .from("plans")
    .select("id")
    .eq("business_id", businessId)
    .eq("name", name)
    .single();
  if (error) throw error;
  return data.id as string;
}

const CHARGE_READY_PURPOSE = "clubly-e2e-charge-ready";

type StripeAccount = {
  id: string;
  charges_enabled: boolean;
  metadata: Record<string, string>;
};

/**
 * A connected account that can really take payments, shared by every test run (local and CI).
 * Stripe takes over a minute to verify a new account, so it's created once, with Stripe's
 * documented test values through the API, and found again by its metadata after that.
 */
async function chargeReadyAccountId() {
  const { data } = await stripeRequest<{ data: StripeAccount[] }>(
    "GET",
    "/v1/accounts?limit=100",
  );
  const existing = data.find(
    (account) =>
      account.metadata.purpose === CHARGE_READY_PURPOSE &&
      account.charges_enabled,
  );
  if (existing) return existing.id;

  const created = await stripeRequest<StripeAccount>("POST", "/v1/accounts", {
    body: new URLSearchParams({
      country: "US",
      "controller[stripe_dashboard][type]": "none",
      "controller[fees][payer]": "application",
      "controller[losses][payments]": "application",
      "controller[requirement_collection]": "application",
      "capabilities[card_payments][requested]": "true",
      "capabilities[transfers][requested]": "true",
      business_type: "individual",
      "business_profile[mcc]": "7997",
      "business_profile[url]": "https://accessible.stripe.com",
      "business_profile[product_description]": "Test memberships",
      "individual[first_name]": "Test",
      "individual[last_name]": "Owner",
      "individual[email]": "owner@example.com",
      "individual[phone]": "0000000000",
      "individual[dob][day]": "1",
      "individual[dob][month]": "1",
      "individual[dob][year]": "1901",
      "individual[address][line1]": "address_full_match",
      "individual[address][city]": "Schenectady",
      "individual[address][state]": "NY",
      "individual[address][postal_code]": "12345",
      "individual[address][country]": "US",
      "individual[id_number]": "000000000",
      external_account: "btok_us_verified",
      "tos_acceptance[date]": String(Math.floor(Date.now() / 1000)),
      "tos_acceptance[ip]": "8.8.8.8",
      "metadata[purpose]": CHARGE_READY_PURPOSE,
    }),
  });
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const account = await stripeRequest<StripeAccount>(
      "GET",
      `/v1/accounts/${created.id}`,
    );
    if (account.charges_enabled) return account.id;
    await new Promise((resolve) => setTimeout(resolve, 3_000));
  }
  throw new Error(`Stripe never enabled charges on ${created.id}`);
}

/**
 * Gives the business the shared charge-ready account (taking it back from an older test
 * business in this database first: account ids are unique) and marks it able to take payments.
 * Tests that use it must not run in parallel with each other.
 */
export async function useChargeReadyAccount(businessId: string) {
  const accountId = await chargeReadyAccountId();
  const admin = adminClient();
  const { error: releaseError } = await admin
    .from("businesses")
    .update({ stripe_account_id: null })
    .eq("stripe_account_id", accountId);
  if (releaseError) throw releaseError;
  const { error } = await admin
    .from("businesses")
    .update({ stripe_account_id: accountId, charges_enabled: true })
    .eq("id", businessId);
  if (error) throw error;
  return accountId;
}

/** A plan with a real Stripe price on the given account, as the app would have created it. */
export async function createPricedPlan(
  businessId: string,
  accountId: string,
  plan: { name: string; amount: number },
) {
  const price = await stripeRequest<{ id: string; product: string }>(
    "POST",
    "/v1/prices",
    {
      account: accountId,
      body: new URLSearchParams({
        currency: "usd",
        unit_amount: String(plan.amount),
        "recurring[interval]": "month",
        "product_data[name]": plan.name,
      }),
    },
  );
  const { data, error } = await adminClient()
    .from("plans")
    .insert({
      business_id: businessId,
      name: plan.name,
      billing_interval: "month",
      amount: plan.amount,
      stripe_price_id: price.id,
    })
    .select("id")
    .single();
  if (error) throw error;
  return { id: data.id as string, priceId: price.id, productId: price.product };
}

/** Archives a test product, so the shared account's catalog doesn't fill up with live ones. */
export async function archiveStripeProduct(
  accountId: string,
  productId: string,
) {
  await stripeRequest("POST", `/v1/products/${productId}`, {
    account: accountId,
    body: new URLSearchParams({ active: "false" }),
  });
}

export type CheckoutSession = {
  mode: string;
  success_url: string;
  cancel_url: string;
  metadata: Record<string, string>;
  line_items: { data: { price: { id: string } }[] };
};

/** The latest Checkout session for a Stripe customer on the given account. */
export async function latestCheckoutSession(
  accountId: string,
  customerId: string,
) {
  const { data } = await stripeRequest<{ data: CheckoutSession[] }>(
    "GET",
    `/v1/checkout/sessions?customer=${customerId}&limit=1&expand[]=data.line_items`,
    { account: accountId },
  );
  const session = data[0];
  if (!session) throw new Error(`No Checkout session for ${customerId}`);
  return session;
}

/** A customer on the given account, like the one joining creates for a member. */
export async function createStripeCustomer(accountId: string, email: string) {
  const customer = await stripeRequest<{ id: string }>(
    "POST",
    "/v1/customers",
    { account: accountId, body: new URLSearchParams({ email }) },
  );
  return customer.id;
}

export async function deleteStripeCustomer(
  accountId: string,
  customerId: string,
) {
  await stripeRequest("DELETE", `/v1/customers/${customerId}`, {
    account: accountId,
  });
}

/** The Customer Portal configuration id stored for a business (service role), if any. */
export async function getPortalConfigurationId(businessId: string) {
  const { data, error } = await adminClient()
    .from("businesses")
    .select("stripe_portal_configuration_id")
    .eq("id", businessId)
    .single();
  if (error) throw error;
  return data.stripe_portal_configuration_id;
}

export type PortalConfiguration = {
  active: boolean;
  is_default: boolean;
  metadata: Record<string, string>;
  features: {
    customer_update: { enabled: boolean };
    invoice_history: { enabled: boolean };
    payment_method_update: { enabled: boolean };
    subscription_cancel: { enabled: boolean; mode: string };
  };
};

export async function getPortalConfiguration(
  accountId: string,
  configurationId: string,
) {
  return stripeRequest<PortalConfiguration>(
    "GET",
    `/v1/billing_portal/configurations/${configurationId}`,
    { account: accountId },
  );
}

/**
 * Portal configurations can't be deleted, only deactivated; this keeps the shared account's
 * list of active ones short. Stripe makes an account's first configuration its default and
 * refuses to deactivate that one, so it stays.
 */
export async function retirePortalConfiguration(
  accountId: string,
  configurationId: string,
) {
  const configuration = await getPortalConfiguration(
    accountId,
    configurationId,
  );
  if (configuration.is_default) return;
  await stripeRequest(
    "POST",
    `/v1/billing_portal/configurations/${configurationId}`,
    { account: accountId, body: new URLSearchParams({ active: "false" }) },
  );
}

/**
 * A subscription created straight in Stripe and paid at once with Stripe's test card, on the
 * member's customer. No webhook reaches the test database, so to the app it's a subscription
 * whose events were missed.
 */
export async function createPaidSubscription(
  accountId: string,
  customerId: string,
  priceId: string,
) {
  const paymentMethod = await stripeRequest<{ id: string }>(
    "POST",
    "/v1/payment_methods/pm_card_visa/attach",
    { account: accountId, body: new URLSearchParams({ customer: customerId }) },
  );
  const subscription = await stripeRequest<{ id: string; status: string }>(
    "POST",
    "/v1/subscriptions",
    {
      account: accountId,
      body: new URLSearchParams({
        customer: customerId,
        "items[0][price]": priceId,
        default_payment_method: paymentMethod.id,
        application_fee_percent: "5",
      }),
    },
  );
  if (subscription.status !== "active") {
    throw new Error(
      `Subscription ${subscription.id} is ${subscription.status}`,
    );
  }
  return subscription.id;
}

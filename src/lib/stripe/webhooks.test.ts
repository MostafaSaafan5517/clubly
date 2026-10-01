import Stripe from "stripe";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  handleWebhookRequest,
  toInvoiceSnapshot,
  toSubscriptionSnapshot,
  type InvoiceSnapshot,
  type SubscriptionSnapshot,
  type WebhookDependencies,
} from "@/lib/stripe/webhooks";

// A real Stripe client: signing and verifying webhooks is local crypto, no network calls.
const stripe = new Stripe("sk_test_unit_tests");
const webhookSecret = "whsec_unit_tests";
const BUSINESS_ACCOUNT = "acct_business";

function stripeEvent(
  id: string,
  type: string,
  object: Record<string, unknown>,
  // null: an event on the platform's own account, which names no connected account.
  account: string | null = BUSINESS_ACCOUNT,
) {
  return { id, object: "event", type, account, data: { object } };
}

function signedRequest(event: object, secret = webhookSecret) {
  const payload = JSON.stringify(event);
  const signature = stripe.webhooks.generateTestHeaderString({
    payload,
    secret,
  });
  return new Request("http://localhost/api/stripe/webhook", {
    method: "POST",
    body: payload,
    headers: { "stripe-signature": signature },
  });
}

function subscription(
  overrides: Partial<SubscriptionSnapshot> = {},
): SubscriptionSnapshot {
  return {
    id: "sub_1",
    customer_id: "cus_1",
    price_id: "price_1",
    status: "active",
    current_period_end: 1_800_000_000,
    cancel_at_period_end: false,
    ...overrides,
  };
}

/**
 * A fake Stripe (the current state of each object) and a fake database that behaves like the
 * real one: an event id can only be recorded once.
 */
function fakeWorld() {
  const accounts = new Map<string, boolean>();
  const subscriptions = new Map<string, SubscriptionSnapshot>();
  const invoices = new Map<string, InvoiceSnapshot>();
  const processedEventIds = new Set<string>();
  const storedSubscriptions = new Map<string, SubscriptionSnapshot>();
  const storedCharges = new Map<string, boolean>();

  function firstTime(eventId: string) {
    if (processedEventIds.has(eventId)) return false;
    processedEventIds.add(eventId);
    return true;
  }

  const dependencies: WebhookDependencies = {
    retrieveAccount: vi.fn(async (accountId: string) => ({
      id: accountId,
      charges_enabled: accounts.get(accountId) ?? false,
    })),
    retrieveSubscription: vi.fn(async (subscriptionId: string) => {
      const current = subscriptions.get(subscriptionId);
      if (!current) throw new Error(`No such subscription: ${subscriptionId}`);
      return current;
    }),
    retrieveInvoice: vi.fn(async (invoiceId: string) => {
      const current = invoices.get(invoiceId);
      if (!current) throw new Error(`No such invoice: ${invoiceId}`);
      return current;
    }),
    applyAccountUpdated: vi.fn(
      async ({ eventId, accountId, chargesEnabled }) => {
        if (!firstTime(eventId)) return false;
        storedCharges.set(accountId, chargesEnabled);
        return true;
      },
    ),
    applySubscriptionEvent: vi.fn(
      async ({ eventId, subscription: snapshot }) => {
        if (!firstTime(eventId)) return "duplicate";
        storedSubscriptions.set(snapshot.id, snapshot);
        return "applied";
      },
    ),
    applyInvoiceEvent: vi.fn(async ({ eventId, subscription: snapshot }) => {
      if (!firstTime(eventId)) return "duplicate";
      storedSubscriptions.set(snapshot.id, snapshot);
      return "applied";
    }),
  };

  return {
    dependencies,
    stripeState: { accounts, subscriptions, invoices },
    stored: { subscriptions: storedSubscriptions, charges: storedCharges },
  };
}

async function deliver(event: object, dependencies: WebhookDependencies) {
  const response = await handleWebhookRequest(signedRequest(event), {
    stripe,
    webhookSecret,
    dependencies,
  });
  const isJson = response.headers.get("content-type")?.includes("json");
  return {
    status: response.status,
    body: isJson ? await response.json() : await response.text(),
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("Stripe webhook: verifying requests", () => {
  it("rejects a request signed with the wrong secret", async () => {
    const { dependencies } = fakeWorld();
    const event = stripeEvent("evt_forged", "account.updated", {
      id: "acct_1",
    });

    const response = await handleWebhookRequest(
      signedRequest(event, "whsec_attacker"),
      { stripe, webhookSecret, dependencies },
    );

    expect(response.status).toBe(400);
    expect(dependencies.retrieveAccount).not.toHaveBeenCalled();
  });

  it("rejects a body that was changed after signing", async () => {
    const { dependencies } = fakeWorld();
    const genuine = signedRequest(
      stripeEvent("evt_tampered", "account.updated", { id: "acct_1" }),
    );
    const tampered = new Request(genuine.url, {
      method: "POST",
      headers: genuine.headers,
      body: JSON.stringify(
        stripeEvent("evt_tampered", "account.updated", { id: "acct_other" }),
      ),
    });

    const response = await handleWebhookRequest(tampered, {
      stripe,
      webhookSecret,
      dependencies,
    });

    expect(response.status).toBe(400);
    expect(dependencies.retrieveAccount).not.toHaveBeenCalled();
  });

  it("rejects a request without a signature", async () => {
    const { dependencies } = fakeWorld();
    const request = new Request("http://localhost/api/stripe/webhook", {
      method: "POST",
      body: JSON.stringify(
        stripeEvent("evt_unsigned", "account.updated", { id: "a" }),
      ),
    });

    const response = await handleWebhookRequest(request, {
      stripe,
      webhookSecret,
      dependencies,
    });

    expect(response.status).toBe(400);
  });

  it("answers 500 when processing fails, so Stripe retries later", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { dependencies } = fakeWorld();
    dependencies.applyAccountUpdated = vi.fn(async () => {
      throw new Error("database unavailable");
    });

    const { status } = await deliver(
      stripeEvent("evt_retry", "account.updated", { id: "acct_1" }),
      dependencies,
    );

    expect(status).toBe(500);
    expect(console.error).toHaveBeenCalled();
  });

  it("acknowledges event types it doesn't handle without doing anything", async () => {
    const { dependencies } = fakeWorld();

    const { status, body } = await deliver(
      stripeEvent("evt_other", "customer.created", { id: "cus_1" }),
      dependencies,
    );

    expect(status).toBe(200);
    expect(body).toMatchObject({ outcome: "ignored" });
    expect(dependencies.retrieveSubscription).not.toHaveBeenCalled();
  });
});

describe("Stripe webhook: account.updated", () => {
  it("stores Stripe's current account, not the event payload", async () => {
    const { dependencies, stripeState, stored } = fakeWorld();
    stripeState.accounts.set("acct_1", true);

    const { body } = await deliver(
      stripeEvent("evt_1", "account.updated", {
        id: "acct_1",
        charges_enabled: false,
      }),
      dependencies,
    );

    expect(body).toEqual({ received: true, outcome: "applied" });
    expect(stored.charges.get("acct_1")).toBe(true);
  });

  it("applies the same event only once when Stripe delivers it twice", async () => {
    const { dependencies, stripeState } = fakeWorld();
    stripeState.accounts.set("acct_1", true);
    const event = stripeEvent("evt_dup", "account.updated", { id: "acct_1" });

    const first = await deliver(event, dependencies);
    const second = await deliver(event, dependencies);

    expect(first.body).toMatchObject({ outcome: "applied" });
    // Still 200: the event was handled, so Stripe must stop retrying it.
    expect(second.status).toBe(200);
    expect(second.body).toMatchObject({ outcome: "duplicate" });
  });
});

describe("Stripe webhook: subscriptions", () => {
  it("syncs Stripe's current subscription, read from the business's connected account", async () => {
    const { dependencies, stripeState, stored } = fakeWorld();
    stripeState.subscriptions.set("sub_1", subscription({ status: "active" }));

    const { body } = await deliver(
      stripeEvent("evt_1", "customer.subscription.created", {
        id: "sub_1",
        status: "incomplete",
      }),
      dependencies,
    );

    expect(body).toMatchObject({ outcome: "applied" });
    expect(dependencies.retrieveSubscription).toHaveBeenCalledWith(
      "sub_1",
      BUSINESS_ACCOUNT,
    );
    expect(stored.subscriptions.get("sub_1")?.status).toBe("active");
  });

  it("ends in the latest state even when an older event arrives last", async () => {
    const { dependencies, stripeState, stored } = fakeWorld();
    // By the time either event is handled, the subscription has been canceled.
    stripeState.subscriptions.set(
      "sub_1",
      subscription({ status: "canceled" }),
    );

    await deliver(
      stripeEvent("evt_newer", "customer.subscription.deleted", {
        id: "sub_1",
        status: "canceled",
      }),
      dependencies,
    );
    await deliver(
      stripeEvent("evt_older", "customer.subscription.created", {
        id: "sub_1",
        status: "active",
      }),
      dependencies,
    );

    expect(stored.subscriptions.get("sub_1")?.status).toBe("canceled");
  });

  it("syncs the subscription a completed Checkout created, and ignores other checkouts", async () => {
    const { dependencies, stripeState, stored } = fakeWorld();
    stripeState.subscriptions.set("sub_1", subscription());

    const subscriptionCheckout = await deliver(
      stripeEvent("evt_1", "checkout.session.completed", {
        id: "cs_1",
        mode: "subscription",
        subscription: "sub_1",
      }),
      dependencies,
    );
    const paymentCheckout = await deliver(
      stripeEvent("evt_2", "checkout.session.completed", {
        id: "cs_2",
        mode: "payment",
        subscription: null,
      }),
      dependencies,
    );

    expect(subscriptionCheckout.body).toMatchObject({ outcome: "applied" });
    expect(stored.subscriptions.has("sub_1")).toBe(true);
    expect(paymentCheckout.body).toMatchObject({ outcome: "ignored" });
  });

  it("applies the same subscription event only once", async () => {
    const { dependencies, stripeState } = fakeWorld();
    stripeState.subscriptions.set("sub_1", subscription());
    const event = stripeEvent("evt_dup", "customer.subscription.updated", {
      id: "sub_1",
    });

    await deliver(event, dependencies);
    const second = await deliver(event, dependencies);

    expect(second.body).toMatchObject({ outcome: "duplicate" });
  });

  it("ignores events from the platform's own account (no connected account)", async () => {
    const { dependencies } = fakeWorld();

    const { body } = await deliver(
      stripeEvent(
        "evt_platform",
        "customer.subscription.created",
        { id: "sub_1" },
        null,
      ),
      dependencies,
    );

    expect(body).toMatchObject({ outcome: "ignored" });
    expect(dependencies.retrieveSubscription).not.toHaveBeenCalled();
  });
});

describe("Stripe webhook: invoices", () => {
  it("records a failed payment together with the subscription's past-due status", async () => {
    const { dependencies, stripeState } = fakeWorld();
    stripeState.invoices.set("in_1", {
      id: "in_1",
      subscription_id: "sub_1",
      amount: 3000,
      application_fee: 0,
      currency: "usd",
      status: "failed",
      paid_at: null,
    });
    stripeState.subscriptions.set(
      "sub_1",
      subscription({ status: "past_due" }),
    );

    const { body } = await deliver(
      stripeEvent("evt_1", "invoice.payment_failed", { id: "in_1" }),
      dependencies,
    );

    expect(body).toMatchObject({ outcome: "applied" });
    expect(dependencies.applyInvoiceEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "invoice.payment_failed",
        accountId: BUSINESS_ACCOUNT,
        invoice: expect.objectContaining({ status: "failed", amount: 3000 }),
        subscription: expect.objectContaining({ status: "past_due" }),
      }),
    );
  });

  it("ignores invoices that aren't for a membership subscription", async () => {
    const { dependencies, stripeState } = fakeWorld();
    stripeState.invoices.set("in_oneoff", {
      id: "in_oneoff",
      subscription_id: null,
      amount: 500,
      application_fee: 0,
      currency: "usd",
      status: "paid",
      paid_at: 1_800_000_000,
    });

    const { body } = await deliver(
      stripeEvent("evt_1", "invoice.paid", { id: "in_oneoff" }),
      dependencies,
    );

    expect(body).toMatchObject({ outcome: "ignored" });
    expect(dependencies.applyInvoiceEvent).not.toHaveBeenCalled();
  });
});

describe("snapshots of Stripe objects", () => {
  it("reads a subscription's price and billing period from its item", () => {
    const snapshot = toSubscriptionSnapshot({
      id: "sub_1",
      customer: { id: "cus_1" },
      status: "trialing",
      cancel_at_period_end: true,
      items: {
        data: [{ price: { id: "price_1" }, current_period_end: 1_800_000_000 }],
      },
    } as unknown as Stripe.Subscription);

    expect(snapshot).toEqual({
      id: "sub_1",
      customer_id: "cus_1",
      price_id: "price_1",
      status: "trialing",
      current_period_end: 1_800_000_000,
      cancel_at_period_end: true,
    });
  });

  it("takes a paid invoice's application fee from its payment, where Stripe records it", () => {
    const snapshot = toInvoiceSnapshot({
      id: "in_1",
      status: "paid",
      amount_paid: 3000,
      amount_due: 3000,
      currency: "usd",
      status_transitions: { paid_at: 1_800_000_000 },
      parent: { subscription_details: { subscription: "sub_1" } },
      payments: {
        data: [
          {
            status: "paid",
            payment: { payment_intent: { application_fee_amount: 150 } },
          },
          {
            status: "canceled",
            payment: { payment_intent: { application_fee_amount: 999 } },
          },
        ],
      },
    } as unknown as Stripe.Invoice);

    expect(snapshot).toEqual({
      id: "in_1",
      subscription_id: "sub_1",
      amount: 3000,
      application_fee: 150,
      currency: "usd",
      status: "paid",
      paid_at: 1_800_000_000,
    });
  });

  it("records a failed invoice as failed, for the amount that was due, with no fee", () => {
    const snapshot = toInvoiceSnapshot({
      id: "in_2",
      status: "open",
      amount_paid: 0,
      amount_due: 3000,
      currency: "usd",
      status_transitions: { paid_at: null },
      parent: { subscription_details: { subscription: { id: "sub_1" } } },
      payments: { data: [] },
    } as unknown as Stripe.Invoice);

    expect(snapshot).toMatchObject({
      subscription_id: "sub_1",
      status: "failed",
      amount: 3000,
      application_fee: 0,
      paid_at: null,
    });
  });
});

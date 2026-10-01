import type Stripe from "stripe";
import { describe, expect, it, vi } from "vitest";
import {
  INVOICE_WINDOW_DAYS,
  invoiceSnapshotsToRecord,
  missingPaymentIntentIds,
  reconcileAll,
  type ReconcileDependencies,
} from "@/lib/stripe/reconcile";
import type { SubscriptionSnapshot } from "@/lib/stripe/webhooks";

const NOW = new Date("2026-10-01T00:00:00Z");

function subscription(id: string): SubscriptionSnapshot {
  return {
    id,
    customer_id: "cus_1",
    price_id: "price_1",
    status: "active",
    current_period_end: 1_800_000_000,
    cancel_at: null,
  };
}

/** Two businesses, each with one correction of every kind to make, unless overridden. */
function fakeDependencies(
  overrides: Partial<ReconcileDependencies> = {},
): ReconcileDependencies {
  return {
    listConnectedBusinesses: vi.fn(async () => [
      { businessId: "biz_a", accountId: "acct_a" },
      { businessId: "biz_b", accountId: "acct_b" },
    ]),
    retrieveAccount: vi.fn(async () => ({ charges_enabled: true })),
    listSubscriptions: vi.fn(async (accountId: string) => [
      subscription(`sub_${accountId}`),
    ]),
    listInvoices: vi.fn(async () => []),
    startRun: vi.fn(async () => "run_1"),
    finishRun: vi.fn(async () => {}),
    reconcileAccount: vi.fn(async () => 1),
    reconcileSubscriptions: vi.fn(async () => 1),
    reconcilePayments: vi.fn(async () => 1),
    now: () => NOW,
    ...overrides,
  };
}

describe("reconcileAll", () => {
  it("checks every business and records the run with its totals", async () => {
    const dependencies = fakeDependencies();

    const result = await reconcileAll(dependencies);

    const expected = {
      runId: "run_1",
      status: "succeeded",
      businessesChecked: 2,
      corrections: 6,
      errors: [],
    };
    expect(result).toEqual(expected);
    expect(dependencies.finishRun).toHaveBeenCalledWith(expected);
    expect(dependencies.reconcileSubscriptions).toHaveBeenCalledWith(
      "run_1",
      "acct_b",
      [subscription("sub_acct_b")],
    );
  });

  it("applies the account, then subscriptions, then payments (which need their subscription)", async () => {
    const calls: string[] = [];
    const dependencies = fakeDependencies({
      listConnectedBusinesses: async () => [
        { businessId: "biz_a", accountId: "acct_a" },
      ],
      reconcileAccount: async () => (calls.push("account"), 0),
      reconcileSubscriptions: async () => (calls.push("subscriptions"), 0),
      reconcilePayments: async () => (calls.push("payments"), 0),
    });

    await reconcileAll(dependencies);

    expect(calls).toEqual(["account", "subscriptions", "payments"]);
  });

  it(`re-reads invoices from the last ${INVOICE_WINDOW_DAYS} days`, async () => {
    const dependencies = fakeDependencies();

    await reconcileAll(dependencies);

    const since = NOW.getTime() / 1000 - INVOICE_WINDOW_DAYS * 24 * 60 * 60;
    expect(dependencies.listInvoices).toHaveBeenCalledWith("acct_a", since);
  });

  it("records a business that fails and carries on with the others", async () => {
    const dependencies = fakeDependencies({
      retrieveAccount: vi.fn(async (accountId: string) => {
        if (accountId === "acct_a") throw new Error("No such account: acct_a");
        return { charges_enabled: true };
      }),
    });

    const result = await reconcileAll(dependencies);

    expect(result).toMatchObject({
      status: "failed",
      businessesChecked: 1,
      corrections: 3,
      errors: [{ businessId: "biz_a", message: "No such account: acct_a" }],
    });
    expect(dependencies.reconcileAccount).toHaveBeenCalledTimes(1);
    expect(dependencies.finishRun).toHaveBeenCalledWith(result);
  });

  it("finishes the run as failed when the businesses can't be listed", async () => {
    const dependencies = fakeDependencies({
      listConnectedBusinesses: async () => {
        throw new Error("database unavailable");
      },
    });

    const result = await reconcileAll(dependencies);

    expect(result).toMatchObject({
      status: "failed",
      businessesChecked: 0,
      errors: [{ businessId: null, message: "database unavailable" }],
    });
    expect(dependencies.finishRun).toHaveBeenCalledWith(result);
  });
});

function invoice(overrides: Partial<Stripe.Invoice>): Stripe.Invoice {
  return {
    id: "in_1",
    status: "paid",
    attempt_count: 1,
    amount_paid: 3000,
    amount_due: 3000,
    currency: "usd",
    status_transitions: { paid_at: 1_800_000_000 },
    parent: { subscription_details: { subscription: "sub_1" } },
    payments: {
      data: [{ status: "paid", payment: { payment_intent: "pi_1" } }],
    },
    ...overrides,
  } as unknown as Stripe.Invoice;
}

const intentWithFee = {
  id: "pi_1",
  application_fee_amount: 150,
} as Stripe.PaymentIntent;

describe("invoiceSnapshotsToRecord", () => {
  it("takes a paid invoice's fee from its PaymentIntent", () => {
    expect(
      invoiceSnapshotsToRecord(
        [invoice({})],
        new Map([["pi_1", intentWithFee]]),
      ),
    ).toEqual([
      {
        id: "in_1",
        subscription_id: "sub_1",
        amount: 3000,
        application_fee: 150,
        currency: "usd",
        status: "paid",
        paid_at: 1_800_000_000,
      },
    ]);
  });

  it("records invoices whose payment failed", () => {
    const snapshots = invoiceSnapshotsToRecord(
      [
        invoice({ id: "in_retrying", status: "open", attempt_count: 2 }),
        invoice({ id: "in_given_up", status: "uncollectible" }),
      ],
      new Map(),
    );

    expect(snapshots.map(({ id, status }) => ({ id, status }))).toEqual([
      { id: "in_retrying", status: "failed" },
      { id: "in_given_up", status: "failed" },
    ]);
  });

  it("skips invoices with no payment to record, and ones that aren't for a membership", () => {
    expect(
      invoiceSnapshotsToRecord(
        [
          invoice({ id: "in_draft", status: "draft" }),
          invoice({ id: "in_void", status: "void" }),
          invoice({ id: "in_not_tried", status: "open", attempt_count: 0 }),
          invoice({ id: "in_one_off", parent: null }),
        ],
        new Map(),
      ),
    ).toEqual([]);
  });
});

describe("missingPaymentIntentIds", () => {
  it("lists the PaymentIntents of paid payments that weren't fetched yet, once each", () => {
    const invoices = [
      invoice({ id: "in_1" }),
      invoice({
        id: "in_2",
        payments: {
          data: [
            { status: "paid", payment: { payment_intent: "pi_2" } },
            { status: "failed", payment: { payment_intent: "pi_failed" } },
          ],
        } as Stripe.ApiList<Stripe.InvoicePayment>,
      }),
      invoice({
        id: "in_3",
        payments: {
          data: [{ status: "paid", payment: { payment_intent: "pi_2" } }],
        } as Stripe.ApiList<Stripe.InvoicePayment>,
      }),
    ];

    expect(
      missingPaymentIntentIds(invoices, new Map([["pi_1", intentWithFee]])),
    ).toEqual(["pi_2"]);
  });
});

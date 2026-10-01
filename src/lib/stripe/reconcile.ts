import type Stripe from "stripe";
import { errorMessage } from "@/lib/redact";
import {
  type InvoiceSnapshot,
  type SubscriptionSnapshot,
  toInvoiceSnapshot,
} from "@/lib/stripe/webhooks";

/** How far back each run re-reads invoices: more than one monthly billing cycle. */
export const INVOICE_WINDOW_DAYS = 35;

export type RunResult = {
  runId: string;
  status: "succeeded" | "failed";
  /** Businesses whose account, subscriptions and payments were all checked. */
  businessesChecked: number;
  corrections: number;
  /** businessId is null when the run couldn't even list the businesses. */
  errors: { businessId: string | null; message: string }[];
};

/** What a run needs from the outside world; injected so tests can fake it. */
export type ReconcileDependencies = {
  /** Every business with a connected Stripe account. */
  listConnectedBusinesses: () => Promise<
    { businessId: string; accountId: string }[]
  >;
  retrieveAccount: (
    accountId: string,
  ) => Promise<Pick<Stripe.Account, "charges_enabled">>;
  /** Every subscription on the account, in any status. */
  listSubscriptions: (accountId: string) => Promise<SubscriptionSnapshot[]>;
  /** The account's membership invoices worth recording, created since `since` (Unix seconds). */
  listInvoices: (
    accountId: string,
    since: number,
  ) => Promise<InvoiceSnapshot[]>;
  startRun: () => Promise<string>;
  finishRun: (result: RunResult) => Promise<void>;
  /** Each applies Stripe's view and logs what it changed; returns how many corrections. */
  reconcileAccount: (
    runId: string,
    accountId: string,
    chargesEnabled: boolean,
  ) => Promise<number>;
  reconcileSubscriptions: (
    runId: string,
    accountId: string,
    subscriptions: SubscriptionSnapshot[],
  ) => Promise<number>;
  reconcilePayments: (
    runId: string,
    accountId: string,
    invoices: InvoiceSnapshot[],
  ) => Promise<number>;
  now: () => Date;
};

/**
 * Brings every business's copy of its Stripe data back in line with Stripe. Businesses are
 * checked one at a time, and one that fails (a deleted account, a Stripe outage) is recorded
 * and skipped, so it can't stop the others. Every run that starts is also finished, with its
 * errors. Running it twice in a row corrects nothing the second time.
 */
export async function reconcileAll(
  dependencies: ReconcileDependencies,
): Promise<RunResult> {
  const runId = await dependencies.startRun();
  const since =
    Math.floor(dependencies.now().getTime() / 1000) -
    INVOICE_WINDOW_DAYS * 24 * 60 * 60;
  const result: RunResult = {
    runId,
    status: "succeeded",
    businessesChecked: 0,
    corrections: 0,
    errors: [],
  };

  let businesses: Awaited<
    ReturnType<ReconcileDependencies["listConnectedBusinesses"]>
  > = [];
  try {
    businesses = await dependencies.listConnectedBusinesses();
  } catch (error) {
    result.errors.push({ businessId: null, message: errorMessage(error) });
  }

  for (const { businessId, accountId } of businesses) {
    try {
      const account = await dependencies.retrieveAccount(accountId);
      result.corrections += await dependencies.reconcileAccount(
        runId,
        accountId,
        account.charges_enabled,
      );
      // Subscriptions before payments: a payment is linked through its subscription.
      result.corrections += await dependencies.reconcileSubscriptions(
        runId,
        accountId,
        await dependencies.listSubscriptions(accountId),
      );
      result.corrections += await dependencies.reconcilePayments(
        runId,
        accountId,
        await dependencies.listInvoices(accountId, since),
      );
      result.businessesChecked += 1;
    } catch (error) {
      result.errors.push({ businessId, message: errorMessage(error) });
    }
  }

  if (result.errors.length > 0) result.status = "failed";
  await dependencies.finishRun(result);
  return result;
}

function subscriptionIdOf(invoice: Stripe.Invoice) {
  const subscription = invoice.parent?.subscription_details?.subscription;
  if (!subscription) return null;
  return typeof subscription === "string" ? subscription : subscription.id;
}

/**
 * Membership invoices whose outcome we record: paid ones, and ones whose payment has failed
 * (still open after an attempt, or given up on). Drafts, voided invoices and invoices nobody has
 * tried to collect yet have no payment to record.
 */
function shouldRecord(invoice: Stripe.Invoice) {
  if (!subscriptionIdOf(invoice)) return false;
  return (
    invoice.status === "paid" ||
    invoice.status === "uncollectible" ||
    (invoice.status === "open" && invoice.attempt_count > 0)
  );
}

function paymentIntentIdOf(payment: Stripe.InvoicePayment) {
  const intent = payment.payment.payment_intent;
  if (!intent) return null;
  return typeof intent === "string" ? intent : intent.id;
}

/**
 * The PaymentIntents a run still has to fetch to know the fees on these invoices. A list call
 * can't expand that deep (Stripe stops at four levels), so the caller lists the account's recent
 * PaymentIntents and fetches any this returns one by one.
 */
export function missingPaymentIntentIds(
  invoices: Stripe.Invoice[],
  intents: ReadonlyMap<string, Stripe.PaymentIntent>,
): string[] {
  const ids = invoices
    .filter(shouldRecord)
    .flatMap((invoice) => invoice.payments?.data ?? [])
    .filter((payment) => payment.status === "paid")
    .map(paymentIntentIdOf)
    .filter((id): id is string => id !== null && !intents.has(id));
  return [...new Set(ids)];
}

/**
 * Snapshots of the invoices to record, from invoices listed with `data.payments` expanded and the
 * PaymentIntents those payments point to (where Stripe keeps the platform's fee).
 */
export function invoiceSnapshotsToRecord(
  invoices: Stripe.Invoice[],
  intents: ReadonlyMap<string, Stripe.PaymentIntent>,
): InvoiceSnapshot[] {
  return invoices.filter(shouldRecord).map((invoice) =>
    toInvoiceSnapshot({
      ...invoice,
      payments: invoice.payments && {
        ...invoice.payments,
        data: invoice.payments.data.map((payment) => {
          const id = paymentIntentIdOf(payment);
          return {
            ...payment,
            payment: {
              ...payment.payment,
              payment_intent:
                (id && intents.get(id)) || payment.payment.payment_intent,
            },
          };
        }),
      },
    }),
  );
}

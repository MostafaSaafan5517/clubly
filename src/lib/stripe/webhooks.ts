import type Stripe from "stripe";

/** The parts of a Stripe subscription we keep, shaped as the database functions expect. */
export type SubscriptionSnapshot = {
  id: string;
  customer_id: string;
  price_id: string | null;
  status: Stripe.Subscription.Status;
  current_period_end: number | null;
  cancel_at_period_end: boolean;
};

/** The parts of a Stripe invoice we keep, shaped as the database functions expect. */
export type InvoiceSnapshot = {
  id: string;
  subscription_id: string | null;
  amount: number;
  application_fee: number;
  currency: string;
  status: "paid" | "failed";
  paid_at: number | null;
};

export type EventOutcome = "applied" | "duplicate" | "ignored";

function idOf(value: string | { id: string } | null | undefined) {
  if (!value) return null;
  return typeof value === "string" ? value : value.id;
}

export function toSubscriptionSnapshot(
  subscription: Stripe.Subscription,
): SubscriptionSnapshot {
  // Each of our subscriptions has exactly one item: the plan's price.
  const item = subscription.items.data[0];
  return {
    id: subscription.id,
    customer_id:
      typeof subscription.customer === "string"
        ? subscription.customer
        : subscription.customer.id,
    price_id: item?.price.id ?? null,
    status: subscription.status,
    // Billing periods live on subscription items in current Stripe API versions.
    current_period_end: item?.current_period_end ?? null,
    cancel_at_period_end: subscription.cancel_at_period_end,
  };
}

export function toInvoiceSnapshot(invoice: Stripe.Invoice): InvoiceSnapshot {
  const paid = invoice.status === "paid";
  // With direct charges the platform's fee is recorded on the payment, not on the invoice.
  // Needs the invoice retrieved with `payments.data.payment.payment_intent` expanded.
  const applicationFee = (invoice.payments?.data ?? []).reduce(
    (total, invoicePayment) => {
      const intent = invoicePayment.payment.payment_intent;
      if (
        invoicePayment.status !== "paid" ||
        typeof intent !== "object" ||
        !intent
      ) {
        return total;
      }
      return total + (intent.application_fee_amount ?? 0);
    },
    0,
  );
  return {
    id: invoice.id,
    subscription_id: idOf(invoice.parent?.subscription_details?.subscription),
    amount: paid ? invoice.amount_paid : invoice.amount_due,
    application_fee: paid ? applicationFee : 0,
    currency: invoice.currency,
    status: paid ? "paid" : "failed",
    paid_at: invoice.status_transitions.paid_at ?? null,
  };
}

/** What handling an event needs from the outside world; injected so tests can fake it. */
export type WebhookDependencies = {
  /** Stripe's current view of a connected account. */
  retrieveAccount: (
    accountId: string,
  ) => Promise<Pick<Stripe.Account, "id" | "charges_enabled">>;
  /** Stripe's current view of a subscription on a connected account. */
  retrieveSubscription: (
    subscriptionId: string,
    accountId: string,
  ) => Promise<SubscriptionSnapshot>;
  /** Stripe's current view of an invoice on a connected account. */
  retrieveInvoice: (
    invoiceId: string,
    accountId: string,
  ) => Promise<InvoiceSnapshot>;
  /** Records the event and applies it atomically; false if it was already processed. */
  applyAccountUpdated: (update: {
    eventId: string;
    accountId: string;
    chargesEnabled: boolean;
  }) => Promise<boolean>;
  /** Records the event and upserts the subscription, atomically. */
  applySubscriptionEvent: (update: {
    eventId: string;
    eventType: string;
    accountId: string;
    subscription: SubscriptionSnapshot;
  }) => Promise<EventOutcome>;
  /** Records the event and upserts the subscription and its payment, atomically. */
  applyInvoiceEvent: (update: {
    eventId: string;
    eventType: string;
    accountId: string;
    subscription: SubscriptionSnapshot;
    invoice: InvoiceSnapshot;
  }) => Promise<EventOutcome>;
};

// Stripe can deliver events late, twice or out of order, so a payload may be stale. Every case
// below treats the event as a nudge: it asks Stripe for the object as it is right now and
// stores that. The order events arrive in then doesn't matter.
export async function handleStripeEvent(
  event: Stripe.Event,
  dependencies: WebhookDependencies,
): Promise<EventOutcome> {
  async function applySubscription(subscriptionId: string, accountId: string) {
    const subscription = await dependencies.retrieveSubscription(
      subscriptionId,
      accountId,
    );
    return dependencies.applySubscriptionEvent({
      eventId: event.id,
      eventType: event.type,
      accountId,
      subscription,
    });
  }

  switch (event.type) {
    case "account.updated": {
      const account = await dependencies.retrieveAccount(event.data.object.id);
      const applied = await dependencies.applyAccountUpdated({
        eventId: event.id,
        accountId: account.id,
        chargesEnabled: account.charges_enabled,
      });
      return applied ? "applied" : "duplicate";
    }

    // Members' subscriptions live on businesses' connected accounts, so these events always
    // name one (`event.account`); anything else isn't ours.
    case "checkout.session.completed": {
      const session = event.data.object;
      const subscriptionId = idOf(session.subscription);
      if (
        session.mode !== "subscription" ||
        !subscriptionId ||
        !event.account
      ) {
        return "ignored";
      }
      return applySubscription(subscriptionId, event.account);
    }
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      if (!event.account) return "ignored";
      return applySubscription(event.data.object.id, event.account);
    }
    case "invoice.paid":
    case "invoice.payment_failed": {
      if (!event.account) return "ignored";
      const invoice = await dependencies.retrieveInvoice(
        event.data.object.id,
        event.account,
      );
      // Only membership (subscription) invoices are ours to record.
      if (!invoice.subscription_id) return "ignored";
      const subscription = await dependencies.retrieveSubscription(
        invoice.subscription_id,
        event.account,
      );
      return dependencies.applyInvoiceEvent({
        eventId: event.id,
        eventType: event.type,
        accountId: event.account,
        subscription,
        invoice,
      });
    }
    default:
      return "ignored";
  }
}

/**
 * Verifies a webhook request's signature, then handles the event. Status codes tell Stripe
 * what to do next: 2xx means done, 400 means never retry (not from Stripe), and 500 means
 * retry later, which is safe because handling is idempotent.
 */
export async function handleWebhookRequest(
  request: Request,
  options: {
    stripe: Stripe;
    webhookSecret: string;
    dependencies: WebhookDependencies;
  },
): Promise<Response> {
  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return new Response("Missing Stripe signature", { status: 400 });
  }

  // The signature covers the exact bytes Stripe sent, so read the raw body, not parsed JSON.
  const payload = await request.text();
  let event: Stripe.Event;
  try {
    event = options.stripe.webhooks.constructEvent(
      payload,
      signature,
      options.webhookSecret,
    );
  } catch {
    return new Response("Invalid Stripe signature", { status: 400 });
  }

  try {
    const outcome = await handleStripeEvent(event, options.dependencies);
    return Response.json({ received: true, outcome });
  } catch (error) {
    console.error("Stripe webhook failed", {
      eventId: event.id,
      type: event.type,
      message: error instanceof Error ? error.message : String(error),
    });
    return new Response("Processing failed", { status: 500 });
  }
}

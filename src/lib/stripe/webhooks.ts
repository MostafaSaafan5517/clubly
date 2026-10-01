import type Stripe from "stripe";

/** What handling an event needs from the outside world; injected so tests can fake it. */
export type WebhookDependencies = {
  /** Stripe's current view of a connected account. */
  retrieveAccount: (
    accountId: string,
  ) => Promise<Pick<Stripe.Account, "id" | "charges_enabled">>;
  /** Records the event and applies it atomically; false if it was already processed. */
  applyAccountUpdated: (update: {
    eventId: string;
    accountId: string;
    chargesEnabled: boolean;
  }) => Promise<boolean>;
};

export type EventOutcome = "applied" | "duplicate" | "ignored";

export async function handleStripeEvent(
  event: Stripe.Event,
  dependencies: WebhookDependencies,
): Promise<EventOutcome> {
  switch (event.type) {
    case "account.updated": {
      // Stripe can deliver events late, twice or out of order, so the payload may be stale.
      // Treat the event as a nudge and ask Stripe for the account as it is right now.
      const account = await dependencies.retrieveAccount(event.data.object.id);
      const applied = await dependencies.applyAccountUpdated({
        eventId: event.id,
        accountId: account.id,
        chargesEnabled: account.charges_enabled,
      });
      return applied ? "applied" : "duplicate";
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

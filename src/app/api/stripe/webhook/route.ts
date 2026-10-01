import { stripe } from "@/lib/stripe/server";
import {
  handleWebhookRequest,
  toInvoiceSnapshot,
  toSubscriptionSnapshot,
  type EventOutcome,
  type WebhookDependencies,
} from "@/lib/stripe/webhooks";
import { supabaseAdmin } from "@/lib/supabase/admin";

// Stripe calls this for events on connected accounts (a Connect webhook endpoint). Locally,
// `pnpm stripe:listen` forwards them here.

function toOutcome(value: string): EventOutcome {
  if (value === "applied" || value === "duplicate" || value === "ignored") {
    return value;
  }
  throw new Error(`Unexpected outcome from the database: ${value}`);
}

const dependencies: WebhookDependencies = {
  retrieveAccount: (accountId) => stripe.accounts.retrieve(accountId),
  retrieveSubscription: async (subscriptionId, accountId) =>
    toSubscriptionSnapshot(
      await stripe.subscriptions.retrieve(
        subscriptionId,
        {},
        { stripeAccount: accountId },
      ),
    ),
  retrieveInvoice: async (invoiceId, accountId) =>
    toInvoiceSnapshot(
      await stripe.invoices.retrieve(
        invoiceId,
        // The application fee is on the payment's PaymentIntent.
        { expand: ["payments.data.payment.payment_intent"] },
        { stripeAccount: accountId },
      ),
    ),
  applyAccountUpdated: async ({ eventId, accountId, chargesEnabled }) => {
    const { data, error } = await supabaseAdmin.rpc("apply_account_updated", {
      event_id: eventId,
      account_id: accountId,
      charges_enabled: chargesEnabled,
    });
    if (error) {
      throw new Error(`apply_account_updated failed: ${error.message}`);
    }
    return data;
  },
  applySubscriptionEvent: async ({
    eventId,
    eventType,
    accountId,
    subscription,
  }) => {
    const { data, error } = await supabaseAdmin.rpc(
      "apply_subscription_event",
      {
        event_id: eventId,
        event_type: eventType,
        account_id: accountId,
        subscription,
      },
    );
    if (error) {
      throw new Error(`apply_subscription_event failed: ${error.message}`);
    }
    return toOutcome(data);
  },
  applyInvoiceEvent: async ({
    eventId,
    eventType,
    accountId,
    subscription,
    invoice,
  }) => {
    const { data, error } = await supabaseAdmin.rpc("apply_invoice_event", {
      event_id: eventId,
      event_type: eventType,
      account_id: accountId,
      subscription,
      invoice,
    });
    if (error) {
      throw new Error(`apply_invoice_event failed: ${error.message}`);
    }
    return toOutcome(data);
  },
};

export async function POST(request: Request) {
  // Read per request (not at import) so a missing secret fails loudly here, not the build.
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error("STRIPE_WEBHOOK_SECRET is not set; refusing webhook.");
    return new Response("Webhook secret not configured", { status: 500 });
  }
  return handleWebhookRequest(request, { stripe, webhookSecret, dependencies });
}

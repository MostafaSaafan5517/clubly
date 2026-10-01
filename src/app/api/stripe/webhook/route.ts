import { stripe } from "@/lib/stripe/server";
import {
  handleWebhookRequest,
  type WebhookDependencies,
} from "@/lib/stripe/webhooks";
import { supabaseAdmin } from "@/lib/supabase/admin";

// Stripe calls this for events on connected accounts (a Connect webhook endpoint). Locally,
// `pnpm stripe:listen` forwards them here.

const dependencies: WebhookDependencies = {
  retrieveAccount: (accountId) => stripe.accounts.retrieve(accountId),
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

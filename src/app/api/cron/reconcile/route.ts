import { isAuthorizedCronRequest } from "@/lib/cron";
import {
  invoiceSnapshotsToRecord,
  missingPaymentIntentIds,
  reconcileAll,
  type ReconcileDependencies,
} from "@/lib/stripe/reconcile";
import { stripe } from "@/lib/stripe/server";
import { toSubscriptionSnapshot } from "@/lib/stripe/webhooks";
import { supabaseAdmin } from "@/lib/supabase/admin";

// Vercel Cron calls this once a day (see vercel.json). Locally, call it with the secret:
//   curl -H "Authorization: Bearer $CRON_SECRET" localhost:3000/api/cron/reconcile

// The most objects of one kind a run reads from one account.
const LIST_LIMIT = 10_000;
const ONE_DAY = 24 * 60 * 60;

async function listInvoices(accountId: string, since: number) {
  const options = { stripeAccount: accountId };
  const invoices = await stripe.invoices
    .list(
      { created: { gte: since }, expand: ["data.payments"], limit: 100 },
      options,
    )
    .autoPagingToArray({ limit: LIST_LIMIT });
  // The fees are on the PaymentIntents. Listing the account's recent ones covers almost every
  // invoice in a call or two; any it misses (paid a day or more after being created) are
  // fetched one by one.
  const recentIntents = await stripe.paymentIntents
    .list({ created: { gte: since - ONE_DAY }, limit: 100 }, options)
    .autoPagingToArray({ limit: LIST_LIMIT });
  const intents = new Map(recentIntents.map((intent) => [intent.id, intent]));
  for (const id of missingPaymentIntentIds(invoices, intents)) {
    intents.set(id, await stripe.paymentIntents.retrieve(id, {}, options));
  }
  return invoiceSnapshotsToRecord(invoices, intents);
}

const dependencies: ReconcileDependencies = {
  listConnectedBusinesses: async () => {
    const { data, error } = await supabaseAdmin
      .from("businesses")
      .select("id, stripe_account_id")
      .not("stripe_account_id", "is", null);
    if (error) throw new Error(`Could not list businesses: ${error.message}`);
    return data.flatMap(({ id, stripe_account_id }) =>
      stripe_account_id
        ? [{ businessId: id, accountId: stripe_account_id }]
        : [],
    );
  },
  retrieveAccount: (accountId) => stripe.accounts.retrieve(accountId),
  listSubscriptions: async (accountId) =>
    (
      await stripe.subscriptions
        .list({ status: "all", limit: 100 }, { stripeAccount: accountId })
        .autoPagingToArray({ limit: LIST_LIMIT })
    ).map(toSubscriptionSnapshot),
  listInvoices,
  startRun: async () => {
    const { data, error } = await supabaseAdmin
      .from("reconciliation_runs")
      .insert({ status: "running" })
      .select("id")
      .single();
    if (error) throw new Error(`Could not start the run: ${error.message}`);
    return data.id;
  },
  finishRun: async (result) => {
    const { error } = await supabaseAdmin
      .from("reconciliation_runs")
      .update({
        finished_at: new Date().toISOString(),
        status: result.status,
        businesses_checked: result.businessesChecked,
        corrections: result.corrections,
        errors: result.errors,
      })
      .eq("id", result.runId);
    if (error) throw new Error(`Could not finish the run: ${error.message}`);
  },
  reconcileAccount: async (runId, accountId, chargesEnabled) => {
    const { data, error } = await supabaseAdmin.rpc("reconcile_account", {
      run_id: runId,
      account_id: accountId,
      charges_enabled: chargesEnabled,
    });
    if (error) throw new Error(`reconcile_account failed: ${error.message}`);
    return data;
  },
  reconcileSubscriptions: async (runId, accountId, subscriptions) => {
    const { data, error } = await supabaseAdmin.rpc("reconcile_subscriptions", {
      run_id: runId,
      account_id: accountId,
      snapshots: subscriptions,
    });
    if (error) {
      throw new Error(`reconcile_subscriptions failed: ${error.message}`);
    }
    return data;
  },
  reconcilePayments: async (runId, accountId, invoices) => {
    const { data, error } = await supabaseAdmin.rpc("reconcile_payments", {
      run_id: runId,
      account_id: accountId,
      snapshots: invoices,
    });
    if (error) throw new Error(`reconcile_payments failed: ${error.message}`);
    return data;
  },
  now: () => new Date(),
};

export async function GET(request: Request) {
  // Read per request (not at import) so a missing secret fails loudly here, not the build.
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error("CRON_SECRET is not set; refusing to reconcile.");
    return new Response("Cron secret not configured", { status: 500 });
  }
  if (!isAuthorizedCronRequest(request, secret)) {
    return new Response("Unauthorized", { status: 401 });
  }

  const result = await reconcileAll(dependencies);
  if (result.status === "failed") {
    console.error("Reconciliation finished with errors", {
      runId: result.runId,
      errors: result.errors,
    });
  }
  // A failed run still checked every business it could; the status code flags it in Vercel's
  // cron logs.
  return Response.json(result, {
    status: result.status === "failed" ? 500 : 200,
  });
}

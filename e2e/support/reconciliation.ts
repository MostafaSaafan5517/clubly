import type { APIRequestContext } from "@playwright/test";
import { adminClient } from "./supabase";

export type ReconciliationRun = {
  runId: string;
  status: "succeeded" | "failed";
  businessesChecked: number;
  corrections: number;
  errors: { businessId: string | null; message: string }[];
};

/** Calls the reconciliation endpoint the way Vercel Cron does. */
export async function runReconciliation(request: APIRequestContext) {
  const secret = process.env.CRON_SECRET;
  if (!secret) throw new Error("Missing CRON_SECRET: run `pnpm env:local`.");
  const response = await request.get("/api/cron/reconcile", {
    headers: { authorization: `Bearer ${secret}` },
    timeout: 120_000,
  });
  // A run reports 500 when any business failed; other tests' businesses are in the same
  // database, so callers check their own business's corrections rather than the status.
  return (await response.json()) as ReconciliationRun;
}

/** The corrections a run made to one business (service role), oldest first. */
export async function reconciliationCorrections(
  runId: string,
  businessId: string,
) {
  const { data, error } = await adminClient()
    .from("reconciliation_corrections")
    .select("object_type, stripe_id, old_data, new_data")
    .eq("run_id", runId)
    .eq("business_id", businessId)
    .order("id");
  if (error) throw error;
  return data;
}

// Writes the Stripe CLI's webhook signing secret into .env.local, without printing it.
// Usage (via `pnpm env:stripe`): stripe listen --print-secret | node scripts/write-stripe-webhook-secret.mjs
// The CLI's secret stays the same across `stripe listen` runs on this machine.
import { readFileSync } from "node:fs";
import { ENV_FILE, setEnvValues } from "./env-file.mjs";

const secret = readFileSync(0, "utf8").trim();
if (!secret.startsWith("whsec_")) {
  throw new Error(
    "No webhook secret on stdin. Is the Stripe CLI installed and logged in (`stripe login`)?",
  );
}

setEnvValues({ STRIPE_WEBHOOK_SECRET: secret });
process.stdout.write(`Wrote STRIPE_WEBHOOK_SECRET to ${ENV_FILE}\n`);

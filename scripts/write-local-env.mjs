// Writes the local Supabase URL and keys into .env.local, and a cron secret if there isn't one.
// Usage (via `pnpm env:local`): supabase status -o json | node scripts/write-local-env.mjs
// Only those lines are written; anything else in .env.local (Stripe keys, ...) is kept.
import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { ENV_FILE, readEnvValue, setEnvValues } from "./env-file.mjs";

const input = readFileSync(0, "utf8");
const jsonStart = input.indexOf("{");
if (jsonStart === -1) {
  throw new Error(
    "No JSON on stdin. Is local Supabase running? Try `pnpm supabase start`.",
  );
}
const status = JSON.parse(input.slice(jsonStart));

const values = {
  NEXT_PUBLIC_SUPABASE_URL: status.API_URL,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: status.PUBLISHABLE_KEY,
  SUPABASE_SECRET_KEY: status.SECRET_KEY,
};

const missing = Object.entries(values)
  .filter(([, value]) => !value)
  .map(([name]) => name);
if (missing.length > 0) {
  throw new Error(
    `supabase status did not report ${missing.join(", ")}. Start the full stack with ` +
      "`pnpm supabase start` (not `db start`).",
  );
}

// Any random value works locally; generated once and then kept.
values.CRON_SECRET =
  readEnvValue("CRON_SECRET") ?? randomBytes(32).toString("hex");

setEnvValues(values);
process.stdout.write(
  `Wrote ${Object.keys(values).join(", ")} to ${ENV_FILE}\n`,
);

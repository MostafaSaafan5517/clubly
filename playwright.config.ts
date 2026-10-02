import { existsSync } from "node:fs";
import { defineConfig, devices } from "@playwright/test";

// Test helpers call Supabase directly (for example to create a confirmed user), so they need
// the same local settings as the app. `pnpm env:local` writes them.
if (existsSync(".env.local")) process.loadEnvFile(".env.local");

const isCI = Boolean(process.env.CI);
// `pnpm test:smoke` points the read-only smoke test at a deployed app instead (E2E_BASE_URL).
// It starts no servers and runs nothing else: the rest of the suite writes to the database.
const smokeURL = process.env.E2E_BASE_URL;
const baseURL = smokeURL ?? "http://localhost:3000";

export default defineConfig({
  testDir: "./e2e",
  testMatch: smokeURL ? "smoke.spec.ts" : "*.spec.ts",
  testIgnore: smokeURL ? [] : ["smoke.spec.ts"],
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  reporter: isCI ? [["github"], ["html", { open: "never" }]] : "list",
  // Locally the dev server compiles each route on its first visit, which can take several
  // seconds while tests run in parallel (and some tests also wait on the Stripe sandbox). CI
  // runs the production build and keeps Playwright's defaults.
  timeout: isCI ? 30_000 : 60_000,
  expect: { timeout: isCI ? 5_000 : 15_000 },
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: smokeURL
    ? undefined
    : [
        {
          // CI tests the production build (`pnpm build` runs first); locally the dev server
          // is enough.
          command: isCI ? "pnpm start" : "pnpm dev",
          url: baseURL,
          reuseExistingServer: !isCI,
        },
        {
          // Forwards the sandbox's events to the app, signed like Stripe signs them in
          // production, so tests can follow a payment from Stripe Checkout to the database.
          // Needs the Stripe CLI, logged in (`stripe login`) or given STRIPE_API_KEY, and
          // `pnpm env:stripe` run once. A second listener (say, one you're already running)
          // is harmless: the app records each event once.
          command: "pnpm stripe:listen",
          wait: { stderr: /Ready!/ },
        },
      ],
});

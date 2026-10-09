import { defineConfig, devices } from "@playwright/test";
import base from "./playwright.config";

// Screenshots of every screen and state, for the design audit and its before/after comparison:
// `pnpm build`, then `SCREENS_DIR=docs/design/before pnpm screens`. It serves the production
// build (the dev server adds its own badge to every page) against the local database with the
// demo gym seeded (`pnpm seed:demo`). Not a test suite: it records what it sees, and axe's
// findings, without judging them. It never opens Stripe Checkout or onboarding, so it needs no
// webhook listener.
export default defineConfig({
  ...base,
  testDir: "./scripts/screens",
  testMatch: "*.spec.ts",
  testIgnore: [],
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: "list",
  timeout: 360_000,
  expect: { timeout: 15_000 },
  // A wrong selector fails in seconds instead of using up the whole test.
  use: { ...base.use, trace: "off", actionTimeout: 30_000 },
  projects: [
    {
      name: "desktop",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 900 },
      },
    },
    {
      name: "mobile",
      // After desktop, so the two passes never change the same fixtures at once.
      dependencies: ["desktop"],
      use: {
        ...devices["Pixel 7"],
        viewport: { width: 390, height: 844 },
        deviceScaleFactor: 1,
      },
    },
  ],
  webServer: {
    command: "pnpm start",
    url: "http://localhost:3000",
    reuseExistingServer: false,
  },
});

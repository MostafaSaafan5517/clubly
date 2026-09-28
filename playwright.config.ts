import { existsSync } from "node:fs";
import { defineConfig, devices } from "@playwright/test";

// Test helpers call Supabase directly (for example to create a confirmed user), so they need
// the same local settings as the app. `pnpm env:local` writes them.
if (existsSync(".env.local")) process.loadEnvFile(".env.local");

const isCI = Boolean(process.env.CI);
const baseURL = "http://localhost:3000";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  reporter: isCI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    // CI tests the production build (`pnpm build` runs first); locally the dev server is enough.
    command: isCI ? "pnpm start" : "pnpm dev",
    url: baseURL,
    reuseExistingServer: !isCI,
  },
});

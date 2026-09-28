import { defineConfig } from "vitest/config";

export default defineConfig({
  // Reuse the `@/*` alias from tsconfig.json instead of defining it twice.
  resolve: { tsconfigPaths: true },
  test: {
    // Unit and integration tests live next to the code in src/.
    // Playwright specs (e2e/) run under Playwright, not Vitest.
    include: ["src/**/*.test.ts"],
  },
});

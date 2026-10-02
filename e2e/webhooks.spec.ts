import { expect, test } from "@playwright/test";
import {
  chargeReadyAccountId,
  countRecordedEvents,
  touchStripeAccount,
} from "./support/stripe";

// Stripe's real events reach the app here through the Stripe CLI listener that Playwright
// starts (playwright.config.ts), signed with the CLI's secret, exactly like production
// deliveries are signed with the endpoint's.

test("a real Stripe event reaches the app, passes the signature check and is recorded", async () => {
  test.setTimeout(240_000);
  const accountId = await chargeReadyAccountId();
  const before = await countRecordedEvents(accountId, "account.updated");

  await touchStripeAccount(accountId);

  await expect
    .poll(() => countRecordedEvents(accountId, "account.updated"), {
      timeout: 30_000,
    })
    .toBeGreaterThan(before);
});

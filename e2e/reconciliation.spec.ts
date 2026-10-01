import { expect, test } from "@playwright/test";

// The reconciliation itself is tested in billing.spec.ts, next to the other tests that use the
// shared Stripe account.

test("the reconciliation endpoint refuses callers without the cron secret", async ({
  request,
}) => {
  const anonymous = await request.get("/api/cron/reconcile");
  expect(anonymous.status()).toBe(401);

  const wrongSecret = await request.get("/api/cron/reconcile", {
    headers: { authorization: "Bearer not-the-secret" },
  });
  expect(wrongSecret.status()).toBe(401);
});

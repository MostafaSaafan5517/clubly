import { createHmac } from "node:crypto";
import { expect, type APIRequestContext, type Page } from "@playwright/test";

/**
 * Pays on Stripe's hosted Checkout page with Stripe's 4242 test card. The page asks for a postal
 * code only for some countries, so the test always picks the United States.
 */
export async function payWithTestCard(page: Page, cardholder: string) {
  await page.waitForURL(/^https:\/\/checkout\.stripe\.com\//);
  // With more than one payment method on offer, the card form starts folded away. Its toggle is
  // a zero-size button (a styled row covers it), so it gets a click event rather than a click.
  await expect(
    page.getByRole("heading", { name: /^Subscribe to/ }),
  ).toBeVisible({
    timeout: 30_000,
  });
  const cardNumber = page.getByRole("textbox", { name: "Card number" });
  const cardOption = page.getByTestId("card-accordion-item-button");
  if (!(await cardNumber.isVisible()) && (await cardOption.count()) > 0) {
    await cardOption.dispatchEvent("click");
  }

  await cardNumber.fill("4242424242424242");
  await page.getByRole("textbox", { name: "Expiration" }).fill("1234");
  await page.getByRole("textbox", { name: /CVC/ }).fill("123");
  await page
    .getByRole("textbox", { name: /Cardholder name|Full name on card/ })
    .fill(cardholder);
  await page
    .getByRole("combobox", { name: "Country or region" })
    .selectOption("US");
  await page.getByRole("textbox", { name: /ZIP/ }).fill("10001");
  await page.getByRole("button", { name: "Subscribe", exact: true }).click();
}

/**
 * Posts an event to the app's webhook route signed the way Stripe signs deliveries: an
 * HMAC-SHA256 of "<timestamp>.<body>" with the endpoint's secret, sent as
 * `Stripe-Signature: t=<timestamp>,v1=<signature>`.
 */
export async function deliverSignedEvent(
  request: APIRequestContext,
  event: object,
  secret = process.env.STRIPE_WEBHOOK_SECRET,
) {
  if (!secret)
    throw new Error("Missing STRIPE_WEBHOOK_SECRET: run `pnpm env:stripe`.");
  const body = JSON.stringify(event);
  const timestamp = Math.floor(Date.now() / 1000);
  const signature = createHmac("sha256", secret)
    .update(`${timestamp}.${body}`)
    .digest("hex");
  const response = await request.post("/api/stripe/webhook", {
    headers: {
      "content-type": "application/json",
      "stripe-signature": `t=${timestamp},v1=${signature}`,
    },
    data: body,
  });
  return response;
}

/** The outcome the webhook route reported for a delivery that it accepted. */
export async function deliveryOutcome(
  response: Awaited<ReturnType<APIRequestContext["post"]>>,
) {
  expect(response.status()).toBe(200);
  return ((await response.json()) as { outcome: string }).outcome;
}

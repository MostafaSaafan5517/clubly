import { expect, type Page } from "@playwright/test";

/** A business's card on the member's account page. */
export function membershipCard(page: Page, businessName: string) {
  return page.getByRole("listitem").filter({ hasText: businessName });
}

/**
 * Reloads the account page until the membership shows `text`. The page shows what Stripe's
 * webhooks have recorded, which can take a few seconds after a change in Stripe.
 */
export async function expectMembershipToShow(
  page: Page,
  businessName: string,
  text: string | RegExp,
) {
  await expect(async () => {
    await page.goto("/account");
    await expect(membershipCard(page, businessName)).toContainText(text, {
      timeout: 1_000,
    });
  }).toPass({ timeout: 30_000 });
}

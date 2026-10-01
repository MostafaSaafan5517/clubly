import { expect, type Page } from "@playwright/test";

// Scoped to the form: Next.js adds its own role="alert" element (the route announcer).
export function formError(page: Page) {
  return page.locator("form").getByRole("alert");
}

/** Fills and submits the sign-in form on the current page. */
export async function signIn(page: Page, email: string, password: string) {
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
}

/**
 * Signs in from the sign-in page and waits to land: on the dashboard, or on the account page
 * for someone who is only a member somewhere.
 */
export async function signInAs(
  page: Page,
  user: { email: string; password: string },
) {
  await page.goto("/login");
  await signIn(page, user.email, user.password);
  await expect(page).toHaveURL(/\/(dashboard|account)$/);
}

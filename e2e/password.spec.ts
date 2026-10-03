import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { DEMO_READ_ONLY_MESSAGE } from "@/lib/demo";
import { formError, signIn, signInAs } from "./support/forms";
import { countEmails, getEmailLink } from "./support/mailpit";
import { supabaseSettings } from "./support/supabase";
import {
  createConfirmedUser,
  markAsDemoAccount,
  uniqueEmail,
} from "./support/users";

const NEW_PASSWORD = "brand-new-pass-2";

test("a user who forgot their password resets it from an email link on another device", async ({
  page,
  browser,
}) => {
  const user = await createConfirmedUser();

  await page.goto("/login");
  await page.getByRole("link", { name: "Forgot your password?" }).click();
  await expect(page).toHaveURL(/\/forgot-password$/);
  await page.getByLabel("Email").fill(user.email);
  await page.getByRole("button", { name: "Email me a link" }).click();
  await expect(page.getByRole("status")).toContainText(
    `If ${user.email} has an account`,
  );

  // Opened in a fresh browser, like tapping the link on a phone.
  const resetLink = await getEmailLink(user.email, "/auth/confirm");
  const phone = await browser.newContext();
  const phonePage = await phone.newPage();
  await phonePage.goto(resetLink);
  await expect(phonePage).toHaveURL(/\/settings\/password$/);
  await expect(
    phonePage.getByText("Choose a new password", { exact: true }),
  ).toBeVisible();
  await expect(phonePage.getByLabel("Current password")).toHaveCount(0);
  await phonePage.getByLabel("New password").fill(NEW_PASSWORD);
  await phonePage.getByRole("button", { name: "Save password" }).click();
  await expect(phonePage.getByRole("status")).toContainText(
    "Your password is changed",
  );
  await phone.close();

  await page.goto("/login");
  await signIn(page, user.email, user.password);
  await expect(formError(page)).toHaveText("Wrong email or password.");
  await signIn(page, user.email, NEW_PASSWORD);
  await expect(page).toHaveURL(/\/dashboard$/);

  // Reset links are single-use.
  const laptop = await browser.newContext();
  const laptopPage = await laptop.newPage();
  await laptopPage.goto(resetLink);
  await expect(laptopPage).toHaveURL(/\/login\?error=link$/);
  await laptop.close();
});

test("asking for a reset link doesn't reveal whether an email has an account", async ({
  page,
}) => {
  const email = uniqueEmail("nobody");

  await page.goto("/forgot-password");
  await page.getByLabel("Email").fill(email);
  await page.getByRole("button", { name: "Email me a link" }).click();
  await expect(page.getByRole("status")).toContainText(
    `If ${email} has an account`,
  );
  // Time for an email to arrive, if one had been sent (the other test sees it within seconds).
  await page.waitForTimeout(3_000);
  expect(await countEmails(email)).toBe(0);
});

test("changing a password needs the current one, and ends the account's other sessions", async ({
  page,
}) => {
  const user = await createConfirmedUser();
  // Another device, signed in through the API.
  const { url, publishableKey } = supabaseSettings();
  const otherDevice = createClient(url, publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error: otherSignInError } =
    await otherDevice.auth.signInWithPassword(user);
  expect(otherSignInError).toBeNull();

  await signInAs(page, user);
  await page.getByRole("link", { name: "Settings" }).click();
  await expect(
    page.getByRole("region", { name: "Your account", exact: true }),
  ).toContainText(user.email);
  await page.getByRole("link", { name: "Change password" }).click();
  await expect(
    page.getByText("Change your password", { exact: true }),
  ).toBeVisible();

  await page.getByLabel("Current password").fill("not-my-password-1");
  await page.getByLabel("New password").fill(NEW_PASSWORD);
  await page.getByRole("button", { name: "Save password" }).click();
  await expect(formError(page)).toHaveText("Your current password is wrong.");

  await page.getByLabel("Current password").fill(user.password);
  await page.getByLabel("New password").fill("password");
  await page.getByRole("button", { name: "Save password" }).click();
  await expect(formError(page)).toHaveText(
    "Use at least 8 characters, with letters and numbers.",
  );

  await page.getByLabel("Current password").fill(user.password);
  await page.getByLabel("New password").fill(NEW_PASSWORD);
  await page.getByRole("button", { name: "Save password" }).click();
  await expect(page.getByRole("status")).toContainText(
    "Your password is changed",
  );

  // This browser stays signed in; the other device's session is over.
  await page.goto("/settings");
  await expect(page).toHaveURL(/\/settings$/);
  const { error: refreshError } = await otherDevice.auth.refreshSession();
  expect(refreshError).not.toBeNull();
});

test("a demo account can't change its password", async ({ page }) => {
  const user = await createConfirmedUser();
  await markAsDemoAccount(user.email);

  await signInAs(page, user);
  await page.goto("/settings/password");
  await page.getByLabel("Current password").fill(user.password);
  await page.getByLabel("New password").fill(NEW_PASSWORD);
  await page.getByRole("button", { name: "Save password" }).click();
  await expect(formError(page)).toHaveText(DEMO_READ_ONLY_MESSAGE);
});

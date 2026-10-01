import { expect, test } from "@playwright/test";
import { formError, signIn } from "./support/forms";
import { countEmails, getEmailLink } from "./support/mailpit";
import {
  createConfirmedUser,
  TEST_PASSWORD,
  uniqueEmail,
} from "./support/users";

test("a new user signs up, confirms their email on another device, and lands on the dashboard", async ({
  page,
  browser,
}) => {
  const email = uniqueEmail("signup");

  await page.goto("/signup");
  await page.getByLabel("Full name").fill("Casey Tester");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(TEST_PASSWORD);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByText("Check your email")).toBeVisible();

  // Signing in before confirming explains what to do.
  await page.goto("/login");
  await signIn(page, email, TEST_PASSWORD);
  await expect(formError(page)).toHaveText(
    "Confirm your email first: open the link we sent you.",
  );

  // Opened in a fresh browser, like tapping the link on a phone: the token-hash link must not
  // depend on anything stored by the browser that signed up.
  const confirmLink = await getEmailLink(email, "/auth/confirm");
  const phone = await browser.newContext();
  const phonePage = await phone.newPage();
  await phonePage.goto(confirmLink);
  await expect(phonePage).toHaveURL(/\/dashboard$/);
  await expect(
    phonePage.getByRole("heading", { name: "Welcome, Casey Tester" }),
  ).toBeVisible();
  await phone.close();

  // Email links are single-use.
  const laptop = await browser.newContext();
  const laptopPage = await laptop.newPage();
  await laptopPage.goto(confirmLink);
  await expect(laptopPage).toHaveURL(/\/login\?error=link$/);
  await laptop.close();
});

test("a user signs in with their password and signs out", async ({ page }) => {
  const user = await createConfirmedUser("Pat Password");

  await page.goto("/login");
  await signIn(page, user.email, "not-the-password-1");
  await expect(formError(page)).toHaveText("Wrong email or password.");

  await signIn(page, user.email, user.password);
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByText(`Signed in as ${user.email}`)).toBeVisible();

  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/$/);
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login\?next=%2Fdashboard$/);
});

test("signing in returns to the page that asked for it", async ({ page }) => {
  const user = await createConfirmedUser();

  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login\?next=%2Fdashboard$/);
  await signIn(page, user.email, user.password);
  await expect(page).toHaveURL(/\/dashboard$/);
});

test("a sign-in link can't send the user to another site", async ({ page }) => {
  const user = await createConfirmedUser();

  await page.goto("/login?next=//evil.example/steal");
  await signIn(page, user.email, user.password);
  await expect(page).toHaveURL(/^http:\/\/localhost:3000\/dashboard$/);
});

test("an existing user signs in with an email link", async ({ page }) => {
  const user = await createConfirmedUser("Morgan Link");

  await page.goto("/login");
  await page
    .getByRole("link", { name: "Email me a sign-in link instead" })
    .click();
  // Both pages have an Email field: wait for the new page before typing into it.
  await expect(page).toHaveURL(/\/magic-link$/);
  await page.getByLabel("Email").fill(user.email);
  await page.getByRole("button", { name: "Email me a link" }).click();
  await expect(page.getByText("Check your email")).toBeVisible();

  await page.goto(await getEmailLink(user.email, "/auth/confirm"));
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(
    page.getByRole("heading", { name: "Welcome, Morgan Link" }),
  ).toBeVisible();
});

test("asking for a link for an unknown email looks the same and sends nothing", async ({
  page,
}) => {
  const email = uniqueEmail("nobody");

  await page.goto("/magic-link");
  await page.getByLabel("Email").fill(email);
  await page.getByRole("button", { name: "Email me a link" }).click();
  await expect(page.getByText("Check your email")).toBeVisible();
  expect(await countEmails(email)).toBe(0);
});

test("signing up from a page that needed sign-in comes back to that page after confirming", async ({
  page,
}) => {
  const email = uniqueEmail("return");

  await page.goto("/dashboard/new-business");
  await expect(page).toHaveURL(/\/login\?next=%2Fdashboard%2Fnew-business$/);
  await page.getByRole("link", { name: "Create an account" }).click();
  await expect(page).toHaveURL(/\/signup\?next=%2Fdashboard%2Fnew-business$/);

  await page.getByLabel("Full name").fill("Rhea Return");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(TEST_PASSWORD);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByText("Check your email")).toBeVisible();

  await page.goto(await getEmailLink(email, "/auth/confirm"));
  await expect(page).toHaveURL(/\/dashboard\/new-business$/);
});

test("an email link sign-in also comes back to the page that needed it", async ({
  page,
}) => {
  const user = await createConfirmedUser();

  await page.goto("/dashboard/new-business");
  await page
    .getByRole("link", { name: "Email me a sign-in link instead" })
    .click();
  await expect(page).toHaveURL(
    /\/magic-link\?next=%2Fdashboard%2Fnew-business$/,
  );
  await page.getByLabel("Email").fill(user.email);
  await page.getByRole("button", { name: "Email me a link" }).click();
  await expect(page.getByText("Check your email")).toBeVisible();

  await page.goto(await getEmailLink(user.email, "/auth/confirm"));
  await expect(page).toHaveURL(/\/dashboard\/new-business$/);
});

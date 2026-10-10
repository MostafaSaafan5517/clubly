import { expect, test } from "@playwright/test";
import { createBusinessFor, uniqueBusinessName } from "./support/businesses";
import { signInAs } from "./support/forms";
import { createConfirmedUser } from "./support/users";

// The two 404 pages: the public one for any address the app doesn't have, and the signed-in one,
// which keeps the header. Neither says why, so a business someone can't see reads exactly like
// one that doesn't exist. Headings are found by role: Next's route announcer copies the h1.

test("an unknown address answers 404, with a way back to the home page", async ({
  page,
}) => {
  const response = await page.goto("/no-such-page");
  expect(response?.status()).toBe(404);
  await expect(page).toHaveTitle(/^Page not found \|/);
  await expect(
    page.getByRole("heading", { level: 1, name: "Page not found" }),
  ).toBeVisible();

  await page.getByRole("link", { name: "Go to the home page" }).click();
  await expect(page).toHaveURL(/\/$/);
});

test("a signed-in 404 keeps the header and reads the same for a hidden business as a missing one", async ({
  page,
}) => {
  const owner = await createConfirmedUser();
  const outsider = await createConfirmedUser();
  const business = await createBusinessFor(
    owner,
    uniqueBusinessName("Hidden Gym"),
  );

  await signInAs(page, outsider);
  const shown: string[] = [];
  for (const path of [
    `/dashboard/b/${business.slug}`,
    "/dashboard/b/no-such-business",
  ]) {
    const response = await page.goto(path);
    expect(response?.status(), path).toBe(404);
    await expect(
      page.getByRole("heading", { level: 1, name: "Page not found" }),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Sign out" })).toBeVisible();
    // The title is the page's own (a nested not-found can't set one), so it depends only on
    // the address too.
    shown.push(
      `${await page.title()}\n${await page.getByRole("main").innerText()}`,
    );
  }
  expect(shown[0]).toBe(shown[1]);

  // Someone without a business lands on the dashboard, where they can create one.
  await page.getByRole("link", { name: "Go to your home page" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
});

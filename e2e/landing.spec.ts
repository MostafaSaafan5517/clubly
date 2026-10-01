import { expect, test } from "@playwright/test";
import {
  addMember,
  createBusinessFor,
  uniqueBusinessName,
} from "./support/businesses";
import { signIn, signInAs } from "./support/forms";
import { createConfirmedUser } from "./support/users";

test("after signing in, members land on their memberships and staff on their businesses", async ({
  page,
  browser,
}) => {
  const owner = await createConfirmedUser();
  const member = await createConfirmedUser();
  const newcomer = await createConfirmedUser();
  const business = await createBusinessFor(
    owner,
    uniqueBusinessName("Landing Gym"),
  );
  await addMember(business.id, member.email);

  await page.goto("/login");
  await signIn(page, member.email, member.password);
  await expect(page).toHaveURL(/\/account$/);
  await expect(page.getByText(business.name)).toBeVisible();

  const ownerPage = await (await browser.newContext()).newPage();
  await ownerPage.goto("/login");
  await signIn(ownerPage, owner.email, owner.password);
  await expect(ownerPage).toHaveURL(/\/dashboard$/);
  await expect(
    ownerPage.getByRole("link", { name: business.name }),
  ).toBeVisible();

  // Neither staff nor a member yet: the dashboard, which offers to create a business.
  const newcomerPage = await (await browser.newContext()).newPage();
  await newcomerPage.goto("/login");
  await signIn(newcomerPage, newcomer.email, newcomer.password);
  await expect(newcomerPage).toHaveURL(/\/dashboard$/);
  await expect(
    newcomerPage.getByText("You don't have a business yet"),
  ).toBeVisible();
});

test("the home page offers signed-in visitors a way back in", async ({
  page,
}) => {
  const owner = await createConfirmedUser();
  const member = await createConfirmedUser();
  const business = await createBusinessFor(
    owner,
    uniqueBusinessName("Home Gym"),
  );
  await addMember(business.id, member.email);

  await page.goto("/");
  await expect(page.getByRole("link", { name: "Get started" })).toBeVisible();

  await signInAs(page, member);
  await page.goto("/");
  await expect(page.getByRole("link", { name: "Get started" })).toHaveCount(0);
  await page.getByRole("link", { name: "Continue" }).click();
  await expect(page).toHaveURL(/\/account$/);
});

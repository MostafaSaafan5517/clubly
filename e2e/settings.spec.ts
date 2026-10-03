import { expect, type Page, test } from "@playwright/test";
import { DEMO_READ_ONLY_MESSAGE } from "@/lib/demo";
import {
  addMember,
  addStaff,
  createBusinessFor,
  uniqueBusinessName,
} from "./support/businesses";
import { formError, signIn, signInAs } from "./support/forms";
import { createConfirmedUser, markAsDemoAccount } from "./support/users";

function deleteSection(page: Page) {
  return page.getByRole("region", { name: "Delete your account" });
}

async function deleteAccount(page: Page, confirmation: string) {
  await page.goto("/settings");
  await deleteSection(page)
    .getByLabel(/to confirm/)
    .fill(confirmation);
  await deleteSection(page)
    .getByRole("button", { name: "Delete my account" })
    .click();
}

test("people change the name their team sees", async ({ page, browser }) => {
  const owner = await createConfirmedUser();
  const staff = await createConfirmedUser("Sam Staff");
  const business = await createBusinessFor(
    owner,
    uniqueBusinessName("Name Gym"),
  );
  await addStaff(business.id, staff.email, "staff");

  await signInAs(page, staff);
  await page.goto("/settings");
  await page.getByLabel("Name").fill("Samira Staff");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("status")).toHaveText("Saved.");

  const ownerPage = await (await browser.newContext()).newPage();
  await signInAs(ownerPage, owner);
  await ownerPage.goto(`/dashboard/b/${business.slug}/team`);
  await expect(
    ownerPage.getByRole("region", { name: "Team" }).getByText("Samira Staff"),
  ).toBeVisible();
});

test("someone with no business or membership deletes their account", async ({
  page,
}) => {
  const user = await createConfirmedUser();

  await signInAs(page, user);
  await deleteAccount(page, "someone-else@example.com");
  await expect(formError(page)).toHaveText(
    "Type your email address exactly as shown to confirm.",
  );

  await deleteAccount(page, user.email.toUpperCase());
  await expect(page).toHaveURL(/\/\?account=deleted$/);
  await expect(page.getByRole("status")).toHaveText("Your account is deleted.");
  await page.goto("/settings");
  await expect(page).toHaveURL(/\/login\?next=%2Fsettings$/);
  await signIn(page, user.email, user.password);
  await expect(formError(page)).toHaveText("Wrong email or password.");
});

test("deleting a staff member's account takes them off the team", async ({
  page,
  browser,
}) => {
  const owner = await createConfirmedUser();
  const staff = await createConfirmedUser("Tess Temp");
  const business = await createBusinessFor(
    owner,
    uniqueBusinessName("Leaving Gym"),
  );
  await addStaff(business.id, staff.email, "staff");

  await signInAs(page, staff);
  await deleteAccount(page, staff.email);
  await expect(page).toHaveURL(/\/\?account=deleted$/);

  const ownerPage = await (await browser.newContext()).newPage();
  await signInAs(ownerPage, owner);
  await ownerPage.goto(`/dashboard/b/${business.slug}/team`);
  await expect(
    ownerPage.getByRole("region", { name: "Team" }).getByRole("listitem"),
  ).toHaveCount(1);
});

test("owners and members keep their accounts, and demo accounts can't be deleted", async ({
  browser,
}) => {
  const owner = await createConfirmedUser();
  const member = await createConfirmedUser();
  const demo = await createConfirmedUser();
  const business = await createBusinessFor(
    owner,
    uniqueBusinessName("Keeper Gym"),
  );
  await addMember(business.id, member.email);
  await markAsDemoAccount(demo.email);

  const cases = [
    {
      user: owner,
      message: `You own ${business.name}. A business can't be left without its owner, so your account stays while you own one.`,
    },
    {
      user: member,
      message:
        "You have memberships. Businesses keep their members' billing records, so an account with memberships can't be deleted.",
    },
    { user: demo, message: DEMO_READ_ONLY_MESSAGE },
  ];
  for (const { user, message } of cases) {
    const page = await (await browser.newContext()).newPage();
    await signInAs(page, user);
    await deleteAccount(page, user.email);
    await expect(formError(page)).toHaveText(message);
    // Still here.
    await page.goto("/settings");
    await expect(page).toHaveURL(/\/settings$/);
  }
});

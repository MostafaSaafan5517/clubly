import { expect, type Page, test } from "@playwright/test";
import { DEMO_READ_ONLY_MESSAGE } from "@/lib/demo";
import {
  addStaff,
  createBusinessFor,
  uniqueBusinessName,
} from "./support/businesses";
import { signIn, signInAs } from "./support/forms";
import { createConfirmedUser, markAsDemoAccount } from "./support/users";

/** Creates an invite link for `role` on the team page and returns it. */
async function createInviteLink(
  page: Page,
  slug: string,
  role: "admin" | "staff",
) {
  await page.goto(`/dashboard/b/${slug}/team`);
  await page.getByLabel("Role").selectOption(role);
  await page.getByRole("button", { name: "Create invite link" }).click();
  const link = page.getByLabel(`Invite link for a new ${role}`);
  await expect(link).toHaveValue(/\/invite\/[A-Za-z0-9_-]{43}$/);
  return link.inputValue();
}

function teamMember(page: Page, name: string) {
  return page
    .getByRole("region", { name: "Team" })
    .getByRole("listitem")
    .filter({ hasText: name });
}

test("an owner invites an admin with a link, which works once", async ({
  page,
  browser,
}) => {
  const owner = await createConfirmedUser("Olive Owner");
  const adam = await createConfirmedUser("Adam Admin");
  const latecomer = await createConfirmedUser("Lee Late");
  const business = await createBusinessFor(
    owner,
    uniqueBusinessName("Invite Gym"),
  );

  await signInAs(page, owner);
  const link = await createInviteLink(page, business.slug, "admin");
  // The page lists it until it's used.
  const openInvites = page.getByRole("region", { name: "Open invites" });
  await expect(openInvites.getByRole("listitem")).toHaveCount(1);
  await expect(openInvites).toContainText("Invite for a new admin");

  // Adam isn't signed in yet: the link sends him to sign in, then back to it.
  const adamPage = await (await browser.newContext()).newPage();
  await adamPage.goto(link);
  await expect(adamPage).toHaveURL(/\/login\?next=%2Finvite%2F/);
  await signIn(adamPage, adam.email, adam.password);
  await expect(
    adamPage.getByRole("heading", { level: 1, name: `Join ${business.name}` }),
  ).toBeVisible();
  await expect(
    adamPage.getByText("invited to join the team as admin"),
  ).toBeVisible();
  await adamPage.getByRole("button", { name: "Accept invite" }).click();
  await expect(adamPage).toHaveURL(
    new RegExp(`/dashboard/b/${business.slug}$`),
  );
  await expect(adamPage.getByText("You're an admin here.")).toBeVisible();

  // Used links stop working, for anyone.
  const latePage = await (await browser.newContext()).newPage();
  await signInAs(latePage, latecomer);
  await latePage.goto(new URL(link).pathname);
  await expect(
    latePage.getByRole("heading", {
      level: 1,
      name: "This invite link doesn't work",
    }),
  ).toBeVisible();

  await page.reload();
  await expect(teamMember(page, "Adam Admin")).toContainText("Admin");
  await expect(openInvites).toHaveCount(0);

  await page.goto(`/dashboard/b/${business.slug}/history`);
  const history = page
    .getByRole("region", { name: "History" })
    .getByRole("listitem");
  await expect(history.nth(0)).toContainText("Used an invite link (admin)");
  await expect(history.nth(0)).toContainText("Adam Admin ·");
  await expect(history.nth(1)).toContainText(
    "Joined as admin with an invite link",
  );
  await expect(history.nth(2)).toContainText(
    "Created an invite link for a new admin",
  );
  await expect(history.nth(2)).toContainText("Olive Owner ·");
});

test("admins invite only staff, and an owner can revoke a link before it's used", async ({
  page,
  browser,
}) => {
  const owner = await createConfirmedUser();
  const admin = await createConfirmedUser("Ada Admin");
  const newcomer = await createConfirmedUser();
  const business = await createBusinessFor(
    owner,
    uniqueBusinessName("Revoke Gym"),
  );
  await addStaff(business.id, admin.email, "admin");

  await signInAs(page, admin);
  await page.goto(`/dashboard/b/${business.slug}/team`);
  await expect(page.getByLabel("Role").locator("option")).toHaveText([
    "Staff: sees the members",
  ]);
  const link = await createInviteLink(page, business.slug, "staff");

  const ownerPage = await (await browser.newContext()).newPage();
  await signInAs(ownerPage, owner);
  await ownerPage.goto(`/dashboard/b/${business.slug}/team`);
  await ownerPage
    .getByRole("region", { name: "Open invites" })
    .getByRole("button", { name: "Revoke" })
    .click();
  await expect(
    ownerPage.getByRole("region", { name: "Open invites" }),
  ).toHaveCount(0);

  const newcomerPage = await (await browser.newContext()).newPage();
  await signInAs(newcomerPage, newcomer);
  await newcomerPage.goto(new URL(link).pathname);
  await expect(
    newcomerPage.getByRole("heading", {
      level: 1,
      name: "This invite link doesn't work",
    }),
  ).toBeVisible();
});

test("the owner changes roles and removes people; staff can leave", async ({
  page,
  browser,
}) => {
  const owner = await createConfirmedUser();
  const sam = await createConfirmedUser("Sam Staff");
  const tia = await createConfirmedUser("Tia Temp");
  const business = await createBusinessFor(
    owner,
    uniqueBusinessName("Roles Gym"),
  );
  await addStaff(business.id, sam.email, "staff");
  await addStaff(business.id, tia.email, "staff");

  await signInAs(page, owner);
  await page.goto(`/dashboard/b/${business.slug}/team`);
  await teamMember(page, "Sam Staff")
    .getByRole("button", { name: "Make admin" })
    .click();
  await expect(teamMember(page, "Sam Staff")).toContainText("Admin");
  await expect(
    teamMember(page, "Sam Staff").getByRole("button", { name: "Make staff" }),
  ).toBeVisible();

  await teamMember(page, "Tia Temp")
    .getByRole("button", { name: "Remove" })
    .click();
  await expect(teamMember(page, "Tia Temp")).toHaveCount(0);

  // Sam leaves by himself and no longer sees the business.
  const samPage = await (await browser.newContext()).newPage();
  await signInAs(samPage, sam);
  await samPage.goto(`/dashboard/b/${business.slug}/team`);
  await expect(
    teamMember(samPage, "Sam Staff").getByRole("button", { name: "Remove" }),
  ).toHaveCount(0);
  await teamMember(samPage, "Sam Staff")
    .getByRole("button", { name: "Leave this business" })
    .click();
  await expect(samPage).toHaveURL(/\/dashboard$/);
  const response = await samPage.goto(`/dashboard/b/${business.slug}`);
  expect(response?.status()).toBe(404);
});

test("plain staff see the team but can't invite or remove anyone", async ({
  page,
}) => {
  const owner = await createConfirmedUser("Olive Owner");
  const staff = await createConfirmedUser("Stan Staff");
  const business = await createBusinessFor(
    owner,
    uniqueBusinessName("Staff View Gym"),
  );
  await addStaff(business.id, staff.email, "staff");

  await signInAs(page, staff);
  await page.goto(`/dashboard/b/${business.slug}/team`);
  await expect(teamMember(page, "Olive Owner")).toContainText("Owner");
  await expect(page.getByRole("button", { name: "Remove" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Make admin" })).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Create invite link" }),
  ).toHaveCount(0);
});

test("a demo owner can't create invite links", async ({ page }) => {
  const owner = await createConfirmedUser();
  const business = await createBusinessFor(
    owner,
    uniqueBusinessName("Demo Team Gym"),
  );
  await markAsDemoAccount(owner.email);

  await signInAs(page, owner);
  await page.goto(`/dashboard/b/${business.slug}/team`);
  await page.getByRole("button", { name: "Create invite link" }).click();
  await expect(
    page.getByRole("region", { name: "Invite someone" }).getByRole("alert"),
  ).toHaveText(DEMO_READ_ONLY_MESSAGE);
});

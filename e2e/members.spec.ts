import { expect, test } from "@playwright/test";
import {
  addMember,
  addPlan,
  addStaff,
  addSubscription,
  createBusinessFor,
  findMembership,
  uniqueBusinessName,
} from "./support/businesses";
import { signInAs } from "./support/forms";
import { createConfirmedUser } from "./support/users";

test("owners see their members with plan and status, and can suspend and reactivate them", async ({
  page,
  browser,
}) => {
  const owner = await createConfirmedUser();
  const paying = await createConfirmedUser("Mona Member");
  const browsing = await createConfirmedUser("Ben Browser");
  const business = await createBusinessFor(
    owner,
    uniqueBusinessName("Member Gym"),
  );
  await addSubscription(
    business.id,
    await addMember(business.id, paying.email),
    await addPlan(business.id, "Gold"),
    { status: "active", currentPeriodEnd: "2026-11-15T12:00:00Z" },
  );
  await addMember(business.id, browsing.email);

  await signInAs(page, owner);
  await page.goto(`/dashboard/b/${business.slug}`);
  await page
    .getByRole("navigation", { name: "Business" })
    .getByRole("link", { name: "Members" })
    .click();
  await expect(page).toHaveURL(
    new RegExp(`/dashboard/b/${business.slug}/members$`),
  );
  await expect(page.getByText("2 members, 1 subscribed")).toBeVisible();

  const mona = page.getByRole("listitem").filter({ hasText: "Mona Member" });
  await expect(mona).toContainText(paying.email);
  await expect(mona).toContainText("Gold");
  await expect(mona).toContainText("Active");
  await expect(mona).toContainText("Renews on November 15, 2026");
  const ben = page.getByRole("listitem").filter({ hasText: "Ben Browser" });
  await expect(ben).toContainText("No plan yet");

  await mona.getByRole("button", { name: "Suspend" }).click();
  await expect(mona.getByRole("button", { name: "Reactivate" })).toBeVisible();
  await expect(mona).toContainText("Suspended");
  expect(await findMembership(business.id, paying.email)).toMatchObject({
    status: "suspended",
  });

  // The member sees it on their own account page.
  const memberPage = await (await browser.newContext()).newPage();
  await signInAs(memberPage, paying);
  await memberPage.goto("/account");
  await expect(
    memberPage.getByRole("listitem").filter({ hasText: business.name }),
  ).toContainText(`${business.name} has suspended your membership.`);

  await mona.getByRole("button", { name: "Reactivate" }).click();
  await expect(mona.getByRole("button", { name: "Suspend" })).toBeVisible();
  await expect(mona).not.toContainText("Suspended");
  expect(await findMembership(business.id, paying.email)).toMatchObject({
    status: "active",
  });
});

test("plain staff see the members but can't suspend them", async ({ page }) => {
  const owner = await createConfirmedUser();
  const staff = await createConfirmedUser();
  const member = await createConfirmedUser("Mona Member");
  const business = await createBusinessFor(
    owner,
    uniqueBusinessName("Front Desk Gym"),
  );
  await addStaff(business.id, staff.email, "staff");
  await addMember(business.id, member.email);

  await signInAs(page, staff);
  await page.goto(`/dashboard/b/${business.slug}/members`);
  await expect(
    page.getByRole("listitem").filter({ hasText: "Mona Member" }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Suspend" })).toHaveCount(0);
});

test("another business's members page is a 404", async ({ page }) => {
  const owner = await createConfirmedUser();
  const outsider = await createConfirmedUser();
  const member = await createConfirmedUser("Mona Member");
  const business = await createBusinessFor(
    owner,
    uniqueBusinessName("Private Members Club"),
  );
  await addMember(business.id, member.email);

  await signInAs(page, outsider);
  const response = await page.goto(`/dashboard/b/${business.slug}/members`);
  expect(response?.status()).toBe(404);
  await expect(page.getByText("Mona Member")).toHaveCount(0);
});

test("visitors are asked to sign in, and come back to the members page", async ({
  page,
}) => {
  const owner = await createConfirmedUser();
  const business = await createBusinessFor(
    owner,
    uniqueBusinessName("Sign In Gym"),
  );

  await page.goto(`/dashboard/b/${business.slug}/members`);
  await expect(page).toHaveURL(
    new RegExp(`/login\\?next=%2Fdashboard%2Fb%2F${business.slug}%2Fmembers$`),
  );
});

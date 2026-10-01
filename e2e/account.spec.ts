import { expect, test } from "@playwright/test";
import {
  addMember,
  addPlan,
  addSubscription,
  createBusinessFor,
  uniqueBusinessName,
} from "./support/businesses";
import { signInAs } from "./support/forms";
import { createConfirmedUser } from "./support/users";

test("members see each membership with its plan, status and what happens next", async ({
  page,
}) => {
  const owner = await createConfirmedUser();
  const member = await createConfirmedUser();
  const gym = await createBusinessFor(owner, uniqueBusinessName("Renew Gym"));
  const studio = await createBusinessFor(
    owner,
    uniqueBusinessName("Leaving Studio"),
  );
  const club = await createBusinessFor(
    owner,
    uniqueBusinessName("Undecided Club"),
  );

  await addSubscription(
    gym.id,
    await addMember(gym.id, member.email),
    await addPlan(gym.id, "Gold", { amount: 4000 }),
    { status: "active", currentPeriodEnd: "2026-11-15T12:00:00Z" },
  );
  // Archived since the member subscribed: they still see what they pay for.
  await addSubscription(
    studio.id,
    await addMember(studio.id, member.email),
    await addPlan(studio.id, "Yearly Flow", {
      amount: 30000,
      billingInterval: "year",
      active: false,
    }),
    {
      status: "active",
      currentPeriodEnd: "2027-03-01T12:00:00Z",
      cancelAt: "2027-03-01T12:00:00Z",
    },
  );
  await addMember(club.id, member.email);

  await signInAs(page, member);
  await page
    .getByRole("navigation")
    .getByRole("link", { name: "Memberships" })
    .click();
  await expect(
    page.getByRole("heading", { name: "Your memberships" }),
  ).toBeVisible();

  const gymCard = page.getByRole("listitem").filter({ hasText: gym.name });
  await expect(gymCard).toContainText("Gold, $40.00 per month");
  await expect(gymCard).toContainText("Active");
  await expect(gymCard).toContainText("Renews on November 15, 2026");
  await expect(
    gymCard.getByRole("button", { name: "Manage billing" }),
  ).toBeVisible();
  await expect(gymCard.getByRole("link", { name: "See plans" })).toHaveCount(0);

  const studioCard = page
    .getByRole("listitem")
    .filter({ hasText: studio.name });
  await expect(studioCard).toContainText("Yearly Flow, $300.00 per year");
  await expect(studioCard).toContainText("Canceling");
  await expect(studioCard).toContainText("Ends on March 1, 2027");

  const clubCard = page.getByRole("listitem").filter({ hasText: club.name });
  await expect(clubCard).toContainText("You haven't chosen a plan yet.");
  await expect(
    clubCard.getByRole("button", { name: "Manage billing" }),
  ).toHaveCount(0);
  await expect(
    clubCard.getByRole("link", { name: "See plans" }),
  ).toHaveAttribute("href", `/b/${club.slug}`);
});

test("staff don't see their business's members as their own memberships", async ({
  page,
}) => {
  const owner = await createConfirmedUser();
  const member = await createConfirmedUser();
  const business = await createBusinessFor(
    owner,
    uniqueBusinessName("Busy Gym"),
  );
  await addSubscription(
    business.id,
    await addMember(business.id, member.email),
    await addPlan(business.id, "Monthly"),
    { status: "active" },
  );

  // The owner can read this member's row (RLS allows it, for the members list), but it isn't
  // the owner's membership.
  await signInAs(page, owner);
  await page.goto("/account");
  await expect(
    page.getByText("You're not a member anywhere yet"),
  ).toBeVisible();
  await expect(page.getByText(business.name)).toHaveCount(0);
});

test("after Checkout, the membership shows as active only once Stripe's webhook confirms it", async ({
  page,
}) => {
  const owner = await createConfirmedUser();
  const member = await createConfirmedUser();
  const business = await createBusinessFor(
    owner,
    uniqueBusinessName("Patient Pilates"),
  );
  const memberId = await addMember(business.id, member.email);
  const planId = await addPlan(business.id, "Monthly");

  // Where Stripe Checkout sends the member back to; anyone could open this URL.
  await signInAs(page, member);
  await page.goto(`/account?joined=${business.slug}`);
  await expect(page.getByRole("status")).toHaveText(
    `Thanks! Stripe is confirming your payment to ${business.name}. This page updates on its own.`,
  );

  // What the webhook writes; the open page picks it up without a reload.
  await addSubscription(business.id, memberId, planId, { status: "active" });
  await expect(page.getByRole("status")).toHaveText(
    `Welcome to ${business.name}! Your membership is active.`,
  );
});

test("visitors are asked to sign in to see their memberships", async ({
  page,
}) => {
  await page.goto("/account");
  await expect(page).toHaveURL(/\/login\?next=%2Faccount$/);
});

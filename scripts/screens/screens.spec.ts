import { existsSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { expect, test, type Page, type TestInfo } from "@playwright/test";
import { adminClient } from "../../e2e/support/supabase";
import { createConfirmedUser } from "../../e2e/support/users";
import {
  axeFindings,
  club,
  demo,
  emptyStudio,
  newcomer,
  newOwner,
  outDir,
  setUpFixtures,
  signedInPage,
  slugOf,
  studio,
  studioInviteLink,
  studioMembers,
  studioOwner,
  visitorPage,
  withUnfinishedStripeAccount,
} from "./support";

// Every screen and state of the app, at the project's size (desktop, then mobile), saved as
// <SCREENS_DIR>/<area>-<nn>-<screen>-<project>.jpg with axe's findings for each page. Run with
// playwright.screens.config.ts. The demo gym is read as `pnpm seed:demo` left it; everything
// else is built (or refreshed) by the setup below, so every run starts from the same state.

test.describe.configure({ mode: "serial" });

const findings: Record<string, string[]> = {};
const demoBusiness = `/dashboard/b/${demo.slug}`;
const studioBusiness = `/dashboard/b/${slugOf(studio)}`;
const emptyBusiness = `/dashboard/b/${slugOf(emptyStudio)}`;

async function shot(
  page: Page,
  testInfo: TestInfo,
  name: string,
  options: { fullPage?: boolean } = {},
) {
  await page.evaluate(async () => {
    await document.fonts.ready;
  });
  // Away from whatever was clicked last, so nothing is caught in its hover state.
  await page.mouse.move(
    1,
    Math.floor((page.viewportSize()?.height ?? 800) / 2),
  );
  findings[name] = await axeFindings(page);
  mkdirSync(outDir, { recursive: true });
  await page.screenshot({
    path: path.join(outDir, `${name}-${testInfo.project.name}.jpg`),
    type: "jpeg",
    quality: 75,
    fullPage: options.fullPage ?? true,
    animations: "disabled",
    caret: "hide",
  });
}

/** Opens a page and waits for its main content. (Not a heading: some pages have none.) */
async function open(page: Page, url: string) {
  await page.goto(url);
  await expect(page.getByRole("main")).toBeVisible();
}

test("setup: the screenshot accounts and businesses", async () => {
  test.setTimeout(120_000);
  await setUpFixtures();
});

test("public: home, join page and its states, not found", async ({
  browser,
}, testInfo) => {
  const visitor = await visitorPage(browser);
  await open(visitor, "/");
  await shot(visitor, testInfo, "public-01-home");
  await open(visitor, "/?account=deleted");
  await shot(visitor, testInfo, "public-02-home-account-deleted");
  await open(visitor, `/b/${demo.slug}`);
  await shot(visitor, testInfo, "public-03-join");
  await open(visitor, `/b/${demo.slug}?checkout=canceled`);
  await shot(visitor, testInfo, "public-04-join-checkout-canceled");
  await open(visitor, `/b/${slugOf(club)}`);
  await shot(visitor, testInfo, "public-05-join-no-plans");
  await visitor.goto("/no-such-page");
  await shot(visitor, testInfo, "public-06-not-found");
  await visitor.goto("/b/no-such-gym");
  await shot(visitor, testInfo, "public-07-join-not-found");
  await visitor.context().close();

  const signedIn = await signedInPage(browser, newcomer.email);
  await open(signedIn, "/");
  await shot(signedIn, testInfo, "public-08-home-signed-in");
  await signedIn.context().close();

  // Refused before anything reaches Stripe: a member who already pays, and a suspended one.
  for (const [member, name] of [
    [studioMembers.grace, "public-09-join-already-member"],
    [studioMembers.marcus, "public-10-join-suspended"],
  ] as const) {
    const page = await signedInPage(browser, member.email);
    await open(page, `/b/${slugOf(studio)}`);
    await page
      .getByRole("listitem")
      .filter({ hasText: "Morning flow" })
      .getByRole("button", { name: "Join" })
      .click();
    await expect(page.locator("form").getByRole("alert")).toBeVisible();
    await shot(page, testInfo, name);
    await page.context().close();
  }
});

test("auth: sign-in, sign-up, email links, password reset", async ({
  browser,
}, testInfo) => {
  const page = await visitorPage(browser);
  await open(page, "/login");
  await shot(page, testInfo, "auth-01-login");
  await page.getByLabel("Email").fill(newcomer.email);
  await page.getByLabel("Password").fill("not-the-password-1");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.locator("form").getByRole("alert")).toBeVisible();
  await shot(page, testInfo, "auth-02-login-wrong-password");
  await open(page, "/login?error=link");
  await shot(page, testInfo, "auth-03-login-link-error");

  await open(page, "/signup");
  await shot(page, testInfo, "auth-04-signup");
  await page.getByLabel("Full name").fill("Lena Fischer");
  await page.getByLabel("Email").fill("screens.signup@example.test");
  await page.getByLabel("Password").fill("lettersonly");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.locator("form").getByRole("alert")).toBeVisible();
  await shot(page, testInfo, "auth-05-signup-weak-password");

  await open(page, "/check-email");
  await shot(page, testInfo, "auth-06-check-email");
  await open(page, "/magic-link");
  await shot(page, testInfo, "auth-07-magic-link");
  await open(page, "/forgot-password");
  await shot(page, testInfo, "auth-08-forgot-password");
  // An address without an account: the answer is the same, and no email goes out.
  await page.getByLabel("Email").fill("nobody@example.test");
  await page.getByRole("button", { name: "Email me a link" }).click();
  await expect(page.getByRole("status")).toBeVisible();
  await shot(page, testInfo, "auth-09-forgot-password-sent");
  await page.context().close();
});

test("invite links: valid and not working", async ({ browser }, testInfo) => {
  const page = await signedInPage(browser, newcomer.email);
  await open(page, await studioInviteLink("admin"));
  await shot(page, testInfo, "invite-01-valid");
  await open(page, `/invite/${crypto.randomUUID()}`);
  await shot(page, testInfo, "invite-02-not-working");
  await page.context().close();
});

test("members: memberships in every state, and the return from Checkout", async ({
  browser,
}, testInfo) => {
  test.setTimeout(240_000);
  const demoMember = await signedInPage(browser, demo.member, demo.password);
  await open(demoMember, "/account");
  await shot(demoMember, testInfo, "member-01-demo");
  await demoMember.context().close();

  for (const [member, name] of [
    [studioMembers.grace, "member-02-active"],
    [studioMembers.priya, "member-03-canceling"],
    [studioMembers.daniel, "member-04-payment-failed"],
    [studioMembers.omar, "member-05-ended"],
    [studioMembers.marcus, "member-06-suspended"],
    [studioMembers.ana, "member-07-no-plan"],
  ] as const) {
    const page = await signedInPage(browser, member.email);
    await open(page, "/account");
    await shot(page, testInfo, name);
    await page.context().close();
  }

  const nobody = await signedInPage(browser, newcomer.email);
  await open(nobody, "/account");
  await shot(nobody, testInfo, "member-08-none");
  await nobody.context().close();

  // Back from Checkout: a live membership is welcomed; one Stripe hasn't confirmed waits (and
  // gives up after 30 seconds).
  const joined = `/account?joined=${slugOf(studio)}`;
  const welcomed = await signedInPage(browser, studioMembers.grace.email);
  await open(welcomed, joined);
  await shot(welcomed, testInfo, "member-09-joined-welcome");
  await welcomed.context().close();
  const waiting = await signedInPage(browser, studioMembers.ana.email);
  await open(waiting, joined);
  await shot(waiting, testInfo, "member-10-joined-confirming");
  await expect(waiting.getByRole("status")).toContainText("hasn't confirmed", {
    timeout: 45_000,
  });
  await shot(waiting, testInfo, "member-11-joined-not-confirmed");
  await waiting.context().close();
});

test("dashboard: the demo gym as its read-only owner", async ({
  browser,
}, testInfo) => {
  const page = await signedInPage(browser, demo.owner, demo.password);
  await shot(page, testInfo, "dash-01-businesses");
  for (const [tab, name] of [
    ["", "dash-02-overview"],
    ["/members", "dash-03-members"],
    ["/revenue", "dash-04-revenue"],
    ["/payouts", "dash-05-payouts"],
    ["/history", "dash-06-history"],
    ["/team", "dash-08-team"],
    ["/plans/new", "dash-09-new-plan"],
  ] as const) {
    await open(page, `${demoBusiness}${tab}`);
    if (tab === "/payouts") {
      // The balance streams in from Stripe after the page.
      await expect(page.getByText("Available to pay out")).toBeVisible();
    }
    await shot(page, testInfo, name);
    if (tab === "/history") {
      const older = page.getByRole("link", { name: "Older" });
      if (await older.count()) {
        await older.click();
        await expect(page.getByRole("link", { name: "Newest" })).toBeVisible();
        await shot(page, testInfo, "dash-07-history-older");
      }
    }
  }

  // Read-only: what a demo account is told when it tries to change something.
  await open(page, demoBusiness);
  await page
    .locator("form")
    .filter({ has: page.getByLabel("Business name") })
    .getByRole("button", { name: "Save" })
    .click();
  await expect(
    page.getByRole("alert").filter({ hasText: "Demo accounts" }),
  ).toBeVisible();
  await shot(page, testInfo, "dash-10-read-only-refused");
  await page.context().close();
});

test("dashboard: the demo gym as its admin and its staff", async ({
  browser,
}, testInfo) => {
  const admin = await signedInPage(browser, demo.admin, demo.password);
  await open(admin, demoBusiness);
  await shot(admin, testInfo, "role-01-admin-overview");
  await open(admin, `${demoBusiness}/team`);
  await shot(admin, testInfo, "role-02-admin-team");
  await admin.context().close();

  const staff = await signedInPage(browser, demo.staff, demo.password);
  await open(staff, demoBusiness);
  await shot(staff, testInfo, "role-03-staff-overview");
  await open(staff, `${demoBusiness}/members`);
  await shot(staff, testInfo, "role-04-staff-members");
  await open(staff, `${demoBusiness}/team`);
  await shot(staff, testInfo, "role-05-staff-team");
  // A page their role can't open is a 404, like a business they're not on.
  await staff.goto(`${demoBusiness}/revenue`);
  await shot(staff, testInfo, "role-06-staff-revenue-not-found");
  await staff.context().close();
});

test("dashboard: a studio with members in every state", async ({
  browser,
}, testInfo) => {
  const page = await signedInPage(browser, studioOwner.email);
  await shot(page, testInfo, "owner-01-businesses");
  await open(page, studioBusiness);
  await shot(page, testInfo, "owner-02-overview");
  await page.getByText("Rename").first().click();
  await expect(page.getByLabel("Plan name").first()).toBeVisible();
  await shot(page, testInfo, "owner-03-overview-rename-open");
  for (const [tab, name] of [
    ["/members", "owner-04-members"],
    ["/revenue", "owner-05-revenue"],
    ["/team", "owner-06-team"],
  ] as const) {
    await open(page, `${studioBusiness}${tab}`);
    await shot(page, testInfo, name);
  }
  await page.getByRole("button", { name: "Create invite link" }).click();
  await expect(page.getByLabel(/Invite link for a new/)).toBeVisible();
  await shot(page, testInfo, "owner-07-team-invite-created");
  await page.context().close();
});

test("dashboard: a business not set up yet", async ({ browser }, testInfo) => {
  const page = await signedInPage(browser, newOwner.email);
  await shot(page, testInfo, "empty-01-businesses");
  for (const [tab, name] of [
    ["", "empty-02-overview"],
    ["/members", "empty-03-members"],
    ["/revenue", "empty-04-revenue"],
    ["/payouts", "empty-05-payouts"],
    ["/history", "empty-06-history"],
    ["/team", "empty-07-team"],
    ["/plans/new", "empty-08-new-plan"],
  ] as const) {
    await open(page, `${emptyBusiness}${tab}`);
    await shot(page, testInfo, name);
  }

  await withUnfinishedStripeAccount(async () => {
    await open(page, `${emptyBusiness}?stripe=returned`);
    await shot(page, testInfo, "empty-09-back-from-stripe");
    await open(page, `${emptyBusiness}/plans/new`);
    await shot(page, testInfo, "empty-10-new-plan-form");
    // The account doesn't exist in Stripe, so loading the balance fails.
    await open(page, `${emptyBusiness}/payouts`);
    // Filtered: Next.js's route announcer is an alert too.
    await expect(
      page.getByRole("alert").filter({ hasText: "reach Stripe" }),
    ).toBeVisible();
    await shot(page, testInfo, "empty-11-payouts-stripe-error");
  });
  await page.context().close();
});

test("newcomer: no business yet, settings and password", async ({
  browser,
}, testInfo) => {
  const page = await signedInPage(browser, newcomer.email);
  await shot(page, testInfo, "new-01-no-business");
  await open(page, "/dashboard/new-business");
  await shot(page, testInfo, "new-02-new-business");
  await page.getByLabel("Business name").fill("Harbor Climbing Gym");
  await page.getByRole("button", { name: "Create business" }).click();
  await expect(page.locator("form").getByRole("alert")).toBeVisible();
  await shot(page, testInfo, "new-03-new-business-taken");

  await open(page, "/settings");
  await shot(page, testInfo, "settings-01-settings");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "Saved" }),
  ).toBeVisible();
  await page.getByLabel(/to confirm/).fill("someone.else@example.test");
  await page.getByRole("button", { name: "Delete my account" }).click();
  await expect(page.locator("form").getByRole("alert")).toBeVisible();
  await shot(page, testInfo, "settings-02-saved-and-delete-refused");

  await open(page, "/settings/password");
  await shot(page, testInfo, "settings-03-password");
  await page.getByLabel("Current password").fill("not-the-password-1");
  await page.getByLabel("New password").fill("another-password-2");
  await page.getByRole("button", { name: "Save password" }).click();
  await expect(page.locator("form").getByRole("alert")).toBeVisible();
  await shot(page, testInfo, "settings-04-password-wrong");

  // A business they aren't on is a 404, so outsiders can't tell it exists.
  await page.goto(demoBusiness);
  await shot(page, testInfo, "error-01-not-staff-not-found");
  await page.context().close();
});

test("error page: a page that fails to load", async ({ browser }, testInfo) => {
  // A signed-in user whose account was deleted keeps a valid token for a while, but their
  // profile is gone, so the dashboard fails to load and shows the signed-in error page.
  const user = await createConfirmedUser("Deleted Person");
  const page = await signedInPage(browser, user.email, user.password);
  const admin = adminClient();
  const { data: profile, error } = await admin
    .from("profiles")
    .select("id")
    .eq("email", user.email)
    .single();
  if (error) throw error;
  const deleted = await admin.auth.admin.deleteUser(profile.id);
  if (deleted.error) throw deleted.error;
  await page.goto("/dashboard");
  await expect(
    page.getByRole("heading", { name: "Something went wrong" }),
  ).toBeVisible();
  await shot(page, testInfo, "error-02-page-failed");
  await page.context().close();
});

test.afterAll(async ({}, testInfo) => {
  if (!existsSync(outDir)) return;
  writeFileSync(
    path.join(outDir, `axe-${testInfo.project.name}.json`),
    `${JSON.stringify(findings, null, 2)}\n`,
  );
  if (testInfo.project.name !== "mobile") return;
  // An index that shows each screen at both sizes side by side.
  const names = [
    ...new Set(
      readdirSync(outDir)
        .filter((file) => file.endsWith(".jpg"))
        .map((file) => file.replace(/-(desktop|mobile)\.jpg$/, "")),
    ),
  ].sort();
  const cell = (name: string, size: "desktop" | "mobile") => {
    const file = `${name}-${size}.jpg`;
    return existsSync(path.join(outDir, file))
      ? `<img src="${file}" width="${size === "desktop" ? 480 : 160}" alt="${name}, ${size}">`
      : "";
  };
  writeFileSync(
    path.join(outDir, "index.md"),
    [
      "# Screens",
      "",
      "Captured by `scripts/screens/screens.spec.ts` (`pnpm screens`): each screen at desktop (1440 wide) and mobile (390 wide), full page.",
      "",
      "| Screen | Desktop | Mobile |",
      "| --- | --- | --- |",
      ...names.map(
        (name) =>
          `| ${name} | ${cell(name, "desktop")} | ${cell(name, "mobile")} |`,
      ),
      "",
    ].join("\n"),
  );
});

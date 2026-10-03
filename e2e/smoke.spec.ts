import { expect, test } from "@playwright/test";
import { DEMO_READ_ONLY_MESSAGE } from "@/lib/demo";
import { signIn } from "./support/forms";

// Read-only checks for a deployed app seeded with `pnpm seed:demo`, run with
// `E2E_BASE_URL=https://... pnpm test:smoke`. Nothing here signs up (that would send real
// email) or changes data, so it can run against the live demo at any time.

// The demo's published password (README).
const DEMO_PASSWORD = "climb-demo-2026";
const DEMO_SLUG = "harbor-climbing-gym";

test("the home page and the demo's public join page load", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("link", { name: "Get started" })).toBeVisible();

  await page.goto(`/b/${DEMO_SLUG}`);
  await expect(
    page.getByRole("heading", { level: 1, name: "Harbor Climbing Gym" }),
  ).toBeVisible();
  await expect(page.getByText("Monthly climber")).toBeVisible();
  await expect(page.getByText("Annual climber")).toBeVisible();
  // Archived plans aren't for sale.
  await expect(page.getByText("Summer pass")).toHaveCount(0);
});

test("the demo owner sees revenue, members, team and history, read-only", async ({
  page,
}) => {
  await page.goto("/login");
  await signIn(page, "olivia.owner@example.com", DEMO_PASSWORD);
  await expect(page).toHaveURL(/\/dashboard$/);
  // The demo accounts are marked read-only (pnpm seed:demo).
  await expect(page.getByText(DEMO_READ_ONLY_MESSAGE)).toBeVisible();

  await page.goto(`/dashboard/b/${DEMO_SLUG}/revenue`);
  await expect(page.getByRole("definition").first()).toHaveText(/^\$\d/);
  await expect(
    page
      .getByRole("region", { name: "Recent payments" })
      .getByRole("listitem")
      .first(),
  ).toContainText("Paid");

  await page.goto(`/dashboard/b/${DEMO_SLUG}/members`);
  await expect(
    page.getByRole("listitem").filter({ hasText: "Sid Suspended" }),
  ).toContainText("Suspended");

  await page.goto(`/dashboard/b/${DEMO_SLUG}/team`);
  const team = page.getByRole("region", { name: "Team" });
  await expect(team.getByRole("listitem")).toHaveCount(3);
  await expect(
    team.getByRole("listitem").filter({ hasText: "Adam Admin" }),
  ).toContainText("Admin");

  await page.goto(`/dashboard/b/${DEMO_SLUG}/history`);
  await expect(
    page.getByRole("region", { name: "History" }).getByRole("listitem").first(),
  ).toBeVisible();
});

test("a demo member sees their membership", async ({ page }) => {
  await page.goto("/login");
  await signIn(page, "mona.member@example.com", DEMO_PASSWORD);
  await expect(page).toHaveURL(/\/account$/);
  await expect(
    page.getByRole("listitem").filter({ hasText: "Harbor Climbing Gym" }),
  ).toContainText("Active");
});

// The live demo sends no auth email (NEXT_PUBLIC_AUTH_EMAILS=off, see CLAUDE.md).
test("the live demo has no pages that need email", async ({
  page,
  request,
}) => {
  expect((await request.get("/forgot-password")).status()).toBe(404);
  expect((await request.get("/magic-link")).status()).toBe(404);
  await page.goto("/login");
  await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Forgot your password?" }),
  ).toHaveCount(0);
});

test("the webhook and cron routes refuse unsigned callers", async ({
  request,
}) => {
  const webhook = await request.post("/api/stripe/webhook", { data: "{}" });
  expect(webhook.status()).toBe(400);
  const cron = await request.get("/api/cron/reconcile");
  expect(cron.status()).toBe(401);
});

import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { DEMO_READ_ONLY_MESSAGE } from "@/lib/demo";
import {
  addMember,
  addPlan,
  createBusinessFor,
  enableCharges,
  findMembership,
  uniqueBusinessName,
} from "./support/businesses";
import { formError, signInAs } from "./support/forms";
import { adminClient, supabaseSettings } from "./support/supabase";
import { createConfirmedUser, markAsDemoAccount } from "./support/users";

// The live demo's accounts share a published password, so they can look but not change anything
// (`pnpm seed:demo` marks them). The billing portal's view-only mode is in billing.spec.ts.

test("a demo owner sees everything but can't change it", async ({ page }) => {
  const owner = await createConfirmedUser("Olivia Owner");
  const member = await createConfirmedUser("Mona Member");
  const business = await createBusinessFor(
    owner,
    uniqueBusinessName("Demo Climbing"),
  );
  await addPlan(business.id, "Monthly", {
    stripePriceId: `price_test_${crypto.randomUUID()}`,
  });
  await addMember(business.id, member.email);
  await markAsDemoAccount(owner.email);

  await signInAs(page, owner);
  await expect(page.getByText(DEMO_READ_ONLY_MESSAGE)).toBeVisible();

  await page.goto(`/dashboard/b/${business.slug}`);
  const plan = page.getByRole("listitem").filter({ hasText: "Monthly" });
  await plan.getByRole("button", { name: "Archive" }).click();
  await expect(plan.getByRole("alert")).toHaveText(DEMO_READ_ONLY_MESSAGE);
  await page.reload();
  await expect(plan).not.toContainText("Archived");

  const details = page.getByRole("region", { name: "Details" });
  await details.getByLabel("Business name").fill("Taken Over Gym");
  await details.getByRole("button", { name: "Save" }).click();
  await expect(details.getByRole("alert")).toHaveText(DEMO_READ_ONLY_MESSAGE);

  await page.goto(`/dashboard/b/${business.slug}/members`);
  const mona = page.getByRole("listitem").filter({ hasText: "Mona Member" });
  await mona.getByRole("button", { name: "Suspend" }).click();
  await expect(mona.getByRole("alert")).toHaveText(DEMO_READ_ONLY_MESSAGE);
  expect(await findMembership(business.id, member.email)).toMatchObject({
    status: "active",
  });

  await page.goto("/dashboard/new-business");
  await page.getByLabel("Business name").fill("Demo Takeover");
  await page.getByRole("button", { name: "Create business" }).click();
  await expect(formError(page)).toHaveText(DEMO_READ_ONLY_MESSAGE);
});

test("a demo account can't join a plan", async ({ page }) => {
  const owner = await createConfirmedUser();
  const visitor = await createConfirmedUser();
  const business = await createBusinessFor(
    owner,
    uniqueBusinessName("Demo Pool"),
  );
  await enableCharges(business.id);
  await addPlan(business.id, "Monthly", {
    stripePriceId: `price_test_${crypto.randomUUID()}`,
  });
  await markAsDemoAccount(visitor.email);

  await signInAs(page, visitor);
  await page.goto(`/b/${business.slug}`);
  await page.getByRole("button", { name: "Join" }).click();
  await expect(formError(page)).toHaveText(DEMO_READ_ONLY_MESSAGE);
  expect(await findMembership(business.id, visitor.email)).toBeNull();
});

test("the database and Supabase Auth refuse a demo account's changes made outside the app", async () => {
  const owner = await createConfirmedUser();
  const business = await createBusinessFor(
    owner,
    uniqueBusinessName("Demo Direct"),
  );
  await markAsDemoAccount(owner.email);

  // Straight to the API with the demo account's own session, as anyone with the password could.
  const { url, publishableKey } = supabaseSettings();
  const client = createClient(url, publishableKey, {
    auth: { persistSession: false },
  });
  const { error: signInError } = await client.auth.signInWithPassword(owner);
  expect(signInError).toBeNull();

  const { error: renameError } = await client
    .from("businesses")
    .update({ name: "Taken Over" })
    .eq("id", business.id);
  expect(renameError).toMatchObject({
    code: "42501",
    message: "Demo accounts are read-only",
  });

  const { error: passwordError } = await client.auth.updateUser({
    password: "locked-everyone-out-1",
  });
  expect(passwordError).not.toBeNull();

  const { data } = await adminClient()
    .from("businesses")
    .select("name")
    .eq("id", business.id)
    .single();
  expect(data?.name).toBe(business.name);
  // The published password still works.
  const { error: againError } = await client.auth.signInWithPassword(owner);
  expect(againError).toBeNull();
});

import AxeBuilder from "@axe-core/playwright";
import { expect, type Browser, type Page } from "@playwright/test";
import { hashInviteToken } from "@/lib/invites";
import { slugify } from "@/lib/slug";
import { addPlan, createBusinessFor } from "../../e2e/support/businesses";
import { signIn } from "../../e2e/support/forms";
import { adminClient } from "../../e2e/support/supabase";
import { TEST_PASSWORD } from "../../e2e/support/users";

// What the screenshot and Lighthouse runs share: where they write, the demo gym and the
// screenshot accounts (made once and kept, so every run starts from the same state), and getting
// a page signed in.

export const outDir = process.env.SCREENS_DIR ?? "";
if (!outDir) {
  throw new Error(
    "Set SCREENS_DIR, for example SCREENS_DIR=docs/design/before",
  );
}

/** The demo gym from `pnpm seed:demo`. Its people are read-only demo accounts. */
export const demo = {
  slug: "harbor-climbing-gym",
  // Public on purpose (README, scripts/seed-demo.mjs).
  password: "climb-demo-2026",
  owner: "olivia.owner@example.com",
  admin: "adam.admin@example.com",
  staff: "sara.staff@example.com",
  member: "mona.member@example.com",
};

type Person = { email: string; fullName: string };

/** Owns a yoga studio that takes payments, with members in every state, and a boxing club. */
export const studioOwner: Person = {
  email: "screens.rosa@example.test",
  fullName: "Rosa Delgado",
};
/** On the yoga studio's staff. */
export const studioStaff: Person = {
  email: "screens.theo@example.test",
  fullName: "Theo Martin",
};
/** Owns a dance studio that hasn't connected Stripe: every empty state. */
export const newOwner: Person = {
  email: "screens.kwame@example.test",
  fullName: "Kwame Mensah",
};
/** Has no business and no membership. */
export const newcomer: Person = {
  email: "screens.lena@example.test",
  fullName: "Lena Fischer",
};

export const studio = { name: "Riverside Yoga Loft" };
export const club = { name: "Summit Boxing Club" };
export const emptyStudio = { name: "Northside Dance Studio" };

const studioPlans = [
  { key: "morning", name: "Morning flow", amount: 7900, interval: "month" },
  { key: "unlimited", name: "Unlimited", amount: 11900, interval: "month" },
  {
    key: "yearly",
    name: "Unlimited, yearly",
    amount: 119000,
    interval: "year",
  },
  {
    key: "intro",
    name: "Intro month",
    amount: 4900,
    interval: "month",
    archived: true,
  },
  // Active but without a Stripe price: what an interrupted plan creation leaves.
  {
    key: "training",
    name: "Teacher training",
    amount: 45000,
    interval: "month",
    unpriced: true,
  },
] as const;
type StudioPlan = (typeof studioPlans)[number]["key"];

const DAY = 86_400_000;
const daysFromNow = (days: number) =>
  new Date(Date.now() + days * DAY).toISOString();

type StudioMember = Person & {
  key: string;
  suspended?: boolean;
  subscription?: {
    plan: StudioPlan;
    status: "active" | "past_due" | "canceled";
    periodEndDays: number;
    cancelAtDays?: number;
  };
  payments?: { plan: StudioPlan; status: "paid" | "failed"; days: number }[];
};

/** The yoga studio's members, one per state a membership can be in. */
export const studioMembers = {
  grace: {
    key: "grace",
    email: "screens.grace@example.test",
    fullName: "Grace Okafor",
    subscription: { plan: "unlimited", status: "active", periodEndDays: 18 },
    payments: [
      { plan: "unlimited", status: "paid", days: -12 },
      { plan: "unlimited", status: "paid", days: -43 },
    ],
  },
  daniel: {
    key: "daniel",
    email: "screens.daniel@example.test",
    fullName: "Daniel Kim",
    subscription: { plan: "morning", status: "past_due", periodEndDays: 27 },
    payments: [
      { plan: "morning", status: "failed", days: -3 },
      { plan: "morning", status: "paid", days: -34 },
    ],
  },
  priya: {
    key: "priya",
    email: "screens.priya@example.test",
    fullName: "Priya Nair",
    subscription: {
      plan: "yearly",
      status: "active",
      periodEndDays: 41,
      cancelAtDays: 41,
    },
    payments: [{ plan: "yearly", status: "paid", days: -324 }],
  },
  omar: {
    key: "omar",
    email: "screens.omar@example.test",
    fullName: "Omar Haddad",
    subscription: { plan: "intro", status: "canceled", periodEndDays: -16 },
    payments: [{ plan: "intro", status: "paid", days: -46 }],
  },
  marcus: {
    key: "marcus",
    email: "screens.marcus@example.test",
    fullName: "Marcus Bell",
    suspended: true,
    subscription: { plan: "morning", status: "active", periodEndDays: 9 },
    payments: [{ plan: "morning", status: "paid", days: -21 }],
  },
  ana: {
    key: "ana",
    email: "screens.ana@example.test",
    fullName: "Ana Souza",
  },
} satisfies Record<string, StudioMember>;

export function slugOf(business: { name: string }) {
  return slugify(business.name);
}

function check<T>(
  { data, error }: { data: T; error: unknown },
  what: string,
): T {
  if (error) {
    throw new Error(
      `${what}: ${error instanceof Error ? error.message : JSON.stringify(error)}`,
    );
  }
  return data;
}

/** The user's id, creating them (already confirmed) the first time. */
export async function ensureUser(person: Person) {
  const admin = adminClient();
  const existing = check(
    await admin
      .from("profiles")
      .select("id")
      .eq("email", person.email)
      .maybeSingle(),
    `Looking up ${person.email}`,
  );
  if (existing) return existing.id;
  const { data, error } = await admin.auth.admin.createUser({
    email: person.email,
    password: TEST_PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: person.fullName },
  });
  if (error) throw error;
  return data.user.id;
}

export async function businessId(slug: string) {
  const row = check(
    await adminClient()
      .from("businesses")
      .select("id")
      .eq("slug", slug)
      .maybeSingle(),
    `Looking up ${slug}`,
  );
  return row?.id ?? null;
}

async function ensureBusiness(owner: Person, business: { name: string }) {
  await ensureUser(owner);
  return (
    (await businessId(slugOf(business))) ??
    (
      await createBusinessFor(
        { email: owner.email, password: TEST_PASSWORD },
        business.name,
      )
    ).id
  );
}

/** Fails early, with what to do, when the demo gym hasn't been seeded. */
export async function requireDemo() {
  if (!(await businessId(demo.slug))) {
    throw new Error(
      "The demo gym is missing: run `pnpm seed:demo` (with the app and `pnpm stripe:listen` running) first.",
    );
  }
}

/**
 * Builds (or refreshes) everything the screenshots need besides the demo gym. Rows are found by
 * name and only added when missing; dates are set relative to today on every run, so "renews
 * on" never drifts into the past.
 */
export async function setUpFixtures() {
  await requireDemo();
  const admin = adminClient();
  await ensureUser(newcomer);
  await ensureBusiness(newOwner, emptyStudio);

  const clubId = await ensureBusiness(studioOwner, club);
  const studioId = await ensureBusiness(studioOwner, studio);
  // As if Stripe's webhook had said both can take payments. No Stripe account is attached, so
  // nothing here ever reaches Stripe.
  check(
    await admin
      .from("businesses")
      .update({ charges_enabled: true })
      .in("id", [clubId, studioId]),
    "Enabling charges",
  );

  const staffId = await ensureUser(studioStaff);
  check(
    await admin
      .from("business_staff")
      .upsert(
        { business_id: studioId, user_id: staffId, role: "staff" },
        { onConflict: "business_id,user_id", ignoreDuplicates: true },
      ),
    "Adding the studio's staff",
  );

  const planIds = {} as Record<StudioPlan, string>;
  for (const plan of studioPlans) {
    const existing = check(
      await admin
        .from("plans")
        .select("id")
        .eq("business_id", studioId)
        .eq("name", plan.name)
        .maybeSingle(),
      `Looking up the ${plan.name} plan`,
    );
    planIds[plan.key] =
      existing?.id ??
      (await addPlan(studioId, plan.name, {
        amount: plan.amount,
        billingInterval: plan.interval,
        active: !("archived" in plan),
        stripePriceId:
          "unpriced" in plan ? undefined : `price_screens_${plan.key}`,
      }));
  }
  const amountOf = (key: StudioPlan) =>
    studioPlans.find((plan) => plan.key === key)!.amount;

  for (const member of Object.values(studioMembers) as StudioMember[]) {
    const userId = await ensureUser(member);
    const { data: memberRow, error: memberError } = await admin
      .from("members")
      .upsert(
        {
          business_id: studioId,
          user_id: userId,
          status: member.suspended ? "suspended" : "active",
        },
        { onConflict: "business_id,user_id" },
      )
      .select("id")
      .single();
    if (memberError) throw memberError;
    if (member.subscription) {
      const { plan, status, periodEndDays, cancelAtDays } = member.subscription;
      check(
        await admin.from("subscriptions").upsert(
          {
            business_id: studioId,
            member_id: memberRow.id,
            plan_id: planIds[plan],
            stripe_subscription_id: `sub_screens_${member.key}`,
            status,
            current_period_end: daysFromNow(periodEndDays),
            cancel_at:
              cancelAtDays === undefined ? null : daysFromNow(cancelAtDays),
          },
          { onConflict: "stripe_subscription_id" },
        ),
        `Saving ${member.fullName}'s subscription`,
      );
    }
    for (const [index, payment] of (member.payments ?? []).entries()) {
      const amount = amountOf(payment.plan);
      check(
        await admin.from("payments").upsert(
          {
            business_id: studioId,
            member_id: memberRow.id,
            stripe_invoice_id: `in_screens_${member.key}_${index}`,
            amount,
            application_fee: Math.round(amount * 0.05),
            currency: "usd",
            status: payment.status,
            paid_at:
              payment.status === "paid" ? daysFromNow(payment.days) : null,
            created_at: daysFromNow(payment.days),
          },
          { onConflict: "stripe_invoice_id" },
        ),
        `Saving ${member.fullName}'s payments`,
      );
    }
  }

  // Two open invites, made fresh each run so their dates stay current.
  check(
    await admin
      .from("staff_invites")
      .delete()
      .eq("business_id", studioId)
      .is("accepted_at", null),
    "Clearing the studio's invites",
  );
  check(
    await admin.from("staff_invites").insert(
      (["admin", "staff"] as const).map((role) => ({
        business_id: studioId,
        role,
        token_hash: hashInviteToken(crypto.randomUUID()),
      })),
    ),
    "Adding the studio's invites",
  );
}

/** A new invite link to the yoga studio, for the invite page. */
export async function studioInviteLink(role: "admin" | "staff") {
  const studioId = await businessId(slugOf(studio));
  if (!studioId) throw new Error("Set the fixtures up first");
  const token = crypto.randomUUID();
  check(
    await adminClient()
      .from("staff_invites")
      .insert({
        business_id: studioId,
        role,
        token_hash: hashInviteToken(token),
      }),
    "Adding an invite",
  );
  return `/invite/${token}`;
}

/**
 * Gives the dance studio a Stripe account id that doesn't exist, for the screens of a business
 * that started onboarding (and of Stripe failing to answer), then takes it away again. Kept
 * only for the length of `use`, so reconciliation runs never ask Stripe about it.
 */
export async function withUnfinishedStripeAccount(
  capture: () => Promise<void>,
) {
  const id = await businessId(slugOf(emptyStudio));
  if (!id) throw new Error("Set the fixtures up first");
  const admin = adminClient();
  check(
    await admin
      .from("businesses")
      .update({ stripe_account_id: `acct_screens_${id.slice(0, 8)}` })
      .eq("id", id),
    "Attaching the made-up account",
  );
  try {
    await capture();
  } finally {
    check(
      await admin
        .from("businesses")
        .update({ stripe_account_id: null })
        .eq("id", id),
      "Detaching the made-up account",
    );
  }
}

/** A page in a context of its own, signed in through the sign-in form. */
export async function signedInPage(
  browser: Browser,
  email: string,
  password = TEST_PASSWORD,
) {
  const page = await (await browser.newContext()).newPage();
  await page.goto("/login");
  await signIn(page, email, password);
  await expect(page).toHaveURL(/\/(dashboard|account)$/);
  return page;
}

/** A page in a context of its own, signed out. */
export async function visitorPage(browser: Browser) {
  return (await browser.newContext()).newPage();
}

/** axe's WCAG 2.1 A and AA findings on the page, as readable lines. */
export async function axeFindings(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  return results.violations.map(
    (violation) =>
      `${violation.id} (${violation.help}) at ${violation.nodes
        .map((node) => node.target.join(" "))
        .join(", ")}`,
  );
}

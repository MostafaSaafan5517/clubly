// Seeds a demo business: a climbing gym with an owner, staff, plans and paying members, in
// Stripe's sandbox and in the database. Safe to run again: it reuses what exists and only adds
// what's missing.
//
//   pnpm seed:demo                                   # local (.env.local, app on localhost:3000)
//   pnpm seed:demo --env .env.vercel-production --app-url https://<your-app>.vercel.app
//
// People act for themselves wherever the app would let them (the owner creates the business and
// its plans, members join), so RLS applies and the business's history reads naturally. Paid
// subscriptions are created in Stripe; their rows arrive the way real ones do, through Stripe's
// webhooks (run `pnpm stripe:listen` locally), or through the reconciliation job, which this
// script calls if they're slow.
import { parseArgs } from "node:util";
import { createClient } from "@supabase/supabase-js";
import Stripe from "stripe";

const { values: args } = parseArgs({
  options: {
    env: { type: "string", default: ".env.local" },
    "app-url": { type: "string", default: "http://localhost:3000" },
  },
});
process.loadEnvFile(args.env);

const {
  NEXT_PUBLIC_SUPABASE_URL: supabaseUrl,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: publishableKey,
  SUPABASE_SECRET_KEY: secretKey,
  STRIPE_SECRET_KEY: stripeKey,
  CRON_SECRET: cronSecret,
} = process.env;
if (!supabaseUrl || !publishableKey || !secretKey || !stripeKey) {
  throw new Error(`Missing Supabase or Stripe settings in ${args.env}.`);
}
if (!stripeKey.startsWith("sk_test_")) {
  throw new Error(
    "The demo only ever runs on Stripe's test mode (an sk_test_ key).",
  );
}

// Public on purpose: the README gives it out so anyone can look around the demo.
const DEMO_PASSWORD = "climb-demo-2026";
const APPLICATION_FEE_PERCENT = 5; // appConfig.applicationFeePercent
const BUSINESS = { name: "Harbor Climbing Gym", slug: "harbor-climbing-gym" };
const PLANS = [
  { name: "Monthly climber", amount: 6500, interval: "month", active: true },
  { name: "Annual climber", amount: 65000, interval: "year", active: true },
  { name: "Summer pass", amount: 4500, interval: "month", active: false },
];
const PEOPLE = {
  owner: { name: "Olivia Owner", email: "olivia.owner@example.com" },
  admin: { name: "Adam Admin", email: "adam.admin@example.com" },
  staff: { name: "Sara Staff", email: "sara.staff@example.com" },
};
// What each member does: subscribe to a plan, then maybe cancel at the period end or get
// suspended by the owner. Nina joined but hasn't picked a plan.
const MEMBERS = [
  {
    name: "Mona Member",
    email: "mona.member@example.com",
    plan: "Monthly climber",
  },
  { name: "Sam Saver", email: "sam.saver@example.com", plan: "Annual climber" },
  {
    name: "Carl Canceling",
    email: "carl.canceling@example.com",
    plan: "Monthly climber",
    cancel: true,
  },
  {
    name: "Sid Suspended",
    email: "sid.suspended@example.com",
    plan: "Monthly climber",
    suspend: true,
  },
  { name: "Nina Newcomer", email: "nina.newcomer@example.com" },
];
const DEMO_ACCOUNT_PURPOSE = "clubly-demo";

const admin = createClient(supabaseUrl, secretKey, {
  auth: { persistSession: false },
});
const stripe = new Stripe(stripeKey);

function step(message) {
  process.stdout.write(`- ${message}\n`);
}

function check({ data, error }, what) {
  if (error) throw new Error(`${what}: ${error.message}`);
  return data;
}

/** The demo user's id, creating them (already confirmed) the first time. */
async function ensureUser({ name, email }) {
  const existing = check(
    await admin.from("profiles").select("id").eq("email", email).maybeSingle(),
    `Looking up ${email}`,
  );
  if (existing) {
    // Keeps the published password working even if someone changed it.
    check(
      await admin.auth.admin.updateUserById(existing.id, {
        password: DEMO_PASSWORD,
      }),
      `Resetting ${email}'s password`,
    );
    return existing.id;
  }
  const created = check(
    await admin.auth.admin.createUser({
      email,
      password: DEMO_PASSWORD,
      email_confirm: true,
      user_metadata: { full_name: name },
    }),
    `Creating ${email}`,
  );
  step(`created ${name} (${email})`);
  return created.user.id;
}

/** A Supabase client signed in as the demo user, so RLS applies as in the app. */
async function signedInAs({ email }) {
  const client = createClient(supabaseUrl, publishableKey, {
    auth: { persistSession: false },
  });
  check(
    await client.auth.signInWithPassword({ email, password: DEMO_PASSWORD }),
    `Signing in as ${email}`,
  );
  return client;
}

/**
 * A connected account that can take payments, kept for the demo. Created once through Stripe's
 * API onboarding with Stripe's documented test values (like the shared E2E account, but separate
 * so test runs never touch the demo); verifying it takes Stripe about a minute.
 */
async function demoAccountId() {
  for await (const account of stripe.accounts.list({ limit: 100 })) {
    if (
      account.metadata?.purpose === DEMO_ACCOUNT_PURPOSE &&
      account.charges_enabled
    ) {
      return account.id;
    }
  }
  step(
    "creating the demo's Stripe account (Stripe takes about a minute to verify it)",
  );
  const created = await stripe.accounts.create({
    country: "US",
    controller: {
      stripe_dashboard: { type: "none" },
      fees: { payer: "application" },
      losses: { payments: "application" },
      requirement_collection: "application",
    },
    capabilities: {
      card_payments: { requested: true },
      transfers: { requested: true },
    },
    business_type: "individual",
    business_profile: {
      name: BUSINESS.name,
      mcc: "7997",
      url: "https://accessible.stripe.com",
      product_description: "Climbing gym memberships (demo)",
    },
    individual: {
      first_name: "Olivia",
      last_name: "Owner",
      email: PEOPLE.owner.email,
      phone: "0000000000",
      dob: { day: 1, month: 1, year: 1901 },
      address: {
        line1: "address_full_match",
        city: "Schenectady",
        state: "NY",
        postal_code: "12345",
        country: "US",
      },
      id_number: "000000000",
    },
    external_account: "btok_us_verified",
    tos_acceptance: { date: Math.floor(Date.now() / 1000), ip: "8.8.8.8" },
    metadata: { purpose: DEMO_ACCOUNT_PURPOSE },
  });
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const account = await stripe.accounts.retrieve(created.id);
    if (account.charges_enabled) return account.id;
    await new Promise((resolve) => setTimeout(resolve, 3_000));
  }
  throw new Error(`Stripe never enabled charges on ${created.id}`);
}

async function main() {
  process.stdout.write(`Seeding the demo with ${args.env}\n`);
  const ids = {};
  for (const [role, person] of Object.entries(PEOPLE))
    ids[role] = await ensureUser(person);
  const memberIds = {};
  for (const member of MEMBERS)
    memberIds[member.email] = await ensureUser(member);
  const owner = await signedInAs(PEOPLE.owner);

  // The business, created by its owner.
  let business = check(
    await admin
      .from("businesses")
      .select("id, stripe_account_id")
      .eq("slug", BUSINESS.slug)
      .maybeSingle(),
    "Looking up the business",
  );
  if (!business) {
    check(
      await owner.rpc("create_business", {
        business_name: BUSINESS.name,
        business_slug: BUSINESS.slug,
      }),
      "Creating the business",
    );
    business = check(
      await admin
        .from("businesses")
        .select("id, stripe_account_id")
        .eq("slug", BUSINESS.slug)
        .single(),
      "Reading the business",
    );
    step(`created ${BUSINESS.name}`);
  }

  // Payouts: the demo account, already verified (what onboarding plus Stripe's webhook would do).
  const accountId = business.stripe_account_id ?? (await demoAccountId());
  check(
    await admin
      .from("businesses")
      .update({ stripe_account_id: accountId, charges_enabled: true })
      .eq("id", business.id),
    "Connecting the Stripe account",
  );

  // Staff, added by the owner.
  for (const role of ["admin", "staff"]) {
    const existing = check(
      await admin
        .from("business_staff")
        .select("user_id")
        .eq("business_id", business.id)
        .eq("user_id", ids[role])
        .maybeSingle(),
      "Looking up staff",
    );
    if (!existing) {
      check(
        await owner
          .from("business_staff")
          .insert({ business_id: business.id, user_id: ids[role], role }),
        `Adding ${PEOPLE[role].name}`,
      );
      step(`added ${PEOPLE[role].name} as ${role}`);
    }
  }

  // Plans, created by the owner, each with its Stripe price (as the app does).
  const planIds = {};
  const priceIds = {};
  for (const plan of PLANS) {
    let row = check(
      await admin
        .from("plans")
        .select("id, stripe_price_id, active")
        .eq("business_id", business.id)
        .eq("name", plan.name)
        .maybeSingle(),
      `Looking up ${plan.name}`,
    );
    if (!row) {
      // The owner can't read Stripe ids (they're never granted to signed-in users), so only the
      // id comes back; the rest is read as the server.
      const created = check(
        await owner
          .from("plans")
          .insert({
            business_id: business.id,
            name: plan.name,
            billing_interval: plan.interval,
            amount: plan.amount,
          })
          .select("id")
          .single(),
        `Creating ${plan.name}`,
      );
      row = check(
        await admin
          .from("plans")
          .select("id, stripe_price_id, active")
          .eq("id", created.id)
          .single(),
        `Reading ${plan.name}`,
      );
      step(`created plan ${plan.name}`);
    }
    if (!row.stripe_price_id) {
      const price = await stripe.prices.create(
        {
          currency: "usd",
          unit_amount: plan.amount,
          recurring: { interval: plan.interval },
          product_data: { name: plan.name, metadata: { plan_id: row.id } },
          metadata: { plan_id: row.id },
        },
        { stripeAccount: accountId, idempotencyKey: `plan-price-${row.id}` },
      );
      check(
        await admin
          .from("plans")
          .update({ stripe_price_id: price.id })
          .eq("id", row.id),
        `Saving ${plan.name}'s price`,
      );
      row.stripe_price_id = price.id;
    }
    if (row.active !== plan.active) {
      check(
        await owner
          .from("plans")
          .update({ active: plan.active })
          .eq("id", row.id),
        `Archiving ${plan.name}`,
      );
      const price = await stripe.prices.retrieve(
        row.stripe_price_id,
        {},
        { stripeAccount: accountId },
      );
      await stripe.products.update(
        String(price.product),
        { active: plan.active },
        { stripeAccount: accountId },
      );
      step(`${plan.active ? "restored" : "archived"} plan ${plan.name}`);
    }
    planIds[plan.name] = row.id;
    priceIds[plan.name] = row.stripe_price_id;
  }

  // Members join for themselves; those with a plan pay with Stripe's test card.
  let subscriptionsExpected = 0;
  for (const member of MEMBERS) {
    const userId = memberIds[member.email];
    let row = check(
      await admin
        .from("members")
        .select("id, stripe_customer_id, status")
        .eq("business_id", business.id)
        .eq("user_id", userId)
        .maybeSingle(),
      `Looking up ${member.name}'s membership`,
    );
    if (!row) {
      const client = await signedInAs(member);
      check(
        await client
          .from("members")
          .insert({ business_id: business.id, user_id: userId }),
        `${member.name} joining`,
      );
      row = check(
        await admin
          .from("members")
          .select("id, stripe_customer_id, status")
          .eq("business_id", business.id)
          .eq("user_id", userId)
          .single(),
        `Reading ${member.name}'s membership`,
      );
      step(`${member.name} joined`);
    }
    if (!member.plan) continue;
    subscriptionsExpected += 1;

    let customerId = row.stripe_customer_id;
    if (!customerId) {
      const customer = await stripe.customers.create(
        {
          email: member.email,
          name: member.name,
          metadata: { member_id: row.id },
        },
        { stripeAccount: accountId, idempotencyKey: `customer-${row.id}` },
      );
      customerId = customer.id;
      check(
        await admin
          .from("members")
          .update({ stripe_customer_id: customerId })
          .eq("id", row.id),
        "Saving the customer",
      );
    }
    const live = await stripe.subscriptions.list(
      { customer: customerId, status: "active", limit: 1 },
      { stripeAccount: accountId },
    );
    if (live.data.length === 0) {
      const card = await stripe.paymentMethods.attach(
        "pm_card_visa",
        { customer: customerId },
        { stripeAccount: accountId },
      );
      await stripe.subscriptions.create(
        {
          customer: customerId,
          items: [{ price: priceIds[member.plan] }],
          default_payment_method: card.id,
          application_fee_percent: APPLICATION_FEE_PERCENT,
          cancel_at_period_end: Boolean(member.cancel),
          metadata: {
            business_id: business.id,
            member_id: row.id,
            plan_id: planIds[member.plan],
          },
        },
        { stripeAccount: accountId },
      );
      step(
        `${member.name} subscribed to ${member.plan}${member.cancel ? " (ending at the period end)" : ""}`,
      );
    }
    if (member.suspend && row.status !== "suspended") {
      check(
        await owner
          .from("members")
          .update({ status: "suspended" })
          .eq("id", row.id),
        `Suspending ${member.name}`,
      );
      step(`${PEOPLE.owner.name} suspended ${member.name}`);
    }
  }

  // The subscriptions' rows come from Stripe's webhooks; nudge reconciliation if they're slow.
  const waitForSubscriptions = async (seconds) => {
    for (let waited = 0; waited < seconds; waited += 3) {
      const { count } = await admin
        .from("subscriptions")
        .select("id", { count: "exact", head: true })
        .eq("business_id", business.id);
      if ((count ?? 0) >= subscriptionsExpected) return true;
      await new Promise((resolve) => setTimeout(resolve, 3_000));
    }
    return false;
  };
  if (!(await waitForSubscriptions(30))) {
    if (!cronSecret)
      throw new Error(
        "Subscriptions haven't arrived and there's no CRON_SECRET to run reconciliation.",
      );
    step(
      `webhooks are slow; asking ${args["app-url"]} to reconcile with Stripe`,
    );
    const response = await fetch(`${args["app-url"]}/api/cron/reconcile`, {
      headers: { authorization: `Bearer ${cronSecret}` },
    });
    step(`reconciliation answered ${response.status}`);
    if (!(await waitForSubscriptions(15))) {
      throw new Error(
        "The subscriptions still aren't in the database. Is the app running and reachable?",
      );
    }
  }

  process.stdout.write(
    `\nDone. Sign in at ${args["app-url"]}/login with any of these (password "${DEMO_PASSWORD}"):\n` +
      [...Object.values(PEOPLE), ...MEMBERS]
        .map((person) => `  ${person.email}  (${person.name})`)
        .join("\n") +
      `\nThe public join page is ${args["app-url"]}/b/${BUSINESS.slug}\n`,
  );
}

await main();

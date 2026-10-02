@AGENTS.md

# Clubly: project guide

Multi-tenant membership SaaS for small businesses (gyms, studios, clubs, coaching programs). Businesses connect Stripe payouts and sell membership plans; members subscribe on the business's public page; the platform takes an application fee on each payment.

This is a public portfolio project. Test coverage, clear decisions, and a clean commit history matter as much as features.

The product name is a working name. In code it lives only in `src/config/app.ts`; never hard-code it anywhere else in `src/`. The docs (`README.md`, this file) use it by name.

## Stack

- Next.js 16 (App Router), TypeScript in strict mode plus `noUncheckedIndexedAccess`
- Tailwind CSS v4 + shadcn/ui
- Supabase: Postgres, Auth, Row-Level Security. Local development with the Supabase CLI and SQL migrations
- Stripe, **test mode only**: Checkout, Billing subscriptions, Customer Portal, Connect (Express accounts), application fees, webhooks
- Vitest (unit/integration), Playwright (end-to-end), pgTAP via `supabase test db` (database and RLS)
- GitHub Actions CI; Vercel hosting with Vercel Cron
- pnpm; Node 24. `engines.node` in `package.json` is the single source of truth for the Node version (Vercel and CI both read it)

## Non-negotiable rules

1. **Tenant isolation lives in the database.** Every table has RLS; the UI is never the only guard. Every policy has pgTAP tests, including negative tests that prove access is denied.
2. **Webhooks are idempotent.** Every processed Stripe event ID is stored in `stripe_events` under a unique constraint, so an event can never apply twice. Every webhook signature is verified.
3. **Stripe is the source of truth for payments.** Never mark a subscription active because of a client redirect. Only webhooks or reconciliation change payment state.
4. **Reconciliation.** A scheduled job compares Stripe subscriptions with the `subscriptions` table, fixes drift, and records every correction.
5. **Append-only audit log.** Privileged actions are written to `audit_log` by database triggers. UPDATE and DELETE on `audit_log` are blocked by a trigger and by revoked privileges.
6. **No secrets in the repo.** Real values go in `.env.local` (gitignored). Keep `.env.example` up to date. Test-mode keys only.
7. **Small, reviewable steps.** Each meaningful step is its own commit with a Conventional Commits message (`feat:`, `fix:`, `refactor:`, `test:`, `docs:`, `ci:`, `chore:`). Never batch a whole phase into one commit. Verify (format, lint, typecheck, tests) before committing, then summarize what changed.
8. **Explain non-obvious decisions** briefly, in the step summary or in a code comment when the "why" is not obvious from the code.

## Code conventions

- Prettier formats everything (Tailwind classes are sorted automatically). ESLint must pass with zero warnings.
- Import app code through the `@/` alias, which maps to `src/`.
- UI primitives come from shadcn/ui (Base UI flavor, `base-nova` style). Add one with `pnpm dlx shadcn@latest add <name>`; it is copied into `src/components/ui/` and becomes our code to edit. Merge class names with `cn` from the `cn` package.
- Anything that navigates is a `<Link>`, even when it looks like a button: style it with `buttonVariants()`. Never `<Button render={<Link />}>`, which gives the link `role="button"` and makes screen readers announce it wrongly.
- Use theme tokens (`bg-background`, `text-muted-foreground`, `border-border`, ...) instead of raw colors, so the palette can change in one place (`src/app/globals.css`).
- No `console.log` in app code, no commented-out code, no unused code. Unexpected server-side failures are logged with `console.error("What failed", { code, status })` (Vercel collects them); users get a plain message, never raw provider errors.
- Handle errors explicitly; no empty `catch` blocks.
- `src/proxy.ts` (Next.js 16's name for middleware) only refreshes the Supabase session. It never makes authorization decisions: every page and Server Action checks the user itself, and RLS checks again in the database.
- Money is always an integer in the currency's smallest unit (cents), exactly as Stripe sends it. Convert only for display, with `formatAmount` in `src/lib/money.ts`.
- No abstractions for single-use code.

## Auth conventions

- Two server clients in `src/lib/supabase/server.ts`: `createServerComponentClient()` for pages (read-only cookies; `proxy.ts` refreshes the session) and `createServerActionClient()` for Server Actions and Route Handlers (can write the session cookies).
- Pages check the user with `supabase.auth.getClaims()` (verifies the token) and redirect to `/login?next=<path>`. Any `next` value goes through `safeRedirectPath` before redirecting.
- Email links go to `/auth/confirm?token_hash=...&type=email` (templates in `supabase/templates/`), not Supabase's code-exchange redirect: a token hash works on any device, the code flow only in the browser that started it. A hosted Supabase project needs the same templates.
- Server Actions validate input with zod and return `{ error, fields }` to `useActionState` forms. Auth errors are mapped to our own messages. Neither sign-up nor the email-link form (`/magic-link`, existing accounts only) reveals whether an email is registered: both always answer "check your email".
- Signing in without a `next` page lands on `SIGNED_IN_HOME` (`/start`), which sends staff to `/dashboard`, people who are only members to `/account`, and everyone else to `/dashboard` (to create a business). Every auth flow uses that constant as its fallback.
- No `loading.tsx` around pages that can 404: a loading boundary streams the response, and once streaming has started `notFound()` still shows the not-found page but with status 200. Access checks run before anything streams; a slow part (Stripe calls on the payouts page) streams inside its own `<Suspense>` after them. Errors in signed-in pages land in `(app)/error.tsx`, which keeps the header and offers `retry()` (Next 16's name for the old `reset`).
- Business pages (`/dashboard/b/[slug]/...`) start with `requireStaffBusiness(slug, path, roles?)`: sign-in redirect back to the page, then a 404 for anyone who isn't staff there or whose role isn't allowed (a 404, not a 403, so outsiders can't tell the business or page exists). They render `BusinessHeader`, whose tabs are filtered by role; hiding a tab is only a convenience, the page and RLS are the real checks.
- Server Actions take their arguments from the browser even when bound on the server, so each one re-checks the user's role and relies on RLS for the write. Helpers shared between actions live outside `"use server"` files: every export of such a file becomes a callable endpoint.
- Local email confirmation is on (like hosted Supabase), and every email lands in Mailpit (http://127.0.0.1:54324). E2E tests read links from Mailpit's API (`e2e/support/mailpit.ts`).

## Stripe conventions

- Test mode only. `src/lib/stripe/server.ts` refuses any key that isn't `sk_test_`. Stripe and service-role code is `server-only`, so importing it from a client component fails the build.
- Every business gets one connected account. Express-style accounts are created through `controller` settings (Stripe hosts onboarding and a light dashboard; the platform pays Stripe fees and covers negative balances), with `type: "express"` avoided because it's deprecated. We use the v1 Accounts API; the SDK's suggestion to move to Accounts v2 is a possible later upgrade.
- Account creation uses an idempotency key per business, and the id is stored only into an empty slot, so double-clicks and races can't create or overwrite a second account.
- Only the owner can start onboarding (payouts go to their bank). Returning from Stripe never marks a business as ready: only Stripe's `account.updated` webhook sets `charges_enabled`.
- Pages and actions find the business through `getStaffBusiness()` (`src/lib/business.ts`): the staff row, not just the business, because public businesses are readable by every signed-in user. Non-staff get a 404.
- Plans are created in three steps (`createPlan`): insert the row through RLS as the user (the database decides who may create plans), create the Stripe product and price on the business's connected account (idempotency key per plan), then save the price id with the service role. If Stripe fails, the unpriced plan is deleted. Public pages only show plans that have a price; staff see a "Not ready" tag on one that doesn't.
- A plan's price, currency and interval never change (Stripe prices are immutable too); to reprice, archive the plan and create a new one.
- Archiving or restoring a plan (`setPlanActive`) updates the row through RLS, then the Stripe product's `active` flag; if Stripe fails, the row is put back so the app and Stripe never disagree. Only the product is archived: its price is the product's default price, which Stripe won't archive, and a price on an archived product can't start new subscriptions.
- Prices typed by users are parsed as text into cents (`parseDollarsToCents`), never with `parseFloat`.
- Joining (`joinPlan` on `/b/[slug]`) re-checks the business and plan as the public page shows them, creates the membership through RLS, refuses suspended members and anyone with a live subscription there, creates the member's Stripe customer on the business's account (idempotency key per member), then opens Stripe Checkout in subscription mode with `application_fee_percent` from `appConfig`. Checkout returns to `/account?joined=<slug>`, which says Stripe is confirming the payment and re-reads the database every 2 seconds (for up to 30) until a webhook has stored a live subscription. The redirect itself activates nothing.
- Members manage billing in Stripe's Customer Portal (`openBillingPortal` on `/account`). Express accounts have no portal settings of their own, so each business gets one configuration created through the API on its connected account (idempotency key per business, id stored into an empty slot of `businesses.stripe_portal_configuration_id`) and passed explicitly to every portal session. Members can update their card, see invoices and cancel at the end of the period; their email is changed in the app, not in Stripe. Stripe makes an account's first configuration its default and won't deactivate it.
- The portal acts as the member (their card, their invoices), so `openBillingPortal` checks the membership's `user_id` is the signed-in user, not only that RLS lets them see it: staff can read their business's members too.
- Payouts (owner only) are read live from Stripe on each visit (`getPayoutSummary`: balance and the latest payouts), not stored: Stripe owns that money's state and nothing in the app acts on it. "Open Stripe dashboard" signs the owner in to their Express dashboard with a single-use login link; Stripe only issues one once onboarding is finished, so the success path can't run in automated tests (the shared test account has no Express dashboard), only its error path.
- Payments are direct charges: customers, products, prices and subscriptions all live on the business's connected account (`stripeAccount` option on every call).
- Webhooks (`/api/stripe/webhook`, a Connect endpoint): verify the signature on the raw body, then handle the event. Handled: `account.updated`, `checkout.session.completed`, `customer.subscription.created|updated|deleted`, `invoice.paid`, `invoice.payment_failed`. Each family has a SQL function (`apply_account_updated`, `apply_subscription_event`, `apply_invoice_event`) that records the event in `stripe_events` and applies it in one transaction; a duplicate delivery reports `duplicate` and changes nothing. Answer 200 when handled or ignored, 400 for a bad signature (never retried), 500 when processing fails (Stripe retries, which is safe).
- Treat events as nudges: re-read the object from Stripe on the event's connected account (`event.account`) and store that snapshot, never the payload. Late, repeated or out-of-order events then can't regress anything (in practice `invoice.paid` often arrives before `customer.subscription.created`; an invoice event upserts its subscription too).
- Stripe objects are linked to our rows through ids we stored, never metadata: member by `stripe_customer_id`, plan by `stripe_price_id`, and only when the event's connected account is that business's account. Unknown or foreign objects are recorded and ignored.
- A subscription's scheduled end is stored as one date, `cancel_at`. Stripe expresses it either as `cancel_at` (what the Customer Portal sets, leaving the flag false) or as `cancel_at_period_end` (the end is then the period's end); the snapshot folds both into the date.
- With direct charges the platform's fee isn't on the invoice: it's read from the payment's PaymentIntent (`invoices.retrieve` with `payments.data.payment.payment_intent` expanded).
- Handler logic lives in `src/lib/stripe/webhooks.ts` with its dependencies injected, so unit tests use real signature checks with fake Stripe and database calls. The route only wires the real ones.
- Reconciliation (`/api/cron/reconcile`) runs daily at 03:00 UTC through Vercel Cron (`vercel.json`). It answers only requests carrying `Authorization: Bearer $CRON_SECRET` (compared in constant time). For each business with a connected account it re-reads the account, every subscription in any status, and membership invoices from the last 35 days, and hands them to the reconcile SQL functions. Fees sit on PaymentIntents, which a list call can't expand to (Stripe stops at four levels), so recent PaymentIntents are listed too and any missing one is fetched alone. Businesses go one at a time; one that fails is recorded in the run and skipped. A run with any failure answers 500, so it shows in Vercel's cron logs. The logic lives in `src/lib/stripe/reconcile.ts` with its dependencies injected; the route only wires the real ones.
- Error messages that are logged or stored go through `errorMessage()` (`src/lib/redact.ts`): Stripe's errors quote the API key with its last characters visible.
- Locally: `pnpm env:stripe` once (writes the CLI's signing secret to `.env.local`), then `pnpm stripe:listen` next to `pnpm dev`. Add every event type the app handles to `EVENTS` in `scripts/stripe-listen.mjs`.
- `pnpm seed:demo` (`scripts/seed-demo.mjs`) fills an environment with the demo climbing gym: an owner, an admin and staff, three plans (one archived) and five members, four of them paying with Stripe's test card. People act for themselves through RLS wherever the app would let them, so the history reads naturally; paid subscriptions are created in Stripe and their rows arrive through the webhooks (or the reconciliation job, which the script calls if they're slow). It's idempotent, refuses anything but an `sk_test_` key, and takes `--env <file>` and `--app-url <url>` to seed production. Every demo account's password is public (it's in the README) and is reset on each run.
- Tests that need a connected account able to take payments share one, and all live in `e2e/billing.spec.ts`: `useChargeReadyAccount()` finds it by its `metadata.purpose` (`clubly-e2e-charge-ready`) or creates it once through API onboarding with Stripe's test values (Stripe takes over a minute to verify a new one). Those tests run serially. It and the demo's account (`metadata.purpose` `clubly-demo`, see `pnpm seed:demo`) are the only connected accounts expected to stay in the sandbox.
- E2E tests that create Stripe objects run against the sandbox and delete them afterwards (`e2e/support/stripe.ts`); `deleteStripeAccount` also detaches the account from its business, so reconciliation doesn't keep asking Stripe for it. CI reads the key from the `STRIPE_SECRET_KEY` repository secret.
- Real webhooks reach the app during E2E: Playwright starts `pnpm stripe:listen` next to the app (`playwright.config.ts`), and `pnpm env:stripe` has given the app the CLI's signing secret. So tests can follow a payment from Stripe to the database (`countRecordedEvents` to wait for events). The listener runs through `scripts/stripe-listen.mjs`, which redacts the signing secret from its output (CI logs are public) and holds the list of event types the app handles. CI installs a pinned, checksum-verified Stripe CLI and gives it the same key as `STRIPE_API_KEY`.
- One test pays for real: it drives Stripe's hosted Checkout with the 4242 test card (`payWithTestCard` in `e2e/support/checkout.ts`) and follows the payment through the webhook to the account page, the revenue page and the history. Checkout's markup is Stripe's, not ours: locate by role and label, and expect it to change. Its card form starts folded behind a zero-size toggle button, which takes a dispatched click event. The page also carries a notice addressed to AI agents (about "Link CLI"); tests ignore it.
- Renewals are tested on a Stripe test clock (`createTestClock`, `advanceTestClock`): the member's customer lives on the clock, the test moves it past the period end (plus the hour Stripe waits before charging a renewal), and the webhooks that follow are real. `pm_card_chargeCustomerFail` makes a renewal fail; deleting the clock deletes its customer and subscription. Pages that show Stripe's state are reloaded until the webhook has landed (`expectMembershipToShow`).
- `deliverSignedEvent` posts an event to the webhook route signed exactly as Stripe signs (HMAC-SHA256 of `<timestamp>.<body>` with the endpoint secret), for checking duplicate deliveries and refused forgeries against the running app.
- The sandbox is shared by every run (local and CI), and every listener receives every event: tests check for "at least one more" event, never exact totals. Events for objects the test database doesn't know are recorded and ignored. The reconciliation test makes the app skip the events of a subscription (the member's customer id isn't saved yet), then saves it and checks that reconciliation fills in the subscription and its payment.

## Database conventions

- Every schema change is a SQL migration (`pnpm supabase migration new <name>`), never a click in Studio. `pnpm supabase db reset` must rebuild the whole database from the migrations alone. When `migration new` runs without a terminal (scripts, agents), it copies stdin into the new file and waits for it to close: pass `< /dev/null`.
- After changing the schema, run `pnpm db:types` and commit `src/lib/supabase/database.types.ts`. CI regenerates it and fails if it differs from the migrations.
- Helper functions that RLS policies call live in the `private` schema. The API only exposes `public` and `graphql_public`, so `private` is never reachable over HTTP.
- **Deny by default, in two layers.** Supabase normally gives `anon` and `authenticated` every privilege on new tables, sequences and functions in `public`; our migrations reverse that. So every new table needs both:
  - **grants**: which operations (and columns) an API role may attempt at all
  - **RLS policies**: which rows those operations may touch
- New functions are not executable by anyone by default. Grant `execute` explicitly, only to the roles that need it. RLS policies run as the calling user, so a helper used in a policy needs `usage` on its schema and `execute` granted to that role.
- Policy names are short sentences of at most 62 characters. Postgres silently cuts identifiers at 63 bytes (a notice, no error), and `policy_names.test.sql` fails on any name that reaches the limit.
- A policy must not query another RLS-protected table whose policy could query back (businesses ↔ members): Postgres rejects the loop as infinite recursion. Ask through a `private` security-definer helper instead (`has_business_role`, `is_business_member`), which reads the table directly.
- Stripe identifiers (`stripe_account_id`, `stripe_portal_configuration_id`, `stripe_price_id`, `stripe_customer_id`) are never granted to API roles; grants on those tables are per column. Only server code with the service role reads or writes them.
- `service_role` bypasses RLS and keeps its grants. Only server code that must act across tenants (webhooks, reconciliation) uses it.
- Tables that hold billing history (`plans`, `members`, `subscriptions`, `payments`) use `on delete restrict`, so deleting a business or user can never silently erase them. Pure access rows (`business_staff`) cascade.
- Rows that belong to a business through more than one path use composite foreign keys (`(member_id, business_id)` → `members (id, business_id)`), so the database itself guarantees a subscription can't join a member of one business to a plan of another.
- `subscriptions` and `payments` are written only by server code (webhooks, reconciliation). Members read their own; staff read their business's subscriptions; only owners and admins read payments (revenue). Members also see every plan they subscribe or subscribed to (`subscribes_to_plan`), even once it's archived.
- Every change to tenant data (`businesses`, `business_staff`, `plans`, `members`, `subscriptions`, `payments`) is recorded in `audit_log` by an `after` trigger (`private.record_audit_log`), never by application code. A new tenant table gets the same trigger, with the column that identifies its rows as the argument. Entries say who (`actor`: `user`, `stripe_webhook`, `reconciliation`, `server` or `database`, plus `actor_user_id`), what (table, row, action, `changed_columns`, old and new row) and when. Updates that change nothing but `updated_at` aren't recorded. Stripe ids are named in `changed_columns` but their values are left out of the stored rows, because owners and admins can read their business's history.
- The History page (`/dashboard/b/[slug]/history`, owners and admins) turns entries into sentences with `describeChange` and `describeActor` (`src/lib/audit.ts`, unit-tested per table and action) and looks up names through RLS, so someone the viewer can no longer see shows as "Someone". It pages back with `?before=<id>`, so new entries never shift an older page.
- Server code names itself as the actor with `set_config('app.actor', '<name>', true)` inside its SQL function (the Stripe webhook functions do); a signed-in user's request is always recorded as `user`, whatever it sets.
- `audit_log` is append-only in two layers: no API role (including `service_role`) has insert, update or delete grants, and triggers (`private.reject_change`) reject updates, deletes and truncation even from the table's owner. Only a superuser disabling triggers could rewrite it; real tamper-proofing would also ship entries to external storage.
- Reconciliation corrects our copy from Stripe through SQL functions (`reconcile_account`, `reconcile_subscriptions`, `reconcile_payments`, service role only). They apply Stripe's snapshots through the same upserts the webhooks use (`private.upsert_subscription`, `private.upsert_payment`), compare our row before and after, and log each difference to `reconciliation_corrections` in the same transaction, so a fix is never applied without its log entry or the reverse. Running them twice makes no second correction. Each run is a row in `reconciliation_runs`. Corrections are append-only like the audit log; owners see the fixes in their audit log as `reconciliation`.
- Figures for dashboards are computed in SQL functions that run as the caller (security invoker, the default), so RLS decides what they add up: `business_revenue(business_id, window_days)` gives plain staff no payment figures because they can't read payments. Time windows use the database's clock (`now()`), not the page's. Money stays in integer cents; monthly recurring revenue counts `active` and `past_due` subscriptions, yearly plans at a twelfth, and trials once they pay.
- pgTAP tests live in `supabase/tests/database/*.test.sql`. Each file runs in a transaction and rolls back, and starts with `select tests.clear_tenant_data();` so it only sees its own fixtures, never data left in a local database by the app or Playwright (the rollback restores that data).
- RLS tests act as real users: `tests.create_user(email)`, `tests.authenticate_as(email)` (the API's `authenticated` role with `auth.uid()` set), `tests.authenticate_as_anon()`, `tests.authenticate_as_service_role()`, then `reset role` to go back to `postgres` for fixtures and assertions (`tests.act_as_database()` also clears the last user's claims, which `reset role` keeps, for tests that check who made a change). The audit log can't be truncated, so audit tests look only at businesses created in the test. A transaction's `now()` never moves, so a test can't see a timestamp change between two calls. `tests.business_id(slug)` finds a business the current user may not see. These helpers are defined in `000_setup.test.sql`, which runs first and exists only in test databases.
- RLS denies silently on SELECT/UPDATE/DELETE (the rows just aren't there), but raises on INSERT and on missing grants. Test both kinds: check state after a refused update, and use `throws_ok` with the exact message for refused inserts and column grants.
- A test must be able to fail. When adding one, break the rule once (drop the trigger, disable RLS, re-grant) in a rolled-back transaction and confirm the test goes red. Prefer whole-row assertions (`results_eq`) over single values, so a missing row can't pass as `null`.

## Folder structure

```
src/
  app/               Next.js App Router routes and layouts
    (auth)/          Sign-in, sign-up and email-link pages
    (app)/           Signed-in pages (/dashboard for staff, /account for members), one shared header
    b/[slug]/        A business's public join page
  components/ui/     shadcn/ui components (owned code, edited freely)
  config/            App-wide constants (the product name lives here)
  lib/               Helpers (money, memberships, slugs, safe redirects, ...)
  lib/supabase/      Supabase settings, clients (incl. server-only admin) and generated types
  lib/stripe/        Server-only Stripe client; Connect, plan, Checkout, portal and webhook helpers
  proxy.ts           Runs before every request; refreshes the Supabase session
scripts/             Dev tooling (writing .env.local)
vercel.json          Vercel settings: the daily reconciliation cron
e2e/                 Playwright end-to-end specs (*.spec.ts)
  support/           E2E helpers (test users and businesses, Mailpit links, Stripe sandbox)
supabase/
  config.toml        Local Supabase settings (unused services are switched off)
  templates/         Auth email templates
  migrations/        SQL migrations, applied in filename order
  tests/database/    pgTAP tests for schema, privileges and RLS
.github/
  workflows/ci.yml   CI pipeline
  actions/setup/     Shared CI setup (pnpm, Node, dependencies)
```

Unit tests sit next to the code they test as `*.test.ts`; Vitest only looks inside `src/`. End-to-end specs live in `e2e/` and only Playwright runs them.

## Commands

| Command                             | What it does                                                                  |
| ----------------------------------- | ----------------------------------------------------------------------------- |
| `pnpm dev`                          | Dev server at http://localhost:3000                                           |
| `pnpm build` / `pnpm start`         | Production build / serve that build                                           |
| `pnpm lint`                         | ESLint; fails on any warning                                                  |
| `pnpm typecheck`                    | Generates Next.js route types, then runs `tsc`                                |
| `pnpm format` / `pnpm format:check` | Prettier: rewrite files / check only (CI uses check)                          |
| `pnpm test` / `pnpm test:watch`     | Vitest unit tests: single run / watch mode                                    |
| `pnpm test:e2e`                     | Playwright; starts `pnpm dev` itself if not running                           |
| `pnpm test:db`                      | pgTAP database tests (Supabase must be running)                               |
| `pnpm supabase start` / `stop`      | Start / stop local Supabase (needs Docker running)                            |
| `pnpm env:local`                    | Write local Supabase URL and keys (and a cron secret, once) into `.env.local` |
| `pnpm supabase db reset`            | Rebuild the local database from migrations                                    |
| `pnpm db:types`                     | Regenerate TypeScript types from the local database                           |
| `pnpm seed:demo`                    | Seed the demo climbing gym (people, plans, paid members); safe to rerun       |
| `pnpm env:stripe`                   | Write the Stripe CLI's webhook secret to `.env.local`                         |
| `pnpm stripe:listen`                | Forward sandbox webhooks to the local app                                     |

First Playwright run on a machine: `pnpm exec playwright install chromium`. E2E tests need the full local Supabase (`pnpm supabase start`, then `pnpm env:local`). With `CI=1`, Playwright serves the production build (`pnpm build` first) instead of the dev server, exactly like CI.

## CI

GitHub Actions runs on every push to `main` and every pull request, as three parallel jobs:

- **checks**: `format:check`, `lint`, `typecheck`, `test`
- **database**: starts only Postgres (`pnpm supabase db start`, which applies every migration from scratch), runs `test:db`, then checks the generated types are current
- **e2e**: starts local Supabase (without Studio), writes `.env.local`, builds for production, then runs Playwright

Every CI step is a `pnpm` script, so anything that fails in CI can be reproduced locally with the same command. Keep it that way.

## Local setup notes

Local Supabase needs Docker Desktop running (on Windows with the WSL 2 backend). The Supabase CLI is a pinned dev dependency, so always call it through `pnpm supabase`, never a global install.

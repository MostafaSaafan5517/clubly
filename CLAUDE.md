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
- Server Actions validate input with zod and return `{ error, fields }` to `useActionState` forms. Auth errors are mapped to our own messages; sign-up never reveals whether an email is registered.
- Local email confirmation is on (like hosted Supabase), and every email lands in Mailpit (http://127.0.0.1:54324). E2E tests read links from Mailpit's API (`e2e/support/mailpit.ts`).

## Database conventions

- Every schema change is a SQL migration (`pnpm supabase migration new <name>`), never a click in Studio. `pnpm supabase db reset` must rebuild the whole database from the migrations alone.
- After changing the schema, run `pnpm db:types` and commit `src/lib/supabase/database.types.ts`. CI regenerates it and fails if it differs from the migrations.
- Helper functions that RLS policies call live in the `private` schema. The API only exposes `public` and `graphql_public`, so `private` is never reachable over HTTP.
- **Deny by default, in two layers.** Supabase normally gives `anon` and `authenticated` every privilege on new tables, sequences and functions in `public`; our migrations reverse that. So every new table needs both:
  - **grants**: which operations (and columns) an API role may attempt at all
  - **RLS policies**: which rows those operations may touch
- New functions are not executable by anyone by default. Grant `execute` explicitly, only to the roles that need it. RLS policies run as the calling user, so a helper used in a policy needs `usage` on its schema and `execute` granted to that role.
- A policy must not query another RLS-protected table whose policy could query back (businesses ↔ members): Postgres rejects the loop as infinite recursion. Ask through a `private` security-definer helper instead (`has_business_role`, `is_business_member`), which reads the table directly.
- Stripe identifiers (`stripe_account_id`, `stripe_price_id`, `stripe_customer_id`) are never granted to API roles; grants on those tables are per column. Only server code with the service role reads or writes them.
- `service_role` bypasses RLS and keeps its grants. Only server code that must act across tenants (webhooks, reconciliation) uses it.
- Tables that hold billing history (`plans`, `members`, later `subscriptions` and `payments`) use `on delete restrict`, so deleting a business or user can never silently erase them. Pure access rows (`business_staff`) cascade.
- pgTAP tests live in `supabase/tests/database/*.test.sql`. Each file runs in a transaction and rolls back.
- RLS tests act as real users: `tests.create_user(email)`, `tests.authenticate_as(email)` (the API's `authenticated` role with `auth.uid()` set), `tests.authenticate_as_anon()`, then `reset role` to go back to `postgres` for fixtures and assertions. `tests.business_id(slug)` finds a business the current user may not see. These helpers are defined in `000_setup.test.sql`, which runs first and exists only in test databases.
- RLS denies silently on SELECT/UPDATE/DELETE (the rows just aren't there), but raises on INSERT and on missing grants. Test both kinds: check state after a refused update, and use `throws_ok` with the exact message for refused inserts and column grants.
- A test must be able to fail. When adding one, break the rule once (drop the trigger, disable RLS, re-grant) in a rolled-back transaction and confirm the test goes red. Prefer whole-row assertions (`results_eq`) over single values, so a missing row can't pass as `null`.

## Folder structure

```
src/
  app/               Next.js App Router routes and layouts
  components/ui/     shadcn/ui components (owned code, edited freely)
  config/            App-wide constants (the product name lives here)
  lib/               Helpers (money formatting, ...)
  lib/supabase/      Supabase settings, clients and generated database types
  proxy.ts           Runs before every request; refreshes the Supabase session
scripts/             Dev tooling (writing .env.local)
e2e/                 Playwright end-to-end specs (*.spec.ts)
  support/           E2E helpers (Mailpit links, confirmed test users)
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

| Command                             | What it does                                         |
| ----------------------------------- | ---------------------------------------------------- |
| `pnpm dev`                          | Dev server at http://localhost:3000                  |
| `pnpm build` / `pnpm start`         | Production build / serve that build                  |
| `pnpm lint`                         | ESLint; fails on any warning                         |
| `pnpm typecheck`                    | Generates Next.js route types, then runs `tsc`       |
| `pnpm format` / `pnpm format:check` | Prettier: rewrite files / check only (CI uses check) |
| `pnpm test` / `pnpm test:watch`     | Vitest unit tests: single run / watch mode           |
| `pnpm test:e2e`                     | Playwright; starts `pnpm dev` itself if not running  |
| `pnpm test:db`                      | pgTAP database tests (Supabase must be running)      |
| `pnpm supabase start` / `stop`      | Start / stop local Supabase (needs Docker running)   |
| `pnpm env:local`                    | Write local Supabase URL and keys into `.env.local`  |
| `pnpm supabase db reset`            | Rebuild the local database from migrations           |
| `pnpm db:types`                     | Regenerate TypeScript types from the local database  |

First Playwright run on a machine: `pnpm exec playwright install chromium`. E2E tests need the full local Supabase (`pnpm supabase start`, then `pnpm env:local`). With `CI=1`, Playwright serves the production build (`pnpm build` first) instead of the dev server, exactly like CI.

## CI

GitHub Actions runs on every push to `main` and every pull request, as three parallel jobs:

- **checks**: `format:check`, `lint`, `typecheck`, `test`
- **database**: starts only Postgres (`pnpm supabase db start`, which applies every migration from scratch), runs `test:db`, then checks the generated types are current
- **e2e**: starts local Supabase (without Studio), writes `.env.local`, builds for production, then runs Playwright

Every CI step is a `pnpm` script, so anything that fails in CI can be reproduced locally with the same command. Keep it that way.

## Local setup notes

Local Supabase needs Docker Desktop running (on Windows with the WSL 2 backend). The Supabase CLI is a pinned dev dependency, so always call it through `pnpm supabase`, never a global install.

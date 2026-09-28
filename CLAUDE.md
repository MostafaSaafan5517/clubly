@AGENTS.md

# Clubly: project guide

Multi-tenant membership SaaS for small businesses (gyms, studios, clubs, coaching programs). Businesses connect Stripe payouts and sell membership plans; members subscribe on the business's public page; the platform takes an application fee on each payment.

This is a public portfolio project. Test coverage, clear decisions, and a clean commit history matter as much as features.

The product name is a working name. It lives only in `src/config/app.ts`; never hard-code it anywhere else.

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
- No `console.log` in app code, no commented-out code, no unused code.
- Handle errors explicitly; no empty `catch` blocks.
- Money is always an integer in the currency's smallest unit (cents), exactly as Stripe sends it. Convert only for display, with `formatAmount` in `src/lib/money.ts`.
- No abstractions for single-use code.

## Folder structure

```
src/
  app/            Next.js App Router routes and layouts
  components/ui/  shadcn/ui components (owned code, edited freely)
  config/         App-wide constants (the product name lives here)
  lib/            Framework-free helpers (money formatting, ...)
```

Unit tests sit next to the code they test as `*.test.ts`.

## Commands

| Command                             | What it does                                         |
| ----------------------------------- | ---------------------------------------------------- |
| `pnpm dev`                          | Dev server at http://localhost:3000                  |
| `pnpm build` / `pnpm start`         | Production build / serve that build                  |
| `pnpm lint`                         | ESLint; fails on any warning                         |
| `pnpm typecheck`                    | Generates Next.js route types, then runs `tsc`       |
| `pnpm format` / `pnpm format:check` | Prettier: rewrite files / check only (CI uses check) |
| `pnpm test` / `pnpm test:watch`     | Vitest unit tests: single run / watch mode           |

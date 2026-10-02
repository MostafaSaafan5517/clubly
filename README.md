# Clubly

[![CI](https://github.com/MostafaSaafan5517/clubly/actions/workflows/ci.yml/badge.svg)](https://github.com/MostafaSaafan5517/clubly/actions/workflows/ci.yml)

A membership platform for small businesses: gyms, studios, clubs and coaching programs. A business connects its Stripe account and creates membership plans; members subscribe from the business's public page and manage their own billing. The platform takes a small application fee on every payment.

> **Status: in active development.** See the [roadmap](#roadmap). Stripe runs in test mode only, so no real money moves.

## What this project demonstrates

The goal is production habits on a real multi-tenant billing product, not a demo:

- **Tenant isolation in the database.** Postgres Row-Level Security keeps each business's data separate, with tests that prove cross-tenant access is denied.
- **Safe webhooks.** Stripe webhooks are signature-verified and idempotent, so a duplicate or out-of-order event can never apply twice.
- **Stripe as the source of truth.** Payment state only changes from Stripe events, and a scheduled reconciliation job repairs any drift.
- **An append-only audit log** written by database triggers, which the application cannot edit or delete.

## Stack

- [Next.js](https://nextjs.org) (App Router) and TypeScript in strict mode
- [Tailwind CSS](https://tailwindcss.com) and [shadcn/ui](https://ui.shadcn.com)
- [Supabase](https://supabase.com): Postgres, Auth, Row-Level Security, SQL migrations
- [Stripe](https://stripe.com): Checkout, Billing, Customer Portal, Connect
- [Vitest](https://vitest.dev), [Playwright](https://playwright.dev) and [pgTAP](https://pgtap.org) for tests
- GitHub Actions for CI, [Vercel](https://vercel.com) for hosting

## Roadmap

- [x] **Phase 0:** project setup, test tooling and CI
- [x] **Phase 1:** authentication, businesses and Row-Level Security
- [x] **Phase 2:** Stripe Connect onboarding and membership plans
- [x] **Phase 3:** member subscriptions and webhooks
- [x] **Phase 4:** reconciliation job and audit log
- [x] **Phase 5:** business and member dashboards
- [ ] **Phase 6:** end-to-end test flows
- [ ] **Phase 7:** documentation, demo data and live demo

## Running locally

You need Node.js 24, [pnpm](https://pnpm.io) 11, [Docker Desktop](https://www.docker.com/products/docker-desktop/) (for the local Supabase stack), a [Stripe](https://stripe.com) account in test mode with Connect enabled, and the [Stripe CLI](https://docs.stripe.com/stripe-cli) (logged in with `stripe login`).

```bash
pnpm install
pnpm supabase start
pnpm env:local
pnpm env:stripe
pnpm dev
```

- `pnpm env:local` writes the local Supabase URL and keys into `.env.local`, plus a `CRON_SECRET` the first time.
- `pnpm env:stripe` writes the Stripe CLI's webhook signing secret there too.
- Add your Stripe test secret key yourself as `STRIPE_SECRET_KEY` (see `.env.example` for every variable).

In a second terminal, `pnpm stripe:listen` forwards Stripe's webhooks to the app. Then open http://localhost:3000.

The daily reconciliation job runs on Vercel Cron in production. To run it locally, call it with the `CRON_SECRET` value from `.env.local`:

```bash
curl -H "Authorization: Bearer <CRON_SECRET>" http://localhost:3000/api/cron/reconcile
```

## Tests

| Suite          | Command         | Notes                                                                                                                                                                                             |
| -------------- | --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Unit           | `pnpm test`     | Vitest                                                                                                                                                                                            |
| Database / RLS | `pnpm test:db`  | pgTAP; needs `pnpm supabase start` first                                                                                                                                                          |
| End-to-end     | `pnpm test:e2e` | Playwright, with real Stripe sandbox webhooks; needs local Supabase running, `pnpm env:local`, the Stripe CLI logged in and `pnpm env:stripe`; first run: `pnpm exec playwright install chromium` |

`pnpm lint`, `pnpm typecheck` and `pnpm format:check` run in CI alongside all three suites.

# Design audit: Clubly before the redesign

Step 1 of the UI redesign: what the interface looks like today, what reads as generic, what's inconsistent, what fails accessibility, and what's worth keeping. No app code was changed for this audit.

**The screens.** [`before/index.md`](before/index.md) shows every screen and state at desktop (1440 wide) and mobile (390 wide), full page: 74 screens, 148 images, with axe's findings for each in `before/axe-desktop.json` and `before/axe-mobile.json`. They were captured on 2026-10-09 from the production build, against the local database:

```bash
pnpm build
SCREENS_DIR=docs/design/before pnpm screens
```

`scripts/screens/screens.spec.ts` shows the demo gym from `pnpm seed:demo` (Harbor Climbing Gym, through its read-only owner, admin, staff and member) exactly as the live demo shows it. For the states the demo doesn't have, it builds screenshot-only fixtures in the local database and refreshes their dates on every run:

| Fixture                | What it shows                                                                                                                                                                                                         |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Riverside Yoga Loft    | A business taking payments (no real Stripe account): plans that are archived or not ready, members whose payment failed, who are canceling, ended, suspended or haven't picked a plan, a failed payment, open invites |
| Summit Boxing Club     | A business taking payments with nothing on sale (the join page's empty state)                                                                                                                                         |
| Northside Dance Studio | A business that hasn't connected Stripe (every empty state), and, for a moment, one that started onboarding (back from Stripe, and Stripe failing to answer on Payouts)                                               |
| Lena Fischer           | Someone with no business and no membership: empty dashboard and account, new business, settings, password, an invite link                                                                                             |

It never opens Stripe Checkout or onboarding, so it needs no webhook listener and leaves nothing in the Stripe sandbox. The page error is reached honestly: a signed-in user whose account was deleted still holds a valid token, so the dashboard fails to load their profile.

## The read in one paragraph

Clubly works, is consistent, and has no identity. It is shadcn/ui's `base-nova` starter almost untouched: every gray has zero hue, the primary color is near-black, the font is Geist (Vercel's default), and a 1px border boxes in everything, from plan cards to status messages to a single line of empty-state text. Nothing says gym, studio or club, nothing feels energetic, and the money screens look exactly like the settings screens. The public join page, which is what members see first, is the plainest of all: a white document with two bordered boxes and two small black "Join" buttons, under Clubly's own name rather than the business's.

## Worth keeping

- **The words.** Plain, specific and honest. Copy explains consequences before people act: "Suspending doesn't change their billing: Stripe keeps charging any subscription they have until it's canceled", "The price can't change after the plan is created", "We don't keep a copy, so this is the only time you'll see it". Errors say what happened ("That web address is taken. Try another one."). Keep every sentence; the redesign changes how they look, not what they say.
- **Semantic structure.** Header, `nav` and `main` landmarks; sections named by their headings (`aria-labelledby`), which tests use as regions; real lists for plans, members, payments and history; `dl`/`dt`/`dd` for figures; `role="status"` and `role="alert"` for feedback; `aria-current="page"` on the current tab; links that navigate are links, buttons that act are buttons.
- **Every action shows it's working.** Each button has its own pending label ("Opening checkout...", "Suspending..."), and fields keep what was typed after an error.
- **Forms done right.** Every field has a visible label, `autocomplete`, hints tied with `aria-describedby`, HTML constraints mirroring the server's, and 16px text in inputs on phones, so iOS doesn't zoom on focus (the two selects, new plan's interval and the invite's role, are 14px and do zoom).
- **The 404-not-403 rule and the read-only demo.** A business you're not on, or a tab your role can't open, is a plain 404; demo accounts get one clear sentence instead of a broken form.
- **Lightness.** Server components almost everywhere, one font family, no animation library, almost no client JavaScript beyond forms. The redesign must keep this.

## What reads as generic or templated

1. **The palette is the starter theme.** Grays from `oklch(1 0 0)` to `oklch(0.145 0 0)` with no hue, primary near-black, `chart-1` to `chart-5` all gray. The only color in the app is the destructive red. Money states have no color at all: "Active", "Canceling", "Payment failed" and "Ended" are the same gray pill (`member-02` to `member-05`, `owner-04-members`); only "Suspended" is red.
2. **Default type, no scale.** Geist at 14 to 16px for almost everything; the largest text anywhere is the home page's 36px name, then the join page's 30px business name. Headings are `text-2xl`, `text-lg` and `font-medium` with nothing in between, so a page title, a section and a card title differ by a step or two. Figures (`$249.17`, `$845.00`) are the same face at 24px with proportional digits, so amounts in lists don't line up (`owner-05-revenue`).
3. **A border around everything.** Plan cards, member cards, payment rows, history entries, stat tiles, invite rows, the "No plans yet." line, the "Checkout was canceled" notice and the "Stripe is confirming your payment" message are all the same 1px-bordered, 8px-rounded box. Hierarchy comes from borders, almost never from surface, tone or size.
4. **The KPI grid.** Revenue opens with four equal bordered tiles in a 2x2 grid (`dash-04-revenue`), each a gray label over a black number: the most common dashboard pattern there is, and it gives monthly recurring revenue (the number an owner cares about) the same weight as the platform's fee.
5. **The home page is a placeholder.** A centered "Clubly", one sentence and two buttons on an empty white page (`public-01-home`). It doesn't say who it's for, what it does or that there's a live demo, and it's the first thing anyone opening the portfolio link sees.
6. **The join page doesn't belong to the business.** The header says "Clubly" (`public-03-join`); the business's name is an ordinary heading; the plans are two equal boxes with a small 32px black "Join". Nothing makes it feel like a gym's membership page, or makes the act of joining feel like a decision.
7. **One narrow column everywhere.** Every signed-in page is a 768px column, even at 1440 wide: the members list is a stack of tall cards (six members fill a full screen, `owner-04-members`), the demo's history is 30 identical boxes (`dash-06-history`), and the dashboard has no sense of place beyond a row of text tabs.
8. **Unfinished edges.** Next.js's default 404 ("404 | This page could not be found."): alone on a white page with no way back for unknown addresses (`public-06-not-found`, `public-07`), and the same two words under the signed-in header for a page your role can't open (`role-06`, `error-01`); the create-next-app favicon, no app icons, no social image, sign-in pages as a small bordered card floating in white (`auth-01-login`).
9. **No icons.** The only icon is the select's chevron (lucide). Tabs, statuses, empty states and actions are text only, which keeps it calm but makes scanning slow (payments "Paid" vs "Failed" differ only in a small red word).

## Inconsistencies

- **Two edge styles.** The shadcn `Card` (auth pages, new business, new plan, invite, empty account) has a `ring-1 ring-foreground/10` and `rounded-xl`; every other box has `border` and `rounded-lg`. They sit side by side on the account page's empty state.
- **Badges are copied, not shared.** The pill (`rounded-full bg-muted px-2.5 py-1 text-xs`) is written out in six files with small differences (`font-medium` or not, `text-muted-foreground` or not); "Suspended" adds its own red version.
- **Status messages look like content.** "Checkout was canceled", "Welcome to ... Your membership is active.", "Thanks! Stripe is confirming your payment" and "Ready to take payments" are the same bordered box as a plan card; success, waiting and error have no tone of their own. Some status lines are bare text instead ("Saved.", "Stripe is checking your details").
- **Errors sit in different places.** Form errors are red text above the submit button, action errors red text under the button, the revenue warning a red paragraph inside the figures, the payouts error a bordered box.
- **Actions have one weight.** "Archive", "Restore", "Suspend", "Reactivate", "Remove", "Revoke", "Make admin", "Manage billing" and "Save" are all the same outline button; the only solid ones are a page's primary action and "Delete my account".
- **Dates in two formats.** "October 8, 2026" everywhere except the history, which says "Oct 2, 2026, 6:24 PM UTC".
- **Headers differ by area.** Signed-in pages have the full header; the join page has a header with only the name; auth pages have a centered name and no header; the 404 has nothing.
- **Mobile header wraps.** At 390 wide, "Sign out" drops onto a second line under the nav (`*-mobile` signed-in shots), and the demo banner takes two more lines.
- **Tabs scroll without a hint.** On phones the business tabs scroll sideways and the current one is scrolled into view, but the cut-off edge ("iew", "H") is the only sign there's more (`dash-04-revenue-mobile`, `dash-06-history-mobile`).

## Accessibility

### Found by axe (WCAG 2.1 A and AA)

The README says every page passes axe. That's true of the states `e2e/accessibility.spec.ts` builds, but these screens reach states it doesn't, and axe fails 11 of the 74 screens at both sizes:

| Problem                                                                                                        | Where                                                | Screens                                                                                            |
| -------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| **Contrast (1.4.3):** the gray pill (`text-muted-foreground` on `bg-muted`, 4.3:1; text this size needs 4.5:1) | "Archived", "Not ready" plans; "Payments not set up" | `dash-02-overview`, `dash-10`, `role-01`, `role-03`, `owner-02`, `owner-03`, `empty-01-businesses` |
| **Contrast (1.4.3):** red on pale red (4.0:1)                                                                  | "Suspended" member                                   | `dash-03-members`, `role-04-staff-members`, `owner-04-members`                                     |
| **Definition list structure (1.3.1):** a `<p>` inside the `<dl>`                                               | Revenue's "N failed payments" warning                | `owner-05-revenue`                                                                                 |

**This affects the live demo today:** its overview shows the archived "Summer pass" and its members page shows Sid Suspended, so both fail axe for every demo role. The test missed them because its fixture business has no archived or unready plan, no suspended member, no failed payment, and is always set up for payments. The redesign fixes all three (the badge colors and the warning's markup) and adds those states to `e2e/accessibility.spec.ts` so they stay fixed. They're live, so they could have gone out first on `main`; the decision (2026-10-09) is to fix them in the redesign.

### Not caught by axe

- **Pages without a heading.** Sign-in, sign-up, check your email, email-link sign-in, password reset, new business, new plan, invite and change password have no heading at all: the shadcn `CardTitle` is a `<div>`. Screen-reader users who jump by heading land nowhere; the page's title is only text. (axe's `page-has-heading-one` is a best-practice rule, not WCAG, so the suite doesn't fail on it.)
- **Faint focus indicator.** `* { outline-ring/50 }` and `ring-ring/50` draw focus in a light gray at half strength, 1.5:1 against white; a focused button's border turns a mid gray, 2.6:1. Focus is visible but easy to lose, especially on the outline buttons whose border is already gray. WCAG's non-text contrast asks 3:1 for indicators that show a control's state.
- **Small targets on phones.** Buttons and fields are 32px tall, "Sign out" 28px, tabs about 38px. They pass WCAG 2.2's 24px minimum, but members use the account and join pages on phones, where 44px is the comfortable size.
- **No skip link.** The header's links and the business tabs come before the content on every signed-in page.
- **Color alone almost never carries meaning** (statuses are words), which is right; the redesign must keep the words when it adds color.
- **Motion.** Nearly none: buttons move down 1px on press, and the payouts skeleton pulses (`animate-pulse`) with no reduced-motion rule. The redesign adds a global `prefers-reduced-motion` rule before adding any motion.

## Performance and Lighthouse

Lighthouse 13.5.0, the median of three runs at its mobile and desktop settings. Two baselines, because they measure different things:

- **`before/lighthouse.json`, the local production build** (this machine, local database, the signed-in pages as the demo owner and member). This is the baseline the redesign is compared against: the "after" run will use the same machine, data and command.
- **`before/lighthouse-site.json`, the live demo** (`LIGHTHOUSE_SITE=https://clubly-nine.vercel.app`), signed-out pages only. Lighthouse never signs in to the live site.

| Page                          | Mobile perf (local) | Mobile perf (live) | Desktop perf (local / live) | Accessibility | Best practices, SEO | Mobile LCP (local / live) | Mobile TBT (local / live) | CLS |
| ----------------------------- | ------------------- | ------------------ | --------------------------- | ------------- | ------------------- | ------------------------- | ------------------------- | --- |
| Home `/`                      | 95                  | 96                 | 100 / 100                   | 100           | 100                 | 2.5 s / 1.6 s             | 158 / 220 ms              | 0   |
| Join `/b/harbor-climbing-gym` | 90                  | 94                 | 99 / 100                    | 100           | 100                 | 2.7 s / 1.8 s             | 318 / 232 ms              | 0   |
| Sign-in `/login`              | 89                  | 95                 | 100 / 100                   | 100           | 100                 | 3.1 s / 1.7 s             | 206 / 229 ms              | 0   |
| Members (owner)               | 83                  |                    | 100                         | **96**        | 100                 | 3.4 s                     | 286 ms                    | 0   |
| Revenue (owner)               | 96                  |                    | 100                         | 100           | 100                 | 2.7 s                     | 90 ms                     | 0   |
| Account (member)              | 91                  |                    | 100                         | 100           | 100                 | 2.9 s                     | 206 ms                    | 0   |

- **The live demo matches the README** (94 to 96 on mobile, 100 on desktop, 100 for everything else on its public pages).
- **Local mobile scores run lower than live** (83 to 96): Lighthouse's mobile score simulates a slow phone from this machine's own speed, and the live site sits behind Vercel's CDN. That's why the comparison is local against local.
- **Members scores 96 for accessibility** because of the "Suspended" badge's contrast (above): Lighthouse runs axe too.
- **No layout shift anywhere** (CLS 0). The redesign's fonts must keep it that way (`next/font` with a fallback that matches the metrics).

## What the redesign must not break

- **Test selectors.** There are no `data-testid`s in `src/`: the end-to-end suite finds things by role, label and text. The ones that constrain the markup most: `getByRole("listitem")` (34 uses: members, plans, payments, history entries and memberships must stay one list item each), regions named by their section heading ("History", "Team", "Recent payments", "Open invites"), the business tabs as `navigation` named "Business", figures as `dt`/`dd` pairs, the business name as the level-1 heading, `role="status"` and `role="alert"` messages, and every button, link and field label by its exact text.
- **Copy the tests read.** For example "1 failed payment in the last 30 days.", "You don't have a business yet", "This invite link doesn't work", "Check your email" and `DEMO_READ_ONLY_MESSAGE`. Changing a word means changing a test; the plan is not to.
- **Headings and the route announcer.** Turning the auth pages' card titles into real headings is right, but Next.js's route announcer reads out the new page's `h1` on client navigation by copying its text, so a test that finds that text with `getByText` can match twice. Such tests should look for the heading by role instead (Hala's redesign hit exactly this).
- **The no-`loading.tsx` rule.** Designed loading states must stay inside `<Suspense>` after the access check (as on Payouts), never as route-level loading files, which turn 404s into 200s.
- **Stripe's pages stay Stripe's.** Checkout, the billing portal and Express onboarding are hosted by Stripe and can't be restyled from this code.

## Proposals that would change behavior (not part of the redesign)

Listed for a decision; none will be built in this redesign.

1. **A home page that explains Clubly**, with a link to the demo gym's join page and the demo sign-in. Today the home page has nothing but two buttons; adding links and copy is new content rather than a visual change.
2. **An overview that summarizes.** The Overview tab shows setup and plans but no numbers; members, subscribers and recurring revenue (for roles that may see revenue) would make it a real overview. It needs new reads on that page.
3. **The business's own identity on its join page:** a logo, a short description, plan descriptions. The data model has none of them.
4. **Stripe branding to match.** Checkout and the billing portal can show a business's color and icon through each connected account's branding settings: a Stripe configuration change.
5. **Confirm destructive actions.** "Suspend", "Remove", "Revoke" and "Archive" act on one click today; a confirmation step changes the flow.
6. **A "refunded" money state.** The brief asks for colors for paid, failed and refunded; payments are only ever `paid` or `failed` today, because no refund event is handled. The design system will define the refunded color so it's ready, but nothing will show it.
7. **Find a member.** Search or filter on the members list, for businesses with more than a screenful.
8. **A copy button for the join page link** on the overview.

## Not captured, and why

- **The payouts skeleton.** It shows only while Stripe answers, which locally is too quick to catch reliably; it's two pulsing gray blocks (`PayoutDetailsLoading`).
- **Choosing a new password from an email link.** It needs a session that started from a real email link; the screen is the change-password form without the current-password field.
- **Pending button labels** ("Opening checkout..."), which last as long as a request.
- **Stripe-hosted pages and auth emails.** Not ours to restyle (Stripe), and switched off in production (emails).

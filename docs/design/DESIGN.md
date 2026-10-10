# Clubly design system

**Status:** approved (step 2 of the redesign, after the [audit](audit.md)). Step 3 made it the app's tokens: [TOKENS.md](TOKENS.md) explains the files, the names used in code, and how another project uses them. Steps 4 to 6 apply it to the public pages, the sign-in pages and the dashboards, and step 7 adds the icons and the 404 page and measures the result.

**See it:** `pnpm dev`, then http://localhost:3000/design-preview (development only: a production build answers 404). Screenshots of each section at desktop and phone width are in [`preview/`](preview/).

## The read

> Reading this as: a redesign (new look; content, flows and behavior kept) of a membership product for gyms, climbing gyms, yoga and dance studios and sports clubs, used by owners and front-desk staff at a desk and by members on their phones, with an energetic, confident and organized language (a well-run gym floor), leaning toward the existing Tailwind v4 and shadcn/ui (Base UI) components re-themed through CSS-variable tokens, not a new component library.

**In one line:** a well-run gym floor: cool chalk neutrals, ink signage, one volt accent for what you can do, and numbers that line up.

**Dials** (from the taste skill, which is written for landing pages; the dashboard takes calmer numbers and more density, because front-desk staff scan lists):

| Surface                    | Variance | Motion | Density |
| -------------------------- | -------- | ------ | ------- |
| Join page and home page    | 6        | 3      | 3       |
| Sign-in and sign-up        | 4        | 2      | 3       |
| Dashboards and the account | 3        | 2      | 6       |

**What it must not be:** Hala (warm stone, one teal, Readex Pro, soft round corners), the starter theme it replaces, AI purple, mesh gradients, a row of three identical cards, or product UI faked with boxes.

### Clubly beside Hala

|           | Hala                                              | Clubly                                                                |
| --------- | ------------------------------------------------- | --------------------------------------------------------------------- |
| Neutrals  | Warm stone (hue 65 to 75)                         | Cool chalk and graphite (hue 255 to 262)                              |
| Accent    | Deep teal that carries white text                 | Volt (a bright lime) as a fill under ink text, never as text on light |
| Signature | Soft shadows, calm surfaces                       | An ink band: the header and hero read like a gym's signage            |
| Type      | Readex Pro, humanist, up to 600                   | Archivo, a sturdy grotesque, up to 800; money set like a scoreboard   |
| Corners   | 10 / 16 / 20px, pills for choices                 | 4 / 6 / 10px, no pills; tabs carry a bar                              |
| Icons     | Phosphor                                          | Tabler                                                                |
| Dark mode | Dashboard follows the device, widget always light | Everything follows the device                                         |

## Color

One family of **cool neutrals** (hue 255 to 262, chroma at most 0.022), **ink** for text and for the band, one **volt** accent, and four status colors that only ever mean status.

**Why volt.** It's the color of sports gear, lane markings and the highlighter on a training plan: energetic and unmistakably about moving, without being red (which Clubly needs for failed payments) or the blue and purple of most software. It is also loud, so it gets a narrow job: **primary actions, the current tab, the mark, and highlights**. Volt under ink text reads at 13.6:1, but volt on a light background is only 1.2:1, so it is **never text and never the only sign of anything on light surfaces**. In light mode, ink carries text and focus; on the band and in dark mode, volt also marks focus.

| Token                      | Light (OKLCH)                   | Light hex             | Dark (OKLCH)                  | Dark hex  | Used for                                                  |
| -------------------------- | ------------------------------- | --------------------- | ----------------------------- | --------- | --------------------------------------------------------- |
| `bg`                       | 0.972 0.005 255                 | `#f3f6f9`             | 0.165 0.012 262               | `#0b0e14` | The page ("chalk")                                        |
| `surface`                  | 0.995 0.002 255                 | `#fcfdff`             | 0.205 0.014 262               | `#14171e` | Lists, panels, forms                                      |
| `surface-2`                | 0.948 0.006 255                 | `#ebeef2`             | 0.245 0.015 262               | `#1d2128` | Fills, hovers, neutral badges                             |
| `surface-3`                | 0.915 0.008 255                 | `#dfe3e8`             | 0.29 0.016 262                | `#272b34` | Pressed fills, initials                                   |
| `line`                     | 0.905 0.008 255                 | `#dce0e5`             | 0.31 0.015 262                | `#2c3038` | Dividers inside a surface                                 |
| `line-input`               | 0.60 0.014 258                  | `#7b8189`             | 0.56 0.016 258                | `#6f757e` | Field and outline-button edges (3:1)                      |
| `ink`                      | 0.21 0.020 262                  | `#131822`             | 0.96 0.005 255                | `#eff2f5` | Text, focus on chalk                                      |
| `ink-2`                    | 0.40 0.018 262                  | `#424852`             | 0.80 0.010 255                | `#b9bec4` | Secondary text                                            |
| `ink-3`                    | 0.50 0.016 262                  | `#5e636d`             | 0.69 0.012 255                | `#969ca3` | Muted text, captions                                      |
| `band`                     | 0.215 0.022 262                 | `#141a24`             | 0.13 0.012 262                | `#05070c` | The header and hero band                                  |
| `band-2`                   | 0.28 0.022 262                  | `#232934`             | 0.20 0.014 262                | `#13161d` | Fills on the band                                         |
| `on-band` / `on-band-2`    | 0.97 0.004 255 / 0.78 0.012 255 | `#f3f5f8` / `#b2b8bf` | same                          | same      | Text on the band, primary and secondary                   |
| `volt`                     | 0.90 0.185 123                  | `#c7f155`             | same                          | same      | Primary actions, the current tab, the mark                |
| `volt-strong`              | 0.85 0.190 123                  | `#b7e139`             | 0.94 0.160 123                | `#d7fd7d` | Hover on volt                                             |
| `volt-soft`                | 0.955 0.070 120                 | `#eaf8c3`             | 0.32 0.070 123                | `#2c3809` | Highlights: net revenue, the demo note, empty-state icons |
| `on-volt`                  | 0.21 0.020 262                  | `#131822`             | same                          | same      | Text on volt                                              |
| `success` / `success-soft` | 0.47 0.11 152 / 0.95 0.045 152  | `#1b6c3a`             | 0.76 0.14 152 / 0.30 0.06 152 | `#63ca84` | Active, paid                                              |
| `warning` / `warning-soft` | 0.48 0.10 65 / 0.955 0.045 85   | `#845011`             | 0.84 0.12 82 / 0.31 0.055 75  | `#f2c36a` | Canceling, pending, a step to finish                      |
| `danger` / `danger-soft`   | 0.52 0.18 25 / 0.955 0.02 22    | `#ba2b2e`             | 0.72 0.16 25 / 0.31 0.07 25   | `#f97770` | Failed, suspended, destructive                            |
| `on-danger`                | 0.99 0.004 25                   | `#fefbfa`             | 0.17 0.020 25                 | `#170c0b` | Text on a solid danger button                             |
| `info` / `info-soft`       | 0.48 0.12 250 / 0.945 0.022 250 | `#1a609e`             | 0.77 0.10 250 / 0.30 0.06 250 | `#82b9f2` | Trial, refunded, waiting on Stripe                        |

**Contrast, computed** (OKLCH converted to sRGB, every value checked in gamut; WCAG ratios; AA asks 4.5:1 for text and 3:1 for edges and focus):

| Pair                                                | Light  | Dark   |
| --------------------------------------------------- | ------ | ------ |
| `ink` on `bg`                                       | 16.3:1 | 17.1:1 |
| `ink-2` on `surface`                                | 9.0:1  | 9.6:1  |
| `ink-3` on `surface-2` (the weakest text pair)      | 5.1:1  | 5.8:1  |
| `on-volt` on `volt` (primary buttons)               | 13.6:1 | 13.6:1 |
| `on-volt` on `volt-strong` (hovered)                | 11.6:1 | 15.3:1 |
| `on-band-2` on `band`                               | 8.7:1  | 10.0:1 |
| `volt` on `band` (current tab, focus on the band)   | 13.4:1 | 15.4:1 |
| Focus: `ink` on `bg` (light), `volt` on `bg` (dark) | 16.3:1 | 14.8:1 |
| `line-input` on `surface`                           | 3.8:1  | 3.8:1  |
| `success` on `success-soft`                         | 5.6:1  | 6.5:1  |
| `warning` on `warning-soft`                         | 5.8:1  | 8.0:1  |
| `danger` on `danger-soft`                           | 5.2:1  | 5.1:1  |
| `info` on `info-soft`                               | 5.5:1  | 6.6:1  |
| `on-danger` on `danger`                             | 5.8:1  | 7.2:1  |

The badge pairs replace the ones axe failed in the audit (4.3:1 and 4.0:1).

### Money and membership states

Every state is a **badge: its tone, an icon and its word**. The word is always there, so nothing depends on color alone.

| Tone    | Icon (Tabler)                          | States                                                                       |
| ------- | -------------------------------------- | ---------------------------------------------------------------------------- |
| Success | circle-check                           | Active, Paid, Ready to take payments                                         |
| Warning | clock-pause, hourglass, alert-triangle | Canceling, Payment pending, Payments not set up, Stripe setup isn't finished |
| Info    | hourglass, receipt-refund              | Trial, Refunded, Stripe is confirming your payment                           |
| Danger  | alert-triangle, ban                    | Payment failed, Failed, Unpaid, Suspended                                    |
| Neutral | circle-x, archive                      | Ended, Archived, Not ready, Paused, Payment not completed, and the roles     |

**Refunded** has its color and icon, but nothing in the app shows it yet: payments are only ever paid or failed (audit, proposal 6).

**Dark mode.** Every page follows the device's setting (`prefers-color-scheme`): the join page, sign-in, the dashboards and the account. The dark tokens shadcn installed but nothing switched on are replaced by these.

**Charts.** There is no chart today (a revenue history would need new reads: a proposal). If one comes: bars in `ink-2` with the current period in `volt` and an `ink` edge, axis labels 12px `ink-3` with tabular figures, every value labeled or in a table beside it, no gradients and no second color.

## Type

**Archivo** (by Omnibus-Type, open licence, on Google Fonts), one family for everything. A sturdy, slightly squared grotesque made for headlines and data: it holds up at 800 for a business's name on its sign, stays plain at 15px in a list, and its figures are tabular by default, so amounts line up in columns without extra settings (checked in Chromium: "111.11" and "888.88" are the same width). Loaded with `next/font` as one variable file (weights 100 to 900): 35 KB for Latin against Geist's 29 KB today.

Considered, side by side on the preview page:

- **Archivo with Archivo Narrow** for display and figures: the scoreboard look, but a second file (+19 KB). Archivo's own width axis would keep it to one file, but Google serves that as 90 KB. Hala's redesign measured a second display face at 0.3 s later paint and 4 Lighthouse points, so not without measuring, and not for this.
- **Instrument Sans:** crisp, 57 KB with its width axis, reads more editorial studio than gym floor.
- **Geist** (today): Vercel's and shadcn's default; neutral to the point of anonymous.

| Step      | Size / line height     | Weight, tracking | Used for                                                              |
| --------- | ---------------------- | ---------------- | --------------------------------------------------------------------- |
| Display   | 60 / 60 (40 on phones) | 800, -0.02em     | A business's name on its join page, the home page                     |
| Title     | 30 / 34                | 750, -0.015em    | Page titles, the business in the dashboard band                       |
| Heading   | 18 / 24                | 650              | Sections, plan names, empty-state titles                              |
| Lead      | 17 / 26                | 400              | "Choose a membership.", intros                                        |
| Body      | 15 / 23                | 400              | Everything else                                                       |
| Small     | 13 / 19                | 400              | Secondary lines, emails, dates                                        |
| Label     | 13 / 17                | 600              | Field labels, figure labels                                           |
| Caption   | 12 / 16                | 400              | Hints, fine print                                                     |
| Figure XL | 60 / 60 (44 on phones) | 800, -0.025em    | The one number a page is about (recurring revenue, available balance) |
| Figure    | 28 / 31                | 750, -0.02em     | Other money: plan prices, paid, fees, net                             |

- **Sentence case everywhere**, no uppercase labels above headings.
- **Weights:** 400, 600 and 650 for interface text, 750 and 800 for titles and figures only.
- **Line length:** reading text stays under 68 characters; display headings use `text-wrap: balance`.
- **Dates keep the app's two formats:** a day in prose and lists ("October 2, 2026") and a moment in the history ("Oct 2, 2026, 6:24 PM UTC"). Changing them would change shared helpers and their tests for little gain.
- **No em or en dashes** in the interface; ranges use a hyphen, and the revenue row uses a real minus sign (drawn by CSS, hidden from screen readers).

## Space

Steps of 4px: 4, 8, 12, 16, 20, 24, 32, 40, 48, 64. Inside a component 8 to 12; between groups 24; between page sections 40 to 48. Page gutters are 16px on phones, 24px on tablets and 32px on desktops. Containers: dashboards up to 1120px wide (today 768px, which wastes half of a desktop screen), forms up to 560px, the join page 960px, reading text 68 characters.

## Shape

One rule, applied everywhere, tighter than Hala on purpose:

- **Badges:** 4px. They're labels, not buttons.
- **Controls** (buttons, fields, selects), **the mark** and **initials:** 6px.
- **Surfaces** (lists, panels, notices, forms): 10px.
- **The band** is full-bleed with square edges. No pills anywhere.

## Depth

Hierarchy comes from the band, from tone (white surfaces on chalk) and from size, not from boxes.

| Level | Light                                                | Dark                        | Used for                          |
| ----- | ---------------------------------------------------- | --------------------------- | --------------------------------- |
| 0     | none                                                 | none                        | Things on the page itself         |
| 1     | a 1px ring of `ink` at 6% and a 1px-2px shadow at 6% | a 1px ring of white at 6%   | Lists, panels, forms              |
| 2     | `0 14px 32px -14px` ink at 28%, plus the ring        | black at 60%, plus the ring | Anything that floats (none today) |

Rows inside a surface are separated by `line` dividers: one surface per list, never a box per row. Borders stay where they mean something: field edges and outline buttons (3:1).

## Motion

Quick and mechanical, CSS only (no animation library).

- **Durations:** 120ms (hover, press), 180ms (state changes). **Easing:** `cubic-bezier(0.2, 0, 0, 1)`. Only `transform`, `opacity` and colors change.
- **What moves:** a button settles 1px when pressed; the payouts placeholder shimmers while Stripe answers. Nothing else loops, and nothing animates on scroll.
- **Reduced motion:** a global rule stops every animation and transition (`prefers-reduced-motion: reduce`), so a later addition can't forget it; the shimmer only runs when motion is welcome.

## Icons

**Tabler** (`@tabler/icons-react`, 3.48), stroke 1.75: 14px in badges, 16px beside text and in buttons and tabs, 18px in notices, 20px in empty states. They render on the server (no client JavaScript), always beside a word and hidden from screen readers (`aria-hidden`); an icon never replaces a label. Tabler replaces lucide, whose only use is the select's chevron, so there's one family.

## Focus and touch

- **Focus:** a 2px outline with a 2px gap on every interactive element: `ink` on chalk and surfaces, `volt` on the band and in dark mode (11:1 or more everywhere). It replaces today's half-strength gray ring (1.5:1).
- **Touch:** controls and fields are 40px tall; a page's main action (Join, Sign in, the forms' submit buttons) is 44px, and so are the tabs.
- **Skip link:** "Skip to content" first on every signed-in page.

## Components

**Buttons.** Primary (`volt` under `on-volt`, with a darker 2px bottom edge; one per view), secondary (`surface` with a `line-input` edge), ghost (`ink-2` text, fills on hover), quiet danger (danger text on `surface`, `danger-soft` on hover: Suspend, Remove, Revoke), danger (solid, only for what can't be undone: Delete my account). On the band, secondary becomes a `band-2` fill. Labels stay exactly as they are (the tests use them).

**Fields.** Label above (Label step), helper below (Caption), error below with an icon and a danger edge. 40px tall like the buttons beside them, `surface` fill with a `line-input` edge, 16px text on phones for every field including the selects (they zoom on iOS today). A placeholder never stands in for a label.

**Notices** (`role="status"` or `role="alert"`). One component for every message a page shows about itself: its tone's soft fill, its icon, the sentence, `ink` text. "Checkout was canceled" (info), "Welcome to ... Your membership is active." (success), "Stripe is confirming your payment" (info), "Stripe setup isn't finished yet" (warning), "We couldn't reach Stripe" (danger). Errors that belong to a field or a button stay beside it, as danger text with an icon.

**Lists.** One level-1 surface per list, a divider between rows, no box per row, one `li` per item (the tests count them). Rows are 56 to 64px. Text starts at the start; money ends at the end. The members list becomes columns from 768px (initials, name and email, plan, status, action) and stacks on phones.

**Figures.** A page about money leads with its one number at Figure XL; the rest follow as a row, not a grid of equal tiles. Revenue reads as an equation: paid in the last 30 days, minus Clubly's fee, equals what reaches the Stripe balance, which sits on `volt-soft`. Payouts: available to pay out at Figure XL, beside what's on the way. The figures stay `dt`/`dd` pairs in lists that hold nothing else, and the failed-payments warning moves out of the list into a danger notice (the audit's third axe failure).

**Tabs** (the business's sections). On the band: icon and word, `on-band-2`, the current one `on-band` with a 3px volt bar and `aria-current="page"`, 44px tall. On phones the row scrolls, fading at its end so it's clear there's more.

**Empty states.** An icon on a `volt-soft` square, a short title, the sentence the app already has about what to do, and the action it already offers (if any).

**Loading.** A placeholder in the shape of what's coming (the two balance figures on Payouts), shimmering only when motion is welcome. Still inside its `<Suspense>`, after the access check: never a route-level loading file (they turn 404s into 200s).

## The pages

**The frame (step 6).** The band holds the mark and wordmark, the main navigation (Businesses, Memberships, Settings; on phones a second row instead of wrapping "Sign out" under it) and Sign out as a ghost button. On business pages the band continues with the business's name (Title), the user's role, and the tabs. The demo note is a `volt-soft` strip with an icon just under the band. Content sits on chalk, up to 1120px wide.

**The join page (step 4).** The business leads: its name in Display on the band, "Choose a membership." under it, and Clubly only as the small mark (still the link home). Plans read like the price board at the front desk: one surface, a row per plan with its name, its price as a Figure with "per month" or "per year", and a 44px volt "Join". Messages (checkout canceled, a refused join) are notices; no plans on sale is an empty state. After Checkout, the account page's waiting message is an info notice, the welcome a success notice, and "Stripe hasn't confirmed" a warning.

**As built (step 4).** The join page is as described, with one detail the screens caught: a refused join (a suspended member, someone already paying) puts its message on a line of its own under the plan, so the prices stay in line. The account page shows each membership on a surface: the business, the plan and its price, then the status badge with what happens next ("Active, Renews on ..."), the suspension message when there is one, and Manage billing or See plans. Its "not a member anywhere yet" is an empty state, and the messages after Checkout are notices. The shared pieces made here (`Notice`, `Badge`, `SubscriptionBadge`, `EmptyState`, `AppMark`, and the restyled `Button` and `ActionButton`) are the ones the next steps build with.

**The home page (step 4).** The same band: "Clubly" in Display, its one sentence, Get started (primary) and Sign in (secondary on the band), or Continue when signed in. Only the content it has today: a fuller home page is audit proposal 1.

**Sign-in, sign-up, password, invite (step 5).** A band panel with the mark and the app's description beside the form on chalk (a short band above it on phones). Each page gets a real heading: today their card titles are `div`s, so these pages have no heading at all.

**As built (step 5).** The sign-in, sign-up, email-link, password-reset and check-your-email pages share the band layout: on wide screens the band takes the left 5 twelfths with the mark at the top and the app's sentence as a sign at the bottom; on phones it's a strip with the mark. Every one of them, the change-password page and the invite page now has a real `h1` (the card's title, `CardTitle as="h1"`), which the audit found missing. Form errors are one component (`FormError`: danger text with an icon, an alert), confirmations are success notices, and the text links under the forms share one style (`textLinkClass`): the text color, underlined, never volt. Cards are surfaces (white on chalk, a hairline ring, 24px inside).

**Dashboards (step 6).** Overview: payments status as a notice with the join page's link, plans in the same board style as the join page (with Archived and Not ready badges, Archive and Restore, Rename), then the business's details. Members, Revenue and Payouts as above. History: one surface, each entry's sentence with who did it as a quiet tag (a person, Stripe, Clubly) and when. Team: people with role badges, and the invite form beside the list on wide screens. Settings: sections on surfaces, with deleting the account in a danger-toned section. The account page: each membership on a surface with the business, the plan and its price, a status badge, and Manage billing or See plans. The page error keeps the header and becomes a danger notice with Try again.

**As built (step 6).** The band holds the mark, the main navigation (the current page on a `band-2` fill with `aria-current="page"`) and Sign out as the band's secondary button. Two changes from the plan: the demo note sits above the band, not under it, because on a business's pages the band runs on into the business's name and tabs and a strip there would cut it in two; and the navigation and tabs use Body (15px, 600), since the 14px they had isn't a step of the scale. The layout now draws only the frame: each page sets its own width with `PageBody` (1120px for a business's pages, 768px for the others, gutters 16, 24 and 32px), starts each section with `SectionHeader` (its heading, what it's for, its one action), and confirms a saved form with `FormDone` (a success line with an icon). Quiet danger buttons are the `destructive-outline` variant. Every piece of text is now a step of the scale: the page defaults to Body (15/23) instead of the browser's 16px, buttons set their labels in Body at 600 (Label on small ones) instead of 14px at 650, initials use Label, and the mark's letter matches the wordmark. Fewer sizes also means less work on first paint, since the browser sets up each size and weight of the font once per page: on a slow phone it brought the revenue page's Lighthouse score back level with step 5.

- **Overview:** two columns from 1024px. Plans take the left (the join page's board, with the price as "$20 per month", Archived and Not ready badges, Archive or Restore, and Rename folded under a `<details>`), and the right holds payments (a success notice with the join page's link, a warning notice while Stripe setup isn't finished, or a surface offering to connect payouts) and the business's details.
- **Members:** the count line ("5 members, 4 subscribed") at the end of the heading; rows of initials, name, email and join date, the plan, the status badge with what happens next and a Suspended badge, then Suspend (quiet danger) or Reactivate.
- **Revenue and Payouts:** as planned. A business without a connected account gets an empty state on Payouts with "Set up payouts".
- **History:** who did it is set in semibold before the time ("Olive Owner · Oct 2, 2026, 6:24 PM UTC") rather than as a tag: it reads as part of the sentence, and the tests find entries by that text.
- **Team:** two columns from 1024px, the team on the left and inviting on the right; the new link appears in a `success-soft` box with Copy (its icon turns to a check once copied).
- **Your businesses** (`/dashboard`): one surface with each business, the user's role and a "Payments not set up" warning badge, and New business at the end of the heading; with none yet, an empty state with Create a business.
- **New business and New plan:** cards whose titles are now real `h1`s (both pages had no heading). Staff, and businesses without payouts, see an info or warning notice instead of the plan form.
- **Settings:** three sections; deleting the account sits on `danger-soft`, the one thing on the page that can't be undone.
- **The page error:** the page's whole content, so a surface rather than a notice: a danger icon, its `h1`, the sentence, the reference, and Try again, still announced as an alert.

## Marks (step 7)

The mark is a volt 6px-rounded square with "C" in Archivo 800 `on-volt`; beside it, the wordmark "Clubly" in Archivo 800. The favicon and app icons are the mark, drawn from Archivo so small sizes stay clean. Unknown pages get a designed 404 with a way back.

## Performance

The redesign's budget: one font file (+5.5 KB against Geist), server-rendered icons (no client JavaScript), CSS-only motion, no images. Lighthouse runs against the same local build and data as the audit's baseline after each step that changes pages, and any drop is measured and either fixed or reported before moving on.

## What tests may need, and why

Nothing about behavior changes, and the selectors the end-to-end suite uses (roles, labels, button and link text) stay. Two kinds of test edits are expected, each explained in its commit: where a card title becomes a real heading, a test that finds its text with `getByText` can match twice (Next.js's route announcer copies the new page's `h1`), so it should find the heading by role instead; and the accessibility test gains the states it missed (archived and unready plans, a suspended member, a failed payment, a business without payments).

# Changelog

The notable changes to Clubly, newest first. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). The project isn't versioned, so entries are dated by the day they reach `main`. Earlier work is in the [roadmap](README.md#roadmap) and the commit history.

## [Unreleased]

The interface redesign (roadmap phase 8). Flows, behavior and the existing wording are unchanged. The design is in [docs/design/DESIGN.md](docs/design/DESIGN.md), and the before and after measurements are in [docs/design/results.md](docs/design/results.md).

### Added

- Dark mode: every page follows the device's light or dark setting.
- Icons (Tabler) beside statuses, tabs, buttons, notices and empty states. They render on the server and always sit next to a word.
- Status badges for every membership and payment state, each with its own tone, an icon and its word.
- Notices for the messages a page shows about itself (success, information, warning, danger), and empty states with an icon, a short title and the next step.
- A "Skip to content" link at the start of every signed-in page.
- App icons drawn from the mark: one for the browser tab and one for the home screen on iPhones and iPads. They replace the Next.js starter favicon.
- Two 404 pages with a way back: a public one for addresses that don't exist, and one inside the signed-in pages that keeps the header. Both say the same thing whatever the reason, so a business you can't see reads exactly like one that doesn't exist.
- Tests: the accessibility test now also covers staff, archived and unfinished plans, a suspended member, paid and failed payments, a business that hasn't set up payments, and both 404 pages, and checks that nothing moves under reduced motion. A new end-to-end test covers the 404 pages.
- Design documents in `docs/design/`: the audit with before screenshots, the design system, the tokens, and the results with after screenshots in light and dark. `pnpm screens` captures every screen at desktop and phone width with axe (and Lighthouse with `LIGHTHOUSE=1`); `pnpm tokens` exports the tokens; `/design-preview` shows the system in development only.

### Changed

- A new identity: cool chalk neutrals, an ink band behind headers and heroes, and one volt (bright lime) accent for the main action, the current tab and the mark.
- Archivo replaces Geist and Geist Mono: one font file instead of two, with tabular figures so amounts line up in columns.
- The join page belongs to the business: its name is the sign on the band, Clubly is only the small mark, and the plans read like a price board with a 44px Join button.
- The member's account shows each membership on its own panel: the business, the plan and its price, a status badge and what happens next.
- The home page is the band: the mark, the name, its sentence and the way in.
- Sign-in, sign-up, the email-link page, password reset and "Check your email" share one layout: the band beside the form on wide screens, a strip above it on phones.
- Business pages are up to 1120px wide instead of 768px. The band carries the navigation, the business's name, your role and the section tabs with icons. On phones the navigation gets a row of its own instead of wrapping Sign out under it, and the tabs fade at the edge to show there are more.
- Revenue leads with monthly recurring revenue at the largest size, then reads as an equation: paid in the last 30 days, minus the platform fee, equals what reaches your Stripe balance. Payouts leads with the balance available to pay out.
- The members list becomes columns from 768px wide instead of a stack of tall cards; history is one list instead of a box per entry; the team page puts the invite form beside the team on wide screens.
- Buttons and fields are 40px tall and a page's main action 44px (they were 32px). Quiet danger buttons (Suspend, Remove, Revoke) look different from ordinary ones.
- When a signed-in page fails to load, the message is a panel with a danger icon, a heading, its reference and Try again.

### Fixed

- The "Archived", "Not ready" and "Payments not set up" badges failed WCAG AA contrast (4.3:1, where text this size needs 4.5:1). Archived and Not ready are now neutral badges whose colors the token tests hold to AA in light and dark, and Payments not set up is a warning badge (5.8:1 in light mode, 8.0:1 in dark). The live demo's overview showed the archived "Summer pass", so this failed for every demo account.
- The "Suspended" badge failed WCAG AA contrast (4.0:1). It is now 5.2:1 in light mode and 5.1:1 in dark. The live demo's members page showed a suspended member.
- Revenue's failed-payments warning sat inside the figures' definition list (a `<p>` in a `<dl>`), which breaks the list's structure for assistive technology (WCAG 1.3.1). It is now a notice of its own after the figures.
- Sign-in, sign-up, "Check your email", email-link sign-in, password reset, change password, the invite page, new business and new plan had no heading at all. Each now has a real `h1`.
- Keyboard focus was a faint half-strength ring (1.5:1 against white). It is now a 2px outline with at least 11:1 contrast in light and dark, and it appears at once instead of fading in.
- The new plan's interval and the invite's role selects used 14px text, so iOS zoomed in when they were tapped. They now use 16px on phones, like the other fields.
- When the device asked for reduced motion, buttons still moved when pressed and the payouts placeholder still pulsed. Now nothing moves: buttons press only when motion is welcome, and a global rule stops every animation and transition, delays included.

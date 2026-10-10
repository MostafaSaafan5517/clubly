# Using the design tokens

The design system ([DESIGN.md](DESIGN.md)) lives in code as one set of tokens. They're named `--ds-*` ("design system") rather than after the product, so renaming the product (one line in `src/config/app.ts`) never touches them.

## The files

| File                                                           | What it is                                                                                                                                                          |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`src/styles/tokens.css`](../../src/styles/tokens.css)         | **The source.** Plain CSS custom properties: colors and shadows for light and dark, radii, motion and the type scale. No framework needed.                          |
| [`tokens.json`](tokens.json)                                   | The same tokens as JSON, with a hex fallback for every color, for tools and projects that don't read CSS. Written by `pnpm tokens`; never edit it by hand.          |
| [`src/app/globals.css`](../../src/app/globals.css)             | How the app wires the tokens into Tailwind CSS v4 and shadcn/ui: the color names, the type-scale utilities, the dark-mode rule, the band, focus and reduced motion. |
| [`src/styles/tokens.test.ts`](../../src/styles/tokens.test.ts) | Fails if the two dark copies differ, if `tokens.json` is out of date, if a color falls outside sRGB, or if a change breaks WCAG AA for a pair the interface uses.   |
| [`src/lib/cn-tables.ts`](../../src/lib/cn-tables.ts)           | The tables `cn` (`@/lib/utils`) merges class names with, built from the theme so it knows `text-body`, `rounded-control` and the rest. Written by `pnpm tokens`.    |

After changing a token or a theme name, run `pnpm tokens`, then `pnpm test`.

## Light, dark, and forcing one

Colors are light by default and dark when the device asks for it (`prefers-color-scheme`); every page follows it. Two classes force a mode for everything inside them (the design preview uses both to show the modes side by side):

- `.ds-light` and `.ds-dark`. A forced class sets the text color too, so nothing inside inherits the other mode's color. Tailwind's `dark:` variant follows the same rule.

**The band** is the ink signage behind the signed-in header and the public pages' hero. The `band` utility sets its background and text color and turns focus volt for everything on it (ink would vanish on ink). It's dark in both modes.

## Names in code

The components keep shadcn/ui's color names, so its components work unchanged; each points at a token. The design system's own names are there too, for code that isn't shadcn's.

| Token (DESIGN.md)      | CSS variable                        | Tailwind names                                                 | Used for                                                      |
| ---------------------- | ----------------------------------- | -------------------------------------------------------------- | ------------------------------------------------------------- |
| `bg`                   | `--ds-bg`                           | `background`                                                   | The page                                                      |
| `surface`              | `--ds-surface`                      | `card`, `popover`, `surface`                                   | Lists, panels, forms                                          |
| `surface-2`            | `--ds-surface-2`                    | `muted`, `secondary`, `surface-2`                              | Fills, hovers, neutral badges                                 |
| `surface-3`            | `--ds-surface-3`                    | `secondary-strong`, `surface-3`                                | Pressed fills, initials                                       |
| `line`                 | `--ds-line`                         | `border`                                                       | Dividers                                                      |
| `line-input`           | `--ds-line-input`                   | `input`                                                        | Field and outline-button edges                                |
| `ink`                  | `--ds-ink`                          | `foreground`, `card-foreground`, `secondary-foreground`, `ink` | Text                                                          |
| `ink-2`                | `--ds-ink-2`                        | `ink-2`, `chart-1`                                             | Secondary text                                                |
| `ink-3`                | `--ds-ink-3`                        | `muted-foreground`, `ink-3`                                    | Muted text, captions                                          |
| `band`, `band-2`       | `--ds-band`, `--ds-band-2`          | `band`, `band-2` (and the `band` utility)                      | Header and hero signage, fills on it                          |
| `on-band`, `on-band-2` | `--ds-on-band`, `--ds-on-band-2`    | `on-band`, `on-band-2`                                         | Text on the band                                              |
| `volt`                 | `--ds-volt`                         | `primary`, `volt`                                              | Primary actions, the current tab, the mark                    |
| `volt-strong`          | `--ds-volt-strong`                  | `primary-strong`, `volt-strong`                                | Hover on volt                                                 |
| `volt-soft`            | `--ds-volt-soft`                    | `accent`, `volt-soft`                                          | Highlights, the demo note                                     |
| `on-volt`              | `--ds-on-volt`                      | `primary-foreground`, `accent-foreground` (ink), `on-volt`     | Text on volt                                                  |
| `success`, `-soft`     | `--ds-success`, `--ds-success-soft` | `success`, `success-soft`                                      | Active, paid                                                  |
| `warning`, `-soft`     | `--ds-warning`, `--ds-warning-soft` | `warning`, `warning-soft`                                      | Canceling, pending, a step to finish                          |
| `danger`, `-soft`      | `--ds-danger`, `--ds-danger-soft`   | `destructive`, `destructive-soft`, `danger`, `danger-soft`     | Failed, suspended, destructive                                |
| `on-danger`            | `--ds-on-danger`                    | `destructive-foreground`                                       | Text on a solid danger button                                 |
| `info`, `-soft`        | `--ds-info`, `--ds-info-soft`       | `info`, `info-soft`                                            | Trial, refunded, waiting on Stripe                            |
| `focus`                | `--ds-focus`                        | `ring`                                                         | The focus outline (ink, or volt on the band and in dark mode) |

**Volt is a fill.** `bg-primary` (or `bg-volt`) always pairs with `text-primary-foreground`; never use volt as a text color on a light surface (1.2:1).

**Type:** `text-display`, `text-title`, `text-heading`, `text-lead`, `text-body`, `text-small`, `text-label`, `text-caption`, and for money `text-figure-xl` and `text-figure`. Each sets size, line height and, where the step has them, weight and tracking (DESIGN.md, Type). Archivo is the only font (`font-sans`); `font-mono` is the system's monospace.

**Shape and depth:** `rounded-badge` (4px), `rounded-control` (6px, also shadcn's `--radius`), `rounded-surface` (10px); `shadow-level-1`, `shadow-level-2`.

**Motion:** transitions default to 120ms with the system's easing (`ease-ds`). Anything that animates goes behind `motion-safe:`; a reduced-motion rule in `globals.css` stops whatever doesn't.

**Focus:** a 2px outline in `--ds-focus` with a 2px gap, set globally on `:focus-visible`. Components don't draw their own focus ring.

## In another project

Copy `src/styles/tokens.css` (it needs nothing else) and load Archivo (Google Fonts, the variable font). With Tailwind v4, copy the `@theme` blocks and the `dark` variant from `src/app/globals.css`; without it, use the `--ds-*` variables directly. Tools that don't read CSS can take `tokens.json`.

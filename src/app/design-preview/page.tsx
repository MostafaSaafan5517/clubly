import {
  IconAlertTriangle,
  IconArchive,
  IconBan,
  IconBuildingBank,
  IconChartBar,
  IconChevronDown,
  IconCircleCheck,
  IconCircleX,
  IconClockPause,
  IconHistory,
  IconHourglass,
  IconInfoCircle,
  IconLayoutDashboard,
  IconLogout,
  IconPlus,
  IconReceiptRefund,
  IconTicket,
  IconUserPlus,
  IconUsers,
  IconUsersGroup,
} from "@tabler/icons-react";
import type { Metadata } from "next";
import { Archivo, Archivo_Narrow, Instrument_Sans } from "next/font/google";
import { notFound } from "next/navigation";
import type { ComponentType, ReactNode } from "react";
import "./preview.css";

// Clubly's design system (docs/design/DESIGN.md), shown with its tokens and key components in
// light and dark. Development only: a production build answers 404. The tokens are scoped to
// this page (preview.css), so the app is unchanged until step 3 adopts them. Figures and names
// come from the demo gym (`pnpm seed:demo`) and the screenshot fixtures.

export const metadata: Metadata = {
  // In production the page is a 404, which shouldn't carry this page's title.
  title: process.env.NODE_ENV === "production" ? undefined : "Design preview",
  robots: { index: false },
};

const archivo = Archivo({ subsets: ["latin"], variable: "--font-archivo" });
// Only for the "fonts considered" comparison.
const archivoNarrow = Archivo_Narrow({ subsets: ["latin"] });
const instrumentSans = Instrument_Sans({ subsets: ["latin"] });

type Icon = ComponentType<{
  size?: number;
  stroke?: number;
  "aria-hidden"?: boolean;
  className?: string;
}>;

function Glyph({ icon: Shape, size = 16 }: { icon: Icon; size?: number }) {
  return <Shape size={size} stroke={1.75} aria-hidden />;
}

const modes = [
  { key: "light", className: "cp", label: "Light" },
  { key: "dark", className: "cp cp-dark", label: "Dark" },
] as const;

/** The same content in light and dark, side by side from 1024px. */
function Both({ children }: { children: ReactNode }) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {modes.map((mode) => (
        <div
          key={mode.key}
          className={`${mode.className} min-w-0 rounded-[10px] p-4 sm:p-6`}
        >
          <p className="t-caption mb-3 text-(--c-ink-3)">{mode.label}</p>
          {children}
        </div>
      ))}
    </div>
  );
}

/** The same wide composition in light, then dark. */
function Stacked({ children }: { children: ReactNode }) {
  return (
    <div className="grid gap-4">
      {modes.map((mode) => (
        <div
          key={mode.key}
          className={`${mode.className} min-w-0 overflow-hidden rounded-[10px]`}
        >
          <p className="t-caption px-4 py-2 text-(--c-ink-3) sm:px-6">
            {mode.label}
          </p>
          {children}
        </div>
      ))}
    </div>
  );
}

function Section({
  id,
  title,
  intro,
  children,
}: {
  id: string;
  title: string;
  intro: string;
  children: ReactNode;
}) {
  return (
    <section aria-labelledby={id} className="grid gap-4">
      <div className="grid max-w-[68ch] gap-1">
        <h2 id={id} className="t-title">
          {title}
        </h2>
        <p className="t-body text-(--c-ink-2)">{intro}</p>
      </div>
      {children}
    </section>
  );
}

function Mark() {
  return (
    <span className="flex items-center gap-2">
      <span className="cp-mark" aria-hidden>
        C
      </span>
      <span className="text-[1.0625rem] font-extrabold tracking-[-0.01em]">
        Clubly
      </span>
    </span>
  );
}

const tabs = [
  { label: "Overview", icon: IconLayoutDashboard },
  { label: "Members", icon: IconUsers },
  { label: "Revenue", icon: IconChartBar, current: true },
  { label: "Payouts", icon: IconBuildingBank },
  { label: "History", icon: IconHistory },
  { label: "Team", icon: IconUsersGroup },
];

/** The signed-in frame: the band with the app's header, the business and its tabs. */
function Frame({ children }: { children: ReactNode }) {
  return (
    <div className="bg-(--c-bg)">
      <div className="cp-band">
        <div className="mx-auto flex max-w-[1120px] flex-wrap items-center justify-between gap-x-6 gap-y-1 px-4 py-2 sm:h-14 sm:flex-nowrap sm:px-8 sm:py-0">
          <Mark />
          <nav
            aria-label="Main"
            className="order-last flex w-full gap-5 text-sm font-semibold text-(--c-on-band-2) sm:order-none sm:w-auto sm:flex-1"
          >
            <a href="#frame" aria-current="page" className="text-(--c-on-band)">
              Businesses
            </a>
            <a href="#members">Memberships</a>
            <a href="#components">Settings</a>
          </nav>
          <button type="button" className="cp-btn cp-btn-ghost">
            <Glyph icon={IconLogout} />
            Sign out
          </button>
        </div>
        <div className="mx-auto grid max-w-[1120px] gap-1 px-4 pt-6 sm:px-8">
          <p className="t-title">Harbor Climbing Gym</p>
          <p className="t-small text-(--c-on-band-2)">You own this business.</p>
        </div>
        <div className="mx-auto mt-3 max-w-[1120px] px-2 sm:px-6">
          <nav aria-label="Business" className="cp-tabs">
            {tabs.map((tab) => (
              <a
                key={tab.label}
                href="#frame"
                className="cp-tab"
                aria-current={tab.current ? "page" : undefined}
              >
                <Glyph icon={tab.icon} />
                {tab.label}
              </a>
            ))}
          </nav>
        </div>
      </div>
      <p className="tone-volt flex items-start gap-2 px-4 py-2 text-sm sm:items-center sm:justify-center sm:text-center">
        <Glyph icon={IconInfoCircle} />
        Demo accounts can look around but not change anything. Sign out and
        create your own account to try it.
      </p>
      <div className="mx-auto max-w-[1120px] px-4 py-8 sm:px-8">{children}</div>
    </div>
  );
}

function RevenueSample() {
  return (
    <div className="grid gap-6">
      <div className="grid gap-1">
        <p className="t-heading">Revenue</p>
        <p className="t-small text-(--c-ink-3)">
          Recurring revenue counts active subscriptions (yearly plans at a
          twelfth of their price), including ones whose payment Stripe is
          retrying. Trials count once they pay.
        </p>
      </div>
      <div className="cp-surface grid gap-5 p-5 sm:p-6">
        <dl>
          <div className="grid gap-2">
            <dt className="t-label text-(--c-ink-2)">
              Monthly recurring revenue
            </dt>
            <dd className="t-figure-xl">$249.17</dd>
          </div>
        </dl>
        {/* Paid - fees = net. The signs are drawn by CSS (with empty alt text), because a
            definition list may only hold its term and description groups. */}
        <dl className="cp-equation grid gap-3 border-t border-(--c-line) pt-5 sm:grid-cols-3 sm:gap-10">
          <div className="grid gap-1">
            <dt className="t-small text-(--c-ink-2)">
              Paid in the last 30 days
            </dt>
            <dd className="t-figure">$845.00</dd>
          </div>
          <div className="op-minus grid gap-1">
            <dt className="t-small text-(--c-ink-2)">Clubly fees (5%)</dt>
            <dd className="t-figure text-(--c-ink-2)">$42.25</dd>
          </div>
          <div className="op-equals tone-volt -m-2 grid gap-1 rounded-[6px] p-2">
            <dt className="t-small">Net to your Stripe balance</dt>
            <dd className="t-figure">$802.75</dd>
          </div>
        </dl>
      </div>
      <p role="status" className="cp-notice tone-danger">
        <Glyph icon={IconAlertTriangle} size={18} />1 failed payment in the last
        30 days. Stripe retries them automatically, and the members can update
        their card from their account page.
      </p>
      <div className="grid gap-3">
        <p className="t-heading">Recent payments</p>
        <ul className="cp-surface cp-rows">
          {[
            {
              name: "Daniel Kim",
              date: "October 5, 2026",
              amount: "$79.00",
              failed: true,
            },
            {
              name: "Grace Okafor",
              date: "September 26, 2026",
              amount: "$119.00",
              fee: "$5.95",
            },
            {
              name: "Sam Saver",
              date: "October 2, 2026",
              amount: "$650.00",
              fee: "$32.50",
            },
          ].map((payment) => (
            <li
              key={payment.name + payment.date}
              className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 px-4 py-3"
            >
              <span className="truncate font-semibold">{payment.name}</span>
              <span className="text-right font-semibold">{payment.amount}</span>
              <span className="t-small text-(--c-ink-3)">{payment.date}</span>
              <span className="justify-self-end">
                {payment.failed ? (
                  <span className="cp-badge tone-danger">
                    <Glyph icon={IconAlertTriangle} size={14} />
                    Failed
                  </span>
                ) : (
                  <span className="t-small text-(--c-ink-3)">
                    Paid, {payment.fee} fee
                  </span>
                )}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

const members = [
  {
    name: "Sid Suspended",
    email: "sid.suspended@example.com",
    plan: "Monthly climber",
    badges: [
      { label: "Active", tone: "success", icon: IconCircleCheck },
      { label: "Suspended", tone: "danger", icon: IconBan },
    ],
    detail: "Renews on November 2, 2026",
    action: "Reactivate",
  },
  {
    name: "Carl Canceling",
    email: "carl.canceling@example.com",
    plan: "Monthly climber",
    badges: [{ label: "Canceling", tone: "warning", icon: IconClockPause }],
    detail: "Ends on November 2, 2026",
    action: "Suspend",
  },
  {
    name: "Sam Saver",
    email: "sam.saver@example.com",
    plan: "Annual climber",
    badges: [{ label: "Active", tone: "success", icon: IconCircleCheck }],
    detail: "Renews on October 2, 2027",
    action: "Suspend",
  },
  {
    name: "Nina Newcomer",
    email: "nina.newcomer@example.com",
    plan: "No plan yet",
    badges: [],
    detail: null,
    action: "Suspend",
  },
] as const;

function MembersSample() {
  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="t-heading">Members</p>
        <p className="t-small text-(--c-ink-3)">5 members, 4 subscribed</p>
      </div>
      <ul className="cp-surface cp-rows">
        {members.map((member) => (
          <li
            key={member.email}
            className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-x-3 gap-y-2 px-4 py-3 md:grid-cols-[auto_minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1.2fr)_auto] md:items-center"
          >
            <span
              aria-hidden
              className="grid size-9 place-items-center rounded-[6px] bg-(--c-surface-3) text-sm font-bold text-(--c-ink-2)"
            >
              {member.name
                .split(" ")
                .map((part) => part[0])
                .join("")}
            </span>
            <span className="grid min-w-0">
              <span className="font-semibold">{member.name}</span>
              <span className="t-small truncate text-(--c-ink-3)">
                {member.email}
              </span>
            </span>
            <span className="t-small col-start-2 row-start-2 md:col-start-auto md:row-start-auto">
              {member.plan}
            </span>
            <span className="col-start-2 flex flex-wrap items-center gap-2 md:col-start-auto">
              {member.badges.map((badge) => (
                <span
                  key={badge.label}
                  className={`cp-badge tone-${badge.tone}`}
                >
                  <Glyph icon={badge.icon} size={14} />
                  {badge.label}
                </span>
              ))}
              {member.detail && (
                <span className="t-small text-(--c-ink-3)">
                  {member.detail}
                </span>
              )}
            </span>
            <button
              type="button"
              className={`cp-btn ${member.action === "Suspend" ? "cp-btn-quiet-danger" : "cp-btn-secondary"} col-start-3 row-start-1 md:col-start-auto md:row-start-auto`}
            >
              {member.action}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function JoinSample() {
  return (
    <div className="bg-(--c-bg)">
      <div className="cp-band">
        <div className="mx-auto max-w-[960px] px-4 pt-4 sm:px-8">
          <Mark />
        </div>
        <div className="mx-auto grid max-w-[960px] gap-3 px-4 pt-12 pb-10 sm:px-8 sm:pt-16">
          <p className="t-display text-balance">Harbor Climbing Gym</p>
          <p className="t-lead text-(--c-on-band-2)">Choose a membership.</p>
        </div>
      </div>
      <div className="mx-auto grid max-w-[960px] gap-4 px-4 py-8 sm:px-8">
        <p role="status" className="cp-notice tone-info">
          <Glyph icon={IconInfoCircle} size={18} />
          Checkout was canceled, and you haven&apos;t been charged.
        </p>
        <ul className="cp-surface cp-rows">
          {[
            { name: "Monthly climber", price: "$65.00", per: "month" },
            { name: "Annual climber", price: "$650.00", per: "year" },
          ].map((plan) => (
            <li
              key={plan.name}
              className="grid items-center gap-4 px-5 py-5 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:gap-8 sm:px-6"
            >
              <span className="t-heading">{plan.name}</span>
              <span className="flex items-baseline gap-2">
                <span className="t-figure">{plan.price}</span>
                <span className="t-small text-(--c-ink-3)">per {plan.per}</span>
              </span>
              <button type="button" className="cp-btn cp-btn-primary cp-btn-lg">
                Join
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

const badgeSamples = [
  {
    label: "Active",
    tone: "success",
    icon: IconCircleCheck,
    means: "Membership running",
  },
  { label: "Paid", tone: "success", icon: IconCircleCheck, means: "Money in" },
  {
    label: "Canceling",
    tone: "warning",
    icon: IconClockPause,
    means: "Ends at the date shown",
  },
  {
    label: "Payment pending",
    tone: "warning",
    icon: IconHourglass,
    means: "Waiting on Stripe",
  },
  {
    label: "Trial",
    tone: "info",
    icon: IconHourglass,
    means: "Not paying yet",
  },
  {
    label: "Refunded",
    tone: "info",
    icon: IconReceiptRefund,
    means: "Money returned (not in the app yet)",
  },
  {
    label: "Payment failed",
    tone: "danger",
    icon: IconAlertTriangle,
    means: "Stripe is retrying",
  },
  {
    label: "Suspended",
    tone: "danger",
    icon: IconBan,
    means: "Can't start a new membership",
  },
  {
    label: "Ended",
    tone: "neutral",
    icon: IconCircleX,
    means: "Over, kept as history",
  },
  {
    label: "Archived",
    tone: "neutral",
    icon: IconArchive,
    means: "Not for sale",
  },
  {
    label: "Payments not set up",
    tone: "warning",
    icon: IconAlertTriangle,
    means: "A step to finish",
  },
  { label: "Owner", tone: "neutral", icon: null, means: "A role" },
] as const;

function Components() {
  return (
    <div className="grid gap-8">
      <div className="grid gap-3">
        <p className="t-label text-(--c-ink-2)">Buttons</p>
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" className="cp-btn cp-btn-primary">
            Create plan
          </button>
          <button type="button" className="cp-btn cp-btn-secondary">
            <Glyph icon={IconPlus} />
            New plan
          </button>
          <button type="button" className="cp-btn cp-btn-ghost">
            Cancel
          </button>
          <button type="button" className="cp-btn cp-btn-quiet-danger">
            Suspend
          </button>
          <button type="button" className="cp-btn cp-btn-danger">
            Delete my account
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" className="cp-btn cp-btn-primary is-focus">
            Focused
          </button>
          <button
            type="button"
            className="cp-btn cp-btn-primary opacity-50"
            disabled
          >
            Opening checkout...
          </button>
        </div>
      </div>

      <div className="grid gap-4">
        <p className="t-label text-(--c-ink-2)">Fields</p>
        <div className="cp-field">
          <label className="t-label">
            Business name
            <input
              className="cp-input mt-1.5"
              defaultValue="Harbor Climbing Gym"
              readOnly
            />
          </label>
          <p className="t-caption text-(--c-ink-3)">
            Your join page stays at /b/harbor-climbing-gym.
          </p>
        </div>
        <div className="cp-field">
          <label className="t-label">
            Password
            <input
              className="cp-input mt-1.5"
              type="password"
              aria-invalid="true"
              defaultValue="lettersonly"
              readOnly
            />
          </label>
          <p className="t-small flex items-center gap-1.5 text-(--c-danger)">
            <Glyph icon={IconAlertTriangle} size={14} />
            Use at least 8 characters, with letters and numbers.
          </p>
        </div>
        <div className="cp-field">
          <label className="t-label">
            Role
            <span className="relative mt-1.5 block">
              <select
                className="cp-input appearance-none pr-9"
                defaultValue="staff"
              >
                <option value="staff">Staff: sees the members</option>
              </select>
              <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-(--c-ink-3)">
                <Glyph icon={IconChevronDown} />
              </span>
            </span>
          </label>
        </div>
      </div>

      <div className="grid gap-3">
        <p className="t-label text-(--c-ink-2)">Badges and money states</p>
        <ul className="grid gap-2 sm:grid-cols-2">
          {badgeSamples.map((badge) => (
            <li key={badge.label} className="flex items-center gap-3">
              <span className={`cp-badge tone-${badge.tone}`}>
                {badge.icon && <Glyph icon={badge.icon} size={14} />}
                {badge.label}
              </span>
              <span className="t-caption text-(--c-ink-3)">{badge.means}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="grid gap-3">
        <p className="t-label text-(--c-ink-2)">Notices</p>
        <p className="cp-notice tone-success">
          <Glyph icon={IconCircleCheck} size={18} />
          Welcome to Harbor Climbing Gym. Your membership is active.
        </p>
        <p className="cp-notice tone-info">
          <Glyph icon={IconHourglass} size={18} />
          Stripe is confirming your payment to Harbor Climbing Gym. This page
          updates on its own.
        </p>
        <p className="cp-notice tone-warning">
          <Glyph icon={IconAlertTriangle} size={18} />
          Stripe setup isn&apos;t finished yet.
        </p>
        <p className="cp-notice tone-danger">
          <Glyph icon={IconAlertTriangle} size={18} />
          We couldn&apos;t reach Stripe to load your balance. Please try again
          in a moment.
        </p>
      </div>

      <div className="grid gap-3">
        <p className="t-label text-(--c-ink-2)">Empty and loading</p>
        <div className="cp-surface grid justify-items-start gap-3 p-6">
          <span className="grid size-10 place-items-center rounded-[8px] bg-(--c-volt-soft) text-(--c-ink)">
            <Glyph icon={IconUserPlus} size={20} />
          </span>
          <p className="t-heading">No members yet</p>
          <p className="t-body text-(--c-ink-2)">
            People join from your public page.
          </p>
        </div>
        <div aria-hidden className="grid gap-3 sm:grid-cols-2">
          <div className="cp-skeleton h-22" />
          <div className="cp-skeleton h-22" />
        </div>
      </div>
    </div>
  );
}

const swatches: { token: string; light: string; dark: string; use: string }[] =
  [
    { token: "bg", light: "#f3f6f9", dark: "#0b0e14", use: "The page (chalk)" },
    {
      token: "surface",
      light: "#fcfdff",
      dark: "#14171e",
      use: "Lists, panels, forms",
    },
    {
      token: "surface-2",
      light: "#ebeef2",
      dark: "#1d2128",
      use: "Fills, hovers, neutral badges",
    },
    {
      token: "surface-3",
      light: "#dfe3e8",
      dark: "#272b34",
      use: "Pressed fills, initials",
    },
    {
      token: "line",
      light: "#dce0e5",
      dark: "#2c3038",
      use: "Dividers inside a surface",
    },
    {
      token: "line-input",
      light: "#7b8189",
      dark: "#6f757e",
      use: "Field and button outlines",
    },
    { token: "ink", light: "#131822", dark: "#eff2f5", use: "Text" },
    {
      token: "ink-2",
      light: "#424852",
      dark: "#b9bec4",
      use: "Secondary text",
    },
    {
      token: "ink-3",
      light: "#5e636d",
      dark: "#969ca3",
      use: "Muted text, captions",
    },
    {
      token: "band",
      light: "#141a24",
      dark: "#05070c",
      use: "Header and hero signage",
    },
    {
      token: "volt",
      light: "#c7f155",
      dark: "#c7f155",
      use: "Primary actions, the current tab, the mark",
    },
    {
      token: "volt-soft",
      light: "#eaf8c3",
      dark: "#2c3809",
      use: "Highlights: net revenue, the demo note",
    },
    {
      token: "success",
      light: "#1b6c3a",
      dark: "#63ca84",
      use: "Active, paid",
    },
    {
      token: "warning",
      light: "#845011",
      dark: "#f2c36a",
      use: "Canceling, pending, to do",
    },
    {
      token: "danger",
      light: "#ba2b2e",
      dark: "#f97770",
      use: "Failed, suspended, destructive",
    },
    {
      token: "info",
      light: "#1a609e",
      dark: "#82b9f2",
      use: "Trial, refunded, waiting on Stripe",
    },
  ];

const typeScale = [
  {
    name: "Display",
    className: "t-display",
    spec: "60 / 60, 800, -0.02em",
    sample: "Harbor Climbing Gym",
  },
  {
    name: "Title",
    className: "t-title",
    spec: "30 / 34, 750, -0.015em",
    sample: "Members",
  },
  {
    name: "Heading",
    className: "t-heading",
    spec: "18 / 24, 650",
    sample: "Recent payments",
  },
  {
    name: "Lead",
    className: "t-lead",
    spec: "17 / 26, 400",
    sample: "Choose a membership.",
  },
  {
    name: "Body",
    className: "t-body",
    spec: "15 / 23, 400",
    sample: "Members pay straight into your Stripe account.",
  },
  {
    name: "Small",
    className: "t-small",
    spec: "13 / 19, 400",
    sample: "Joined October 2, 2026",
  },
  {
    name: "Label",
    className: "t-label",
    spec: "13 / 17, 600",
    sample: "Business name",
  },
  {
    name: "Caption",
    className: "t-caption",
    spec: "12 / 16, 400",
    sample: "Lowercase letters, numbers and dashes.",
  },
  {
    name: "Figure XL",
    className: "t-figure-xl",
    spec: "60 / 60, 800, -0.025em",
    sample: "$249.17",
  },
  {
    name: "Figure",
    className: "t-figure",
    spec: "28 / 31, 750, -0.02em",
    sample: "$1,605.50",
  },
];

const fonts = [
  {
    name: "Archivo (chosen)",
    className: "",
    note: "One variable file, weights 100 to 900, 35 KB for Latin (Geist today: 29 KB). Sturdy, slightly squared grotesque made for headlines and data; figures are tabular by default, so amounts line up.",
  },
  {
    name: "Archivo Narrow, for display and figures",
    className: archivoNarrow.className,
    note: "The scoreboard look, but a second file (+19 KB). Archivo's own width axis would make it one file, but Google serves it as 90 KB. Measure-first rule: not worth the Lighthouse risk.",
  },
  {
    name: "Instrument Sans",
    className: instrumentSans.className,
    note: "Crisp and contemporary, 57 KB with its width axis; reads more editorial studio than gym floor.",
  },
  {
    name: "Geist (today)",
    className: "font-[family-name:var(--font-geist-sans)]",
    note: "Vercel's default, and shadcn's. Neutral to the point of anonymous; it's half of why Clubly looks like a starter.",
  },
];

const icons: { icon: Icon; name: string }[] = [
  { icon: IconLayoutDashboard, name: "Overview" },
  { icon: IconUsers, name: "Members" },
  { icon: IconChartBar, name: "Revenue" },
  { icon: IconBuildingBank, name: "Payouts" },
  { icon: IconHistory, name: "History" },
  { icon: IconUsersGroup, name: "Team" },
  { icon: IconTicket, name: "Plans" },
  { icon: IconCircleCheck, name: "Active, paid" },
  { icon: IconClockPause, name: "Canceling" },
  { icon: IconAlertTriangle, name: "Failed, errors" },
  { icon: IconBan, name: "Suspended" },
  { icon: IconReceiptRefund, name: "Refunded" },
];

export default function DesignPreviewPage() {
  if (process.env.NODE_ENV === "production") notFound();

  return (
    <div className={`${archivo.variable} cp flex-1`}>
      <main className="mx-auto grid max-w-[1280px] gap-16 px-4 py-10 sm:px-8">
        <header className="grid max-w-[72ch] gap-3">
          <Mark />
          <h1 className="t-display">Clubly design system</h1>
          <p className="t-lead text-(--c-ink-2)">
            A well-run gym floor: cool chalk neutrals, ink signage, one volt
            accent for what you can do, and numbers that line up.
          </p>
          <p className="t-small text-(--c-ink-3)">
            Development only. The tokens are scoped to this page until step 3
            makes them the app&apos;s; docs/design/DESIGN.md explains every
            choice.
          </p>
        </header>

        <Section
          id="frame"
          title="The signed-in frame"
          intro="The ink band carries the app's header, the business and its tabs, like a gym's signage; work happens below it on chalk. The demo note is a volt strip, not a gray bar."
        >
          <Stacked>
            <Frame>
              <RevenueSample />
            </Frame>
          </Stacked>
        </Section>

        <Section
          id="members"
          title="Members"
          intro="One surface, one row per member with dividers between, columns from 768px. Status is a badge with an icon and a word; actions that take something away are quiet red."
        >
          <Stacked>
            <div className="px-4 pb-6 sm:px-6">
              <MembersSample />
            </div>
          </Stacked>
        </Section>

        <Section
          id="join"
          title="The join page"
          intro="The business leads: its name as a sign on the band, Clubly only as the small mark. Plans read like the price board at the front desk, each with one volt Join."
        >
          <Stacked>
            <JoinSample />
          </Stacked>
        </Section>

        <Section
          id="components"
          title="Components"
          intro="Buttons, fields, badges, notices, empty and loading states, in both modes."
        >
          <Both>
            <Components />
          </Both>
        </Section>

        <Section
          id="color"
          title="Color"
          intro="Cool neutrals (hue 255 to 262), ink for text and signage, one volt accent, and four status colors that only mean status. Volt is a fill, never text on a light background."
        >
          <Both>
            <ul className="grid gap-2 sm:grid-cols-2">
              {swatches.map((swatch) => (
                <li key={swatch.token} className="flex items-center gap-3">
                  <span
                    aria-hidden
                    className="size-10 flex-none rounded-[6px] shadow-[0_0_0_1px_var(--c-line)]"
                    style={{ background: `var(--c-${swatch.token})` }}
                  />
                  <span className="grid min-w-0">
                    <span className="t-label">{swatch.token}</span>
                    <span className="t-caption text-(--c-ink-3)">
                      {swatch.light} / {swatch.dark}. {swatch.use}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </Both>
        </Section>

        <Section
          id="type"
          title="Type"
          intro="Archivo for everything, from 400 to 800. Big money is set like a scoreboard: heavy, tight, tabular."
        >
          <Both>
            <ul className="grid gap-4">
              {typeScale.map((step) => (
                <li key={step.name} className="grid gap-1">
                  <span className="t-caption text-(--c-ink-3)">
                    {step.name}: {step.spec}
                  </span>
                  <span className={step.className}>{step.sample}</span>
                </li>
              ))}
            </ul>
          </Both>
          <div className="grid gap-4 md:grid-cols-2">
            {fonts.map((font) => (
              <div key={font.name} className="cp-surface grid gap-2 p-5">
                <p className="t-label text-(--c-ink-2)">{font.name}</p>
                <p className={`${font.className} text-3xl font-extrabold`}>
                  Harbor Climbing Gym $249.17
                </p>
                <p className={`${font.className} t-body`}>
                  Members pay straight into your Stripe account. 0123456789
                </p>
                <p className="t-small text-(--c-ink-3)">{font.note}</p>
              </div>
            ))}
          </div>
        </Section>

        <Section
          id="icons"
          title="Icons"
          intro="Tabler, at a 1.75 stroke: 14px in badges, 16px beside text, 20px in empty states and plan rows. Always beside a word, never instead of one."
        >
          <Both>
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {icons.map(({ icon, name }) => (
                <li key={name} className="t-small flex items-center gap-2">
                  <Glyph icon={icon} size={20} />
                  {name}
                </li>
              ))}
            </ul>
          </Both>
        </Section>
      </main>
    </div>
  );
}

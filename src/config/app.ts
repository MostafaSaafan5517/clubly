// The product name lives only here, so a rename is a one-line change.
export const appConfig = {
  name: "Clubly",
  description:
    "Memberships and recurring billing for gyms, studios, and clubs.",
  // The platform's cut of every membership payment, taken by Stripe as an application fee.
  applicationFeePercent: 5,
  // Whether this deployment can send auth emails (confirmations, sign-in links). The live demo
  // can't (NEXT_PUBLIC_AUTH_EMAILS=off): Supabase's free built-in email only reaches the
  // project's own team. There, sign-ups are confirmed at once and the email link is hidden.
  authEmails: process.env.NEXT_PUBLIC_AUTH_EMAILS !== "off",
} as const;

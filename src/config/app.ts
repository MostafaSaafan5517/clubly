// The product name lives only here, so a rename is a one-line change.
export const appConfig = {
  name: "Clubly",
  description:
    "Memberships and recurring billing for gyms, studios, and clubs.",
  // The platform's cut of every membership payment, taken by Stripe as an application fee.
  applicationFeePercent: 5,
} as const;

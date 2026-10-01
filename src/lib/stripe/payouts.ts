import "server-only";
import type Stripe from "stripe";
import { stripe } from "@/lib/stripe/server";

export type Money = { amount: number; currency: string };

export type PayoutSummary = {
  /** Ready to be paid out to the business's bank account. */
  available: Money[];
  /** Paid by members, but not settled yet. */
  pending: Money[];
  payouts: {
    id: string;
    amount: number;
    currency: string;
    /** When the money is expected in the bank (Unix seconds). */
    arrivalDate: number;
    status: Stripe.Payout["status"];
  }[];
};

const RECENT_PAYOUTS = 10;

/** The connected account's balance and latest payouts, read live from Stripe. */
export async function getPayoutSummary(
  accountId: string,
): Promise<PayoutSummary> {
  const options = { stripeAccount: accountId };
  const [balance, payouts] = await Promise.all([
    stripe.balance.retrieve({}, options),
    stripe.payouts.list({ limit: RECENT_PAYOUTS }, options),
  ]);
  const toMoney = ({ amount, currency }: Money) => ({ amount, currency });
  return {
    available: balance.available.map(toMoney),
    pending: balance.pending.map(toMoney),
    payouts: payouts.data.map((payout) => ({
      id: payout.id,
      amount: payout.amount,
      currency: payout.currency,
      arrivalDate: payout.arrival_date,
      status: payout.status,
    })),
  };
}

/**
 * A single-use link that signs the owner in to their Stripe Express dashboard, where they
 * change their bank account and payout schedule. Stripe only issues it once onboarding is done.
 */
export async function createDashboardLoginUrl(accountId: string) {
  const link = await stripe.accounts.createLoginLink(accountId);
  return link.url;
}

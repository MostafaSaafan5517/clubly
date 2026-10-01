import { describe, expect, it } from "vitest";
import {
  currentSubscription,
  describeSubscription,
  isLive,
} from "@/lib/membership";

describe("isLive", () => {
  it("counts subscriptions that are paid up, in a trial or being retried", () => {
    expect(isLive("active")).toBe(true);
    expect(isLive("trialing")).toBe(true);
    expect(isLive("past_due")).toBe(true);
  });

  it("does not count ended or unfinished subscriptions", () => {
    expect(isLive("canceled")).toBe(false);
    expect(isLive("incomplete")).toBe(false);
    expect(isLive("incomplete_expired")).toBe(false);
    expect(isLive("unpaid")).toBe(false);
    expect(isLive("paused")).toBe(false);
  });
});

describe("currentSubscription", () => {
  it("is null for a member who never subscribed", () => {
    expect(currentSubscription([])).toBeNull();
  });

  it("prefers the live subscription over a newer ended one", () => {
    const live = {
      status: "active",
      created_at: "2026-01-01T00:00:00Z",
    } as const;
    const ended = {
      status: "canceled",
      created_at: "2026-06-01T00:00:00Z",
    } as const;
    expect(currentSubscription([ended, live])).toBe(live);
  });

  it("falls back to the most recent subscription when none is live", () => {
    const older = {
      status: "canceled",
      created_at: "2026-01-01T00:00:00Z",
    } as const;
    const newer = {
      status: "incomplete_expired",
      created_at: "2026-06-01T00:00:00+00:00",
    } as const;
    expect(currentSubscription([older, newer])).toBe(newer);
  });
});

describe("describeSubscription", () => {
  const periodEnd = "2026-11-01T12:00:00+00:00";

  it("shows when an active subscription renews", () => {
    expect(
      describeSubscription({
        status: "active",
        current_period_end: periodEnd,
        cancel_at: null,
      }),
    ).toEqual({ label: "Active", detail: "Renews on November 1, 2026" });
  });

  it("shows when a subscription that's been canceled stops", () => {
    expect(
      describeSubscription({
        status: "active",
        current_period_end: periodEnd,
        cancel_at: periodEnd,
      }),
    ).toEqual({ label: "Canceling", detail: "Ends on November 1, 2026" });
    expect(
      describeSubscription({
        status: "trialing",
        current_period_end: periodEnd,
        cancel_at: "2026-10-20T12:00:00+00:00",
      }),
    ).toEqual({ label: "Trial", detail: "Ends on October 20, 2026" });
  });

  it("shows when a trial's first payment is due", () => {
    expect(
      describeSubscription({
        status: "trialing",
        current_period_end: periodEnd,
        cancel_at: null,
      }),
    ).toEqual({ label: "Trial", detail: "First payment on November 1, 2026" });
  });

  it("asks for a new payment method when a payment failed", () => {
    expect(
      describeSubscription({
        status: "past_due",
        current_period_end: periodEnd,
        cancel_at: null,
      }),
    ).toEqual({
      label: "Payment failed",
      detail: "Update your payment method to keep your membership.",
    });
  });

  it("leaves out dates Stripe hasn't given", () => {
    expect(
      describeSubscription({
        status: "active",
        current_period_end: null,
        cancel_at: null,
      }),
    ).toEqual({ label: "Active", detail: null });
  });

  it("says an ended subscription has ended", () => {
    expect(
      describeSubscription({
        status: "canceled",
        current_period_end: periodEnd,
        cancel_at: null,
      }),
    ).toEqual({ label: "Ended", detail: null });
  });
});

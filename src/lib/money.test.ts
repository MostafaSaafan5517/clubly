import { describe, expect, it } from "vitest";
import { formatAmount } from "@/lib/money";

describe("formatAmount", () => {
  it("converts cents to dollars", () => {
    expect(formatAmount(3000, "USD")).toBe("$30.00");
  });

  it("accepts Stripe's lowercase currency codes", () => {
    expect(formatAmount(30000, "usd")).toBe("$300.00");
  });

  it("does not divide zero-decimal currencies", () => {
    expect(formatAmount(500, "jpy")).toBe("¥500");
  });
});

import { describe, expect, it } from "vitest";
import { formatAmount, parseDollarsToCents } from "@/lib/money";

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

describe("parseDollarsToCents", () => {
  it("converts whole and fractional dollars exactly", () => {
    expect(parseDollarsToCents("30")).toBe(3000);
    expect(parseDollarsToCents("29.99")).toBe(2999);
    expect(parseDollarsToCents("19.99")).toBe(1999);
    expect(parseDollarsToCents("29.9")).toBe(2990);
    expect(parseDollarsToCents("0.50")).toBe(50);
    expect(parseDollarsToCents(" 12 ")).toBe(1200);
  });

  it("rejects anything that isn't a plain amount with at most two decimals", () => {
    for (const input of [
      "",
      "abc",
      "-5",
      "29.999",
      "12.",
      ".5",
      "1e3",
      "1,200",
    ]) {
      expect(parseDollarsToCents(input)).toBeNull();
    }
  });
});

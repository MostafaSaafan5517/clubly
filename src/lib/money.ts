/**
 * Formats an amount stored in the currency's smallest unit for display.
 * Stripe and our database keep money as integers (3000 = $30.00) to avoid floating-point errors.
 */
export function formatAmount(
  amountInMinorUnits: number,
  currency: string,
  locale = "en-US",
): string {
  const formatter = new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
  });
  // 2 for USD, 0 for zero-decimal currencies like JPY.
  const fractionDigits = formatter.resolvedOptions().maximumFractionDigits ?? 2;
  return formatter.format(amountInMinorUnits / 10 ** fractionDigits);
}

// Stripe's limits for a USD charge: at least $0.50, at most $999,999.99.
export const MIN_PLAN_AMOUNT = 50;
export const MAX_PLAN_AMOUNT = 99_999_999;

/**
 * Turns a price typed in dollars ("30", "29.99") into whole cents, or null if it isn't a plain
 * amount with at most two decimals. Works on the text, never on floats: in JavaScript
 * `parseFloat("19.99") * 100` is 1998.9999999999998. Plans are priced in USD for now, so two
 * decimal places is the rule.
 */
export function parseDollarsToCents(input: string): number | null {
  const match = /^(\d{1,9})(?:\.(\d{1,2}))?$/.exec(input.trim());
  if (!match) return null;
  const [, dollars = "0", cents = ""] = match;
  return Number(dollars) * 100 + Number(cents.padEnd(2, "0"));
}

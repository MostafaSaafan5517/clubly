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

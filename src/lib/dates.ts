const dateFormat = new Intl.DateTimeFormat("en-US", {
  dateStyle: "long",
  // Pages are rendered on the server, which doesn't know the viewer's time zone, so dates are
  // shown as UTC calendar days.
  timeZone: "UTC",
});

/** A timestamp as a calendar date ("November 1, 2026"). */
export function formatDate(timestamp: string | Date) {
  return dateFormat.format(new Date(timestamp));
}

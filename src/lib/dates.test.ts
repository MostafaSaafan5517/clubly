import { describe, expect, it } from "vitest";
import { formatDate } from "@/lib/dates";

describe("formatDate", () => {
  it("formats a timestamp as a long calendar date", () => {
    expect(formatDate("2026-11-01T12:00:00+00:00")).toBe("November 1, 2026");
  });

  it("uses the UTC calendar day, whatever the server's time zone", () => {
    // Already November 1 east of UTC (Cairo, for one).
    expect(formatDate("2026-10-31T23:30:00+00:00")).toBe("October 31, 2026");
  });
});

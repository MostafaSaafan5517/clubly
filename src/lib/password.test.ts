import type { JwtPayload } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { cameFromEmailLink } from "@/lib/password";

const NOW = 1_800_000_000;
const signedIn = (amr: JwtPayload["amr"]) =>
  ({ sub: "user-1", amr }) as JwtPayload;

describe("cameFromEmailLink", () => {
  it("is true for a session started from an email link in the last hour", () => {
    expect(
      cameFromEmailLink(
        signedIn([{ method: "otp", timestamp: NOW - 59 * 60 }]),
        NOW,
      ),
    ).toBe(true);
  });

  it("is false once the hour has passed", () => {
    expect(
      cameFromEmailLink(
        signedIn([{ method: "otp", timestamp: NOW - 60 * 60 }]),
        NOW,
      ),
    ).toBe(false);
  });

  it("is false for a password sign-in, however recent", () => {
    expect(
      cameFromEmailLink(
        signedIn([{ method: "password", timestamp: NOW }]),
        NOW,
      ),
    ).toBe(false);
  });

  it("is false without timestamps to check", () => {
    expect(cameFromEmailLink(signedIn(["otp"]), NOW)).toBe(false);
    expect(cameFromEmailLink(signedIn(undefined), NOW)).toBe(false);
  });
});

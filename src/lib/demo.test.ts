import type { JwtPayload } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { isDemoAccount } from "@/lib/demo";

const claims = (appMetadata?: JwtPayload["app_metadata"]) =>
  ({ sub: "user-1", app_metadata: appMetadata }) as JwtPayload;

describe("isDemoAccount", () => {
  it("is true only for accounts marked demo: true", () => {
    expect(isDemoAccount(claims({ provider: "email", demo: true }))).toBe(true);
  });

  it("is false for everyone else", () => {
    expect(isDemoAccount(claims({ provider: "email" }))).toBe(false);
    expect(isDemoAccount(claims())).toBe(false);
    // Only the boolean counts, like the database's check of the stored mark.
    expect(isDemoAccount(claims({ demo: "true" }))).toBe(false);
  });
});

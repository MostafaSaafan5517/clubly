import { describe, expect, it } from "vitest";
import { createInviteToken, hashInviteToken, isPending } from "@/lib/invites";

describe("invite tokens", () => {
  it("hashes a token exactly as the database does", () => {
    // select encode(sha256(convert_to('admin-link', 'UTF8')), 'hex')
    expect(hashInviteToken("admin-link")).toBe(
      "065c3db99a54b1be344223dce31f4b7a5433e8a027e86f15d904a08fa66bca74",
    );
  });

  it("makes a new URL-safe token every time, with its hash", () => {
    const first = createInviteToken();
    const second = createInviteToken();
    expect(first.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(first.token).not.toBe(second.token);
    expect(first.tokenHash).toBe(hashInviteToken(first.token));
    expect(first.tokenHash).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("isPending", () => {
  const now = Date.parse("2026-10-03T12:00:00Z");

  it("is true for an unused invite that hasn't expired", () => {
    expect(
      isPending({ accepted_at: null, expires_at: "2026-10-03T12:00:01Z" }, now),
    ).toBe(true);
  });

  it("is false once it's used or expired", () => {
    expect(
      isPending(
        {
          accepted_at: "2026-10-02T09:00:00Z",
          expires_at: "2026-10-09T12:00:00Z",
        },
        now,
      ),
    ).toBe(false);
    expect(
      isPending({ accepted_at: null, expires_at: "2026-10-03T12:00:00Z" }, now),
    ).toBe(false);
  });
});

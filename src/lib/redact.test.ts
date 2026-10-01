import { describe, expect, it } from "vitest";
import { errorMessage, redactSecrets } from "@/lib/redact";

describe("redactSecrets", () => {
  it("removes the part of a Stripe key that Stripe's errors leave visible", () => {
    expect(
      redactSecrets(
        "The provided key 'sk_test_****************X92v14' does not have access to account 'acct_1'",
      ),
    ).toBe(
      "The provided key 'sk_test_[redacted]' does not have access to account 'acct_1'",
    );
  });

  it("covers live, restricted and publishable keys too", () => {
    expect(redactSecrets("sk_live_abc rk_test_def pk_live_ghi")).toBe(
      "sk_live_[redacted] rk_test_[redacted] pk_live_[redacted]",
    );
  });

  it("leaves Stripe object ids alone", () => {
    expect(redactSecrets("No such subscription: 'sub_123' on acct_456")).toBe(
      "No such subscription: 'sub_123' on acct_456",
    );
  });
});

describe("errorMessage", () => {
  it("redacts the message of an Error or of anything thrown", () => {
    expect(errorMessage(new Error("bad key sk_test_123"))).toBe(
      "bad key sk_test_[redacted]",
    );
    expect(errorMessage("sk_test_123")).toBe("sk_test_[redacted]");
  });
});

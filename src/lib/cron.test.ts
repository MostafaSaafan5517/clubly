import { describe, expect, it } from "vitest";
import { isAuthorizedCronRequest } from "@/lib/cron";

const SECRET = "s3cret-value";

function request(authorization?: string) {
  return new Request("http://localhost/api/cron/reconcile", {
    headers: authorization ? { authorization } : {},
  });
}

describe("isAuthorizedCronRequest", () => {
  it("accepts the secret sent as a bearer token", () => {
    expect(isAuthorizedCronRequest(request(`Bearer ${SECRET}`), SECRET)).toBe(
      true,
    );
  });

  it("rejects a request without the header", () => {
    expect(isAuthorizedCronRequest(request(), SECRET)).toBe(false);
  });

  it("rejects a wrong secret, including one of a different length", () => {
    expect(
      isAuthorizedCronRequest(request("Bearer s3cret-valuX"), SECRET),
    ).toBe(false);
    expect(isAuthorizedCronRequest(request("Bearer s3cret"), SECRET)).toBe(
      false,
    );
    expect(isAuthorizedCronRequest(request(SECRET), SECRET)).toBe(false);
  });
});

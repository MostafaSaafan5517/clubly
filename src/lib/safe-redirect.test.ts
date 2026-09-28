import { describe, expect, it } from "vitest";
import { safeRedirectPath } from "@/lib/safe-redirect";

describe("safeRedirectPath", () => {
  it("keeps paths on this site", () => {
    expect(safeRedirectPath("/dashboard", "/")).toBe("/dashboard");
    expect(safeRedirectPath("/b/iron-gym?tab=plans", "/")).toBe(
      "/b/iron-gym?tab=plans",
    );
  });

  it("falls back when there is no path", () => {
    expect(safeRedirectPath(null, "/dashboard")).toBe("/dashboard");
    expect(safeRedirectPath(undefined, "/dashboard")).toBe("/dashboard");
    expect(safeRedirectPath("", "/dashboard")).toBe("/dashboard");
  });

  it("rejects links to other sites", () => {
    expect(safeRedirectPath("https://evil.example", "/dashboard")).toBe(
      "/dashboard",
    );
    expect(safeRedirectPath("//evil.example", "/dashboard")).toBe("/dashboard");
    expect(safeRedirectPath("/\\evil.example", "/dashboard")).toBe(
      "/dashboard",
    );
    expect(safeRedirectPath("javascript:alert(1)", "/dashboard")).toBe(
      "/dashboard",
    );
  });
});

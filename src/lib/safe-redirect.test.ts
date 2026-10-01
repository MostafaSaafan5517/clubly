import { describe, expect, it } from "vitest";
import { safeRedirectFromUrl, safeRedirectPath } from "@/lib/safe-redirect";

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

describe("safeRedirectFromUrl", () => {
  const origin = "http://localhost:3000";

  it("keeps full URLs on this site, as a path", () => {
    expect(
      safeRedirectFromUrl(
        "http://localhost:3000/b/iron-gym",
        origin,
        "/dashboard",
      ),
    ).toBe("/b/iron-gym");
    expect(safeRedirectFromUrl("/b/iron-gym?x=1", origin, "/dashboard")).toBe(
      "/b/iron-gym?x=1",
    );
  });

  it("treats the bare site root (Supabase's default) as no preference", () => {
    expect(
      safeRedirectFromUrl("http://localhost:3000", origin, "/dashboard"),
    ).toBe("/dashboard");
    expect(
      safeRedirectFromUrl("http://localhost:3000/", origin, "/dashboard"),
    ).toBe("/dashboard");
  });

  it("rejects other sites and things that aren't URLs", () => {
    expect(
      safeRedirectFromUrl(
        "https://evil.example/b/iron-gym",
        origin,
        "/dashboard",
      ),
    ).toBe("/dashboard");
    expect(safeRedirectFromUrl("//evil.example", origin, "/dashboard")).toBe(
      "/dashboard",
    );
    expect(safeRedirectFromUrl("http://[::1", origin, "/dashboard")).toBe(
      "/dashboard",
    );
    expect(safeRedirectFromUrl(null, origin, "/dashboard")).toBe("/dashboard");
  });
});

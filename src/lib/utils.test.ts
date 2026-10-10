import { readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { build } from "cn/build";
import { describe, expect, it } from "vitest";
import { cn } from "@/lib/utils";

// cn settles class conflicts with tables that know the design system's own utilities, so a size
// from the type scale and a text color survive side by side.

describe("cn", () => {
  it("uses tables built from the current theme (run `pnpm tokens` after changing it)", async () => {
    const { source } = await build({
      css: "src/app/globals.css",
      full: true,
      out: path.join(tmpdir(), "ds-cn-check", "cn-tables.ts"),
    });
    expect(readFileSync("src/lib/cn-tables.ts", "utf8")).toBe(source);
  });

  it("keeps a type-scale size beside a text color", () => {
    // Without the theme's tables, the size counted as a color and replaced it.
    for (const pair of [
      ["text-body", "text-primary-foreground"],
      ["text-caption", "text-muted-foreground"],
      ["text-figure-xl", "text-ink"],
      ["text-label", "text-on-band-2"],
    ]) {
      expect(
        cn(...pair)
          .split(" ")
          .sort(),
      ).toEqual([...pair].sort());
    }
    expect(cn("text-xs", "text-caption")).toBe("text-caption");
  });

  it("lets the design system's sizes, radii and shadows replace Tailwind's", () => {
    expect(cn("text-sm", "text-small")).toBe("text-small");
    expect(cn("rounded-lg", "rounded-control")).toBe("rounded-control");
    expect(cn("rounded-xl", "rounded-surface")).toBe("rounded-surface");
    expect(cn("shadow-xs", "shadow-level-1")).toBe("shadow-level-1");
  });
});

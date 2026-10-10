import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  contrast,
  isColor,
  oklchToRgb,
  readTokenBlocks,
  tokensCssPath,
  tokensJson,
  tokensJsonPath,
} from "../../scripts/design-tokens.mjs";

// The design tokens (src/styles/tokens.css) stay consistent with themselves, with the exported
// JSON, with sRGB, and with WCAG AA: changing a color that breaks a pair fails here.

const css = readFileSync(tokensCssPath, "utf8");
const { light, darkMedia, darkClass } = readTokenBlocks(css);

/** Text and interface pairs the components use, with the contrast each needs. */
const pairs: [foreground: string, background: string, needs: number][] = [
  ["ink", "bg", 4.5],
  ["ink", "surface", 4.5],
  ["ink", "surface-2", 4.5],
  ["ink", "surface-3", 4.5],
  ["ink-2", "bg", 4.5],
  ["ink-2", "surface", 4.5],
  ["ink-2", "surface-2", 4.5],
  ["ink-3", "bg", 4.5],
  ["ink-3", "surface", 4.5],
  ["ink-3", "surface-2", 4.5],
  // Volt is a fill under ink, never text on a light surface.
  ["on-volt", "volt", 4.5],
  ["on-volt", "volt-strong", 4.5],
  ["ink", "volt-soft", 4.5],
  ["on-band", "band", 4.5],
  ["on-band", "band-2", 4.5],
  ["on-band-2", "band", 4.5],
  ["on-band-2", "band-2", 4.5],
  // Badges: the tone's color on its soft fill. Notices: ink on the soft fill.
  ["success", "success-soft", 4.5],
  ["warning", "warning-soft", 4.5],
  ["danger", "danger-soft", 4.5],
  ["info", "info-soft", 4.5],
  ["ink", "success-soft", 4.5],
  ["ink", "warning-soft", 4.5],
  ["ink", "danger-soft", 4.5],
  ["ink", "info-soft", 4.5],
  // Inline errors and quiet danger buttons sit on surfaces and the page.
  ["danger", "surface", 4.5],
  ["danger", "bg", 4.5],
  ["success", "surface", 4.5],
  ["on-danger", "danger", 4.5],
  // Field edges, the focus outline and the current tab's bar are interface parts: 3:1.
  ["line-input", "surface", 3],
  ["line-input", "bg", 3],
  ["focus", "bg", 3],
  ["focus", "surface", 3],
  ["volt", "band", 3],
];

describe("design tokens", () => {
  it("writes the same dark values for the device setting and for .ds-dark", () => {
    expect(darkClass).toEqual(darkMedia);
  });

  it("gives every light color and shadow a dark value", () => {
    expect(Object.keys(darkMedia).sort()).toEqual(Object.keys(light).sort());
  });

  it("are exported to docs/design/tokens.json (run `pnpm tokens` after changing them)", () => {
    expect(JSON.parse(readFileSync(tokensJsonPath, "utf8"))).toEqual(
      tokensJson(css),
    );
  });

  it("are all colors a screen can show (inside sRGB)", () => {
    const outside = [
      ...Object.entries(light).map(([name, value]) => [`light ${name}`, value]),
      ...Object.entries(darkMedia).map(([name, value]) => [
        `dark ${name}`,
        value,
      ]),
    ]
      .filter(([, value]) => isColor(value!))
      .filter(([, value]) => !oklchToRgb(value!).inGamut)
      .map(([name]) => name);
    expect(outside).toEqual([]);
  });

  describe.each([
    ["light", light],
    ["dark", darkMedia],
  ])("%s colors meet WCAG AA", (_mode, tokens) => {
    it.each(pairs)("%s on %s reaches %s:1", (foreground, background, needs) => {
      const [front, back] = [tokens[foreground], tokens[background]];
      if (!front || !back) {
        throw new Error(`Missing ${foreground} or ${background}`);
      }
      expect(contrast(front, back)).toBeGreaterThanOrEqual(needs);
    });
  });
});

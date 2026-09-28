import { describe, expect, it } from "vitest";
import { MAX_SLUG_LENGTH, slugify } from "@/lib/slug";

describe("slugify", () => {
  it("joins words with dashes", () => {
    expect(slugify("Iron Gym Downtown")).toBe("iron-gym-downtown");
  });

  it("drops accents and punctuation", () => {
    expect(slugify("Café Élan & Co.")).toBe("cafe-elan-co");
  });

  it("never starts or ends with a dash, or doubles one", () => {
    expect(slugify("  --Yoga   Loft!!  ")).toBe("yoga-loft");
  });

  it("keeps digits", () => {
    expect(slugify("24/7 Fitness")).toBe("24-7-fitness");
  });

  it("stays within the length the database allows", () => {
    const slug = slugify("word ".repeat(30));
    expect(slug.length).toBeLessThanOrEqual(MAX_SLUG_LENGTH);
    expect(slug.endsWith("-")).toBe(false);
  });

  it("returns an empty string when nothing is usable", () => {
    expect(slugify("!!!")).toBe("");
  });
});

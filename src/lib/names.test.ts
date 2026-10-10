import { describe, expect, it } from "vitest";
import { initials } from "@/lib/names";

describe("initials", () => {
  it("takes the first letter of the first two words, in capitals", () => {
    expect(initials("Olive Owner")).toBe("OO");
    expect(initials("mona van der member")).toBe("MV");
  });

  it("works for one word and for an email used as the name", () => {
    expect(initials("Cher")).toBe("C");
    expect(initials("sam@example.com")).toBe("S");
  });

  it("ignores extra spaces", () => {
    expect(initials("  Ada   Lovelace ")).toBe("AL");
    expect(initials("   ")).toBe("");
  });
});

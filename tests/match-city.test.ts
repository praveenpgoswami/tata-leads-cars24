/**
 * Tests for city mapping (lib/cities/match-city.ts), including aliases.
 */
import { describe, expect, it } from "vitest";
import { CITY_ALIASES } from "@/config/city-aliases";
import { ACTIVE_CITIES } from "@/lib/cities/active-cities.generated";
import { createCityMatcher, matchCity, normalizeCityKey } from "@/lib/cities/match-city";

describe("normalizeCityKey", () => {
  it("trims, lower-cases and collapses whitespace to hyphens", () => {
    expect(normalizeCityKey("  New   Delhi ")).toBe("new-delhi");
    expect(normalizeCityKey("NAVI_MUMBAI")).toBe("navi-mumbai");
    expect(normalizeCityKey("new--delhi")).toBe("new-delhi");
    expect(normalizeCityKey("   ")).toBe("");
  });
});

describe("matchCity", () => {
  it("matches the slugs from the sample sheet", () => {
    for (const slug of ["new-delhi", "gurgaon", "udaipur", "vellore"]) {
      expect(matchCity(slug)?.slug).toBe(slug);
    }
  });

  it("matches names case-insensitively with messy whitespace", () => {
    expect(matchCity("  new   DELHI ")).toEqual({ name: "New Delhi", slug: "new-delhi", method: "slug" });
    expect(matchCity("Navi Mumbai")?.slug).toBe("navi-mumbai");
  });

  it("resolves aliases to canonical cities", () => {
    expect(matchCity("Bengaluru")).toEqual({ name: "Bangalore", slug: "bangalore", method: "alias" });
    expect(matchCity("gurugram")?.slug).toBe("gurgaon");
    expect(matchCity("Delhi")?.slug).toBe("new-delhi");
    expect(matchCity(" BOMBAY ")?.slug).toBe("mumbai");
    expect(matchCity("Poona")?.slug).toBe("pune");
  });

  it("returns null for unknown or empty cities", () => {
    expect(matchCity("Atlantis")).toBeNull();
    expect(matchCity("")).toBeNull();
  });

  it("only maps alias keys to slugs that exist in the active list", () => {
    const slugs = new Set(ACTIVE_CITIES.map((city) => city.slug));
    const broken = Object.entries(CITY_ALIASES).filter(([, slug]) => !slugs.has(slug));
    expect(broken).toEqual([]);
  });

  it("ignores aliases whose target is not an active city", () => {
    const matcher = createCityMatcher([{ id: 1, name: "Pune", slug: "pune" }], { poona: "pune", bombay: "mumbai" });
    expect(matcher("poona")?.slug).toBe("pune");
    expect(matcher("bombay")).toBeNull();
  });
});

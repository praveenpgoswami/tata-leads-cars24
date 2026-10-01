/**
 * Maps a free-text city from Excel to a canonical active city.
 *
 * Exports:
 * - `CityMatch`: a matched city plus how it was matched.
 * - `normalizeCityKey()`: canonical comparison key for city text.
 * - `createCityMatcher()`: builds a matcher from a city list and an alias map.
 * - `matchCity()`: the default matcher (generated city list + `config/city-aliases.ts`).
 *
 * Notes: The match order is exact slug, then city name, then alias. Matching is
 * case-insensitive and ignores surrounding and repeated whitespace.
 */
import { CITY_ALIASES } from "@/config/city-aliases";
import { ACTIVE_CITIES, type ActiveCity } from "./active-cities.generated";

export type CityMatchMethod = "slug" | "name" | "alias";

export interface CityMatch {
  readonly name: string;
  readonly slug: string;
  readonly method: CityMatchMethod;
}

/**
 * Normalises city text: trim, lower-case, collapse whitespace, then spaces,
 * underscores and repeated hyphens become single hyphens.
 * @example normalizeCityKey("  New   Delhi ") === "new-delhi"
 */
export function normalizeCityKey(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * Creates a city matcher.
 * @param cities canonical active cities.
 * @param aliases alias → canonical slug. Aliases with an unknown target are ignored.
 * @returns a function that returns the match, or null when the city is unmapped.
 */
export function createCityMatcher(
  cities: readonly ActiveCity[],
  aliases: Readonly<Record<string, string>>,
): (input: string) => CityMatch | null {
  const bySlug = new Map<string, ActiveCity>();
  const byName = new Map<string, ActiveCity>();
  for (const city of cities) {
    bySlug.set(city.slug, city);
    byName.set(normalizeCityKey(city.name), city);
  }
  const byAlias = new Map<string, ActiveCity>();
  for (const [alias, slug] of Object.entries(aliases)) {
    const target = bySlug.get(slug);
    if (target) {
      byAlias.set(normalizeCityKey(alias), target);
    }
  }

  return (input: string): CityMatch | null => {
    const key = normalizeCityKey(input);
    if (!key) {
      return null;
    }
    const lookups: ReadonlyArray<[CityMatchMethod, Map<string, ActiveCity>]> = [
      ["slug", bySlug],
      ["name", byName],
      ["alias", byAlias],
    ];
    for (const [method, map] of lookups) {
      const city = map.get(key);
      if (city) {
        return { name: city.name, slug: city.slug, method };
      }
    }
    return null;
  };
}

/** Default matcher over the generated active-city list and the editable alias map. */
export const matchCity = createCityMatcher(ACTIVE_CITIES, CITY_ALIASES);

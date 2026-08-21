import { describe, it, expect } from "vitest";
import {
  formatRentRange,
  deckOrder,
  placeKindLabel,
  personalizedDeck,
  hasSearchPrefs,
  matchedTagLabels,
  type Place,
  type SearchPrefs,
} from "./places";

describe("formatRentRange", () => {
  it("formats a range with an en dash", () => {
    expect(formatRentRange(900, 1400)).toBe("$900\u2013$1,400/mo");
  });
  it("formats a single value when only min is given", () => {
    expect(formatRentRange(1200, null)).toBe("$1,200/mo");
  });
  it("formats a single value when min equals max", () => {
    expect(formatRentRange(1200, 1200)).toBe("$1,200/mo");
  });
  it("formats 'Rent varies' when both are null", () => {
    expect(formatRentRange(null, null)).toBe("Rent varies");
  });
});

function place(overrides: Partial<Place>): Place {
  return {
    id: "id",
    name: "name",
    kind: "complex",
    city: null,
    neighborhood: null,
    address: null,
    rent_min: null,
    rent_max: null,
    photos: null,
    website: null,
    curated: false,
    sponsored: false,
    created_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

describe("placeKindLabel", () => {
  it("maps each kind to a human-readable label", () => {
    expect(placeKindLabel("complex")).toBe("Complex");
    expect(placeKindLabel("building")).toBe("Building");
    expect(placeKindLabel("house")).toBe("House");
    expect(placeKindLabel("other")).toBe("Other");
  });
});

describe("deckOrder", () => {
  it("puts curated places before non-curated places", () => {
    const a = place({ id: "a", curated: false, created_at: "2026-01-03T00:00:00Z" });
    const b = place({ id: "b", curated: true, created_at: "2026-01-01T00:00:00Z" });
    const result = deckOrder([a, b]);
    expect(result.map((p) => p.id)).toEqual(["b", "a"]);
  });

  it("orders newest first within a curated/non-curated group", () => {
    const older = place({ id: "older", curated: true, created_at: "2026-01-01T00:00:00Z" });
    const newer = place({ id: "newer", curated: true, created_at: "2026-01-05T00:00:00Z" });
    const result = deckOrder([older, newer]);
    expect(result.map((p) => p.id)).toEqual(["newer", "older"]);
  });

  it("does not mutate the input array", () => {
    const a = place({ id: "a", curated: false, created_at: "2026-01-01T00:00:00Z" });
    const b = place({ id: "b", curated: true, created_at: "2026-01-02T00:00:00Z" });
    const input = [a, b];
    deckOrder(input);
    expect(input).toEqual([a, b]);
  });
});

const NO_PREFS: SearchPrefs = { budget_min: null, budget_max: null, pref_areas: null, pref_tags: null };

describe("personalizedDeck", () => {
  it("passes everything through when no prefs are set", () => {
    const a = place({ id: "a" });
    const b = place({ id: "b" });
    expect(personalizedDeck([a, b], NO_PREFS)).toHaveLength(2);
  });

  it("filters out places whose rent cannot overlap the budget", () => {
    const cheap = place({ id: "cheap", rent_min: 700, rent_max: 1000 });
    const pricey = place({ id: "pricey", rent_min: 2000, rent_max: 2600 });
    const unknown = place({ id: "unknown" }); // no rent listed: kept
    const out = personalizedDeck([cheap, pricey, unknown], { ...NO_PREFS, budget_min: 800, budget_max: 1200 });
    expect(out.map((p) => p.id).sort()).toEqual(["cheap", "unknown"]);
  });

  it("hard-filters by chosen areas", () => {
    const hyde = place({ id: "hyde", neighborhood: "Hyde Park" });
    const zilker = place({ id: "zilker", neighborhood: "Zilker" });
    const out = personalizedDeck([hyde, zilker], { ...NO_PREFS, pref_areas: ["Hyde Park"] });
    expect(out.map((p) => p.id)).toEqual(["hyde"]);
  });

  it("ranks places with more wanted amenities first", () => {
    const two = place({ id: "two", tags: ["gym", "coffee"] });
    const none = place({ id: "none", tags: ["nightlife"] });
    const one = place({ id: "one", tags: ["gym"] });
    const out = personalizedDeck([none, one, two], { ...NO_PREFS, pref_tags: ["gym", "coffee"] });
    expect(out.map((p) => p.id)).toEqual(["two", "one", "none"]);
  });
});

describe("hasSearchPrefs", () => {
  it("is false for empty prefs and true once anything is set", () => {
    expect(hasSearchPrefs(NO_PREFS)).toBe(false);
    expect(hasSearchPrefs({ ...NO_PREFS, budget_max: 1200 })).toBe(true);
    expect(hasSearchPrefs({ ...NO_PREFS, pref_areas: ["Zilker"] })).toBe(true);
    expect(hasSearchPrefs({ ...NO_PREFS, pref_tags: ["gym"] })).toBe(true);
  });
});

describe("matchedTagLabels", () => {
  it("returns labels only for wanted tags the place has", () => {
    const p = place({ id: "p", tags: ["gym", "quiet", "coffee"] });
    expect(matchedTagLabels(p, ["gym", "coffee", "parks"])).toEqual(["Gym", "Coffee shops"]);
    expect(matchedTagLabels(p, null)).toEqual([]);
  });
});

import { describe, it, expect } from "vitest";
import { formatRentRange, deckOrder, type Place } from "./places";

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

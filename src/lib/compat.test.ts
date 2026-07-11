import { describe, it, expect } from "vitest";
import { compatibility, reasons, headline, type CompatProfile } from "./compat";

function profile(overrides: Partial<CompatProfile>): CompatProfile {
  return {
    id: "id",
    full_name: "Name",
    age: 25,
    city: "Austin, TX",
    bio: null,
    avatar_url: null,
    photos: null,
    budget_min: 1000,
    budget_max: 1500,
    cleanliness: 3,
    sleep_schedule: "flexible",
    smoking: false,
    pets: false,
    guests: "sometimes",
    email_verified: true,
    verification_status: "verified",
    ...overrides,
  };
}

describe("compatibility", () => {
  it("stays within 0 and 100", () => {
    const me = profile({});
    const them = profile({ id: "them" });
    const score = compatibility(me, them);
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
  });

  it("scores identical lifestyle profiles higher than opposite ones", () => {
    const me = profile({
      cleanliness: 5,
      sleep_schedule: "early_bird",
      smoking: false,
      pets: true,
      guests: "rarely",
      budget_min: 1000,
      budget_max: 1200,
    });
    const same = profile({
      id: "same",
      cleanliness: 5,
      sleep_schedule: "early_bird",
      smoking: false,
      pets: true,
      guests: "rarely",
      budget_min: 1000,
      budget_max: 1200,
    });
    const opposite = profile({
      id: "opposite",
      cleanliness: 1,
      sleep_schedule: "night_owl",
      smoking: true,
      pets: false,
      guests: "often",
      budget_min: 3000,
      budget_max: 4000,
    });
    expect(compatibility(me, same)).toBeGreaterThan(compatibility(me, opposite));
  });
});

describe("headline", () => {
  it("returns the first good reason when one exists", () => {
    const why = [
      { good: false, text: "bad thing" },
      { good: true, text: "good thing" },
    ];
    expect(headline(80, why)).toBe("good thing");
  });

  it("falls back to a score summary when no reason is good", () => {
    const why = [{ good: false, text: "bad thing" }];
    expect(headline(42, why)).toBe("42% match");
  });
});

describe("reasons", () => {
  it("returns at most 4 reasons", () => {
    const me = profile({});
    const them = profile({ id: "them" });
    expect(reasons(me, them).length).toBeLessThanOrEqual(4);
  });
});

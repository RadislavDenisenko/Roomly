import { describe, it, expect } from "vitest";
import { compatibility, reasons, headline, passesDealbreakers, scoreTier, axisScores, type CompatProfile } from "./compat";

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
  it("returns at most 5 reasons", () => {
    const me = profile({});
    const them = profile({ id: "them" });
    expect(reasons(me, them).length).toBeLessThanOrEqual(5);
  });

  it("surfaces warnings before matches", () => {
    const me = profile({ smoking: false, dishes: "now" });
    const them = profile({ id: "them", smoking: true, dishes: "eventually" });
    const r = reasons(me, them);
    const firstGood = r.findIndex((x) => x.good);
    const lastBad = r.map((x) => x.good).lastIndexOf(false);
    if (firstGood !== -1 && lastBad !== -1) expect(lastBad).toBeLessThan(firstGood);
  });
});

describe("axisScores", () => {
  it("scores answered axes and nulls unanswered ones", () => {
    const me = profile({ dishes: "now" });
    const them = profile({ id: "them", dishes: "same_day" });
    const axes = axisScores(me, them);
    expect(axes.find((a) => a.label === "Dishes")?.sim).toBe(0.8);
    expect(axes.find((a) => a.label === "Fridge rules")?.sim).toBeNull(); // neither answered
    expect(axes.find((a) => a.label === "Budget")?.sim).toBe(1); // same range overlaps
  });
});

describe("scoreTier", () => {
  it("labels every score band", () => {
    expect(scoreTier(100)).toBe("Great fit");
    expect(scoreTier(80)).toBe("Great fit");
    expect(scoreTier(79)).toBe("Solid fit");
    expect(scoreTier(65)).toBe("Solid fit");
    expect(scoreTier(64)).toBe("Mixed fit");
    expect(scoreTier(45)).toBe("Mixed fit");
    expect(scoreTier(44)).toBe("Long shot");
    expect(scoreTier(0)).toBe("Long shot");
  });
});

describe("awkward-question axes", () => {
  it("scores identical answers at 100", () => {
    const me = profile({
      dishes: "now", food_sharing: "ask", chores: "rota",
      weekend_style: "home", home_noise: "quiet", overnight_guests: "weekends",
    });
    const them = { ...me, id: "them" };
    expect(compatibility(me, them)).toBe(100);
  });

  it("is forgiving of adjacent answers (not too strict)", () => {
    const me = profile({
      cleanliness: 4, sleep_schedule: "flexible", dishes: "now",
      food_sharing: "share", chores: "rota", weekend_style: "host",
      home_noise: "speakers", overnight_guests: "never",
    });
    const adjacent = profile({
      id: "them", cleanliness: 3, sleep_schedule: "early_bird", dishes: "same_day",
      food_sharing: "ask", chores: "whoever", weekend_style: "out",
      home_noise: "headphones", overnight_guests: "weekends",
    });
    expect(compatibility(me, adjacent)).toBeGreaterThanOrEqual(70);
  });

  it("punishes big gaps more than small ones", () => {
    const me = profile({ dishes: "now" });
    const near = profile({ id: "near", dishes: "same_day" });
    const far = profile({ id: "far", dishes: "eventually" });
    expect(compatibility(me, near)).toBeGreaterThan(compatibility(me, far));
  });

  it("hard-filters dealbreakers regardless of score", () => {
    const me = { ...profile({}), db_nonsmokers_only: true };
    expect(passesDealbreakers(me, profile({ id: "s", smoking: true }))).toBe(false);
    expect(passesDealbreakers(me, profile({ id: "n", smoking: false }))).toBe(true);
    const noPets = { ...profile({}), db_no_pet_owners: true };
    expect(passesDealbreakers(noPets, profile({ id: "p", pets: true }))).toBe(false);
    const budgetOnly = { ...profile({ budget_min: 500, budget_max: 700 }), db_budget_overlap_only: true };
    expect(passesDealbreakers(budgetOnly, profile({ id: "b", budget_min: 2000, budget_max: 3000 }))).toBe(false);
  });

  it("treats unanswered questions as neutral, not as zero", () => {
    const me = profile({ dishes: "now", food_sharing: "share" });
    const unanswered = profile({ id: "u" }); // all new axes undefined
    const opposite = profile({ id: "o", dishes: "eventually", food_sharing: "separate" });
    expect(compatibility(me, unanswered)).toBeGreaterThan(compatibility(me, opposite));
  });
});

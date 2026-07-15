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

  it("scores fully identical profiles, including every optional factor, at exactly 100", () => {
    const shared: Partial<CompatProfile> = {
      cleanliness: 4,
      sleep_schedule: "early_bird",
      smoking: false,
      pets: true,
      guests: "sometimes",
      budget_min: 1000,
      budget_max: 1500,
      city: "Austin, TX",
      work_schedule: "day",
      roommates_wanted: 2,
      overnight_guests: "sometimes",
      noise_level: 3,
    };
    const me = profile({ ...shared });
    const them = profile({ ...shared, id: "them" });
    expect(compatibility(me, them)).toBe(100);
  });

  it("keeps the pets mismatch floor small instead of zero (new weight ~3)", () => {
    const me = profile({ pets: true });
    const them = profile({ id: "them", pets: false });
    // base-7 baseline (see neutrality test) is 80; pets equal contributes 8 of that,
    // so a mismatch drops it to a 3-point floor: 80 - 8 + 3 = 75.
    expect(compatibility(me, them)).toBe(75);
  });

  describe("optional-factor neutrality", () => {
    const base: Partial<CompatProfile> = {
      cleanliness: 4,
      sleep_schedule: "early_bird",
      smoking: false,
      pets: true,
      guests: "sometimes",
      budget_min: 1000,
      budget_max: 1500,
      city: "Austin, TX",
    };

    it("unset optional factors contribute zero (baseline = the 7 original weighted factors only)", () => {
      const me = profile({
        ...base,
        work_schedule: null,
        roommates_wanted: null,
        overnight_guests: null,
        noise_level: null,
      });
      const them = profile({
        ...base,
        id: "them",
        work_schedule: null,
        roommates_wanted: null,
        overnight_guests: null,
        noise_level: null,
      });
      expect(compatibility(me, them)).toBe(80);
    });

    it("maximally mismatched-but-set optional factors also contribute zero, same as unset", () => {
      const me = profile({
        ...base,
        work_schedule: "day",
        roommates_wanted: 1,
        overnight_guests: "rarely",
        noise_level: 1,
      });
      const them = profile({
        ...base,
        id: "them",
        work_schedule: "night",
        roommates_wanted: 3,
        overnight_guests: "often",
        noise_level: 5,
      });
      expect(compatibility(me, them)).toBe(80);
    });
  });

  describe("work_schedule factor (weight 8)", () => {
    it("equal schedules add the full 8 points", () => {
      const me = profile({ work_schedule: "day" });
      const them = profile({ id: "them", work_schedule: "day" });
      expect(compatibility(me, them)).toBe(88);
    });

    it("either side being flexible adds half (4) points", () => {
      const me = profile({ work_schedule: "day" });
      const them = profile({ id: "them", work_schedule: "flexible" });
      expect(compatibility(me, them)).toBe(84);
    });

    it("mismatched non-flexible schedules add 0", () => {
      const me = profile({ work_schedule: "day" });
      const them = profile({ id: "them", work_schedule: "night" });
      expect(compatibility(me, them)).toBe(80);
    });
  });

  describe("roommates_wanted factor (weight 6)", () => {
    it("equal count adds the full 6 points", () => {
      const me = profile({ roommates_wanted: 2 });
      const them = profile({ id: "them", roommates_wanted: 2 });
      expect(compatibility(me, them)).toBe(86);
    });

    it("off-by-one adds half (3) points", () => {
      const me = profile({ roommates_wanted: 1 });
      const them = profile({ id: "them", roommates_wanted: 2 });
      expect(compatibility(me, them)).toBe(83);
    });

    it("off by two or more adds 0", () => {
      const me = profile({ roommates_wanted: 1 });
      const them = profile({ id: "them", roommates_wanted: 3 });
      expect(compatibility(me, them)).toBe(80);
    });
  });

  describe("overnight_guests factor (weight 3, only when both set)", () => {
    it("matching values add the full 3 points", () => {
      const me = profile({ overnight_guests: "sometimes" });
      const them = profile({ id: "them", overnight_guests: "sometimes" });
      expect(compatibility(me, them)).toBe(83);
    });

    it("is skipped (adds 0) when only one side has set it", () => {
      const me = profile({ overnight_guests: "sometimes" });
      const them = profile({ id: "them", overnight_guests: null });
      expect(compatibility(me, them)).toBe(80);
    });
  });

  describe("noise_level factor (weight 3, only when both set)", () => {
    it("matching values add the full 3 points", () => {
      const me = profile({ noise_level: 3 });
      const them = profile({ id: "them", noise_level: 3 });
      expect(compatibility(me, them)).toBe(83);
    });

    it("is skipped (adds 0) when only one side has set it", () => {
      const me = profile({ noise_level: 3 });
      const them = profile({ id: "them", noise_level: null });
      expect(compatibility(me, them)).toBe(80);
    });
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

  it("includes a good work-schedule line when both sides match", () => {
    const me = profile({ work_schedule: "day" });
    const them = profile({ id: "them", work_schedule: "day" });
    expect(reasons(me, them)).toContainEqual({ good: true, text: "Both work days" });
  });

  it("includes a bad work-schedule line when schedules mismatch", () => {
    const me = profile({ work_schedule: "day" });
    const them = profile({ id: "them", work_schedule: "night" });
    expect(reasons(me, them)).toContainEqual({
      good: false,
      text: "You work days, they work nights",
    });
  });

  it("uses 'work from home' phrasing for wfh", () => {
    const me = profile({ work_schedule: "wfh" });
    const them = profile({ id: "them", work_schedule: "day" });
    expect(reasons(me, them)).toContainEqual({
      good: false,
      text: "You work from home, they work days",
    });
  });

  it("omits the work-schedule line when either side has not set it", () => {
    const me = profile({ work_schedule: "day" });
    const them = profile({ id: "them", work_schedule: null });
    expect(reasons(me, them).some((r) => r.text.toLowerCase().includes("work"))).toBe(false);
  });

  it("includes a good overnight-guests line when both sides match", () => {
    const me = profile({ overnight_guests: "sometimes" });
    const them = profile({ id: "them", overnight_guests: "sometimes" });
    expect(reasons(me, them)).toContainEqual({
      good: true,
      text: "Both sometimes have overnight guests",
    });
  });

  it("includes a bad overnight-guests line when values mismatch", () => {
    const me = profile({ overnight_guests: "rarely" });
    const them = profile({ id: "them", overnight_guests: "often" });
    expect(reasons(me, them)).toContainEqual({
      good: false,
      text: "Different overnight-guest habits",
    });
  });

  it("omits the overnight-guests line when either side has not set it", () => {
    const me = profile({ overnight_guests: "sometimes" });
    const them = profile({ id: "them", overnight_guests: null });
    expect(reasons(me, them).some((r) => r.text.toLowerCase().includes("overnight"))).toBe(false);
  });
});

import { describe, it, expect } from "vitest";
import {
  REQUIRED_PROFILE_FIELDS,
  isProfileComplete,
  missingProfileFields,
} from "./completeness";
import { isMissingColumn } from "./listings";

describe("REQUIRED_PROFILE_FIELDS", () => {
  it("contains exactly 14 fields in the correct order", () => {
    expect(REQUIRED_PROFILE_FIELDS).toHaveLength(14);
    expect(REQUIRED_PROFILE_FIELDS.map((f) => f.key)).toEqual([
      "full_name",
      "age",
      "city",
      "gender",
      "roommate_gender_pref",
      "budget_min",
      "budget_max",
      "roommates_wanted",
      "work_schedule",
      "cleanliness",
      "sleep_schedule",
      "smoking",
      "pets",
      "guests",
    ]);
  });

  it("each field has a key and a label", () => {
    REQUIRED_PROFILE_FIELDS.forEach((field) => {
      expect(field.key).toBeDefined();
      expect(field.label).toBeDefined();
      expect(typeof field.key).toBe("string");
      expect(typeof field.label).toBe("string");
      expect(field.key.length).toBeGreaterThan(0);
      expect(field.label.length).toBeGreaterThan(0);
    });
  });
});

describe("isProfileComplete", () => {
  it("returns false for null profile", () => {
    expect(isProfileComplete(null)).toBe(false);
  });

  it("returns false for undefined profile", () => {
    expect(isProfileComplete(undefined as unknown as Record<string, unknown>)).toBe(false);
  });

  it("returns true when all 14 required fields are filled", () => {
    const profile = {
      full_name: "Alice",
      age: 28,
      city: "Austin",
      gender: "female",
      roommate_gender_pref: "any",
      budget_min: 800,
      budget_max: 1200,
      roommates_wanted: 2,
      work_schedule: "9-5",
      cleanliness: 8,
      sleep_schedule: "early_bird",
      smoking: false,
      pets: true,
      guests: true,
    };
    expect(isProfileComplete(profile)).toBe(true);
  });

  it("treats boolean false as filled", () => {
    const profile = {
      full_name: "Alice",
      age: 28,
      city: "Austin",
      gender: "female",
      roommate_gender_pref: "any",
      budget_min: 800,
      budget_max: 1200,
      roommates_wanted: 2,
      work_schedule: "9-5",
      cleanliness: 8,
      sleep_schedule: "early_bird",
      smoking: false, // false is filled
      pets: false, // false is filled
      guests: false, // false is filled
    };
    expect(isProfileComplete(profile)).toBe(true);
  });

  it("returns false when a string field is empty", () => {
    const profile = {
      full_name: "", // empty string is NOT filled
      age: 28,
      city: "Austin",
      gender: "female",
      roommate_gender_pref: "any",
      budget_min: 800,
      budget_max: 1200,
      roommates_wanted: 2,
      work_schedule: "9-5",
      cleanliness: 8,
      sleep_schedule: "early_bird",
      smoking: false,
      pets: true,
      guests: true,
    };
    expect(isProfileComplete(profile)).toBe(false);
  });

  it("returns false when a string field is whitespace-only", () => {
    const profile = {
      full_name: "   ", // whitespace-only string is NOT filled
      age: 28,
      city: "Austin",
      gender: "female",
      roommate_gender_pref: "any",
      budget_min: 800,
      budget_max: 1200,
      roommates_wanted: 2,
      work_schedule: "9-5",
      cleanliness: 8,
      sleep_schedule: "early_bird",
      smoking: false,
      pets: true,
      guests: true,
    };
    expect(isProfileComplete(profile)).toBe(false);
  });

  it("returns false when a field is null", () => {
    const profile = {
      full_name: "Alice",
      age: null,
      city: "Austin",
      gender: "female",
      roommate_gender_pref: "any",
      budget_min: 800,
      budget_max: 1200,
      roommates_wanted: 2,
      work_schedule: "9-5",
      cleanliness: 8,
      sleep_schedule: "early_bird",
      smoking: false,
      pets: true,
      guests: true,
    };
    expect(isProfileComplete(profile)).toBe(false);
  });

  it("returns false when a field is missing", () => {
    const profile = {
      full_name: "Alice",
      age: 28,
      city: "Austin",
      gender: "female",
      roommate_gender_pref: "any",
      budget_min: 800,
      budget_max: 1200,
      roommates_wanted: 2,
      work_schedule: "9-5",
      cleanliness: 8,
      sleep_schedule: "early_bird",
      // smoking is missing
      pets: true,
      guests: true,
    };
    expect(isProfileComplete(profile)).toBe(false);
  });

  it("returns false when zero is treated as null (zero is filled)", () => {
    const profile = {
      full_name: "Alice",
      age: 0, // 0 != null, so it counts as filled
      city: "Austin",
      gender: "female",
      roommate_gender_pref: "any",
      budget_min: 800,
      budget_max: 1200,
      roommates_wanted: 2,
      work_schedule: "9-5",
      cleanliness: 8,
      sleep_schedule: "early_bird",
      smoking: false,
      pets: true,
      guests: true,
    };
    // 0 should be treated as filled since it != null
    expect(isProfileComplete(profile)).toBe(true);
  });
});

describe("missingProfileFields", () => {
  it("returns empty array when all fields are filled", () => {
    const profile = {
      full_name: "Alice",
      age: 28,
      city: "Austin",
      gender: "female",
      roommate_gender_pref: "any",
      budget_min: 800,
      budget_max: 1200,
      roommates_wanted: 2,
      work_schedule: "9-5",
      cleanliness: 8,
      sleep_schedule: "early_bird",
      smoking: false,
      pets: true,
      guests: true,
    };
    expect(missingProfileFields(profile)).toEqual([]);
  });

  it("returns all field labels when profile is null", () => {
    const result = missingProfileFields(null);
    expect(result).toHaveLength(14);
    // Should match REQUIRED_PROFILE_FIELDS order
    expect(result).toEqual(REQUIRED_PROFILE_FIELDS.map((f) => f.label));
  });

  it("returns missing field labels in REQUIRED_PROFILE_FIELDS order", () => {
    const profile = {
      full_name: null,
      age: 28,
      city: null,
      gender: "female",
      roommate_gender_pref: "any",
      budget_min: 800,
      budget_max: 1200,
      roommates_wanted: 2,
      work_schedule: "9-5",
      cleanliness: 8,
      sleep_schedule: "early_bird",
      smoking: false,
      pets: true,
      guests: true,
    };
    const result = missingProfileFields(profile);
    // full_name and city are missing, and should appear in their original order
    const fullNameLabel = REQUIRED_PROFILE_FIELDS.find((f) => f.key === "full_name")!.label;
    const cityLabel = REQUIRED_PROFILE_FIELDS.find((f) => f.key === "city")!.label;
    expect(result).toEqual([fullNameLabel, cityLabel]);
  });

  it("detects empty strings as missing", () => {
    const profile = {
      full_name: "",
      age: 28,
      city: "Austin",
      gender: "female",
      roommate_gender_pref: "any",
      budget_min: 800,
      budget_max: 1200,
      roommates_wanted: 2,
      work_schedule: "9-5",
      cleanliness: 8,
      sleep_schedule: "early_bird",
      smoking: false,
      pets: true,
      guests: true,
    };
    const result = missingProfileFields(profile);
    const fullNameLabel = REQUIRED_PROFILE_FIELDS.find((f) => f.key === "full_name")!.label;
    expect(result).toContain(fullNameLabel);
  });

  it("detects whitespace-only strings as missing", () => {
    const profile = {
      full_name: "   ",
      age: 28,
      city: "Austin",
      gender: "female",
      roommate_gender_pref: "any",
      budget_min: 800,
      budget_max: 1200,
      roommates_wanted: 2,
      work_schedule: "9-5",
      cleanliness: 8,
      sleep_schedule: "early_bird",
      smoking: false,
      pets: true,
      guests: true,
    };
    const result = missingProfileFields(profile);
    const fullNameLabel = REQUIRED_PROFILE_FIELDS.find((f) => f.key === "full_name")!.label;
    expect(result).toContain(fullNameLabel);
  });

  it("does not include boolean false fields as missing", () => {
    const profile = {
      full_name: "Alice",
      age: 28,
      city: "Austin",
      gender: "female",
      roommate_gender_pref: "any",
      budget_min: 800,
      budget_max: 1200,
      roommates_wanted: 2,
      work_schedule: "9-5",
      cleanliness: 8,
      sleep_schedule: "early_bird",
      smoking: false,
      pets: false,
      guests: false,
    };
    const result = missingProfileFields(profile);
    expect(result).toEqual([]);
  });
});

describe("isMissingColumn", () => {
  it("returns false for null error", () => {
    expect(isMissingColumn(null)).toBe(false);
  });

  it("returns false for undefined error", () => {
    expect(isMissingColumn(undefined as unknown as { message?: string; code?: string })).toBe(false);
  });

  it("returns true for postgres code 42703", () => {
    const error = { code: "42703", message: "column does not exist" };
    expect(isMissingColumn(error)).toBe(true);
  });

  it("returns true for postgrest code PGRST204", () => {
    const error = { code: "PGRST204", message: "Could not find the column" };
    expect(isMissingColumn(error)).toBe(true);
  });

  it("returns true for message matching 'column X does not exist'", () => {
    const error = { message: "column user_id does not exist" };
    expect(isMissingColumn(error)).toBe(true);
  });

  it("returns true for message matching 'could not find the X column'", () => {
    const error = { message: "could not find the user_id column" };
    expect(isMissingColumn(error)).toBe(true);
  });

  it("returns true for case-insensitive pattern match", () => {
    const error = { message: "COLUMN USER_ID DOES NOT EXIST" };
    expect(isMissingColumn(error)).toBe(true);
  });

  it("returns true for case-insensitive 'could not find'", () => {
    const error = { message: "Could Not Find The USER_ID Column" };
    expect(isMissingColumn(error)).toBe(true);
  });

  it("returns false for unrelated error code", () => {
    const error = { code: "23505", message: "duplicate key value" };
    expect(isMissingColumn(error)).toBe(false);
  });

  it("returns false for unrelated error message", () => {
    const error = { message: "Authentication failed" };
    expect(isMissingColumn(error)).toBe(false);
  });

  it("returns false for table-related error", () => {
    const error = { message: "table does not exist" };
    expect(isMissingColumn(error)).toBe(false);
  });

  it("returns false for error object without message or code", () => {
    const error = {};
    expect(isMissingColumn(error)).toBe(false);
  });
});

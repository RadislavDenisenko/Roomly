export const REQUIRED_PROFILE_FIELDS = [
  { key: "full_name", label: "Your name" },
  { key: "age", label: "Age" },
  { key: "city", label: "City" },
  { key: "gender", label: "Gender" },
  { key: "roommate_gender_pref", label: "Roommate gender preference" },
  { key: "budget_min", label: "Budget minimum" },
  { key: "budget_max", label: "Budget maximum" },
  { key: "roommates_wanted", label: "Looking for" },
  { key: "work_schedule", label: "Work schedule" },
  { key: "cleanliness", label: "Cleanliness" },
  { key: "sleep_schedule", label: "Sleep schedule" },
  { key: "smoking", label: "Smoking" },
  { key: "pets", label: "Pets" },
  { key: "guests", label: "Guests" },
] as const;

function isFieldFilled(value: unknown): boolean {
  // A field counts as filled when != null
  if (value === null || value === undefined) {
    return false;
  }
  // For strings, must be non-empty after trim
  if (typeof value === "string") {
    return value.trim().length > 0;
  }
  // Everything else (including false booleans) counts as filled
  return true;
}

export function isProfileComplete(p: Record<string, unknown> | null | undefined): boolean {
  if (!p) {
    return false;
  }

  // Check if all required fields are filled
  for (const field of REQUIRED_PROFILE_FIELDS) {
    if (!isFieldFilled(p[field.key])) {
      return false;
    }
  }

  return true;
}

export function missingProfileFields(p: Record<string, unknown> | null | undefined): string[] {
  const missing: string[] = [];

  for (const field of REQUIRED_PROFILE_FIELDS) {
    const value = p ? p[field.key] : undefined;
    if (!isFieldFilled(value)) {
      missing.push(field.label);
    }
  }

  return missing;
}

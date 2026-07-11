// One-time notice shown the first time someone likes a place, explaining
// that liking makes them visible in that place's People pool.
const PEOPLE_CONSENT_KEY = "roomly_people_consent_seen";

export function peopleConsentSeen(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(PEOPLE_CONSENT_KEY) === "1";
  } catch {
    return false;
  }
}

export function markPeopleConsentSeen(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(PEOPLE_CONSENT_KEY, "1");
  } catch {
    // ignore storage errors (private mode, quota, etc.)
  }
}

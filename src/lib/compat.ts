import type { VerificationStatus } from "@/lib/verification";

export type Gender = "male" | "female";
export type RoommateGenderPref = "male" | "female" | "any";
export type WorkSchedule = "day" | "night" | "wfh" | "flexible";
export type OvernightGuests = "rarely" | "sometimes" | "often";

export type CompatProfile = {
  id: string;
  full_name: string | null;
  age: number | null;
  city: string | null;
  bio: string | null;
  avatar_url: string | null;
  photos: string[] | null;
  budget_min: number | null;
  budget_max: number | null;
  cleanliness: number | null;
  sleep_schedule: string | null;
  smoking: boolean | null;
  pets: boolean | null;
  guests: string | null;
  email_verified: boolean | null;
  verification_status?: VerificationStatus | null;
  gender?: Gender | null;
  roommate_gender_pref?: RoommateGenderPref | null;
  roommates_wanted?: number | null;
  work_schedule?: WorkSchedule | null;
  income_monthly?: number | null;
  overnight_guests?: OvernightGuests | null;
  noise_level?: number | null;
};

export const sleepLabel: Record<string, string> = {
  early_bird: "Early bird",
  night_owl: "Night owl",
  flexible: "Flexible",
};

// Shared 3-point ordering used by both the "guests" and "overnight_guests"
// frequency fields.
const GUESTS_ORDER = ["rarely", "sometimes", "often"];

const workScheduleVerbPhrase: Record<WorkSchedule, string> = {
  day: "work days",
  night: "work nights",
  wfh: "work from home",
  flexible: "have a flexible schedule",
};

const overnightGuestsGoodPhrase: Record<OvernightGuests, string> = {
  rarely: "Both rarely have overnight guests",
  sometimes: "Both sometimes have overnight guests",
  often: "Both often have overnight guests",
};

export function budgetsOverlap(me: CompatProfile, them: CompatProfile) {
  return (
    Math.min(me.budget_max ?? 99999, them.budget_max ?? 99999) >=
    Math.max(me.budget_min ?? 0, them.budget_min ?? 0)
  );
}

/**
 * Weight table (spec §6.3, sums to 100):
 * cleanliness 20, sleep 12, smoking 12, pets 8, guests 8, budget 12, city 8,
 * work_schedule 8, roommates_wanted 6, overnight_guests 3, noise_level 3.
 *
 * work_schedule, roommates_wanted, overnight_guests, and noise_level are all
 * optional on CompatProfile — when either side hasn't set one, it
 * contributes exactly 0 (no bonus, no penalty).
 */
export function compatibility(me: CompatProfile, them: CompatProfile): number {
  let s = 0;
  s += 20 * (1 - Math.abs((me.cleanliness ?? 3) - (them.cleanliness ?? 3)) / 4);
  if (me.sleep_schedule === them.sleep_schedule) s += 12;
  else if (me.sleep_schedule === "flexible" || them.sleep_schedule === "flexible") s += 6;
  if ((me.smoking ?? false) === (them.smoking ?? false)) s += 12;
  s += (me.pets ?? false) === (them.pets ?? false) ? 8 : 3;
  const gi = Math.abs(
    GUESTS_ORDER.indexOf(me.guests ?? "sometimes") - GUESTS_ORDER.indexOf(them.guests ?? "sometimes"),
  );
  s += 8 * (1 - gi / 2);
  if (budgetsOverlap(me, them)) s += 12;
  if (me.city && them.city && me.city.toLowerCase() === them.city.toLowerCase()) s += 8;

  if (me.work_schedule && them.work_schedule) {
    if (me.work_schedule === them.work_schedule) s += 8;
    else if (me.work_schedule === "flexible" || them.work_schedule === "flexible") s += 4;
  }

  if (me.roommates_wanted != null && them.roommates_wanted != null) {
    const rd = Math.abs(me.roommates_wanted - them.roommates_wanted);
    if (rd === 0) s += 6;
    else if (rd === 1) s += 3;
  }

  if (me.overnight_guests && them.overnight_guests) {
    const ogd = Math.abs(
      GUESTS_ORDER.indexOf(me.overnight_guests) - GUESTS_ORDER.indexOf(them.overnight_guests),
    );
    s += 3 * (1 - ogd / 2);
  }

  if (me.noise_level != null && them.noise_level != null) {
    s += 3 * (1 - Math.abs(me.noise_level - them.noise_level) / 4);
  }

  return Math.max(0, Math.min(100, Math.round(s)));
}

export type Reason = { good: boolean; text: string };

export function reasons(me: CompatProfile, them: CompatProfile): Reason[] {
  const r: Reason[] = [];
  if (them.sleep_schedule && me.sleep_schedule === them.sleep_schedule)
    r.push({ good: true, text: `Both ${sleepLabel[them.sleep_schedule].toLowerCase()}s` });
  if (me.work_schedule && them.work_schedule) {
    if (me.work_schedule === them.work_schedule)
      r.push({ good: true, text: `Both ${workScheduleVerbPhrase[them.work_schedule]}` });
    else
      r.push({
        good: false,
        text: `You ${workScheduleVerbPhrase[me.work_schedule]}, they ${workScheduleVerbPhrase[them.work_schedule]}`,
      });
  }
  if ((me.smoking ?? false) === (them.smoking ?? false))
    r.push({ good: true, text: them.smoking ? "Both smokers" : "Both non-smokers" });
  else r.push({ good: false, text: them.smoking ? "They smoke, you do not" : "You smoke, they do not" });
  if ((me.pets ?? false) === (them.pets ?? false))
    r.push({ good: true, text: them.pets ? "Both have pets" : "Neither has pets" });
  if (me.overnight_guests && them.overnight_guests) {
    if (me.overnight_guests === them.overnight_guests)
      r.push({ good: true, text: overnightGuestsGoodPhrase[them.overnight_guests] });
    else r.push({ good: false, text: "Different overnight-guest habits" });
  }
  const cd = Math.abs((me.cleanliness ?? 3) - (them.cleanliness ?? 3));
  if (cd <= 1) r.push({ good: true, text: "Similar tidiness" });
  else
    r.push({
      good: false,
      text: (them.cleanliness ?? 3) > (me.cleanliness ?? 3) ? "They are tidier than you" : "You are tidier than them",
    });
  r.push(
    budgetsOverlap(me, them)
      ? { good: true, text: "Budgets overlap" }
      : { good: false, text: "Budgets do not overlap" },
  );
  return r.slice(0, 4);
}

export function headline(score: number, why: Reason[]): string {
  const top = why.find((r) => r.good);
  return top ? top.text : `${score}% match`;
}

import type { VerificationStatus } from "@/lib/verification";

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
  // "Awkward question" axes — nullable, optional so older rows/fixtures still type-check.
  weekend_style?: string | null;
  home_noise?: string | null;
  food_sharing?: string | null;
  dishes?: string | null;
  chores?: string | null;
  overnight_guests?: string | null;
  email_verified: boolean | null;
  verification_status?: VerificationStatus | null;
};

export const sleepLabel: Record<string, string> = {
  early_bird: "Early bird",
  night_owl: "Night owl",
  flexible: "Flexible",
};

export const weekendLabel: Record<string, string> = {
  out: "Out on weekends",
  host: "Has people over",
  home: "Homebody weekends",
  depends: "Depends on the week",
};

export const noiseLabel: Record<string, string> = {
  speakers: "Speakers on",
  headphones: "Headphones mostly",
  quiet: "Lives for quiet",
};

export const foodLabel: Record<string, string> = {
  share: "Shares groceries",
  ask: "Ask first, all good",
  separate: "Separate shelves",
};

export const dishesLabel: Record<string, string> = {
  now: "Washes as they go",
  same_day: "Dishes done same day",
  soaking: "Lets dishes soak",
  eventually: "Dishes… eventually",
};

export const choresLabel: Record<string, string> = {
  rota: "Chore schedule person",
  whoever: "Whoever notices, does it",
  cleaner: "Would split a cleaner",
  eventually: "Chores… eventually",
};

export const overnightLabel: Record<string, string> = {
  never: "Rarely has sleepovers",
  weekends: "Weekend sleepovers",
  often: "Guests a few nights a week",
  partner: "Partner's often over",
};

export function budgetsOverlap(me: CompatProfile, them: CompatProfile) {
  return (
    Math.min(me.budget_max ?? 99999, them.budget_max ?? 99999) >=
    Math.max(me.budget_min ?? 0, them.budget_min ?? 0)
  );
}

// --- Scoring -----------------------------------------------------------------
// Weights follow what surveys say actually blows up roommate pairs
// (cleanliness > dishes > sleep/noise > food > guests > the rest), and
// similarity is deliberately forgiving: adjacent answers score well, only
// 2+ step gaps really hurt, and an unanswered question scores neutral
// (UNKNOWN) instead of zero. Research note: *perceived unfairness*, not any
// single habit, is what predicts blowups — so we avoid over-punishing small
// differences.

const UNKNOWN = 0.55;

// Similarity by distance apart in an ordered scale, e.g. ORD[1] = one step apart.
function ordinal(order: string[], simByGap: number[]) {
  return (a: string, b: string) => {
    const ai = order.indexOf(a);
    const bi = order.indexOf(b);
    if (ai < 0 || bi < 0) return UNKNOWN;
    return simByGap[Math.abs(ai - bi)] ?? 0;
  };
}

const sleepSim = (a: string, b: string) => {
  if (a === b) return 1;
  if (a === "flexible" || b === "flexible") return 0.7;
  return 0; // early bird vs night owl
};

const weekendSim = (a: string, b: string) => {
  if (a === b) return 1;
  if (a === "depends" || b === "depends") return 0.8;
  return ordinal(["out", "host", "home"], [1, 0.7, 0.2])(a, b);
};

const CHORE_PAIRS: Record<string, number> = {
  "rota|whoever": 0.6, "rota|cleaner": 0.7, "rota|eventually": 0.2,
  "whoever|cleaner": 0.7, "whoever|eventually": 0.5,
  "cleaner|eventually": 0.6,
};
const choresSim = (a: string, b: string) =>
  a === b ? 1 : (CHORE_PAIRS[`${a}|${b}`] ?? CHORE_PAIRS[`${b}|${a}`] ?? UNKNOWN);

// A dim's sim returns null when either side hasn't answered; compatibility()
// scores unknowns as the neutral UNKNOWN, the axis breakdown skips them.
type Dim = { label: string; weight: number; sim: (me: CompatProfile, them: CompatProfile) => number | null };

const text = (
  pick: (p: CompatProfile) => string | null | undefined,
  sim: (a: string, b: string) => number,
) => (me: CompatProfile, them: CompatProfile) => {
  const a = pick(me);
  const b = pick(them);
  return a && b ? sim(a, b) : null;
};

const DIMS: Dim[] = [
  { label: "Tidiness", weight: 18, sim: (me, them) =>
      me.cleanliness == null || them.cleanliness == null
        ? null
        : [1, 0.75, 0.45, 0.2, 0][Math.abs(me.cleanliness - them.cleanliness)] ?? 0 },
  { label: "Dishes", weight: 12, sim: text((p) => p.dishes, ordinal(["now", "same_day", "soaking", "eventually"], [1, 0.8, 0.3, 0])) },
  { label: "Sleep schedule", weight: 12, sim: text((p) => p.sleep_schedule, sleepSim) },
  { label: "Budget", weight: 10, sim: (me, them) => (budgetsOverlap(me, them) ? 1 : 0.2) },
  { label: "Fridge rules", weight: 10, sim: text((p) => p.food_sharing, ordinal(["share", "ask", "separate"], [1, 0.75, 0.3])) },
  { label: "Overnight guests", weight: 8, sim: text((p) => p.overnight_guests, ordinal(["never", "weekends", "often", "partner"], [1, 0.75, 0.35, 0])) },
  { label: "Smoking", weight: 8, sim: (me, them) =>
      me.smoking == null || them.smoking == null ? null : me.smoking === them.smoking ? 1 : 0.25 },
  { label: "Pets", weight: 6, sim: (me, them) =>
      me.pets == null || them.pets == null ? null : me.pets === them.pets ? 1 : 0.5 },
  { label: "Chores", weight: 6, sim: text((p) => p.chores, choresSim) },
  { label: "Weekends", weight: 5, sim: text((p) => p.weekend_style, weekendSim) },
  { label: "Noise at home", weight: 5, sim: text((p) => p.home_noise, ordinal(["speakers", "headphones", "quiet"], [1, 0.7, 0.15])) },
];

// Hard "no" preferences from the profile's Dealbreakers card.
export type Dealbreakers = {
  db_nonsmokers_only?: boolean | null;
  db_no_pet_owners?: boolean | null;
  db_budget_overlap_only?: boolean | null;
};

export function passesDealbreakers(me: CompatProfile & Dealbreakers, them: CompatProfile): boolean {
  if (me.db_nonsmokers_only && them.smoking) return false;
  if (me.db_no_pet_owners && them.pets) return false;
  if (me.db_budget_overlap_only && !budgetsOverlap(me, them)) return false;
  return true;
}

export function compatibility(me: CompatProfile, them: CompatProfile): number {
  const s = DIMS.reduce((sum, d) => sum + d.weight * (d.sim(me, them) ?? UNKNOWN), 0);
  return Math.max(0, Math.min(100, Math.round(s)));
}

// Per-dimension breakdown for the profile sheet, heaviest axes first (DIMS
// order). sim is null when either side hasn't answered that question.
export type AxisScore = { label: string; sim: number | null };

export function axisScores(me: CompatProfile, them: CompatProfile): AxisScore[] {
  return DIMS.map((d) => ({ label: d.label, sim: d.sim(me, them) }));
}

// --- "Why you match" chips ---------------------------------------------------

export type Reason = { good: boolean; text: string };

// Steps apart in an ordered scale (0 = same answer).
function gapIn(order: string[], a: string, b: string): number {
  return Math.abs(order.indexOf(a) - order.indexOf(b));
}

export function reasons(me: CompatProfile, them: CompatProfile): Reason[] {
  const r: Reason[] = [];
  const both = <T,>(a: T | null | undefined, b: T | null | undefined) => (a != null && b != null);

  if (both(me.cleanliness, them.cleanliness)) {
    const cd = Math.abs((me.cleanliness as number) - (them.cleanliness as number));
    if (cd <= 1) r.push({ good: true, text: "Similar tidiness" });
    else
      r.push({
        good: false,
        text: (them.cleanliness as number) > (me.cleanliness as number)
          ? "They are tidier than you"
          : "You are tidier than them",
      });
  }

  if (both(me.dishes, them.dishes)) {
    if (gapIn(["now", "same_day", "soaking", "eventually"], me.dishes!, them.dishes!) <= 1)
      r.push({ good: true, text: "Same dishes timeline" });
    else r.push({ good: false, text: "Very different dishes habits" });
  }

  if (both(me.sleep_schedule, them.sleep_schedule)) {
    if (me.sleep_schedule === them.sleep_schedule && me.sleep_schedule !== "flexible")
      r.push({ good: true, text: `Both ${sleepLabel[them.sleep_schedule!]?.toLowerCase() ?? "the same schedule"}s` });
    else if (sleepSim(me.sleep_schedule!, them.sleep_schedule!) === 0)
      r.push({ good: false, text: "Opposite sleep schedules" });
  }

  if (both(me.food_sharing, them.food_sharing)) {
    if (me.food_sharing === "share" && them.food_sharing === "share")
      r.push({ good: true, text: "Both happy sharing groceries" });
    else if (me.food_sharing === "separate" && them.food_sharing === "separate")
      r.push({ good: true, text: "Both keep shelves separate" });
    else if (
      (me.food_sharing === "share" && them.food_sharing === "separate") ||
      (me.food_sharing === "separate" && them.food_sharing === "share")
    )
      r.push({ good: false, text: "Different fridge rules" });
  }

  if (both(me.overnight_guests, them.overnight_guests)) {
    if (gapIn(["never", "weekends", "often", "partner"], me.overnight_guests!, them.overnight_guests!) <= 1)
      r.push({ good: true, text: "Aligned on overnight guests" });
    else r.push({ good: false, text: "Different takes on overnight guests" });
  }

  if (both(me.smoking, them.smoking)) {
    if (me.smoking === them.smoking)
      r.push({ good: true, text: them.smoking ? "Both smokers" : "Both non-smokers" });
    else r.push({ good: false, text: them.smoking ? "They smoke, you do not" : "You smoke, they do not" });
  }

  if (both(me.pets, them.pets) && me.pets === them.pets)
    r.push({ good: true, text: them.pets ? "Both have pets" : "Neither has pets" });

  r.push(
    budgetsOverlap(me, them)
      ? { good: true, text: "Budgets overlap" }
      : { good: false, text: "Budgets do not overlap" },
  );

  // Warnings are the chips that change a decision — surface them all, then
  // fill the remaining slots with the strongest matches (already in weight order).
  const bad = r.filter((x) => !x.good);
  const good = r.filter((x) => x.good);
  return [...bad, ...good].slice(0, 5);
}

export function headline(score: number, why: Reason[]): string {
  const top = why.find((r) => r.good);
  return top ? top.text : `${score}% match`;
}

// Human label for the score, so a number always comes with a read on it.
export function scoreTier(score: number): string {
  if (score >= 80) return "Great fit";
  if (score >= 65) return "Solid fit";
  if (score >= 45) return "Mixed fit";
  return "Long shot";
}

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
  email_verified: boolean | null;
  verification_status?: VerificationStatus | null;
};

export const sleepLabel: Record<string, string> = {
  early_bird: "Early bird",
  night_owl: "Night owl",
  flexible: "Flexible",
};

export function budgetsOverlap(me: CompatProfile, them: CompatProfile) {
  return (
    Math.min(me.budget_max ?? 99999, them.budget_max ?? 99999) >=
    Math.max(me.budget_min ?? 0, them.budget_min ?? 0)
  );
}

export function compatibility(me: CompatProfile, them: CompatProfile): number {
  let s = 0;
  s += 25 * (1 - Math.abs((me.cleanliness ?? 3) - (them.cleanliness ?? 3)) / 4);
  if (me.sleep_schedule === them.sleep_schedule) s += 15;
  else if (me.sleep_schedule === "flexible" || them.sleep_schedule === "flexible") s += 7.5;
  if ((me.smoking ?? false) === (them.smoking ?? false)) s += 15;
  s += (me.pets ?? false) === (them.pets ?? false) ? 10 : 4;
  const g = ["rarely", "sometimes", "often"];
  const gi = Math.abs(g.indexOf(me.guests ?? "sometimes") - g.indexOf(them.guests ?? "sometimes"));
  s += 10 * (1 - gi / 2);
  if (budgetsOverlap(me, them)) s += 15;
  if (me.city && them.city && me.city.toLowerCase() === them.city.toLowerCase()) s += 10;
  return Math.max(0, Math.min(100, Math.round(s)));
}

export type Reason = { good: boolean; text: string };

export function reasons(me: CompatProfile, them: CompatProfile): Reason[] {
  const r: Reason[] = [];
  if (them.sleep_schedule && me.sleep_schedule === them.sleep_schedule)
    r.push({ good: true, text: `Both ${sleepLabel[them.sleep_schedule].toLowerCase()}s` });
  if ((me.smoking ?? false) === (them.smoking ?? false))
    r.push({ good: true, text: them.smoking ? "Both smokers" : "Both non-smokers" });
  else r.push({ good: false, text: them.smoking ? "They smoke, you do not" : "You smoke, they do not" });
  if ((me.pets ?? false) === (them.pets ?? false))
    r.push({ good: true, text: them.pets ? "Both have pets" : "Neither has pets" });
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

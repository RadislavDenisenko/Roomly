"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient, supabaseConfigured } from "@/lib/supabase/client";
import { isMissingColumn } from "@/lib/listings";
import { isProfileComplete, missingProfileFields, REQUIRED_PROFILE_FIELDS } from "@/lib/completeness";
import type { Gender, OvernightGuests, RoommateGenderPref, WorkSchedule } from "@/lib/compat";
import {
  type BudgetRange,
  BudgetRangeInputs,
  CleanlinessSlider,
  GenderSelect,
  GuestsSelect,
  IncomeInput,
  LookingForSelect,
  NoiseSlider,
  OvernightGuestsSelect,
  PetsToggle,
  RoommatesWantedSelect,
  SleepScheduleSelect,
  SmokingToggle,
  WorkScheduleSelect,
} from "@/components/ProfileFields";

// Explicit column list (not "*") so a fresh checkout that hasn't run the
// latest supabase/schema.sql (which adds gender/roommate_gender_pref/
// roommates_wanted/work_schedule/income_monthly/overnight_guests/noise_level)
// surfaces a "column does not exist" error we can detect with isMissingColumn,
// instead of silently omitting fields the wizard needs.
const PROFILE_SELECT =
  "full_name, age, city, gender, roommate_gender_pref, budget_min, budget_max, roommates_wanted, income_monthly, work_schedule, cleanliness, sleep_schedule, smoking, pets, guests, overnight_guests, noise_level";

type Form = {
  full_name: string;
  age: string;
  gender: Gender | "";
  city: string;
  budget_min: string;
  budget_max: string;
  roommates_wanted: number | null;
  roommate_gender_pref: RoommateGenderPref | "";
  income_monthly: string;
  cleanliness: number;
  sleep_schedule: string;
  work_schedule: WorkSchedule | "";
  smoking: boolean;
  pets: boolean;
  guests: string;
  overnight_guests: OvernightGuests | "";
  noise_level: number | null;
};

const EMPTY: Form = {
  full_name: "",
  age: "",
  gender: "",
  city: "",
  budget_min: "",
  budget_max: "",
  roommates_wanted: null,
  roommate_gender_pref: "",
  income_monthly: "",
  cleanliness: 3,
  sleep_schedule: "flexible",
  work_schedule: "",
  smoking: false,
  pets: false,
  guests: "sometimes",
  overnight_guests: "",
  noise_level: null,
};

const TOTAL_STEPS = 3;
const STEP_TITLES = ["You", "Your place", "Your habits"];

function clampStep(n: number): number {
  if (!Number.isFinite(n)) return 1;
  return Math.min(TOTAL_STEPS, Math.max(1, Math.round(n)));
}

function isAgeInvalid(age: string): boolean {
  if (!age.trim()) return false; // "missing" is handled separately from "invalid"
  const n = parseInt(age, 10);
  return isNaN(n) || n < 18 || n > 99;
}

function isStep1Valid(f: Form): boolean {
  if (!f.full_name.trim()) return false;
  if (!f.age.trim() || isAgeInvalid(f.age)) return false;
  if (!f.gender) return false;
  if (!f.city.trim()) return false;
  return true;
}

function isStep2Valid(f: Form): boolean {
  if (!f.budget_min.trim() || !f.budget_max.trim()) return false;
  if (isNaN(parseInt(f.budget_min, 10)) || isNaN(parseInt(f.budget_max, 10))) return false;
  if (f.roommates_wanted == null) return false;
  if (!f.roommate_gender_pref) return false;
  return true;
}

function isStep3Valid(f: Form): boolean {
  // cleanliness/sleep_schedule/guests carry defaults and smoking/pets default
  // to false, all of which already count as "filled" (see completeness.ts) —
  // work_schedule is the one field on this step with no default, so it's the
  // only thing that needs an explicit choice before Next unlocks.
  return !!f.work_schedule;
}

export default function OnboardingPage() {
  return (
    <Suspense fallback={<Centered>Loading…</Centered>}>
      <OnboardingWizard />
    </Suspense>
  );
}

function OnboardingWizard() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [loading, setLoading] = useState(supabaseConfigured);
  const [authed, setAuthed] = useState(false);
  const [schemaError, setSchemaError] = useState(false);
  const [step, setStep] = useState(() => clampStep(parseInt(searchParams.get("step") ?? "1", 10)));
  const [form, setForm] = useState<Form>(EMPTY);
  const [missingCount, setMissingCount] = useState<number>(REQUIRED_PROFILE_FIELDS.length);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!supabaseConfigured) return;
    const supabase = createClient();
    (async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        setLoading(false);
        return;
      }
      setAuthed(true);

      const { data: profile, error: profileErr } = await supabase
        .from("profiles")
        .select(PROFILE_SELECT)
        .eq("id", userData.user.id)
        .single();

      if (profileErr && isMissingColumn(profileErr)) {
        setSchemaError(true);
        setLoading(false);
        return;
      }

      if (profile && isProfileComplete(profile)) {
        router.replace("/places");
        return;
      }

      if (profile) {
        setForm({
          full_name: profile.full_name ?? "",
          age: profile.age?.toString() ?? "",
          gender: (profile.gender as Gender) ?? "",
          city: profile.city ?? "",
          budget_min: profile.budget_min?.toString() ?? "",
          budget_max: profile.budget_max?.toString() ?? "",
          roommates_wanted: profile.roommates_wanted ?? null,
          roommate_gender_pref: (profile.roommate_gender_pref as RoommateGenderPref) ?? "",
          income_monthly: profile.income_monthly?.toString() ?? "",
          cleanliness: profile.cleanliness ?? 3,
          sleep_schedule: profile.sleep_schedule ?? "flexible",
          work_schedule: (profile.work_schedule as WorkSchedule) ?? "",
          smoking: profile.smoking ?? false,
          pets: profile.pets ?? false,
          guests: profile.guests ?? "sometimes",
          overnight_guests: (profile.overnight_guests as OvernightGuests) ?? "",
          noise_level: profile.noise_level ?? null,
        });
        setMissingCount(missingProfileFields(profile).length);
      }

      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function update<K extends keyof Form>(key: K, value: Form[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    setError(null);
  }

  function updateBudget(v: BudgetRange) {
    setForm((f) => ({ ...f, budget_min: v.min, budget_max: v.max }));
    setError(null);
  }

  function goToStep(n: number) {
    const clamped = clampStep(n);
    setError(null);
    setStep(clamped);
    router.replace(`/onboarding?step=${clamped}`, { scroll: false });
  }

  async function saveStep1() {
    setSaving(true);
    setError(null);
    const supabase = createClient();
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      setSaving(false);
      setError("Your session expired — please log in again.");
      return;
    }
    const { error: err } = await supabase
      .from("profiles")
      .update({
        full_name: form.full_name.trim(),
        age: parseInt(form.age, 10),
        gender: form.gender,
        city: form.city.trim(),
      })
      .eq("id", userData.user.id);
    setSaving(false);
    if (err) {
      setError("Couldn't save — try again.");
      return;
    }
    goToStep(2);
  }

  async function saveStep2() {
    setSaving(true);
    setError(null);
    const supabase = createClient();
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      setSaving(false);
      setError("Your session expired — please log in again.");
      return;
    }
    let budgetMin = parseInt(form.budget_min, 10);
    let budgetMax = parseInt(form.budget_max, 10);
    if (budgetMin > budgetMax) [budgetMin, budgetMax] = [budgetMax, budgetMin];
    const { error: err } = await supabase
      .from("profiles")
      .update({
        budget_min: budgetMin,
        budget_max: budgetMax,
        roommates_wanted: form.roommates_wanted,
        roommate_gender_pref: form.roommate_gender_pref,
        income_monthly: form.income_monthly ? parseInt(form.income_monthly, 10) : null,
      })
      .eq("id", userData.user.id);
    setSaving(false);
    if (err) {
      setError("Couldn't save — try again.");
      return;
    }
    setForm((f) => ({ ...f, budget_min: String(budgetMin), budget_max: String(budgetMax) }));
    goToStep(3);
  }

  async function saveStep3() {
    setSaving(true);
    setError(null);
    const supabase = createClient();
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      setSaving(false);
      setError("Your session expired — please log in again.");
      return;
    }
    const { error: err } = await supabase
      .from("profiles")
      .update({
        cleanliness: form.cleanliness,
        sleep_schedule: form.sleep_schedule,
        work_schedule: form.work_schedule,
        smoking: form.smoking,
        pets: form.pets,
        guests: form.guests,
        overnight_guests: form.overnight_guests || null,
        noise_level: form.noise_level,
      })
      .eq("id", userData.user.id);
    setSaving(false);
    if (err) {
      setError("Couldn't save — try again.");
      return;
    }
    router.push("/places");
  }

  function handleNext() {
    if (step === 1) void saveStep1();
    else if (step === 2) void saveStep2();
    else void saveStep3();
  }

  if (loading) {
    return <Centered>Loading your profile…</Centered>;
  }

  if (!supabaseConfigured) {
    return <Centered>Accounts aren&apos;t connected yet — see SETUP.md.</Centered>;
  }

  if (!authed) {
    return (
      <Centered>
        <p className="text-zinc-600 dark:text-zinc-400">Please log in to set up your profile.</p>
        <Link href="/login" className="roomly-btn mt-4 h-11 px-6 text-sm">
          Go to log in
        </Link>
      </Centered>
    );
  }

  if (schemaError) {
    return (
      <main className="roomly-page flex flex-1 flex-col items-center justify-center px-6 py-16 text-center">
        <div className="max-w-md rounded-2xl border border-violet-200 bg-violet-50 px-6 py-5 text-sm text-violet-800 dark:border-violet-900/50 dark:bg-violet-950/40 dark:text-violet-200">
          ✨ Your profile needs a couple of new columns. Run{" "}
          <code className="rounded bg-violet-100 px-1 py-0.5 font-mono text-xs dark:bg-violet-900/50">
            supabase/schema.sql
          </code>{" "}
          in Supabase, then refresh.
        </div>
      </main>
    );
  }

  const introCopy =
    missingCount > 0 && missingCount < REQUIRED_PROFILE_FIELDS.length
      ? `Just ${missingCount} quick ${missingCount === 1 ? "thing" : "things"} to finish your profile.`
      : "A few quick questions so we can find your people.";

  const stepValid = step === 1 ? isStep1Valid(form) : step === 2 ? isStep2Valid(form) : isStep3Valid(form);

  return (
    <main className="roomly-page flex flex-1 flex-col">
      <header className="mx-auto flex w-full max-w-md items-center justify-between px-6 py-5">
        <Link href="/" className="flex items-center gap-2">
          <span className="roomly-mark h-8 w-8 text-sm">R</span>
          <span className="text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">Roomly</span>
        </Link>
      </header>

      <div className="mx-auto w-full max-w-md flex-1 px-6 pb-16">
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
          {STEP_TITLES[step - 1]}
        </h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">{introCopy}</p>

        <div
          className="mt-4 flex gap-2"
          role="progressbar"
          aria-valuenow={step}
          aria-valuemin={1}
          aria-valuemax={TOTAL_STEPS}
          aria-label="Onboarding progress"
        >
          {Array.from({ length: TOTAL_STEPS }, (_, i) => i + 1).map((n) => (
            <span
              key={n}
              className={`h-1.5 flex-1 rounded-full transition-colors duration-300 ${
                n <= step ? "bg-gradient-to-r from-fuchsia-500 to-violet-600" : "bg-zinc-200 dark:bg-zinc-800"
              }`}
            />
          ))}
        </div>

        <div
          key={step}
          className="roomly-card-in mt-6 space-y-4 rounded-3xl border border-zinc-200 bg-white/80 p-5 backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/80"
        >
          {step === 1 && (
            <>
              <Text label="Full name" value={form.full_name} onChange={(v) => update("full_name", v)} placeholder="Alex Rivera" />
              <div>
                <Text label="Age" type="number" value={form.age} onChange={(v) => update("age", v)} placeholder="24" />
                {isAgeInvalid(form.age) && (
                  <p className="mt-1 text-xs text-red-600 dark:text-red-400">Age must be between 18 and 99.</p>
                )}
              </div>
              <GenderSelect value={form.gender} onChange={(v) => update("gender", v)} />
              <Text label="City" value={form.city} onChange={(v) => update("city", v)} placeholder="Austin, TX" />
            </>
          )}

          {step === 2 && (
            <>
              <BudgetRangeInputs value={{ min: form.budget_min, max: form.budget_max }} onChange={updateBudget} />
              <RoommatesWantedSelect value={form.roommates_wanted} onChange={(v) => update("roommates_wanted", v)} />
              <LookingForSelect value={form.roommate_gender_pref} onChange={(v) => update("roommate_gender_pref", v)} />
              <IncomeInput value={form.income_monthly} onChange={(v) => update("income_monthly", v)} />
            </>
          )}

          {step === 3 && (
            <>
              <CleanlinessSlider value={form.cleanliness} onChange={(v) => update("cleanliness", v)} />
              <SleepScheduleSelect value={form.sleep_schedule} onChange={(v) => update("sleep_schedule", v)} />
              <WorkScheduleSelect value={form.work_schedule} onChange={(v) => update("work_schedule", v)} />
              <div className="flex gap-6">
                <SmokingToggle value={form.smoking} onChange={(v) => update("smoking", v)} />
                <PetsToggle value={form.pets} onChange={(v) => update("pets", v)} />
              </div>
              <GuestsSelect value={form.guests} onChange={(v) => update("guests", v)} />

              <div className="mt-2 rounded-2xl border border-dashed border-zinc-300 p-4 dark:border-zinc-700">
                <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                  Optional, but helps
                </p>
                <div className="space-y-4">
                  <OvernightGuestsSelect value={form.overnight_guests} onChange={(v) => update("overnight_guests", v)} />
                  <NoiseSlider value={form.noise_level} onChange={(v) => update("noise_level", v)} />
                </div>
              </div>
            </>
          )}
        </div>

        {error && (
          <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">
            {error}
          </p>
        )}

        <div className="mt-6 flex gap-3">
          {step > 1 && (
            <button
              type="button"
              onClick={() => goToStep(step - 1)}
              disabled={saving}
              className="flex h-12 flex-1 items-center justify-center rounded-full border border-zinc-300 text-sm font-semibold text-zinc-700 transition-all duration-200 ease-out hover:bg-zinc-100 active:scale-95 disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              Back
            </button>
          )}
          <button
            type="button"
            onClick={handleNext}
            disabled={saving || !stepValid}
            className="roomly-btn h-12 flex-1 text-sm"
          >
            {saving ? "Saving…" : step === TOTAL_STEPS ? "Finish" : "Next"}
          </button>
        </div>
      </div>
    </main>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <main className="roomly-page flex flex-1 flex-col items-center justify-center px-6 py-16 text-center">
      <div className="max-w-sm text-zinc-600 dark:text-zinc-400">{children}</div>
    </main>
  );
}

function Text({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-11 w-full rounded-lg border border-zinc-300 bg-white px-3 text-sm text-zinc-900 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
      />
    </label>
  );
}

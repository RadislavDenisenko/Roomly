"use client";

import type { Gender, OvernightGuests, RoommateGenderPref, WorkSchedule } from "@/lib/compat";

// Shared, controlled field components for the profile form (and, later, the
// onboarding wizard). Each is `{ value, onChange }` plus whatever secondary
// props a faithful extraction needs (e.g. label overrides). Styling is
// copied verbatim from the profile page inputs they replace/extend.

export type BudgetRange = { min: string; max: string };

// ---- Budget -----------------------------------------------------------

export function BudgetRangeInputs({
  value,
  onChange,
}: {
  value: BudgetRange;
  onChange: (value: BudgetRange) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-4">
      <Text
        label="Budget min ($/mo)"
        type="number"
        value={value.min}
        onChange={(v) => onChange({ ...value, min: v })}
        placeholder="800"
      />
      <Text
        label="Budget max ($/mo)"
        type="number"
        value={value.max}
        onChange={(v) => onChange({ ...value, max: v })}
        placeholder="1400"
      />
    </div>
  );
}

// ---- Lifestyle (existing) ----------------------------------------------

export function CleanlinessSlider({
  value,
  onChange,
}: {
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <div>
      <span className="mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
        Cleanliness: {cleanlinessLabel(value)}
      </span>
      <div className="flex gap-2">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n)}
            className={`h-10 flex-1 rounded-lg border text-sm font-medium transition-colors ${
              value === n
                ? "border-emerald-600 bg-emerald-600 text-white"
                : "border-zinc-300 text-zinc-600 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800"
            }`}
          >
            {n}
          </button>
        ))}
      </div>
    </div>
  );
}

export function SleepScheduleSelect({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <Select
      label="Sleep schedule"
      value={value}
      onChange={onChange}
      options={[
        ["early_bird", "Early bird"],
        ["night_owl", "Night owl"],
        ["flexible", "Flexible"],
      ]}
    />
  );
}

export function GuestsSelect({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <Select
      label="Guests over"
      value={value}
      onChange={onChange}
      options={[
        ["rarely", "Rarely"],
        ["sometimes", "Sometimes"],
        ["often", "Often"],
      ]}
    />
  );
}

export function SmokingToggle({
  value,
  onChange,
}: {
  value: boolean;
  onChange: (value: boolean) => void;
}) {
  return <Toggle label="I smoke" checked={value} onChange={onChange} />;
}

export function PetsToggle({
  value,
  onChange,
}: {
  value: boolean;
  onChange: (value: boolean) => void;
}) {
  return <Toggle label="I have pets" checked={value} onChange={onChange} />;
}

// ---- New onboarding-gate fields ----------------------------------------

export function GenderSelect({
  value,
  onChange,
}: {
  value: Gender | "";
  onChange: (value: Gender) => void;
}) {
  return (
    <SegmentedButtons
      label="Gender"
      value={value}
      onChange={(v) => onChange(v as Gender)}
      options={[
        { value: "male", label: "Male" },
        { value: "female", label: "Female" },
      ]}
    />
  );
}

export function LookingForSelect({
  value,
  onChange,
}: {
  value: RoommateGenderPref | "";
  onChange: (value: RoommateGenderPref) => void;
}) {
  return (
    <SegmentedButtons
      label="Show me"
      value={value}
      onChange={(v) => onChange(v as RoommateGenderPref)}
      options={[
        { value: "male", label: "Male" },
        { value: "female", label: "Female" },
        { value: "any", label: "Either" },
      ]}
    />
  );
}

export function RoommatesWantedSelect({
  value,
  onChange,
}: {
  value: number | null;
  onChange: (value: number) => void;
}) {
  return (
    <SegmentedButtons
      label="Looking for"
      value={value}
      onChange={(v) => onChange(v as number)}
      options={[
        { value: 1, label: "1" },
        { value: 2, label: "2" },
        { value: 3, label: "3+" },
      ]}
    />
  );
}

export function WorkScheduleSelect({
  value,
  onChange,
}: {
  value: WorkSchedule | "";
  onChange: (value: WorkSchedule) => void;
}) {
  return (
    <SegmentedButtons
      label="Work schedule"
      value={value}
      onChange={(v) => onChange(v as WorkSchedule)}
      options={[
        { value: "day", label: "Day" },
        { value: "night", label: "Night" },
        { value: "wfh", label: "From home" },
        { value: "flexible", label: "Flexible" },
      ]}
    />
  );
}

export function IncomeInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <Text
        label="Monthly income ($/mo)"
        type="number"
        value={value}
        onChange={onChange}
        placeholder="3200"
      />
      <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
        Optional — shown on your profile if you fill it
      </p>
    </div>
  );
}

export function OvernightGuestsSelect({
  value,
  onChange,
}: {
  value: OvernightGuests | "";
  onChange: (value: OvernightGuests | "") => void;
}) {
  return (
    <SegmentedButtons
      label="Overnight guests"
      helper="Optional — tap again to clear"
      value={value}
      onChange={(v) => onChange((v ?? "") as OvernightGuests | "")}
      options={[
        { value: "rarely", label: "Rarely" },
        { value: "sometimes", label: "Sometimes" },
        { value: "often", label: "Often" },
      ]}
      clearable
      emptyValue=""
    />
  );
}

export function NoiseSlider({
  value,
  onChange,
}: {
  value: number | null;
  onChange: (value: number | null) => void;
}) {
  return (
    <SegmentedButtons
      label="Noise level"
      helper="Optional — tap again to clear"
      value={value}
      onChange={(v) => onChange(v as number | null)}
      options={[1, 2, 3, 4, 5].map((n) => ({ value: n, label: String(n) }))}
      clearable
      emptyValue={null}
    />
  );
}

// ---- Local helpers (module-private, mirror the profile page's own) -----

function cleanlinessLabel(n: number) {
  return ["", "Relaxed", "Easygoing", "Tidy", "Very tidy", "Spotless"][n] ?? "";
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
      <span className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
        {label}
      </span>
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

function Select({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: [string, string][];
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
        {label}
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-11 w-full rounded-lg border border-zinc-300 bg-white px-3 text-sm text-zinc-900 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
      >
        {options.map(([v, label]) => (
          <option key={v} value={v}>
            {label}
          </option>
        ))}
      </select>
    </label>
  );
}

function Toggle({
  label,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <label
      className={`flex items-center gap-2 text-sm font-medium ${
        disabled ? "text-zinc-400 dark:text-zinc-600" : "text-zinc-700 dark:text-zinc-300"
      }`}
    >
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 rounded border-zinc-300 text-emerald-600 focus:ring-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
      />
      {label}
    </label>
  );
}

type SegValue = string | number | null;

function SegmentedButtons({
  label,
  helper,
  value,
  onChange,
  options,
  clearable,
  emptyValue,
}: {
  label: string;
  helper?: string;
  value: SegValue;
  onChange: (v: SegValue) => void;
  options: { value: SegValue; label: string }[];
  clearable?: boolean;
  emptyValue?: SegValue;
}) {
  return (
    <div>
      <span className="mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
        {label}
      </span>
      <div className="flex gap-2">
        {options.map((opt) => {
          const active = value === opt.value;
          return (
            <button
              key={String(opt.value)}
              type="button"
              onClick={() => onChange(active && clearable ? (emptyValue ?? null) : opt.value)}
              className={`h-10 flex-1 rounded-lg border text-sm font-medium transition-all duration-150 ease-out hover:scale-[1.02] active:scale-95 ${
                active
                  ? "border-transparent bg-gradient-to-r from-fuchsia-500 to-violet-600 text-white shadow-md shadow-violet-500/30"
                  : "border-zinc-300 text-zinc-600 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800"
              }`}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
      {helper && (
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{helper}</p>
      )}
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient, supabaseConfigured } from "@/lib/supabase/client";

type Form = {
  full_name: string;
  age: string;
  city: string;
  bio: string;
  budget_min: string;
  budget_max: string;
  move_in_date: string;
  cleanliness: number;
  sleep_schedule: string;
  smoking: boolean;
  pets: boolean;
  guests: string;
};

const EMPTY: Form = {
  full_name: "",
  age: "",
  city: "",
  bio: "",
  budget_min: "",
  budget_max: "",
  move_in_date: "",
  cleanliness: 3,
  sleep_schedule: "flexible",
  smoking: false,
  pets: false,
  guests: "sometimes",
};

export default function ProfilePage() {
  const [loading, setLoading] = useState(true);
  const [authed, setAuthed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<Form>(EMPTY);

  useEffect(() => {
    if (!supabaseConfigured) {
      setLoading(false);
      return;
    }
    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) {
        setAuthed(false);
        setLoading(false);
        return;
      }
      setAuthed(true);
      const { data: profile } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", data.user.id)
        .single();
      if (profile) {
        setForm({
          full_name: profile.full_name ?? "",
          age: profile.age?.toString() ?? "",
          city: profile.city ?? "",
          bio: profile.bio ?? "",
          budget_min: profile.budget_min?.toString() ?? "",
          budget_max: profile.budget_max?.toString() ?? "",
          move_in_date: profile.move_in_date ?? "",
          cleanliness: profile.cleanliness ?? 3,
          sleep_schedule: profile.sleep_schedule ?? "flexible",
          smoking: profile.smoking ?? false,
          pets: profile.pets ?? false,
          guests: profile.guests ?? "sometimes",
        });
      }
      setLoading(false);
    });
  }, []);

  function update<K extends keyof Form>(key: K, value: Form[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    setSaved(false);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    const supabase = createClient();
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      setError("Your session expired — please log in again.");
      setSaving(false);
      return;
    }
    const { error } = await supabase.from("profiles").upsert({
      id: userData.user.id,
      full_name: form.full_name || null,
      age: form.age ? parseInt(form.age, 10) : null,
      city: form.city || null,
      bio: form.bio || null,
      budget_min: form.budget_min ? parseInt(form.budget_min, 10) : null,
      budget_max: form.budget_max ? parseInt(form.budget_max, 10) : null,
      move_in_date: form.move_in_date || null,
      cleanliness: form.cleanliness,
      sleep_schedule: form.sleep_schedule,
      smoking: form.smoking,
      pets: form.pets,
      guests: form.guests,
    });
    setSaving(false);
    if (error) setError(error.message);
    else setSaved(true);
  }

  if (loading) {
    return <Centered>Loading your profile…</Centered>;
  }

  if (!supabaseConfigured) {
    return (
      <Centered>
        Accounts aren&apos;t connected yet — finish the Supabase setup in
        SETUP.md.
      </Centered>
    );
  }

  if (!authed) {
    return (
      <Centered>
        <p className="text-zinc-600 dark:text-zinc-400">
          Please log in to set up your profile.
        </p>
        <Link
          href="/login"
          className="mt-4 inline-flex h-11 items-center justify-center rounded-full bg-emerald-600 px-6 text-sm font-semibold text-white hover:bg-emerald-700"
        >
          Go to log in
        </Link>
      </Centered>
    );
  }

  return (
    <main className="flex flex-1 flex-col bg-zinc-50 dark:bg-zinc-950">
      <header className="mx-auto flex w-full max-w-2xl items-center justify-between px-6 py-5">
        <Link href="/" className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-600 text-sm font-bold text-white">
            R
          </span>
          <span className="text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            Roomly
          </span>
        </Link>
        <Link
          href="/discover"
          className="rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-emerald-700"
        >
          Discover →
        </Link>
      </header>

      <form
        onSubmit={handleSave}
        className="mx-auto w-full max-w-2xl px-6 pb-16"
      >
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
          Your profile
        </h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          This is what potential roommates see. The lifestyle answers power your
          matches.
        </p>

        <Card title="About you">
          <Text label="Full name" value={form.full_name} onChange={(v) => update("full_name", v)} placeholder="Alex Rivera" />
          <div className="grid grid-cols-2 gap-4">
            <Text label="Age" type="number" value={form.age} onChange={(v) => update("age", v)} placeholder="24" />
            <Text label="City" value={form.city} onChange={(v) => update("city", v)} placeholder="Austin, TX" />
          </div>
          <Area label="Short bio" value={form.bio} onChange={(v) => update("bio", v)} placeholder="A couple sentences about you…" />
        </Card>

        <Card title="What you're looking for">
          <div className="grid grid-cols-2 gap-4">
            <Text label="Budget min ($/mo)" type="number" value={form.budget_min} onChange={(v) => update("budget_min", v)} placeholder="800" />
            <Text label="Budget max ($/mo)" type="number" value={form.budget_max} onChange={(v) => update("budget_max", v)} placeholder="1400" />
          </div>
          <Text label="Move-in date" type="date" value={form.move_in_date} onChange={(v) => update("move_in_date", v)} />
        </Card>

        <Card title="Lifestyle (powers your matches)">
          <div>
            <span className="mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Cleanliness: {cleanlinessLabel(form.cleanliness)}
            </span>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => update("cleanliness", n)}
                  className={`h-10 flex-1 rounded-lg border text-sm font-medium transition-colors ${
                    form.cleanliness === n
                      ? "border-emerald-600 bg-emerald-600 text-white"
                      : "border-zinc-300 text-zinc-600 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800"
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          <Select
            label="Sleep schedule"
            value={form.sleep_schedule}
            onChange={(v) => update("sleep_schedule", v)}
            options={[
              ["early_bird", "Early bird"],
              ["night_owl", "Night owl"],
              ["flexible", "Flexible"],
            ]}
          />

          <Select
            label="Guests over"
            value={form.guests}
            onChange={(v) => update("guests", v)}
            options={[
              ["rarely", "Rarely"],
              ["sometimes", "Sometimes"],
              ["often", "Often"],
            ]}
          />

          <div className="flex gap-6">
            <Toggle label="I smoke" checked={form.smoking} onChange={(v) => update("smoking", v)} />
            <Toggle label="I have pets" checked={form.pets} onChange={(v) => update("pets", v)} />
          </div>
        </Card>

        {error && (
          <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">
            {error}
          </p>
        )}
        {saved && (
          <p className="mt-4 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
            Saved! Your profile is up to date.
          </p>
        )}

        <button
          type="submit"
          disabled={saving}
          className="mt-6 flex h-12 w-full items-center justify-center rounded-full bg-emerald-600 text-sm font-semibold text-white transition-colors hover:bg-emerald-700 disabled:opacity-60"
        >
          {saving ? "Saving…" : "Save profile"}
        </button>
      </form>
    </main>
  );
}

function cleanlinessLabel(n: number) {
  return ["", "Relaxed", "Easygoing", "Tidy", "Very tidy", "Spotless"][n] ?? "";
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-6 py-16 text-center">
      <div className="max-w-sm text-zinc-600 dark:text-zinc-400">{children}</div>
    </main>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-6 space-y-4 rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
        {title}
      </h2>
      {children}
    </section>
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

function Area({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
        {label}
      </span>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={3}
        className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
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
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2 text-sm font-medium text-zinc-700 dark:text-zinc-300">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 rounded border-zinc-300 text-emerald-600 focus:ring-emerald-500"
      />
      {label}
    </label>
  );
}

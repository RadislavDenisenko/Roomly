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
  photos: string[];
  db_nonsmokers_only: boolean;
  db_no_pet_owners: boolean;
  db_budget_overlap_only: boolean;
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
  photos: [],
  db_nonsmokers_only: false,
  db_no_pet_owners: false,
  db_budget_overlap_only: false,
};

const MAX_PHOTOS = 6;

export default function ProfilePage() {
  // Seed from supabaseConfigured (a stable build-time constant) so we never need a
  // synchronous setLoading(false) in the effect when accounts aren't connected.
  const [loading, setLoading] = useState(supabaseConfigured);
  const [authed, setAuthed] = useState(false);
  const [vStatus, setVStatus] = useState<"unverified" | "pending" | "verified">("unverified");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<Form>(EMPTY);
  const [uploading, setUploading] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);

  useEffect(() => {
    if (!supabaseConfigured) return;
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
      setVStatus((profile?.verification_status as "unverified" | "pending" | "verified") ?? "unverified");
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
          photos:
            profile.photos && profile.photos.length > 0
              ? profile.photos
              : profile.avatar_url
                ? [profile.avatar_url]
                : [],
          db_nonsmokers_only: profile.db_nonsmokers_only ?? false,
          db_no_pet_owners: profile.db_no_pet_owners ?? false,
          db_budget_overlap_only: profile.db_budget_overlap_only ?? false,
        });
      }
      setLoading(false);
    });
  }, []);

  function update<K extends keyof Form>(key: K, value: Form[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    setSaved(false);
  }

  async function handleAddPhotos(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = ""; // let the same file be re-selected later
    if (!files.length) return;
    setError(null);
    setUploading(true);
    const supabase = createClient();
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      setUploading(false);
      return;
    }
    const uid = userData.user.id;
    const room = MAX_PHOTOS - form.photos.length;
    const urls: string[] = [];
    for (const file of files.slice(0, room)) {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${uid}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("avatars")
        .upload(path, file, { upsert: true });
      if (upErr) {
        setError("Photo upload failed — is the 'avatars' storage bucket set up? " + upErr.message);
        setUploading(false);
        return;
      }
      const { data: pub } = supabase.storage.from("avatars").getPublicUrl(path);
      urls.push(pub.publicUrl);
    }
    setForm((f) => ({ ...f, photos: [...f.photos, ...urls] }));
    setSaved(false);
    setUploading(false);
  }

  function removePhoto(idx: number) {
    setForm((f) => ({ ...f, photos: f.photos.filter((_, i) => i !== idx) }));
    setSaved(false);
  }

  function makeMain(idx: number) {
    setForm((f) => {
      const next = [...f.photos];
      const [pick] = next.splice(idx, 1);
      return { ...f, photos: [pick, ...next] };
    });
    setSaved(false);
  }

  function reorder(from: number, to: number) {
    if (from === to) return;
    setForm((f) => {
      const next = [...f.photos];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return { ...f, photos: next };
    });
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
      avatar_url: form.photos[0] ?? null,
      photos: form.photos,
      db_nonsmokers_only: form.db_nonsmokers_only,
      db_no_pet_owners: form.db_no_pet_owners,
      db_budget_overlap_only: form.db_budget_overlap_only,
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
          className="roomly-btn mt-4 h-11 px-6 text-sm"
        >
          Go to log in
        </Link>
      </Centered>
    );
  }

  return (
    <main className="roomly-page flex flex-1 flex-col">
      <header className="mx-auto flex w-full max-w-2xl items-center justify-between px-6 py-5">
        <Link href="/" className="flex items-center gap-2">
          <span className="roomly-mark h-8 w-8 text-sm">
            R
          </span>
          <span className="text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            Roomly
          </span>
        </Link>
        <Link
          href="/discover"
          className="roomly-btn px-4 py-2 text-sm"
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
        <Link
          href="/verify"
          className="mt-5 flex items-center justify-between rounded-2xl border border-zinc-200 bg-white/80 px-5 py-4 backdrop-blur transition-all hover:-translate-y-0.5 hover:shadow-md hover:shadow-violet-500/10 dark:border-zinc-800 dark:bg-zinc-900/80"
        >
          <span className="flex items-center gap-3">
            <span aria-hidden="true" className="text-xl">{vStatus === "verified" ? "✅" : "🛡️"}</span>
            <span>
              <span className="block text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                {vStatus === "verified" ? "You're verified" : "Get verified"}
              </span>
              <span className="block text-xs text-zinc-500 dark:text-zinc-400">
                {vStatus === "verified" ? "You can match and message." : "Required to match and message on Roomly."}
              </span>
            </span>
          </span>
          <span aria-hidden="true" className="text-violet-600 dark:text-violet-400">→</span>
        </Link>

        <Link
          href="/apartments/saved"
          className="mt-5 flex items-center justify-between rounded-2xl border border-zinc-200 bg-white/80 px-5 py-4 backdrop-blur transition-all hover:-translate-y-0.5 hover:shadow-md hover:shadow-violet-500/10 dark:border-zinc-800 dark:bg-zinc-900/80"
        >
          <span className="flex items-center gap-3">
            <span aria-hidden="true" className="text-xl">❤️</span>
            <span>
              <span className="block text-sm font-semibold text-zinc-900 dark:text-zinc-50">Your saved places</span>
              <span className="block text-xs text-zinc-500 dark:text-zinc-400">Apartments you&apos;ve hearted</span>
            </span>
          </span>
          <span aria-hidden="true" className="text-violet-600 dark:text-violet-400">→</span>
        </Link>

        <Card title="Photos">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Add up to {MAX_PHOTOS}. Drag photos to reorder — the first is your
            main one (or use “Make main”).
          </p>
          <div className="grid grid-cols-3 gap-3">
            {form.photos.map((url, i) => (
              <div
                key={url}
                draggable
                onDragStart={() => setDragIndex(i)}
                onDragEnter={() => setOverIndex(i)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => {
                  if (dragIndex !== null) reorder(dragIndex, i);
                  setDragIndex(null);
                  setOverIndex(null);
                }}
                onDragEnd={() => {
                  setDragIndex(null);
                  setOverIndex(null);
                }}
                className={`group relative aspect-[3/4] cursor-move overflow-hidden rounded-2xl bg-zinc-100 ring-2 transition-all dark:bg-zinc-800 ${
                  dragIndex === i
                    ? "opacity-40 ring-transparent"
                    : overIndex === i
                      ? "ring-violet-500"
                      : "ring-transparent"
                }`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt={`Photo ${i + 1}`} draggable={false} className="h-full w-full object-cover" />
                {i === 0 && (
                  <span className="absolute left-1.5 top-1.5 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                    Main
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => removePhoto(i)}
                  aria-label="Remove photo"
                  className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-black/55 text-xs text-white backdrop-blur transition-transform hover:scale-110 active:scale-90"
                >
                  ✕
                </button>
                {i !== 0 && (
                  <button
                    type="button"
                    onClick={() => makeMain(i)}
                    className="absolute inset-x-1.5 bottom-1.5 rounded-full bg-white/90 py-1 text-[11px] font-semibold text-zinc-800 opacity-0 backdrop-blur transition-opacity group-hover:opacity-100 focus:opacity-100 dark:bg-zinc-900/90 dark:text-zinc-100"
                  >
                    Make main
                  </button>
                )}
              </div>
            ))}

            {form.photos.length < MAX_PHOTOS && (
              <label className="flex aspect-[3/4] cursor-pointer flex-col items-center justify-center gap-1 rounded-2xl border-2 border-dashed border-zinc-300 text-zinc-500 transition-colors hover:border-violet-400 hover:text-violet-600 dark:border-zinc-700 dark:text-zinc-400 dark:hover:border-violet-500">
                {uploading ? (
                  <span className="text-xs font-medium">Uploading…</span>
                ) : (
                  <>
                    <span className="text-2xl leading-none">＋</span>
                    <span className="text-xs font-medium">Add</span>
                  </>
                )}
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleAddPhotos}
                  className="hidden"
                  disabled={uploading}
                />
              </label>
            )}
          </div>
        </Card>

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

        <Card title="Dealbreakers (hard filters)">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Turn these on to completely hide anyone who does not meet them in Discover.
          </p>
          <div className="space-y-3">
            <Toggle label="Only show non-smokers" checked={form.db_nonsmokers_only} onChange={(v) => update("db_nonsmokers_only", v)} />
            <Toggle label="Hide people who have pets" checked={form.db_no_pet_owners} onChange={(v) => update("db_no_pet_owners", v)} />
            <Toggle label="Only budgets that overlap mine" checked={form.db_budget_overlap_only} onChange={(v) => update("db_budget_overlap_only", v)} />
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
          className="roomly-btn mt-6 h-12 w-full text-sm"
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
    <main className="roomly-page flex flex-1 flex-col items-center justify-center px-6 py-16 text-center">
      <div className="max-w-sm text-zinc-600 dark:text-zinc-400">{children}</div>
    </main>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-6 space-y-4 rounded-3xl border border-zinc-200 bg-white/80 p-5 backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/80">
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

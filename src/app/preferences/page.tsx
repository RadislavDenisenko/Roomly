"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient, supabaseConfigured } from "@/lib/supabase/client";
import { TAG_LABELS } from "@/lib/places";

// The Zillow step: between the quiz and the deck. What you'd pay, where, and
// what needs to be nearby — so the deck shows places you meant, not a shuffle.

const BUDGET_ZONES = [
  { min: 500, max: 800, emoji: "💵", label: "Under $800" },
  { min: 800, max: 1200, emoji: "💰", label: "$800 – $1,200" },
  { min: 1200, max: 1600, emoji: "🏦", label: "$1,200 – $1,600" },
  { min: 1600, max: 2400, emoji: "💎", label: "$1,600+" },
];

export default function PreferencesPage() {
  return (
    <Suspense fallback={null}>
      <PreferencesInner />
    </Suspense>
  );
}

function PreferencesInner() {
  const router = useRouter();
  // Onboarding passes ?next=/verify; everyone else lands on the deck.
  const nextParam = useSearchParams().get("next");
  const next = nextParam && nextParam.startsWith("/") ? nextParam : "/places";

  const [loading, setLoading] = useState(supabaseConfigured);
  const [authed, setAuthed] = useState(false);
  const [uid, setUid] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [zone, setZone] = useState<number | null>(null); // index into BUDGET_ZONES
  const [areas, setAreas] = useState<Set<string>>(new Set());
  const [tags, setTags] = useState<Set<string>>(new Set());
  const [areaQuery, setAreaQuery] = useState("");
  const [allAreas, setAllAreas] = useState<string[]>([]);

  useEffect(() => {
    if (!supabaseConfigured) return;
    const supabase = createClient();
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user) {
        setLoading(false);
        return;
      }
      setAuthed(true);
      setUid(data.user.id);

      const { data: profile } = await supabase
        .from("profiles")
        .select("budget_min, budget_max, pref_areas, pref_tags")
        .eq("id", data.user.id)
        .single();
      if (profile) {
        const zi = BUDGET_ZONES.findIndex(
          (z) => z.min === profile.budget_min && z.max === profile.budget_max,
        );
        if (zi >= 0) setZone(zi);
        setAreas(new Set((profile.pref_areas ?? []) as string[]));
        setTags(new Set((profile.pref_tags ?? []) as string[]));
      }

      const { data: placeRows } = await supabase
        .from("places")
        .select("neighborhood")
        .not("neighborhood", "is", null);
      const unique = [...new Set((placeRows ?? []).map((r: { neighborhood: string }) => r.neighborhood))];
      setAllAreas(unique.sort());
      setLoading(false);
    })();
  }, []);

  const visibleAreas = useMemo(() => {
    const q = areaQuery.trim().toLowerCase();
    // Selected areas always stay visible so a search can't hide your choices.
    return allAreas.filter((a) => areas.has(a) || !q || a.toLowerCase().includes(q));
  }, [allAreas, areaQuery, areas]);

  function toggle(set: Set<string>, value: string, apply: (s: Set<string>) => void) {
    const nextSet = new Set(set);
    if (nextSet.has(value)) nextSet.delete(value);
    else nextSet.add(value);
    apply(nextSet);
  }

  async function save() {
    if (!uid) return;
    setSaving(true);
    setError(null);
    const supabase = createClient();
    const z = zone != null ? BUDGET_ZONES[zone] : null;
    const { error: saveError } = await supabase
      .from("profiles")
      .update({
        budget_min: z?.min ?? null,
        budget_max: z?.max ?? null,
        pref_areas: [...areas],
        pref_tags: [...tags],
      })
      .eq("id", uid);
    setSaving(false);
    if (saveError) {
      setError("That didn't save — give it a second and try again.");
      return;
    }
    router.push(next);
  }

  if (loading) return <Centered>Loading…</Centered>;
  if (!supabaseConfigured)
    return <Centered>Accounts aren&apos;t connected yet — see SETUP.md.</Centered>;
  if (!authed)
    return (
      <Centered>
        <p className="text-zinc-600 dark:text-zinc-400">Log in to set up your search.</p>
        <Link href="/login" className="roomly-btn mt-4 h-11 px-6 text-sm">
          Go to log in
        </Link>
      </Centered>
    );

  return (
    <main className="roomly-page flex flex-1 flex-col">
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col px-6 py-8">
        <p className="font-mono text-xs font-semibold uppercase tracking-[0.18em] text-brick-600 dark:text-brick-400">
          Your search
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
          What are you looking for?
        </h1>
        <p className="mt-2 text-sm leading-6 text-zinc-500 dark:text-zinc-400">
          So the deck shows places you&apos;d actually take — not a shuffle of
          random apartments. Change any of it later from the deck.
        </p>

        <section className="mt-8">
          <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">Monthly rent</h2>
          <div className="mt-3 grid grid-cols-2 gap-2.5">
            {BUDGET_ZONES.map((z, i) => (
              <button
                key={z.label}
                type="button"
                onClick={() => setZone(zone === i ? null : i)}
                className={`flex items-center gap-2 rounded-2xl border-2 px-4 py-3 text-sm font-medium transition-all active:scale-[0.98] ${
                  zone === i
                    ? "border-brick-600 bg-brick-50 text-brick-800 dark:bg-brick-950 dark:text-brick-100"
                    : "border-zinc-200 bg-white/80 text-zinc-800 hover:border-brick-300 dark:border-zinc-800 dark:bg-zinc-900/80 dark:text-zinc-100"
                }`}
              >
                <span aria-hidden>{z.emoji}</span>
                {z.label}
              </button>
            ))}
          </div>
        </section>

        <section className="mt-8">
          <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">Areas</h2>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            Pick any — leave empty for anywhere in Austin.
          </p>
          <input
            value={areaQuery}
            onChange={(e) => setAreaQuery(e.target.value)}
            placeholder="Search neighborhoods…"
            aria-label="Search neighborhoods"
            className="mt-3 h-11 w-full rounded-xl border border-zinc-300 bg-white px-4 text-sm text-zinc-900 outline-none focus:border-brick-500 focus:ring-2 focus:ring-brick-500/20 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
          />
          <div className="mt-3 flex flex-wrap gap-2">
            {visibleAreas.map((a) => (
              <button
                key={a}
                type="button"
                onClick={() => toggle(areas, a, setAreas)}
                className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition-all active:scale-95 ${
                  areas.has(a)
                    ? "bg-emerald-700 text-white shadow-sm"
                    : "border border-zinc-200 text-zinc-600 hover:border-emerald-400 dark:border-zinc-700 dark:text-zinc-300"
                }`}
              >
                {areas.has(a) ? "✓ " : ""}
                {a}
              </button>
            ))}
            {visibleAreas.length === 0 && (
              <p className="text-sm text-zinc-400">No neighborhood matches that.</p>
            )}
          </div>
        </section>

        <section className="mt-8">
          <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">Needs to be nearby</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {Object.entries(TAG_LABELS).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => toggle(tags, key, setTags)}
                className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition-all active:scale-95 ${
                  tags.has(key)
                    ? "bg-emerald-700 text-white shadow-sm"
                    : "border border-zinc-200 text-zinc-600 hover:border-emerald-400 dark:border-zinc-700 dark:text-zinc-300"
                }`}
              >
                {tags.has(key) ? "✓ " : ""}
                {label}
              </button>
            ))}
          </div>
        </section>

        {error && (
          <p className="mt-6 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">
            {error}
          </p>
        )}

        <button
          type="button"
          onClick={() => void save()}
          disabled={saving}
          className="roomly-btn mt-8 h-13 w-full text-base"
        >
          {saving ? "Saving…" : "Show me my places →"}
        </button>
        <Link
          href={next}
          className="mt-3 pb-8 text-center text-sm font-medium text-zinc-400 underline-offset-2 hover:underline"
        >
          Skip — show me everything
        </Link>
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

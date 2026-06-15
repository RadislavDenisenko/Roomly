"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient, supabaseConfigured } from "@/lib/supabase/client";
import { VerifiedBadge } from "@/components/VerifiedBadge";
import {
  type Listing,
  listingMainPhoto,
  formatRent,
  bedBath,
  isMissingTable,
  DEMO_LISTINGS,
} from "@/lib/listings";

export default function ApartmentsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(supabaseConfigured);
  const [authed, setAuthed] = useState(false);
  const [listings, setListings] = useState<Listing[]>([]);
  const [saved, setSaved] = useState<Set<string>>(new Set());
  const [demo, setDemo] = useState(false);
  const [myId, setMyId] = useState<string | null>(null);

  // filters
  const [query, setQuery] = useState("");
  const [maxRent, setMaxRent] = useState(3000);
  const [minBeds, setMinBeds] = useState(0);
  const [minBaths, setMinBaths] = useState(0);
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [sort, setSort] = useState<"new" | "price-asc" | "price-desc">("new");

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
      setMyId(userData.user.id);

      const { data, error } = await supabase
        .from("listings")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) {
        if (isMissingTable(error)) {
          setListings(DEMO_LISTINGS);
          setDemo(true);
        }
        setLoading(false);
        return;
      }
      setListings((data ?? []) as Listing[]);

      const { data: savedRows } = await supabase
        .from("saved_listings")
        .select("listing_id")
        .eq("user_id", userData.user.id);
      setSaved(new Set((savedRows ?? []).map((r: { listing_id: string }) => r.listing_id)));
      setLoading(false);
    })();
  }, []);

  async function toggleSave(id: string) {
    const isSaved = saved.has(id);
    setSaved((s) => {
      const next = new Set(s);
      if (isSaved) next.delete(id);
      else next.add(id);
      return next;
    });
    if (demo || !myId) return; // demo mode keeps saves in memory only
    const supabase = createClient();
    if (isSaved) {
      await supabase.from("saved_listings").delete().eq("user_id", myId).eq("listing_id", id);
    } else {
      await supabase.from("saved_listings").upsert({ user_id: myId, listing_id: id });
    }
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let out = listings.filter((l) => {
      if (q) {
        const hay = `${l.title} ${l.city ?? ""} ${l.neighborhood ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (maxRent < 3000 && (l.rent == null || l.rent > maxRent)) return false;
      if (minBeds > 0 && (l.bedrooms ?? 0) < minBeds) return false;
      if (minBaths > 0 && (l.bathrooms ?? 0) < minBaths) return false;
      if (verifiedOnly && !l.verified) return false;
      return true;
    });
    if (sort !== "new") {
      out = [...out].sort((a, b) => {
        const ar = a.rent ?? Infinity;
        const br = b.rent ?? Infinity;
        return sort === "price-asc" ? ar - br : br - ar;
      });
    }
    return out;
  }, [listings, query, maxRent, minBeds, minBaths, verifiedOnly, sort]);

  const hasActiveFilters =
    query.trim() !== "" || maxRent < 3000 || minBeds > 0 || minBaths > 0 || verifiedOnly;

  function resetFilters() {
    setQuery("");
    setMaxRent(3000);
    setMinBeds(0);
    setMinBaths(0);
    setVerifiedOnly(false);
    setSort("new");
  }

  return (
    <main className="roomly-page flex flex-1 flex-col">
      <header className="mx-auto flex w-full max-w-2xl items-center justify-between px-6 py-5">
        <Link href="/" className="flex items-center gap-2">
          <span className="roomly-mark h-8 w-8 text-sm">R</span>
          <span className="text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">Roomly</span>
        </Link>
        <nav className="flex items-center gap-4 text-sm font-medium">
          <Link href="/apartments/together" className="text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100">
            Together
          </Link>
          <Link href="/apartments/new" className="roomly-btn px-4 py-2 text-sm">
            Post a place
          </Link>
        </nav>
      </header>

      <div className="mx-auto w-full max-w-2xl flex-1 px-6 pb-16">
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">Apartments</h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Verified places posted right here on Roomly — no scraped listings, no fakes.
        </p>
        {demo && (
          <div className="mt-4 rounded-2xl border border-violet-200 bg-violet-50 px-4 py-3 text-sm text-violet-800 dark:border-violet-900/50 dark:bg-violet-950/40 dark:text-violet-200">
            ✨ Showing demo listings. Run <code className="rounded bg-violet-100 px-1 py-0.5 font-mono text-xs dark:bg-violet-900/50">supabase/schema.sql</code> to switch to real, saved data.
          </div>
        )}

        {loading ? (
          <p className="mt-10 text-center text-sm text-zinc-500">Loading places…</p>
        ) : !supabaseConfigured ? (
          <Empty title="Accounts aren't connected yet" body="Finish the Supabase setup in SETUP.md." />
        ) : !authed ? (
          <div className="mt-10 text-center">
            <p className="text-sm text-zinc-600 dark:text-zinc-400">Log in to browse apartments.</p>
            <Link href="/login" className="roomly-btn mt-4 h-11 px-6 text-sm">
              Go to log in
            </Link>
          </div>
        ) : listings.length === 0 ? (
          <div className="mt-10 text-center">
            <p className="text-base font-semibold text-zinc-900 dark:text-zinc-50">No places listed yet.</p>
            <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">Be the first — post a place for roommates to find.</p>
            <Link href="/apartments/new" className="roomly-btn mt-6 h-11 px-6 text-sm">
              Post a place
            </Link>
          </div>
        ) : (
          <>
            <div className="mt-6 space-y-4 rounded-3xl border border-zinc-200 bg-white/80 p-4 backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/80">
              <div className="flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-3 dark:border-zinc-700 dark:bg-zinc-950">
                <span aria-hidden="true" className="text-zinc-400">🔍</span>
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search city or neighborhood"
                  aria-label="Search apartments"
                  className="h-10 flex-1 bg-transparent text-sm text-zinc-900 outline-none dark:text-zinc-100"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Segmented label="Beds" value={minBeds} onChange={setMinBeds} options={[{ v: 0, label: "Any" }, { v: 1, label: "1+" }, { v: 2, label: "2+" }, { v: 3, label: "3+" }]} />
                <Segmented label="Baths" value={minBaths} onChange={setMinBaths} options={[{ v: 0, label: "Any" }, { v: 1, label: "1+" }, { v: 2, label: "2+" }]} />
              </div>
              <div>
                <div className="mb-1.5 flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Max rent</span>
                  <span className="text-sm font-bold text-violet-600 dark:text-violet-400">{maxRent >= 3000 ? "Any" : `$${maxRent.toLocaleString()}/mo`}</span>
                </div>
                <input
                  type="range"
                  min={500}
                  max={3000}
                  step={50}
                  value={maxRent}
                  onChange={(e) => setMaxRent(parseInt(e.target.value, 10))}
                  aria-label="Maximum rent"
                  className="w-full accent-violet-600"
                />
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <label className="flex items-center gap-2 text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  <input type="checkbox" checked={verifiedOnly} onChange={(e) => setVerifiedOnly(e.target.checked)} className="h-4 w-4 rounded accent-violet-600" />
                  Verified only
                </label>
                <select
                  value={sort}
                  onChange={(e) => setSort(e.target.value as "new" | "price-asc" | "price-desc")}
                  aria-label="Sort listings"
                  className="h-9 rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                >
                  <option value="new">Newest</option>
                  <option value="price-asc">Price: low to high</option>
                  <option value="price-desc">Price: high to low</option>
                </select>
              </div>
            </div>

            <div className="mt-4 flex items-center justify-between text-sm">
              <span className="text-zinc-500 dark:text-zinc-400">
                {filtered.length} of {listings.length} {listings.length === 1 ? "place" : "places"}
              </span>
              {hasActiveFilters && (
                <button type="button" onClick={resetFilters} className="font-medium text-violet-600 hover:underline dark:text-violet-400">
                  Clear filters
                </button>
              )}
            </div>

            {filtered.length === 0 ? (
              <div className="mt-8 rounded-3xl border border-zinc-200 bg-white/70 p-8 text-center dark:border-zinc-800 dark:bg-zinc-900/70">
                <p className="text-base font-semibold text-zinc-900 dark:text-zinc-50">No places match those filters.</p>
                <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">Try widening your budget or beds.</p>
                <button type="button" onClick={resetFilters} className="roomly-btn mt-5 h-10 px-5 text-sm">Clear filters</button>
              </div>
            ) : (
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                {filtered.map((l, i) => (
              <article
                key={l.id}
                role="button"
                tabIndex={0}
                onClick={() => router.push(`/apartments/${l.id}`)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    router.push(`/apartments/${l.id}`);
                  }
                }}
                style={{ animationDelay: `${i * 50}ms` }}
                className="roomly-card-in group cursor-pointer overflow-hidden rounded-3xl border border-zinc-200 bg-white/80 text-left shadow-sm backdrop-blur transition-all duration-200 ease-out hover:-translate-y-0.5 hover:shadow-lg hover:shadow-violet-500/10 dark:border-zinc-800 dark:bg-zinc-900/80"
              >
                <div className="relative aspect-[4/3] w-full overflow-hidden bg-zinc-200 dark:bg-zinc-800">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={listingMainPhoto(l)}
                    alt={l.title}
                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                  <div className="absolute left-3 top-3">
                    {l.verified && <VerifiedBadge label="Verified place" />}
                  </div>
                  <button
                    type="button"
                    aria-label={saved.has(l.id) ? "Unsave" : "Save"}
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleSave(l.id);
                    }}
                    className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-black/45 text-lg backdrop-blur transition-transform hover:scale-110 active:scale-90"
                  >
                    {saved.has(l.id) ? "❤️" : "🤍"}
                  </button>
                  <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-3 pt-10">
                    <p className="text-lg font-bold text-white">{formatRent(l.rent)}</p>
                  </div>
                </div>
                <div className="p-4">
                  <h2 className="truncate font-semibold text-zinc-900 dark:text-zinc-50">{l.title}</h2>
                  <p className="mt-0.5 truncate text-sm text-zinc-500 dark:text-zinc-400">
                    {[l.neighborhood, l.city].filter(Boolean).join(", ") || "—"}
                  </p>
                  <p className="mt-2 text-xs font-medium text-zinc-600 dark:text-zinc-300">{bedBath(l)}</p>
                </div>
              </article>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}

function Segmented({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  options: { v: number; label: string }[];
}) {
  return (
    <div>
      <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">{label}</span>
      <div className="flex gap-1.5">
        {options.map((o) => (
          <button
            key={o.v}
            type="button"
            onClick={() => onChange(o.v)}
            className={`h-9 flex-1 rounded-xl border text-sm font-medium transition-all ${
              value === o.v
                ? "border-transparent bg-gradient-to-r from-fuchsia-500 to-violet-600 text-white shadow-sm"
                : "border-zinc-200 text-zinc-600 hover:border-violet-300 dark:border-zinc-700 dark:text-zinc-300 dark:hover:border-violet-700"
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function Empty({ title, body }: { title: string; body: string }) {
  return (
    <div className="mt-10 rounded-3xl border border-zinc-200 bg-white/70 p-8 text-center dark:border-zinc-800 dark:bg-zinc-900/70">
      <p className="text-base font-semibold text-zinc-900 dark:text-zinc-50">{title}</p>
      <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">{body}</p>
    </div>
  );
}

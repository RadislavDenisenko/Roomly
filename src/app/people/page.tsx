"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { createClient, supabaseConfigured } from "@/lib/supabase/client";
import { AppNav } from "@/components/AppNav";
import { ProfileDetail } from "@/components/ProfileDetail";
import { mainPhoto } from "@/lib/photos";
import { isMissingTable } from "@/lib/listings";
import {
  compatibility,
  reasons,
  axisScores,
  passesDealbreakers,
  scoreTier,
  type CompatProfile,
  type Dealbreakers,
} from "@/lib/compat";
import type { PoolPerson } from "@/lib/people";

type MyProfile = CompatProfile & Dealbreakers;
type LikedPlace = { id: string; name: string; city: string | null; neighborhood: string | null };
type ScoredPerson = PoolPerson & { score: number };
type Pool = { people: ScoredPerson[]; areaFallback: boolean };

// Scripted demo data shown when the app tables haven't been created yet.
const DEMO_PLACES_LIKED: LikedPlace[] = [
  { id: "demo-place-1", name: "The Triangle", city: "Austin, TX", neighborhood: "Triangle State" },
  { id: "demo-place-2", name: "East 6th Lofts", city: "Austin, TX", neighborhood: "East Austin" },
];

const DEMO_PEOPLE: PoolPerson[] = [
  {
    id: "demo-person-1", full_name: "Jordan Pierce", age: 27, city: "Austin, TX",
    bio: "Software engineer who loves morning runs.", avatar_url: null, photos: null,
    budget_min: 1100, budget_max: 1600, cleanliness: 4, sleep_schedule: "early_bird",
    smoking: false, pets: true, guests: "sometimes", email_verified: true,
    verification_status: "verified", member_group: "seeker",
  },
  {
    id: "demo-person-2", full_name: "Sam Rivera", age: 24, city: "Austin, TX",
    bio: "Grad student, quiet during the week.", avatar_url: null, photos: null,
    budget_min: 1000, budget_max: 1400, cleanliness: 5, sleep_schedule: "night_owl",
    smoking: false, pets: false, guests: "rarely", email_verified: true,
    verification_status: "verified", member_group: "seeker",
  },
  {
    id: "demo-person-3", full_name: "Casey Nguyen", age: 29, city: "Austin, TX",
    bio: "Already lives at The Triangle, looking for a roommate.", avatar_url: null, photos: null,
    budget_min: 1200, budget_max: 1800, cleanliness: 3, sleep_schedule: "flexible",
    smoking: false, pets: false, guests: "sometimes", email_verified: true,
    verification_status: "verified", member_group: "resident",
  },
];

const DEMO_POOLS: Record<string, PoolPerson[]> = {
  "demo-place-1": [DEMO_PEOPLE[0], DEMO_PEOPLE[2]],
  "demo-place-2": [DEMO_PEOPLE[1]],
};

function scoreColor(s: number) {
  if (s >= 70) return "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300";
  if (s >= 45) return "bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300";
  return "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300";
}

function withScores(people: PoolPerson[], me: MyProfile): ScoredPerson[] {
  return people
    .filter((p) => passesDealbreakers(me, p))
    .map((p) => ({ ...p, score: compatibility(me, p) }))
    .sort((a, b) => {
      if (a.member_group !== b.member_group) return a.member_group === "resident" ? -1 : 1;
      return b.score - a.score;
    });
}

export default function PeoplePage() {
  return (
    <Suspense fallback={<Centered>Loading people…</Centered>}>
      <PeopleInner />
    </Suspense>
  );
}

function PeopleInner() {
  const requestedPlace = useSearchParams().get("place");
  const [loading, setLoading] = useState(supabaseConfigured);
  const [authed, setAuthed] = useState(false);
  const [meVerified, setMeVerified] = useState(false);
  const [me, setMe] = useState<MyProfile | null>(null);
  const [demo, setDemo] = useState(false);
  const [likedPlaces, setLikedPlaces] = useState<LikedPlace[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pools, setPools] = useState<Record<string, Pool>>({});
  const [poolLoading, setPoolLoading] = useState(false);
  const [cityWide, setCityWide] = useState<ScoredPerson[] | null>(null);
  const [detailPerson, setDetailPerson] = useState<ScoredPerson | null>(null);
  const [match, setMatch] = useState<ScoredPerson | null>(null);

  // Last resort when a pool and its area are both empty: everyone verified.
  const cityWideLoaded = useRef(false);
  const loadCityWide = useCallback(async (meProfile: MyProfile, uid: string) => {
    if (cityWideLoaded.current) return;
    cityWideLoaded.current = true;
    const supabase = createClient();
    const { data: blockRows } = await supabase
      .from("blocks")
      .select("blocker_id, blocked_id")
      .or(`blocker_id.eq.${uid},blocked_id.eq.${uid}`);
    const blocked = new Set(
      (blockRows ?? []).map((b: { blocker_id: string; blocked_id: string }) =>
        b.blocker_id === uid ? b.blocked_id : b.blocker_id,
      ),
    );
    const { data: myLikes } = await supabase.from("likes").select("liked_id").eq("liker_id", uid);
    const liked = new Set((myLikes ?? []).map((l: { liked_id: string }) => l.liked_id));
    const { data: myPasses } = await supabase.from("passes").select("passed_id").eq("passer_id", uid);
    const passed = new Set((myPasses ?? []).map((p: { passed_id: string }) => p.passed_id));

    const { data: others } = await supabase
      .from("profiles")
      .select("*")
      .neq("id", uid)
      .eq("people_visible", true)
      .not("full_name", "is", null);
    const filtered = ((others ?? []) as CompatProfile[]).filter((p) => {
      if (p.verification_status !== "verified") return false;
      if (blocked.has(p.id)) return false;
      if (liked.has(p.id)) return false;
      if (passed.has(p.id)) return false;
      return passesDealbreakers(meProfile, p);
    });
    setCityWide(
      filtered
        .map((p) => ({ ...p, member_group: "seeker" as const, score: compatibility(meProfile, p) }))
        .sort((a, b) => b.score - a.score)
        .slice(0, 20),
    );
  }, []);

  // Load one place's pool: the place's own pool, else people looking in its
  // area, else (once) the city-wide everyone-on-Roomly fallback.
  const loadPool = useCallback(
    async (place: LikedPlace, meProfile: MyProfile, isDemo: boolean) => {
      if (isDemo) {
        setPools((prev) => ({
          ...prev,
          [place.id]: { people: withScores(DEMO_POOLS[place.id] ?? [], meProfile), areaFallback: false },
        }));
        return;
      }
      setPoolLoading(true);
      const supabase = createClient();
      const { data, error } = await supabase.rpc("people_for_place", { pid: place.id });
      let people = error ? [] : ((data ?? []) as PoolPerson[]);
      let areaFallback = false;
      if (people.length === 0) {
        const { data: areaData, error: areaError } = await supabase.rpc("people_for_area", {
          p_city: place.city,
          p_neighborhood: place.neighborhood,
        });
        people = areaError ? [] : ((areaData ?? []) as PoolPerson[]);
        areaFallback = people.length > 0;
      }
      const scored = withScores(people, meProfile);
      setPools((prev) => ({ ...prev, [place.id]: { people: scored, areaFallback } }));
      setPoolLoading(false);
      if (scored.length === 0) void loadCityWide(meProfile, meProfile.id);
    },
    [loadCityWide],
  );

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
      const uid = userData.user.id;

      const { data: meRow, error: meError } = await supabase.from("profiles").select("*").eq("id", uid).single();
      const meProfile = (meRow ?? { id: uid }) as MyProfile;
      const verified = meProfile.verification_status === "verified";
      setMe(meProfile);
      setMeVerified(verified);

      const { data: prRows, error: prError } = await supabase
        .from("place_reactions")
        .select("place_id, created_at")
        .eq("user_id", uid)
        .eq("reaction", "like")
        .order("created_at", { ascending: false });

      if ((meError && isMissingTable(meError)) || (prError && isMissingTable(prError))) {
        setDemo(true);
        setLikedPlaces(DEMO_PLACES_LIKED);
        const first =
          DEMO_PLACES_LIKED.find((p) => p.id === requestedPlace) ?? DEMO_PLACES_LIKED[0];
        setSelectedId(first.id);
        for (const p of DEMO_PLACES_LIKED) void loadPool(p, meProfile, true);
        setLoading(false);
        return;
      }

      if (!verified) {
        setLoading(false);
        return;
      }

      const likedIds = (prRows ?? []).map((r: { place_id: string }) => r.place_id);
      if (likedIds.length === 0) {
        setLoading(false);
        return;
      }

      const { data: placeRows } = await supabase
        .from("places")
        .select("id, name, city, neighborhood")
        .in("id", likedIds);
      const byId = new Map((placeRows ?? []).map((p: LikedPlace) => [p.id, p]));
      const placesLiked = likedIds.map((id) => byId.get(id)).filter(Boolean) as LikedPlace[];
      setLikedPlaces(placesLiked);

      const first = placesLiked.find((p) => p.id === requestedPlace) ?? placesLiked[0];
      if (first) {
        setSelectedId(first.id);
        await loadPool(first, meProfile, false);
      }
      setLoading(false);
    })();
    // requestedPlace only picks the initial chip; changing it later goes through pickPlace.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadPool]);

  function pickPlace(place: LikedPlace) {
    setSelectedId(place.id);
    if (!pools[place.id] && me) void loadPool(place, me, demo);
  }

  const selected = likedPlaces.find((p) => p.id === selectedId) ?? null;
  const pool = selectedId ? pools[selectedId] : undefined;

  function removePerson(id: string) {
    setPools((prev) => {
      const next: Record<string, Pool> = {};
      for (const [k, v] of Object.entries(prev)) {
        next[k] = { ...v, people: v.people.filter((p) => p.id !== id) };
      }
      return next;
    });
    setCityWide((prev) => (prev ? prev.filter((p) => p.id !== id) : prev));
  }

  async function onLike(them: ScoredPerson) {
    setDetailPerson(null);
    if (demo || !me) {
      removePerson(them.id);
      return;
    }
    const supabase = createClient();
    await supabase.from("likes").upsert({ liker_id: me.id, liked_id: them.id });
    const { data: back } = await supabase
      .from("likes")
      .select("liker_id")
      .eq("liker_id", them.id)
      .eq("liked_id", me.id)
      .maybeSingle();
    if (back) {
      setMatch(them);
    } else {
      removePerson(them.id);
    }
  }

  async function onPass(them: ScoredPerson) {
    setDetailPerson(null);
    removePerson(them.id);
    if (demo || !me) return;
    const supabase = createClient();
    await supabase.from("passes").upsert({ passer_id: me.id, passed_id: them.id });
  }

  if (loading) return <Centered>Loading people…</Centered>;
  if (!supabaseConfigured)
    return <Centered>Accounts aren&apos;t connected yet — see SETUP.md.</Centered>;
  if (!authed)
    return (
      <Centered>
        <p className="text-zinc-600 dark:text-zinc-400">Log in to see people.</p>
        <Link href="/login" className="roomly-btn mt-4 h-11 px-6 text-sm">
          Go to log in
        </Link>
      </Centered>
    );

  return (
    <main className="roomly-page flex flex-1 flex-col">
      <AppNav active="people" />

      <div className="relative mx-auto w-full max-w-2xl flex-1 px-6 pb-16">
        {match && (
          <div className="fixed inset-0 z-30 flex flex-col items-center justify-center bg-emerald-600/95 px-8 text-center text-white backdrop-blur">
            <p className="text-sm font-semibold uppercase tracking-widest text-emerald-100">{"It's a match!"}</p>
            <Avatar name={match.full_name} url={mainPhoto(match)} large />
            <h2 className="mt-4 text-2xl font-bold">You and {match.full_name} liked each other 🎉</h2>
            <p className="mt-2 max-w-xs text-sm text-emerald-100">Start the conversation from your Matches.</p>
            <Link href="/matches" className="mt-6 flex h-12 w-full max-w-xs items-center justify-center rounded-full bg-white text-sm font-semibold text-emerald-700 hover:bg-emerald-50">
              See your matches
            </Link>
            <button
              onClick={() => {
                removePerson(match.id);
                setMatch(null);
              }}
              className="mt-3 text-sm font-medium text-emerald-100 underline"
            >
              Keep browsing
            </button>
          </div>
        )}

        {demo && (
          <div className="mt-4 rounded-2xl border border-brick-200 bg-brick-50 px-4 py-3 text-sm text-brick-800 dark:border-brick-900/50 dark:bg-brick-950/40 dark:text-brick-200">
            ✨ Showing demo people. Run <code className="rounded bg-brick-100 px-1 py-0.5 font-mono text-xs dark:bg-brick-900/50">supabase/schema.sql</code> to switch to real, saved data.
          </div>
        )}

        {!demo && !meVerified ? (
          <div className="mt-10 flex flex-col items-center text-center">
            <span className="text-4xl" aria-hidden="true">🛡️</span>
            <p className="mt-4 text-lg font-semibold text-zinc-900 dark:text-zinc-50">Get verified to see people</p>
            <p className="mt-2 max-w-xs text-sm text-zinc-500 dark:text-zinc-400">Roomly only shows you verified people — and only verified people see you. It takes a minute.</p>
            <Link href="/verify" className="roomly-btn mt-6 h-11 px-6 text-sm">Verify my identity</Link>
          </div>
        ) : likedPlaces.length === 0 ? (
          <div className="mt-10 rounded-3xl border border-zinc-200 bg-white/70 p-8 text-center dark:border-zinc-800 dark:bg-zinc-900/70">
            <p className="text-base font-semibold text-zinc-900 dark:text-zinc-50">Step 1 comes first: like a place.</p>
            <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
              People unlock per apartment — like a place you&apos;d live in, and
              everyone who wants it shows up here.
            </p>
            <Link href="/places" className="roomly-btn mt-6 h-11 px-6 text-sm">
              Swipe places
            </Link>
          </div>
        ) : (
          <>
            <h1 className="mt-2 text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
              Who wants your places
            </h1>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              Pick one of your liked places to see its people, ranked by how well
              you&apos;d actually live together.
            </p>

            {/* place picker */}
            <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
              {likedPlaces.map((p) => {
                const active = p.id === selectedId;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => pickPlace(p)}
                    className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-medium transition-all ${
                      active
                        ? "bg-brick-600 text-white shadow-sm shadow-brick-900/20"
                        : "border border-zinc-200 text-zinc-600 hover:border-brick-300 dark:border-zinc-700 dark:text-zinc-300 dark:hover:border-brick-700"
                    }`}
                  >
                    {p.name}
                  </button>
                );
              })}
            </div>

            {selected && (
              <section className="mt-6">
                <div className="flex items-baseline justify-between">
                  <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-50">{selected.name}</h2>
                  <Link href={`/places/${selected.id}`} className="text-xs font-medium text-brick-600 hover:underline dark:text-brick-400">
                    View place
                  </Link>
                </div>

                {poolLoading || !pool ? (
                  <p className="mt-6 text-center text-sm text-zinc-500">Finding people…</p>
                ) : pool.people.length > 0 ? (
                  <>
                    {pool.areaFallback && (
                      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                        Nobody else has swiped on {selected.name} yet — people looking in {selected.neighborhood ?? selected.city ?? "the area"}:
                      </p>
                    )}
                    <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
                      {pool.people.map((p) => (
                        <PersonCard key={p.id} person={p} onOpen={() => setDetailPerson(p)} />
                      ))}
                    </div>
                  </>
                ) : cityWide && cityWide.length > 0 ? (
                  <>
                    <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                      You&apos;re first on {selected.name} — meanwhile, here&apos;s everyone verified on Roomly:
                    </p>
                    <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
                      {cityWide.map((p) => (
                        <PersonCard key={p.id} person={p} onOpen={() => setDetailPerson(p)} />
                      ))}
                    </div>
                  </>
                ) : (
                  <p className="mt-6 text-center text-sm text-zinc-500 dark:text-zinc-400">
                    You&apos;re first in line here — check back soon.
                  </p>
                )}
              </section>
            )}
          </>
        )}
      </div>

      {detailPerson && (
        <ProfileDetail
          profile={detailPerson}
          score={detailPerson.score}
          why={me ? reasons(me, detailPerson) : []}
          axes={me ? axisScores(me, detailPerson) : undefined}
          onClose={() => setDetailPerson(null)}
          footer={
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => onPass(detailPerson)}
                className="flex h-12 flex-1 items-center justify-center rounded-full border border-zinc-300 text-sm font-semibold text-zinc-700 transition-all duration-200 ease-out hover:bg-zinc-100 active:scale-95 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                Pass
              </button>
              <button
                type="button"
                onClick={() => onLike(detailPerson)}
                className="roomly-btn h-12 flex-1 text-sm"
              >
                Like 💚
              </button>
            </div>
          }
        />
      )}
    </main>
  );
}

function PersonCard({ person, onOpen }: { person: ScoredPerson; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="roomly-card-in flex w-full flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white/80 text-left shadow-sm backdrop-blur transition-all duration-200 ease-out hover:-translate-y-0.5 hover:shadow-lg hover:shadow-brick-500/10 active:scale-[0.98] dark:border-zinc-800 dark:bg-zinc-900/80"
    >
      <div className="relative aspect-square w-full overflow-hidden bg-zinc-200 dark:bg-zinc-800">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={mainPhoto(person)} alt={person.full_name ?? "Profile photo"} className="h-full w-full object-cover" />
        {person.member_group === "resident" && (
          <span className="absolute left-2 top-2 rounded-full bg-black/60 px-2 py-0.5 text-[11px] font-semibold text-white backdrop-blur">
            Lives here
          </span>
        )}
        <span className={`absolute right-2 top-2 rounded-full px-2 py-0.5 text-xs font-bold ${scoreColor(person.score)}`}>
          {person.score}%
        </span>
      </div>
      <div className="p-2.5">
        <p className="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-50">
          {person.full_name}
          {person.age ? `, ${person.age}` : ""}
        </p>
        <p className="truncate text-xs text-zinc-500 dark:text-zinc-400">{scoreTier(person.score)}</p>
      </div>
    </button>
  );
}

function Avatar({ name, url, large }: { name: string | null; url: string | null; large?: boolean }) {
  const size = large ? "h-20 w-20 text-3xl" : "h-14 w-14 text-xl";
  if (url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt={name ?? "avatar"} className={`${size} shrink-0 rounded-full object-cover`} />;
  }
  return (
    <div className={`${size} flex shrink-0 items-center justify-center rounded-full bg-brick-600 font-bold text-white`}>
      {(name ?? "?").charAt(0).toUpperCase()}
    </div>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <main className="roomly-page flex flex-1 flex-col items-center justify-center px-6 py-16 text-center">
      <div className="max-w-sm text-zinc-600 dark:text-zinc-400">{children}</div>
    </main>
  );
}

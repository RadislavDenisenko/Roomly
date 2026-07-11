"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient, supabaseConfigured } from "@/lib/supabase/client";
import { ProfileDetail } from "@/components/ProfileDetail";
import { mainPhoto } from "@/lib/photos";
import { isMissingTable } from "@/lib/listings";
import { compatibility, reasons, budgetsOverlap, type CompatProfile } from "@/lib/compat";
import { groupPeopleByPlace, type PoolPerson } from "@/lib/people";

type MyProfile = CompatProfile & {
  db_nonsmokers_only: boolean | null;
  db_no_pet_owners: boolean | null;
  db_budget_overlap_only: boolean | null;
};

type LikedPlace = { id: string; name: string; city: string | null; neighborhood: string | null };
type ScoredPerson = PoolPerson & { score: number };
type Section = { place: LikedPlace; people: ScoredPerson[]; areaFallback?: boolean };

// Scripted demo pools shown when the app tables haven't been created yet.
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

function withScores(people: PoolPerson[], me: CompatProfile): ScoredPerson[] {
  return people
    .map((p) => ({ ...p, score: compatibility(me, p) }))
    .sort((a, b) => {
      if (a.member_group !== b.member_group) return a.member_group === "resident" ? -1 : 1;
      return b.score - a.score;
    });
}

export default function PeoplePage() {
  const [loading, setLoading] = useState(supabaseConfigured);
  const [authed, setAuthed] = useState(false);
  const [meVerified, setMeVerified] = useState(false);
  const [myId, setMyId] = useState<string | null>(null);
  const [me, setMe] = useState<MyProfile | null>(null);
  const [demo, setDemo] = useState(false);
  const [sections, setSections] = useState<Section[]>([]);
  const [cityWide, setCityWide] = useState<ScoredPerson[]>([]);
  const [detailPerson, setDetailPerson] = useState<ScoredPerson | null>(null);
  const [match, setMatch] = useState<ScoredPerson | null>(null);

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
      setMyId(uid);

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
        setSections(
          DEMO_PLACES_LIKED.map((place) => ({
            place,
            people: withScores(DEMO_POOLS[place.id] ?? [], meProfile),
          })).filter((s) => s.people.length > 0),
        );
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

      const pools = await Promise.all(
        placesLiked.map(async (p) => {
          const { data, error } = await supabase.rpc("people_for_place", { pid: p.id });
          return { placeId: p.id, people: error ? [] : ((data ?? []) as PoolPerson[]) };
        }),
      );
      const poolsByPlace: Record<string, PoolPerson[]> = {};
      pools.forEach(({ placeId, people }) => {
        poolsByPlace[placeId] = people;
      });

      const directSections = groupPeopleByPlace(placesLiked, poolsByPlace).map((s) => ({
        place: s.place as LikedPlace,
        people: withScores(s.people, meProfile),
      }));
      const usedIds = new Set(directSections.flatMap((s) => s.people.map((p) => p.id)));

      const emptyPlaces = placesLiked.filter((p) => !directSections.some((s) => s.place.id === p.id));
      const areaResults = await Promise.all(
        emptyPlaces.map(async (p) => {
          const { data, error } = await supabase.rpc("people_for_area", {
            p_city: p.city,
            p_neighborhood: p.neighborhood,
          });
          const people = error ? [] : ((data ?? []) as PoolPerson[]).filter((person) => !usedIds.has(person.id));
          return { place: p, people };
        }),
      );
      const areaSections: Section[] = [];
      areaResults.forEach(({ place, people }) => {
        if (people.length === 0) return;
        people.forEach((p) => usedIds.add(p.id));
        areaSections.push({ place, people: withScores(people, meProfile), areaFallback: true });
      });

      const allSections = [...directSections, ...areaSections];
      setSections(allSections);

      if (allSections.length === 0) {
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
          if (meProfile.db_nonsmokers_only && p.smoking) return false;
          if (meProfile.db_no_pet_owners && p.pets) return false;
          if (meProfile.db_budget_overlap_only && !budgetsOverlap(meProfile, p)) return false;
          return true;
        });
        const scored = filtered
          .map((p) => ({ ...p, member_group: "seeker" as const, score: compatibility(meProfile, p) }))
          .sort((a, b) => b.score - a.score)
          .slice(0, 20);
        setCityWide(scored);
      }

      setLoading(false);
    })();
  }, []);

  function removePerson(id: string) {
    setSections((prev) => prev.map((s) => ({ ...s, people: s.people.filter((p) => p.id !== id) })).filter((s) => s.people.length > 0));
    setCityWide((prev) => prev.filter((p) => p.id !== id));
  }

  async function onLike(them: ScoredPerson) {
    setDetailPerson(null);
    if (demo || !myId) {
      removePerson(them.id);
      return;
    }
    const supabase = createClient();
    await supabase.from("likes").upsert({ liker_id: myId, liked_id: them.id });
    const { data: back } = await supabase
      .from("likes")
      .select("liker_id")
      .eq("liker_id", them.id)
      .eq("liked_id", myId)
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
    if (demo || !myId) return;
    const supabase = createClient();
    await supabase.from("passes").upsert({ passer_id: myId, passed_id: them.id });
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

  const hasContent = sections.length > 0 || cityWide.length > 0;

  return (
    <main className="roomly-page flex flex-1 flex-col">
      <header className="mx-auto flex w-full max-w-2xl items-center justify-between px-6 py-5">
        <Link href="/" className="flex items-center gap-2">
          <span className="roomly-mark h-8 w-8 text-sm">R</span>
          <span className="text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">Roomly</span>
        </Link>
        <nav className="flex items-center gap-4 text-sm font-medium">
          <Link href="/places" className="text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100">
            Places
          </Link>
          <Link href="/matches" className="text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100">
            Matches
          </Link>
        </nav>
      </header>

      <div className="relative mx-auto w-full max-w-2xl flex-1 px-6 pb-16">
        {match && (
          <div className="roomly-fade-in fixed inset-0 z-30 flex flex-col items-center justify-center bg-emerald-600/95 px-8 text-center text-white backdrop-blur">
            <div className="roomly-match-in flex flex-col items-center">
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
          </div>
        )}

        {demo && (
          <div className="mt-4 rounded-2xl border border-violet-200 bg-violet-50 px-4 py-3 text-sm text-violet-800 dark:border-violet-900/50 dark:bg-violet-950/40 dark:text-violet-200">
            ✨ Showing demo people. Run <code className="rounded bg-violet-100 px-1 py-0.5 font-mono text-xs dark:bg-violet-900/50">supabase/schema.sql</code> to switch to real, saved data.
          </div>
        )}

        {!meVerified ? (
          <div className="mt-10 flex flex-col items-center text-center">
            <span className="text-4xl" aria-hidden="true">🛡️</span>
            <p className="mt-4 text-lg font-semibold text-zinc-900 dark:text-zinc-50">Get verified to see people</p>
            <p className="mt-2 max-w-xs text-sm text-zinc-500 dark:text-zinc-400">Roomly only shows you verified people — and only verified people see you. It takes a minute.</p>
            <Link href="/verify" className="roomly-btn mt-6 h-11 px-6 text-sm">Verify my identity</Link>
          </div>
        ) : !hasContent ? (
          <div className="mt-10 rounded-3xl border border-zinc-200 bg-white/70 p-8 text-center dark:border-zinc-800 dark:bg-zinc-900/70">
            <p className="text-base font-semibold text-zinc-900 dark:text-zinc-50">Like places first.</p>
            <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
              People who want the same places show up here.
            </p>
            <Link href="/places" className="roomly-btn mt-6 h-11 px-6 text-sm">
              Swipe places
            </Link>
          </div>
        ) : (
          <div className="mt-6 space-y-8">
            {sections.map((s) => (
              <section key={s.place.id}>
                <div className="flex items-baseline justify-between">
                  <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-50">{s.place.name}</h2>
                  <Link href={`/places/${s.place.id}`} className="text-xs font-medium text-violet-600 hover:underline dark:text-violet-400">
                    View place
                  </Link>
                </div>
                {s.areaFallback && (
                  <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                    Nobody else has swiped on {s.place.name} yet — people looking in {s.place.neighborhood ?? s.place.city ?? "the area"}:
                  </p>
                )}
                <div className="mt-3 flex gap-3 overflow-x-auto pb-2">
                  {s.people.map((p) => (
                    <PersonCard key={p.id} person={p} onOpen={() => setDetailPerson(p)} />
                  ))}
                </div>
              </section>
            ))}

            {cityWide.length > 0 && (
              <section>
                <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-50">Everyone on Roomly</h2>
                <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                  Here&apos;s everyone verified on Roomly for now.
                </p>
                <div className="mt-3 flex gap-3 overflow-x-auto pb-2">
                  {cityWide.map((p) => (
                    <PersonCard key={p.id} person={p} onOpen={() => setDetailPerson(p)} />
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </div>

      {detailPerson && (
        <ProfileDetail
          profile={detailPerson}
          score={detailPerson.score}
          why={me ? reasons(me, detailPerson) : []}
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
      className="roomly-card-in roomly-tilt flex w-40 shrink-0 flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white/80 text-left shadow-sm backdrop-blur transition-transform duration-150 ease-out hover:shadow-lg hover:shadow-violet-500/10 active:scale-[0.98] dark:border-zinc-800 dark:bg-zinc-900/80"
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
        {person.city && <p className="truncate text-xs text-zinc-500 dark:text-zinc-400">{person.city}</p>}
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
    <div className={`${size} flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-fuchsia-500 to-violet-600 font-bold text-white`}>
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

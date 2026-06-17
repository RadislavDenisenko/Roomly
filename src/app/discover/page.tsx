"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient, supabaseConfigured } from "@/lib/supabase/client";
import { VerifiedBadge } from "@/components/VerifiedBadge";
import { ProfileDetail } from "@/components/ProfileDetail";
import { mainPhoto } from "@/lib/photos";
import { isVerified, type VerificationStatus } from "@/lib/verification";

type Profile = {
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

type MyProfile = Profile & {
  db_nonsmokers_only: boolean | null;
  db_no_pet_owners: boolean | null;
  db_budget_overlap_only: boolean | null;
};

const sleepLabel: Record<string, string> = {
  early_bird: "Early bird",
  night_owl: "Night owl",
  flexible: "Flexible",
};
const cleanLabel = ["", "Relaxed", "Easygoing", "Tidy", "Very tidy", "Spotless"];

function budgetsOverlap(me: Profile, them: Profile) {
  return (
    Math.min(me.budget_max ?? 99999, them.budget_max ?? 99999) >=
    Math.max(me.budget_min ?? 0, them.budget_min ?? 0)
  );
}

function compatibility(me: Profile, them: Profile): number {
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

type Reason = { good: boolean; text: string };
function reasons(me: Profile, them: Profile): Reason[] {
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

function headline(score: number, why: Reason[]): string {
  const top = why.find((r) => r.good);
  return top ? top.text : `${score}% match`;
}

export default function DiscoverPage() {
  // Seed from supabaseConfigured (a stable build-time constant) so we never need a
  // synchronous setLoading(false) in the effect when accounts aren't connected.
  const [loading, setLoading] = useState(supabaseConfigured);
  const [authed, setAuthed] = useState(false);
  const [cards, setCards] = useState<{ profile: Profile; score: number; why: Reason[] }[]>([]);
  const [index, setIndex] = useState(0);
  const [match, setMatch] = useState<Profile | null>(null);
  const [myId, setMyId] = useState<string | null>(null);
  const [showDetail, setShowDetail] = useState(false);
  const [meVerified, setMeVerified] = useState(false);

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

      const { data: meRow } = await supabase.from("profiles").select("*").eq("id", uid).single();
      const me = (meRow ?? { id: uid }) as MyProfile;
      const meVerified = me.verification_status === "verified";
      setMeVerified(meVerified);

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

      const { data: others } = await supabase
        .from("profiles")
        .select("*")
        .neq("id", uid)
        .not("full_name", "is", null);

      const filtered = ((others ?? []) as Profile[]).filter((p) => {
        if (!isVerified(p)) return false;
        if (blocked.has(p.id)) return false;
        if (liked.has(p.id)) return false;
        if (me.db_nonsmokers_only && p.smoking) return false;
        if (me.db_no_pet_owners && p.pets) return false;
        if (me.db_budget_overlap_only && !budgetsOverlap(me, p)) return false;
        return true;
      });

      const scored = filtered
        .map((p) => ({ profile: p, score: compatibility(me, p), why: reasons(me, p) }))
        .sort((a, b) => b.score - a.score);
      setCards(scored);
      setLoading(false);
    })();
  }, []);

  async function onLike(them: Profile) {
    if (!myId) return;
    const supabase = createClient();
    await supabase.from("likes").upsert({ liker_id: myId, liked_id: them.id });
    const { data: back } = await supabase
      .from("likes")
      .select("liker_id")
      .eq("liker_id", them.id)
      .eq("liked_id", myId)
      .maybeSingle();
    if (back) setMatch(them);
    else setIndex((i) => i + 1);
  }

  if (loading) return <Centered>Finding your matches…</Centered>;
  if (!supabaseConfigured)
    return <Centered>Accounts aren&apos;t connected yet — see SETUP.md.</Centered>;
  if (!authed)
    return (
      <Centered>
        <p className="text-zinc-600 dark:text-zinc-400">Log in to discover roommates.</p>
        <Link href="/login" className="roomly-btn mt-4 h-11 px-6 text-sm">
          Go to log in
        </Link>
      </Centered>
    );

  const current = cards[index];

  return (
    <main className="roomly-page flex flex-1 flex-col">
      <header className="mx-auto flex w-full max-w-md items-center justify-between px-6 py-5">
        <Link href="/" className="flex items-center gap-2">
          <span className="roomly-mark h-8 w-8 text-sm">R</span>
          <span className="text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">Roomly</span>
        </Link>
        <nav className="flex items-center gap-4 text-sm font-medium">
          <Link href="/apartments" className="text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100">
            Apartments
          </Link>
          <Link href="/matches" className="text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100">
            Matches
          </Link>
        </nav>
      </header>

      <div className="relative mx-auto flex w-full max-w-md flex-1 flex-col items-center px-6 pb-16">
        {match && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center rounded-3xl bg-emerald-600/95 px-8 text-center text-white backdrop-blur">
            <p className="text-sm font-semibold uppercase tracking-widest text-emerald-100">{"It's a match!"}</p>
            <Avatar name={match.full_name} url={mainPhoto(match)} large />
            <h2 className="mt-4 text-2xl font-bold">You and {match.full_name} liked each other 🎉</h2>
            <p className="mt-2 max-w-xs text-sm text-emerald-100">Start the conversation from your Matches.</p>
            <Link href="/matches" className="mt-6 flex h-12 w-full max-w-xs items-center justify-center rounded-full bg-white text-sm font-semibold text-emerald-700 hover:bg-emerald-50">
              See your matches
            </Link>
            <button
              onClick={() => {
                setMatch(null);
                setIndex((i) => i + 1);
              }}
              className="mt-3 text-sm font-medium text-emerald-100 underline"
            >
              Keep swiping
            </button>
          </div>
        )}

        {!meVerified ? (
          <div className="flex flex-1 flex-col items-center justify-center text-center">
            <span className="text-4xl" aria-hidden="true">🛡️</span>
            <p className="mt-4 text-lg font-semibold text-zinc-900 dark:text-zinc-50">Get verified to start matching</p>
            <p className="mt-2 max-w-xs text-sm text-zinc-500 dark:text-zinc-400">Roomly only shows you verified people — and only verified people see you. It takes a minute.</p>
            <Link href="/verify" className="roomly-btn mt-6 h-11 px-6 text-sm">Verify my identity</Link>
          </div>
        ) : !current ? (
          <div className="flex flex-1 flex-col items-center justify-center text-center">
            <p className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">No more roommates to show right now.</p>
            <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">Check back soon as more people join.</p>
            <Link href="/matches" className="roomly-btn mt-6 h-11 px-6 text-sm">
              See your matches
            </Link>
          </div>
        ) : (
          <>
            <div
              key={current.profile.id}
              role="button"
              tabIndex={0}
              onClick={() => setShowDetail(true)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setShowDetail(true);
                }
              }}
              className="roomly-card-in w-full cursor-pointer rounded-3xl border border-zinc-200 bg-white/80 p-6 text-left shadow-sm backdrop-blur transition-shadow duration-300 hover:shadow-xl hover:shadow-violet-500/10 dark:border-zinc-800 dark:bg-zinc-900/80"
            >
              <div className="flex items-center gap-4">
                <Avatar name={current.profile.full_name} url={mainPhoto(current.profile)} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h2 className="truncate text-xl font-bold text-zinc-900 dark:text-zinc-50">
                      {current.profile.full_name}
                      {current.profile.age ? `, ${current.profile.age}` : ""}
                    </h2>
                    {isVerified(current.profile) && <VerifiedBadge />}
                  </div>
                  {current.profile.city && (
                    <p className="text-sm text-zinc-500 dark:text-zinc-400">{current.profile.city}</p>
                  )}
                </div>
                <span className={`shrink-0 rounded-full px-3 py-1 text-sm font-bold ${scoreColor(current.score)}`}>
                  {current.score}%
                </span>
              </div>

              <p className="mt-4 text-base font-medium text-zinc-800 dark:text-zinc-200">
                ✨ {headline(current.score, current.why)}
              </p>

              {current.profile.bio && (
                <p className="mt-2 line-clamp-2 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
                  {current.profile.bio}
                </p>
              )}

              <p className="mt-4 text-center text-xs font-medium text-violet-600 dark:text-violet-400">
                Tap to see why you match →
              </p>
            </div>

            <div className="mt-6 flex w-full gap-4">
              <button
                onClick={() => setIndex((i) => i + 1)}
                className="flex h-14 flex-1 items-center justify-center rounded-full border border-zinc-300 text-base font-semibold text-zinc-700 transition-all duration-200 ease-out hover:bg-zinc-100 active:scale-95 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                Pass
              </button>
              <button
                onClick={() => onLike(current.profile)}
                className="roomly-btn h-14 flex-1 text-base"
              >
                Like 💚
              </button>
            </div>
          </>
        )}
      </div>

      {showDetail && current && (
        <ProfileDetail
          profile={current.profile}
          score={current.score}
          why={current.why}
          onClose={() => setShowDetail(false)}
          footer={
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => {
                  setShowDetail(false);
                  setIndex((i) => i + 1);
                }}
                className="flex h-12 flex-1 items-center justify-center rounded-full border border-zinc-300 text-sm font-semibold text-zinc-700 transition-all duration-200 ease-out hover:bg-zinc-100 active:scale-95 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                Pass
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowDetail(false);
                  onLike(current.profile);
                }}
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

function scoreColor(s: number) {
  if (s >= 70) return "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300";
  if (s >= 45) return "bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300";
  return "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300";
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

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
      {children}
    </span>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <main className="roomly-page flex flex-1 flex-col items-center justify-center px-6 py-16 text-center">
      <div className="max-w-sm text-zinc-600 dark:text-zinc-400">{children}</div>
    </main>
  );
}

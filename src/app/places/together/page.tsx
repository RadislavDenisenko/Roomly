"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { createClient, supabaseConfigured } from "@/lib/supabase/client";
import { mainPhoto } from "@/lib/photos";
import { DottedTrail } from "@/components/MapMotif";
import {
  type Listing,
  listingMainPhoto,
  formatRent,
  bedBath,
  isMissingTable,
  DEMO_LISTINGS,
} from "@/lib/listings";

type Match = { id: string; full_name: string | null; avatar_url: string | null; photos: string[] | null };

const DEMO_MATCH: Match = { id: "demo-match-1", full_name: "Jordan Pierce", avatar_url: null, photos: null };
// In demo mode, pretend the match already liked these two places.
const DEMO_MATCH_LIKES = new Set(["demo-1", "demo-4"]);

export default function TogetherPage() {
  return (
    <Suspense fallback={null}>
      <TogetherInner />
    </Suspense>
  );
}

function TogetherInner() {
  // Together is reached from a match's chat; ?with= preselects that person.
  const withParam = useSearchParams().get("with");
  const [loading, setLoading] = useState(supabaseConfigured);
  const [authed, setAuthed] = useState(false);
  const [myId, setMyId] = useState<string | null>(null);
  const [demo, setDemo] = useState(false);
  const [listings, setListings] = useState<Listing[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [myReaction, setMyReaction] = useState<Record<string, "like" | "pass">>({});
  const [matchLikes, setMatchLikes] = useState<Set<string>>(new Set());

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

      // listings (real, else demo)
      const { data: rows, error } = await supabase.from("listings").select("*").order("created_at", { ascending: false });
      let isDemo = false;
      if (error) {
        if (isMissingTable(error)) {
          isDemo = true;
          setDemo(true);
          setListings(DEMO_LISTINGS);
        }
      } else {
        setListings((rows ?? []) as Listing[]);
      }

      // mutual matches
      const { data: matchRows } = await supabase
        .from("matches")
        .select("user_a, user_b")
        .eq("status", "active");
      const mutualIds = (matchRows ?? []).map((m: { user_a: string; user_b: string }) =>
        m.user_a === uid ? m.user_b : m.user_a,
      );
      let people: Match[] = [];
      if (mutualIds.length) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("id, full_name, avatar_url, photos")
          .in("id", mutualIds);
        people = (profs ?? []) as Match[];
      }
      if (isDemo && people.length === 0) people = [DEMO_MATCH];
      setMatches(people);
      const firstMatch =
        (withParam && people.some((p) => p.id === withParam) ? withParam : null) ??
        people[0]?.id ??
        null;
      setSelected(firstMatch);

      // selected match's liked listings
      if (firstMatch) {
        if (isDemo) {
          setMatchLikes(new Set(DEMO_MATCH_LIKES));
        } else {
          const { data: ml } = await supabase
            .from("listing_reactions")
            .select("listing_id")
            .eq("user_id", firstMatch)
            .eq("reaction", "like");
          setMatchLikes(new Set((ml ?? []).map((r: { listing_id: string }) => r.listing_id)));
        }
      }

      // my reactions (real only)
      if (!isDemo) {
        const { data: mine } = await supabase.from("listing_reactions").select("listing_id, reaction").eq("user_id", uid);
        const map: Record<string, "like" | "pass"> = {};
        (mine ?? []).forEach((r: { listing_id: string; reaction: "like" | "pass" }) => { map[r.listing_id] = r.reaction; });
        setMyReaction(map);
      }
      setLoading(false);
    })();
  }, [withParam]);

  // load the selected match's liked listing ids
  const loadMatchLikes = useCallback(
    async (matchId: string | null) => {
      if (!matchId) { setMatchLikes(new Set()); return; }
      if (demo) { setMatchLikes(new Set(DEMO_MATCH_LIKES)); return; }
      const supabase = createClient();
      const { data } = await supabase
        .from("listing_reactions")
        .select("listing_id")
        .eq("user_id", matchId)
        .eq("reaction", "like");
      setMatchLikes(new Set((data ?? []).map((r: { listing_id: string }) => r.listing_id)));
    },
    [demo],
  );

  function pickMatch(id: string) {
    setSelected(id);
    loadMatchLikes(id);
  }

  async function react(listingId: string, reaction: "like" | "pass") {
    setMyReaction((m) => {
      const next = { ...m };
      if (next[listingId] === reaction) delete next[listingId];
      else next[listingId] = reaction;
      return next;
    });
    if (demo || !myId) return;
    const supabase = createClient();
    const current = myReaction[listingId];
    if (current === reaction) {
      await supabase.from("listing_reactions").delete().eq("user_id", myId).eq("listing_id", listingId);
    } else {
      await supabase.from("listing_reactions").upsert({ user_id: myId, listing_id: listingId, reaction });
    }
  }

  const bothLiked = listings.filter((l) => myReaction[l.id] === "like" && matchLikes.has(l.id));
  const selectedMatch = matches.find((m) => m.id === selected) ?? null;
  const firstName = selectedMatch?.full_name?.split(" ")[0] ?? "your match";

  return (
    <main className="roomly-page flex flex-1 flex-col">
      <header className="mx-auto flex w-full max-w-2xl items-center justify-between px-6 py-5">
        <Link
          href={withParam ? `/messages/${withParam}` : "/matches"}
          className="text-sm font-semibold text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
        >
          {withParam ? "← Back to chat" : "← Matches"}
        </Link>
        <span className="roomly-mark h-8 w-8 text-sm">R</span>
      </header>

      <DottedTrail variant="zigzag" height={40} className="opacity-70" />

      <div className="mx-auto w-full max-w-2xl flex-1 px-6 pb-16">
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">Search together</h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          React to places with a matched roommate — the ones you both like land in your shared shortlist.
        </p>
        {demo && (
          <div className="mt-4 rounded-2xl border border-violet-200 bg-violet-50 px-4 py-3 text-sm text-violet-800 dark:border-violet-900/50 dark:bg-violet-950/40 dark:text-violet-200">
            ✨ Demo mode — {DEMO_MATCH.full_name} has already liked a couple of places. Like them too to see the shared shortlist fill up. Run <code className="rounded bg-violet-100 px-1 py-0.5 font-mono text-xs dark:bg-violet-900/50">supabase/schema.sql</code> to go live.
          </div>
        )}

        {loading ? (
          <p className="mt-10 text-center text-sm text-zinc-500">Loading…</p>
        ) : !supabaseConfigured ? (
          <Note>Accounts aren&apos;t connected yet — see SETUP.md.</Note>
        ) : !authed ? (
          <div className="mt-10 text-center">
            <p className="text-sm text-zinc-600 dark:text-zinc-400">Log in to search with a roommate.</p>
            <Link href="/login" className="roomly-btn mt-4 h-11 px-6 text-sm">Go to log in</Link>
          </div>
        ) : matches.length === 0 ? (
          <div className="mt-10 text-center">
            <p className="text-base font-semibold text-zinc-900 dark:text-zinc-50">No roommates to search with yet.</p>
            <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">Match with someone in People, then come back to hunt together.</p>
            <Link href="/people" className="roomly-btn mt-6 h-11 px-6 text-sm">Go to People</Link>
          </div>
        ) : (
          <>
            {/* match picker */}
            <div className="mt-6 flex gap-2 overflow-x-auto pb-1">
              {matches.map((m) => {
                const active = m.id === selected;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => pickMatch(m.id)}
                    className={`flex shrink-0 items-center gap-2 rounded-full border py-1.5 pl-1.5 pr-4 text-sm font-medium transition-all ${
                      active
                        ? "border-transparent bg-gradient-to-r from-fuchsia-500 to-violet-600 text-white shadow-sm"
                        : "border-zinc-200 text-zinc-700 hover:border-violet-300 dark:border-zinc-700 dark:text-zinc-200"
                    }`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={mainPhoto(m)} alt={m.full_name ?? "match"} className="h-7 w-7 rounded-full object-cover" />
                    {m.full_name?.split(" ")[0] ?? "Match"}
                  </button>
                );
              })}
            </div>

            {/* shared shortlist */}
            <section className="mt-6">
              <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                <span aria-hidden="true">💜</span> You both liked
                <span className="rounded-full bg-violet-100 px-2 py-0.5 text-xs font-bold text-violet-700 dark:bg-violet-900/50 dark:text-violet-300">{bothLiked.length}</span>
              </h2>
              {bothLiked.length === 0 ? (
                <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
                  Nothing yet — like a place {firstName} also liked and it shows up here.
                </p>
              ) : (
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  {bothLiked.map((l) => (
                    <Link
                      key={l.id}
                      href={`/places/unit/${l.id}`}
                      className="roomly-card-in flex items-center gap-3 rounded-2xl border-2 border-violet-300 bg-violet-50/60 p-3 transition-transform hover:-translate-y-0.5 dark:border-violet-800 dark:bg-violet-950/30"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={listingMainPhoto(l)} alt={l.title} className="h-14 w-14 shrink-0 rounded-xl object-cover" />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-50">{l.title}</p>
                        <p className="text-xs text-zinc-500 dark:text-zinc-400">{formatRent(l.rent)}</p>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </section>

            {/* browse + react */}
            <section className="mt-8">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Browse places</h2>
              <div className="mt-3 space-y-3">
                {listings.map((l) => {
                  const mine = myReaction[l.id];
                  const theirs = matchLikes.has(l.id);
                  return (
                    <div
                      key={l.id}
                      className="roomly-card-in flex items-center gap-3 rounded-2xl border border-zinc-200 bg-white/80 p-3 backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/80"
                    >
                      <Link href={`/places/unit/${l.id}`} className="flex min-w-0 flex-1 items-center gap-3">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={listingMainPhoto(l)} alt={l.title} className="h-16 w-16 shrink-0 rounded-xl object-cover" />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-50">{l.title}</p>
                          <p className="truncate text-xs text-zinc-500 dark:text-zinc-400">
                            {formatRent(l.rent)} · {bedBath(l)}
                          </p>
                          {theirs && (
                            <p className="mt-1 inline-flex items-center gap-1 rounded-full bg-violet-100 px-2 py-0.5 text-[11px] font-semibold text-violet-700 dark:bg-violet-900/50 dark:text-violet-300">
                              💜 {firstName} liked this
                            </p>
                          )}
                        </div>
                      </Link>
                      <div className="flex shrink-0 gap-2">
                        <button
                          type="button"
                          aria-label="Pass"
                          onClick={() => react(l.id, "pass")}
                          className={`flex h-10 w-10 items-center justify-center rounded-full border text-lg transition-transform hover:scale-105 active:scale-90 ${
                            mine === "pass"
                              ? "border-zinc-400 bg-zinc-200 dark:border-zinc-500 dark:bg-zinc-700"
                              : "border-zinc-200 dark:border-zinc-700"
                          }`}
                        >
                          👎
                        </button>
                        <button
                          type="button"
                          aria-label="Like"
                          onClick={() => react(l.id, "like")}
                          className={`flex h-10 w-10 items-center justify-center rounded-full border text-lg transition-transform hover:scale-105 active:scale-90 ${
                            mine === "like"
                              ? "border-transparent bg-gradient-to-r from-fuchsia-500 to-violet-600"
                              : "border-zinc-200 dark:border-zinc-700"
                          }`}
                        >
                          {mine === "like" ? "❤️" : "🤍"}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          </>
        )}
      </div>
    </main>
  );
}

function Note({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-10 rounded-3xl border border-zinc-200 bg-white/70 p-8 text-center text-sm text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900/70 dark:text-zinc-400">
      {children}
    </div>
  );
}

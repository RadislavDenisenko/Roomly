"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { createClient, supabaseConfigured } from "@/lib/supabase/client";
import { VerifiedBadge } from "@/components/VerifiedBadge";
import { mainPhoto } from "@/lib/photos";
import {
  type Listing,
  listingPhotos,
  formatRent,
  bedBath,
  formatAvailable,
  DEMO_LISTINGS,
} from "@/lib/listings";

type Owner = { id: string; full_name: string | null; avatar_url: string | null; photos: string[] | null };

export default function ListingDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const [loading, setLoading] = useState(supabaseConfigured);
  const [authed, setAuthed] = useState(false);
  const [listing, setListing] = useState<Listing | null>(null);
  const [owner, setOwner] = useState<Owner | null>(null);
  const [saved, setSaved] = useState(false);
  const [missing, setMissing] = useState(false);
  const [demo, setDemo] = useState(false);
  const [myId, setMyId] = useState<string | null>(null);
  const [photoIdx, setPhotoIdx] = useState(0);

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

      const { data, error } = await supabase.from("listings").select("*").eq("id", id).single();
      if (error || !data) {
        const demoListing = DEMO_LISTINGS.find((dl) => dl.id === id);
        if (demoListing) {
          setListing(demoListing);
          setDemo(true);
        } else {
          setMissing(true);
        }
        setLoading(false);
        return;
      }
      const l = data as Listing;
      setListing(l);

      const { data: ownerRow } = await supabase
        .from("profiles")
        .select("id, full_name, avatar_url, photos")
        .eq("id", l.owner_id)
        .single();
      setOwner((ownerRow as Owner) ?? null);

      const { data: savedRow } = await supabase
        .from("saved_listings")
        .select("listing_id")
        .eq("user_id", userData.user.id)
        .eq("listing_id", id)
        .maybeSingle();
      setSaved(!!savedRow);
      setLoading(false);
    })();
  }, [id]);

  async function toggleSave() {
    if (!listing) return;
    const next = !saved;
    setSaved(next);
    if (demo || !myId) return; // demo mode keeps saves in memory only
    const supabase = createClient();
    if (next) {
      await supabase.from("saved_listings").upsert({ user_id: myId, listing_id: listing.id });
    } else {
      await supabase.from("saved_listings").delete().eq("user_id", myId).eq("listing_id", listing.id);
    }
  }

  if (loading) return <Centered>Loading…</Centered>;
  if (!supabaseConfigured) return <Centered>Accounts aren&apos;t connected yet — see SETUP.md.</Centered>;
  if (!authed)
    return (
      <Centered>
        <p className="text-zinc-600 dark:text-zinc-400">Log in to view this place.</p>
        <Link href="/login" className="roomly-btn mt-4 h-11 px-6 text-sm">
          Go to log in
        </Link>
      </Centered>
    );
  if (missing || !listing)
    return (
      <Centered>
        <p className="text-zinc-600 dark:text-zinc-400">This place isn&apos;t available.</p>
        <Link href="/apartments" className="roomly-btn mt-4 h-11 px-6 text-sm">
          Back to apartments
        </Link>
      </Centered>
    );

  const photos = listingPhotos(listing);

  return (
    <main className="roomly-page flex flex-1 flex-col">
      <header className="sticky top-0 z-10 mx-auto flex w-full max-w-2xl items-center justify-between px-6 py-3">
        <Link
          href="/apartments"
          className="flex h-9 items-center gap-1 rounded-full bg-white/80 px-4 text-sm font-semibold text-zinc-700 backdrop-blur transition-colors hover:bg-white dark:bg-zinc-900/80 dark:text-zinc-200"
        >
          ← Apartments
        </Link>
        <button
          type="button"
          onClick={toggleSave}
          className="flex h-9 items-center gap-1.5 rounded-full bg-white/80 px-4 text-sm font-semibold text-zinc-700 backdrop-blur transition-transform hover:scale-105 active:scale-95 dark:bg-zinc-900/80 dark:text-zinc-200"
        >
          {saved ? "❤️ Saved" : "🤍 Save"}
        </button>
      </header>

      <div className="mx-auto w-full max-w-2xl flex-1 px-6 pb-16">
        {/* Gallery */}
        <div className="relative aspect-[4/3] w-full select-none overflow-hidden rounded-3xl bg-zinc-200 dark:bg-zinc-800">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={photos[photoIdx]} alt={listing.title} className="h-full w-full object-cover" />
          <button
            type="button"
            aria-label="Previous photo"
            onClick={() => setPhotoIdx((p) => (p - 1 + photos.length) % photos.length)}
            className="absolute inset-y-0 left-0 w-1/3 cursor-pointer focus:outline-none"
          />
          <button
            type="button"
            aria-label="Next photo"
            onClick={() => setPhotoIdx((p) => (p + 1) % photos.length)}
            className="absolute inset-y-0 right-0 w-2/3 cursor-pointer focus:outline-none"
          />
          <div className="pointer-events-none absolute inset-x-0 top-0 flex gap-1.5 p-2.5">
            {photos.map((_, i) => (
              <span
                key={i}
                className={`h-1 flex-1 rounded-full ${i === photoIdx ? "bg-white" : "bg-white/40"}`}
              />
            ))}
          </div>
          {listing.verified && (
            <div className="absolute bottom-3 left-3">
              <VerifiedBadge label="Verified place" />
            </div>
          )}
        </div>

        {/* Headline */}
        <div className="mt-5 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">{listing.title}</h1>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              {[listing.neighborhood, listing.city].filter(Boolean).join(", ") || "—"}
            </p>
          </div>
          <p className="shrink-0 text-xl font-black text-violet-600 dark:text-violet-400">
            {formatRent(listing.rent)}
          </p>
        </div>

        {/* Quick facts */}
        <div className="mt-4 grid grid-cols-2 gap-3">
          <Fact label="Layout" value={bedBath(listing)} />
          <Fact label="Move-in" value={formatAvailable(listing.available_from).replace("Available ", "")} />
        </div>

        {listing.description && (
          <section className="mt-6">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              About this place
            </h2>
            <p className="mt-2 text-sm leading-6 text-zinc-700 dark:text-zinc-300">{listing.description}</p>
          </section>
        )}

        {owner && (
          <section className="mt-6 flex items-center gap-3 rounded-2xl border border-zinc-200 bg-white/70 p-4 dark:border-zinc-800 dark:bg-zinc-900/70">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={mainPhoto(owner)} alt={owner.full_name ?? "Owner"} className="h-11 w-11 rounded-full object-cover" />
            <div className="min-w-0">
              <p className="text-xs text-zinc-500 dark:text-zinc-400">Posted by</p>
              <p className="truncate font-semibold text-zinc-900 dark:text-zinc-50">{owner.full_name ?? "A Roomly member"}</p>
            </div>
          </section>
        )}

        <button type="button" onClick={toggleSave} className="roomly-btn mt-6 h-12 w-full text-sm">
          {saved ? "❤️ Saved to your list" : "🤍 Save this place"}
        </button>
      </div>
    </main>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-zinc-100 px-4 py-3 dark:bg-zinc-800">
      <p className="text-xs text-zinc-500 dark:text-zinc-400">{label}</p>
      <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">{value}</p>
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

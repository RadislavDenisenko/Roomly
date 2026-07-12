"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient, supabaseConfigured } from "@/lib/supabase/client";
import { isMissingTable } from "@/lib/listings";
import { type Place } from "@/lib/places";

const MAX_PHOTOS = 8;

export default function NewListingPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(supabaseConfigured);
  const [authed, setAuthed] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [city, setCity] = useState("");
  const [neighborhood, setNeighborhood] = useState("");
  const [rent, setRent] = useState("");
  const [bedrooms, setBedrooms] = useState("");
  const [bathrooms, setBathrooms] = useState("");
  const [availableFrom, setAvailableFrom] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Place picker
  const [places, setPlaces] = useState<Place[]>([]);
  const [placesDemo, setPlacesDemo] = useState(false);
  const [placeQuery, setPlaceQuery] = useState("");
  const [selectedPlaceId, setSelectedPlaceId] = useState<string | null>(null);
  const [selectedPlaceName, setSelectedPlaceName] = useState<string | null>(null);

  useEffect(() => {
    if (!supabaseConfigured) return;
    const supabase = createClient();
    (async () => {
      const { data } = await supabase.auth.getUser();
      setAuthed(!!data.user);
      setLoading(false);
      if (!data.user) return;

      const { data: placeRows, error: placesErr } = await supabase
        .from("places")
        .select("*")
        .order("name", { ascending: true });
      if (placesErr) {
        if (isMissingTable(placesErr)) setPlacesDemo(true);
        return;
      }
      setPlaces((placeRows ?? []) as Place[]);
    })();
  }, []);

  const placeMatches = places.filter((p) =>
    p.name.toLowerCase().includes(placeQuery.trim().toLowerCase()),
  );
  const exactMatch = places.some((p) => p.name.toLowerCase() === placeQuery.trim().toLowerCase());

  function pickPlace(p: Place) {
    setSelectedPlaceId(p.id);
    setSelectedPlaceName(p.name);
    setPlaceQuery(p.name);
  }

  // "Create" isn't picked from the list — it just locks in the typed name so
  // handleSubmit knows to insert a new place row on submit.
  function pickNewPlaceName(name: string) {
    setSelectedPlaceId(null);
    setSelectedPlaceName(`${name} (new)`);
    setPlaceQuery(name);
  }

  function clearPlace() {
    setSelectedPlaceId(null);
    setSelectedPlaceName(null);
    setPlaceQuery("");
  }

  async function handleAddPhotos(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
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
    const urls: string[] = [];
    for (const file of files.slice(0, MAX_PHOTOS - photos.length)) {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${uid}/listing-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error: upErr } = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
      if (upErr) {
        setError("Photo upload failed — is the 'avatars' storage bucket set up? " + upErr.message);
        setUploading(false);
        return;
      }
      const { data: pub } = supabase.storage.from("avatars").getPublicUrl(path);
      urls.push(pub.publicUrl);
    }
    setPhotos((p) => [...p, ...urls]);
    setUploading(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!title.trim()) {
      setError("Give your place a title.");
      return;
    }
    if (!placesDemo && !selectedPlaceId && !placeQuery.trim()) {
      setError("Which place is this in? Search for it or create a new one.");
      return;
    }
    setSubmitting(true);
    const supabase = createClient();
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      setError("Your session expired — please log in again.");
      setSubmitting(false);
      return;
    }

    let placeId: string | null = selectedPlaceId;
    if (!placesDemo && !placeId) {
      // Typing an existing place's exact name without clicking the suggestion
      // shouldn't fork a duplicate places row — reuse the match if there is one.
      const existing = places.find(
        (p) => p.name.trim().toLowerCase() === placeQuery.trim().toLowerCase(),
      );
      if (existing) {
        placeId = existing.id;
      } else {
        const { data: placeRow, error: placeErr } = await supabase
          .from("places")
          .insert({
            created_by: userData.user.id,
            name: placeQuery.trim(),
            kind: "complex",
            city: city.trim() || null,
            neighborhood: neighborhood.trim() || null,
          })
          .select("id")
          .single();
        if (placeErr) {
          setError(
            isMissingTable(placeErr)
              ? "Places aren't set up yet — run the latest supabase/schema.sql first."
              : placeErr.message,
          );
          setSubmitting(false);
          return;
        }
        placeId = placeRow.id;
      }
    }

    const { data, error: insErr } = await supabase
      .from("listings")
      .insert({
        owner_id: userData.user.id,
        title: title.trim(),
        description: description.trim() || null,
        city: city.trim() || null,
        neighborhood: neighborhood.trim() || null,
        rent: rent ? parseInt(rent, 10) : null,
        bedrooms: bedrooms ? parseInt(bedrooms, 10) : null,
        bathrooms: bathrooms ? parseInt(bathrooms, 10) : null,
        available_from: availableFrom || null,
        photos,
        verified: false,
        place_id: placeId,
      })
      .select("id")
      .single();
    setSubmitting(false);
    if (insErr) {
      setError(
        isMissingTable(insErr)
          ? "Places aren't set up yet — run the latest supabase/schema.sql first."
          : insErr.message,
      );
      return;
    }
    router.push(`/places/unit/${data.id}`);
  }

  if (loading) return <Centered>Loading…</Centered>;
  if (!supabaseConfigured) return <Centered>Accounts aren&apos;t connected yet — see SETUP.md.</Centered>;
  if (!authed)
    return (
      <Centered>
        <p className="text-zinc-600 dark:text-zinc-400">Log in to post a place.</p>
        <Link href="/login" className="roomly-btn mt-4 h-11 px-6 text-sm">
          Go to log in
        </Link>
      </Centered>
    );

  return (
    <main className="roomly-page flex flex-1 flex-col">
      <header className="mx-auto flex w-full max-w-2xl items-center justify-between px-6 py-5">
        <Link href="/places/browse" className="text-sm font-semibold text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100">
          ← Places
        </Link>
      </header>

      <form onSubmit={handleSubmit} className="mx-auto w-full max-w-2xl px-6 pb-16">
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">Post a place</h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          List a room or apartment for roommates to find. Roomly verifies listings before they get a badge.
        </p>

        <Card title="Which place is this in?">
          {placesDemo ? (
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Places aren&apos;t set up yet — run <code className="rounded bg-zinc-100 px-1 py-0.5 font-mono text-xs dark:bg-zinc-800">supabase/schema.sql</code> first. Posting a place also requires the real tables, so the picker is skipped in demo mode.
            </p>
          ) : selectedPlaceName ? (
            <div className="flex items-center justify-between rounded-lg border border-violet-300 bg-violet-50 px-3 py-2 dark:border-violet-800 dark:bg-violet-950/40">
              <span className="text-sm font-semibold text-violet-800 dark:text-violet-200">{selectedPlaceName}</span>
              <button
                type="button"
                onClick={clearPlace}
                className="text-xs font-medium text-violet-600 hover:underline dark:text-violet-400"
              >
                Change
              </button>
            </div>
          ) : (
            <div>
              <input
                value={placeQuery}
                onChange={(e) => setPlaceQuery(e.target.value)}
                placeholder="Search by place name (e.g. The Triangle)"
                aria-label="Search places"
                className="h-11 w-full rounded-lg border border-zinc-300 bg-white px-3 text-sm text-zinc-900 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
              />
              {placeQuery.trim() && (
                <div className="mt-2 space-y-1.5">
                  {placeMatches.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => pickPlace(p)}
                      className="flex w-full items-center justify-between rounded-lg border border-zinc-200 px-3 py-2 text-left text-sm hover:border-violet-400 dark:border-zinc-700"
                    >
                      <span className="font-medium text-zinc-900 dark:text-zinc-50">{p.name}</span>
                      <span className="text-xs text-zinc-500 dark:text-zinc-400">
                        {[p.neighborhood, p.city].filter(Boolean).join(", ") || "—"}
                      </span>
                    </button>
                  ))}
                  {!exactMatch && (
                    <button
                      type="button"
                      onClick={() => pickNewPlaceName(placeQuery.trim())}
                      className="flex w-full items-center gap-1.5 rounded-lg border border-dashed border-violet-300 px-3 py-2 text-left text-sm font-medium text-violet-600 hover:border-violet-400 dark:border-violet-700 dark:text-violet-400"
                    >
                      ＋ Create &quot;{placeQuery.trim()}&quot;
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </Card>

        <Card title="Photos">
          <div className="grid grid-cols-3 gap-3">
            {photos.map((url, i) => (
              <div key={url} className="group relative aspect-[4/3] overflow-hidden rounded-2xl bg-zinc-100 dark:bg-zinc-800">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt={`Photo ${i + 1}`} className="h-full w-full object-cover" />
                <button
                  type="button"
                  aria-label="Remove photo"
                  onClick={() => setPhotos((p) => p.filter((_, idx) => idx !== i))}
                  className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-black/55 text-xs text-white backdrop-blur transition-transform hover:scale-110 active:scale-90"
                >
                  ✕
                </button>
              </div>
            ))}
            {photos.length < MAX_PHOTOS && (
              <label className="flex aspect-[4/3] cursor-pointer flex-col items-center justify-center gap-1 rounded-2xl border-2 border-dashed border-zinc-300 text-zinc-500 transition-colors hover:border-violet-400 hover:text-violet-600 dark:border-zinc-700 dark:text-zinc-400 dark:hover:border-violet-500">
                {uploading ? (
                  <span className="text-xs font-medium">Uploading…</span>
                ) : (
                  <>
                    <span className="text-2xl leading-none">＋</span>
                    <span className="text-xs font-medium">Add</span>
                  </>
                )}
                <input type="file" accept="image/*" multiple onChange={handleAddPhotos} className="hidden" disabled={uploading} />
              </label>
            )}
          </div>
        </Card>

        <Card title="The basics">
          <Text label="Title" value={title} onChange={setTitle} placeholder="Sunny 2BR near campus" />
          <Area label="Description" value={description} onChange={setDescription} placeholder="What makes this place great?" />
        </Card>

        <Card title="Where">
          <div className="grid grid-cols-2 gap-4">
            <Text label="City" value={city} onChange={setCity} placeholder="Austin, TX" />
            <Text label="Neighborhood" value={neighborhood} onChange={setNeighborhood} placeholder="Hyde Park" />
          </div>
        </Card>

        <Card title="Details">
          <div className="grid grid-cols-2 gap-4">
            <Text label="Rent ($/mo)" type="number" value={rent} onChange={setRent} placeholder="1400" />
            <Text label="Move-in date" type="date" value={availableFrom} onChange={setAvailableFrom} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Text label="Bedrooms" type="number" value={bedrooms} onChange={setBedrooms} placeholder="2" />
            <Text label="Bathrooms" type="number" value={bathrooms} onChange={setBathrooms} placeholder="1" />
          </div>
        </Card>

        {error && (
          <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">
            {error}
          </p>
        )}

        <button type="submit" disabled={submitting || uploading} className="roomly-btn mt-6 h-12 w-full text-sm">
          {submitting ? "Posting…" : "Post place"}
        </button>
      </form>
    </main>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-6 space-y-4 rounded-3xl border border-zinc-200 bg-white/80 p-5 backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/80">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">{title}</h2>
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
      <span className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-11 w-full rounded-lg border border-zinc-300 bg-white px-3 text-sm text-zinc-900 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
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
      <span className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">{label}</span>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={4}
        className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
      />
    </label>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <main className="roomly-page flex flex-1 flex-col items-center justify-center px-6 py-16 text-center">
      <div className="max-w-sm text-zinc-600 dark:text-zinc-400">{children}</div>
    </main>
  );
}

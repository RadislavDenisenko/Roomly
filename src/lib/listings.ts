export type Listing = {
  id: string;
  owner_id: string;
  title: string;
  description: string | null;
  city: string | null;
  neighborhood: string | null;
  rent: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  available_from: string | null;
  photos: string[] | null;
  verified: boolean | null;
  place_id: string | null;
  created_at?: string;
};

// Stock fallback photos for a listing with no uploads yet (deterministic by id).
export function listingPhotos(l: Pick<Listing, "id" | "photos">): string[] {
  if (l.photos && l.photos.length > 0) return l.photos;
  const seed = encodeURIComponent(l.id);
  return [
    `https://picsum.photos/seed/${seed}-apt1/800/1000`,
    `https://picsum.photos/seed/${seed}-apt2/800/1000`,
    `https://picsum.photos/seed/${seed}-apt3/800/1000`,
  ];
}

export function listingMainPhoto(l: Pick<Listing, "id" | "photos">): string {
  return listingPhotos(l)[0];
}

export function formatRent(rent: number | null): string {
  return rent ? `$${rent.toLocaleString()}/mo` : "Price on request";
}

export function bedBath(l: Pick<Listing, "bedrooms" | "bathrooms">): string {
  const parts: string[] = [];
  if (l.bedrooms != null) parts.push(`${l.bedrooms} bd`);
  if (l.bathrooms != null) parts.push(`${l.bathrooms} ba`);
  return parts.join(" · ") || "Room";
}

export function formatAvailable(date: string | null): string {
  if (!date) return "Available now";
  const d = new Date(date);
  if (isNaN(d.getTime())) return "Available now";
  return `Available ${d.toLocaleDateString(undefined, { month: "short", year: "numeric" })}`;
}

// True when an error from Supabase means the listings tables haven't been
// created yet (i.e. the schema.sql migration hasn't been run).
// Demo listings shown when the real tables don't exist yet (before schema.sql
// is run). Lets the whole apartments feature be browsed/filtered immediately;
// real data takes over automatically once the listings table is created.
export const DEMO_LISTINGS: Listing[] = [
  { id: "demo-1", owner_id: "demo-owner-1", title: "Sunny 2BR near campus", description: "Bright corner unit with big windows, dishwasher, and a small balcony. Walkable to campus, coffee, and the green belt.", city: "Austin, TX", neighborhood: "Hyde Park", rent: 1450, bedrooms: 2, bathrooms: 1, available_from: "2026-08-01", photos: null, verified: true, place_id: null, created_at: "2026-06-10T00:00:00Z" },
  { id: "demo-2", owner_id: "demo-owner-2", title: "Modern loft downtown", description: "Open-plan loft with exposed brick, in-unit laundry, and a rooftop pool. Steps from restaurants and transit.", city: "Austin, TX", neighborhood: "Downtown", rent: 1900, bedrooms: 1, bathrooms: 1, available_from: "2026-07-15", photos: null, verified: true, place_id: null, created_at: "2026-06-09T00:00:00Z" },
  { id: "demo-3", owner_id: "demo-owner-3", title: "Cozy room in shared house", description: "Furnished private room in a friendly 3-person house. Big backyard, fast wifi, and a cat named Biscuit.", city: "Austin, TX", neighborhood: "East Side", rent: 850, bedrooms: 1, bathrooms: 1, available_from: "2026-09-01", photos: null, verified: false, place_id: null, created_at: "2026-06-08T00:00:00Z" },
  { id: "demo-4", owner_id: "demo-owner-4", title: "Bright 3BR with a yard", description: "Roomy house share with a fenced yard, gas range, and a covered porch. Great for a small crew.", city: "Austin, TX", neighborhood: "Mueller", rent: 2400, bedrooms: 3, bathrooms: 2, available_from: "2026-08-15", photos: null, verified: true, place_id: null, created_at: "2026-06-07T00:00:00Z" },
  { id: "demo-5", owner_id: "demo-owner-5", title: "Studio by the lake", description: "Compact studio with lake views, a Murphy bed, and a tiny but mighty kitchen. Utilities included.", city: "Austin, TX", neighborhood: "Zilker", rent: 1200, bedrooms: null, bathrooms: 1, available_from: null, photos: null, verified: false, place_id: null, created_at: "2026-06-06T00:00:00Z" },
];

// In demo mode (tables not created yet) saved places are kept in localStorage
// so they persist across pages until the real saved_listings table exists.
const DEMO_SAVED_KEY = "roomly_demo_saved";

export function getDemoSaved(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    return new Set(JSON.parse(localStorage.getItem(DEMO_SAVED_KEY) || "[]") as string[]);
  } catch {
    return new Set();
  }
}

export function setDemoSaved(ids: Set<string>): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(DEMO_SAVED_KEY, JSON.stringify([...ids]));
  } catch {
    // ignore storage errors (private mode, quota, etc.)
  }
}

export function isMissingTable(error: { message?: string; code?: string } | null): boolean {
  if (!error) return false;
  const msg = error.message?.toLowerCase() ?? "";
  return (
    error.code === "42P01" || // postgres: relation does not exist
    error.code === "PGRST205" || // postgrest: table not in schema cache
    error.code === "PGRST202" || // postgrest: function not found in schema cache
    msg.includes("does not exist") ||
    msg.includes("schema cache") ||
    msg.includes("could not find the table")
  );
}

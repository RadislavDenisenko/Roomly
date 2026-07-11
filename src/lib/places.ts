export type Place = {
  id: string;
  name: string;
  kind: "complex" | "building" | "house" | "other";
  city: string | null;
  neighborhood: string | null;
  address: string | null;
  rent_min: number | null;
  rent_max: number | null;
  photos: string[] | null;
  website: string | null;
  curated: boolean | null;
  sponsored: boolean | null;
  created_at?: string;
};

// Stock fallback photos for a place with no uploads yet (deterministic by id).
export function placePhotos(p: Pick<Place, "id" | "photos">): string[] {
  if (p.photos && p.photos.length > 0) return p.photos;
  const seed = encodeURIComponent(p.id);
  return [
    `https://picsum.photos/seed/${seed}-place1/800/1000`,
    `https://picsum.photos/seed/${seed}-place2/800/1000`,
    `https://picsum.photos/seed/${seed}-place3/800/1000`,
  ];
}

export function placeMainPhoto(p: Pick<Place, "id" | "photos">): string {
  return placePhotos(p)[0];
}

export function formatRentRange(min: number | null, max: number | null): string {
  if (min == null && max == null) return "Rent varies";
  if (min != null && max != null && min !== max) {
    return `$${min.toLocaleString()}\u2013$${max.toLocaleString()}/mo`;
  }
  const single = min ?? max;
  return `$${single!.toLocaleString()}/mo`;
}

// Curated places first, then newest first within each group. Does not mutate input.
export function deckOrder(places: Place[]): Place[] {
  return [...places].sort((a, b) => {
    const curatedA = a.curated ? 1 : 0;
    const curatedB = b.curated ? 1 : 0;
    if (curatedA !== curatedB) return curatedB - curatedA;
    const timeA = a.created_at ? new Date(a.created_at).getTime() : 0;
    const timeB = b.created_at ? new Date(b.created_at).getTime() : 0;
    return timeB - timeA;
  });
}

// Demo places shown when the real tables don't exist yet (before schema.sql is run).
export const DEMO_PLACES: Place[] = [
  { id: "demo-place-1", name: "The Triangle", kind: "complex", city: "Austin, TX", neighborhood: "Triangle State", address: null, rent_min: 1300, rent_max: 2200, photos: null, website: null, curated: true, sponsored: false, created_at: "2026-06-10T00:00:00Z" },
  { id: "demo-place-2", name: "East 6th Lofts", kind: "complex", city: "Austin, TX", neighborhood: "East Austin", address: null, rent_min: 1250, rent_max: 2100, photos: null, website: null, curated: true, sponsored: false, created_at: "2026-06-09T00:00:00Z" },
  { id: "demo-place-3", name: "Zilker Terrace", kind: "complex", city: "Austin, TX", neighborhood: "Zilker", address: null, rent_min: 1400, rent_max: 2400, photos: null, website: null, curated: true, sponsored: false, created_at: "2026-06-08T00:00:00Z" },
  { id: "demo-place-4", name: "Hyde Park Commons", kind: "complex", city: "Austin, TX", neighborhood: "Hyde Park", address: null, rent_min: 1100, rent_max: 1800, photos: null, website: null, curated: true, sponsored: false, created_at: "2026-06-07T00:00:00Z" },
  { id: "demo-place-5", name: "Cherrywood Court", kind: "house", city: "Austin, TX", neighborhood: "Cherrywood", address: null, rent_min: 1000, rent_max: 1700, photos: null, website: null, curated: true, sponsored: false, created_at: "2026-06-06T00:00:00Z" },
  { id: "demo-place-6", name: "Riley's shared house", kind: "other", city: "Austin, TX", neighborhood: "East Side", address: null, rent_min: 850, rent_max: null, photos: null, website: null, curated: false, sponsored: false, created_at: "2026-06-05T00:00:00Z" },
];

// In demo mode (tables not created yet) place reactions are kept in
// localStorage so they persist across pages until the real place_reactions
// table exists.
const DEMO_PLACE_REACTIONS_KEY = "roomly_demo_place_reactions";

export function getDemoPlaceReactions(): Record<string, "like" | "pass"> {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(DEMO_PLACE_REACTIONS_KEY) || "{}") as Record<
      string,
      "like" | "pass"
    >;
  } catch {
    return {};
  }
}

export function setDemoPlaceReactions(map: Record<string, "like" | "pass">): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(DEMO_PLACE_REACTIONS_KEY, JSON.stringify(map));
  } catch {
    // ignore storage errors (private mode, quota, etc.)
  }
}

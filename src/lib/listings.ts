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
export function isMissingTable(error: { message?: string; code?: string } | null): boolean {
  if (!error) return false;
  const msg = error.message?.toLowerCase() ?? "";
  return (
    error.code === "42P01" || // postgres: relation does not exist
    error.code === "PGRST205" || // postgrest: table not in schema cache
    msg.includes("does not exist") ||
    msg.includes("schema cache") ||
    msg.includes("could not find the table")
  );
}

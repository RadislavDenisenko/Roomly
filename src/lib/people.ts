import type { CompatProfile } from "@/lib/compat";

export type PoolPerson = CompatProfile & { member_group: "seeker" | "resident" };

// Groups pooled people by the places the caller liked (most-recent-first, as
// passed in). A person only shows up under the first place they appear
// under; sections that end up with nobody new are dropped. Residents sort
// before seekers within a section.
export function groupPeopleByPlace(
  placesLiked: { id: string; name: string }[],
  poolsByPlace: Record<string, PoolPerson[]>,
): { place: { id: string; name: string }; people: PoolPerson[] }[] {
  const seen = new Set<string>();
  const sections: { place: { id: string; name: string }; people: PoolPerson[] }[] = [];

  for (const place of placesLiked) {
    const pool = poolsByPlace[place.id] ?? [];
    const people = pool.filter((p) => {
      if (seen.has(p.id)) return false;
      seen.add(p.id);
      return true;
    });
    if (people.length === 0) continue;
    people.sort((a, b) => {
      if (a.member_group === b.member_group) return 0;
      return a.member_group === "resident" ? -1 : 1;
    });
    sections.push({ place, people });
  }

  return sections;
}

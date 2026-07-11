import { describe, it, expect } from "vitest";
import { groupPeopleByPlace, type PoolPerson } from "./people";

function person(overrides: Partial<PoolPerson>): PoolPerson {
  return {
    id: "id",
    full_name: "Name",
    age: 25,
    city: "Austin, TX",
    bio: null,
    avatar_url: null,
    photos: null,
    budget_min: 1000,
    budget_max: 1500,
    cleanliness: 3,
    sleep_schedule: "flexible",
    smoking: false,
    pets: false,
    guests: "sometimes",
    email_verified: true,
    verification_status: "verified",
    member_group: "seeker",
    ...overrides,
  };
}

const placeA = { id: "place-a", name: "The Triangle" };
const placeB = { id: "place-b", name: "Hyde Park Commons" };

describe("groupPeopleByPlace", () => {
  it("dedupes a person into the first section they appear in", () => {
    const maya = person({ id: "maya" });
    const sections = groupPeopleByPlace(
      [placeA, placeB],
      { [placeA.id]: [maya], [placeB.id]: [maya] },
    );
    expect(sections).toHaveLength(1);
    expect(sections[0].place.id).toBe(placeA.id);
    expect(sections[0].people.map((p) => p.id)).toEqual(["maya"]);
  });

  it("sorts residents before seekers within a section", () => {
    const seeker = person({ id: "seeker", member_group: "seeker" });
    const resident = person({ id: "resident", member_group: "resident" });
    const sections = groupPeopleByPlace([placeA], { [placeA.id]: [seeker, resident] });
    expect(sections[0].people.map((p) => p.id)).toEqual(["resident", "seeker"]);
  });

  it("drops sections that end up with nobody new", () => {
    const sections = groupPeopleByPlace([placeA, placeB], { [placeA.id]: [], [placeB.id]: [] });
    expect(sections).toEqual([]);
  });

  it("preserves the order places were passed in", () => {
    const a = person({ id: "a" });
    const b = person({ id: "b" });
    const sections = groupPeopleByPlace([placeB, placeA], { [placeA.id]: [a], [placeB.id]: [b] });
    expect(sections.map((s) => s.place.id)).toEqual([placeB.id, placeA.id]);
  });
});

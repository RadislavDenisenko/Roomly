import type { CompatProfile } from "@/lib/compat";

// One person in an apartment's People pool, as returned by the
// people_for_place / people_for_area RPCs.
export type PoolPerson = CompatProfile & { member_group: "seeker" | "resident" };

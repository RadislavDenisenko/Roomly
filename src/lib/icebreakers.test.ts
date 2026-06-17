import { describe, it, expect } from "vitest";
import { ICEBREAKERS, pickIcebreakers } from "./icebreakers";

describe("pickIcebreakers", () => {
  it("returns 3 by default", () => {
    expect(pickIcebreakers()).toHaveLength(3);
  });
  it("returns the requested count, capped at the list length", () => {
    expect(pickIcebreakers(2)).toHaveLength(2);
    expect(pickIcebreakers(99).length).toBe(ICEBREAKERS.length);
  });
});

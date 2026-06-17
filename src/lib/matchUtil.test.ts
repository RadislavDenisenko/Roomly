import { describe, it, expect } from "vitest";
import { orderedPair } from "./matchUtil";

describe("orderedPair", () => {
  it("returns the two ids sorted ascending regardless of input order", () => {
    expect(orderedPair("b", "a")).toEqual(["a", "b"]);
    expect(orderedPair("a", "b")).toEqual(["a", "b"]);
  });
});

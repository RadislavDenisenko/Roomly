import { describe, it, expect, afterEach } from "vitest";
import { prefersReducedMotion } from "./motion";

describe("prefersReducedMotion", () => {
  const originalWindow = global.window;

  afterEach(() => {
    global.window = originalWindow;
  });

  it("returns false when window is undefined", () => {
    // @ts-expect-error simulate an SSR environment
    delete global.window;
    expect(prefersReducedMotion()).toBe(false);
  });

  it("returns true when the media query matches", () => {
    // @ts-expect-error minimal stub for a Node test environment (no jsdom)
    global.window = { matchMedia: () => ({ matches: true }) };
    expect(prefersReducedMotion()).toBe(true);
  });

  it("returns false when the media query does not match", () => {
    // @ts-expect-error minimal stub for a Node test environment (no jsdom)
    global.window = { matchMedia: () => ({ matches: false }) };
    expect(prefersReducedMotion()).toBe(false);
  });
});

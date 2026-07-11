import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { peopleConsentSeen, markPeopleConsentSeen } from "./consent";

function fakeLocalStorage() {
  const store = new Map<string, string>();
  return {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => {
      store.set(k, v);
    },
  };
}

describe("people consent", () => {
  const originalWindow = global.window;
  const originalLocalStorage = global.localStorage;

  beforeEach(() => {
    const storage = fakeLocalStorage();
    // @ts-expect-error minimal stubs for a Node test environment (no jsdom)
    global.window = {};
    // @ts-expect-error minimal stubs for a Node test environment (no jsdom)
    global.localStorage = storage;
  });

  afterEach(() => {
    global.window = originalWindow;
    global.localStorage = originalLocalStorage;
  });

  it("returns false with no flag set", () => {
    expect(peopleConsentSeen()).toBe(false);
  });

  it("returns true after marking seen", () => {
    markPeopleConsentSeen();
    expect(peopleConsentSeen()).toBe(true);
  });

  it("returns false when window is undefined", () => {
    // @ts-expect-error simulate an SSR environment
    delete global.window;
    expect(peopleConsentSeen()).toBe(false);
  });

  it("does not throw when marking seen without window", () => {
    // @ts-expect-error simulate an SSR environment
    delete global.window;
    expect(() => markPeopleConsentSeen()).not.toThrow();
  });
});

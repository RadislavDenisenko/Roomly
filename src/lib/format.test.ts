import { describe, it, expect } from "vitest";
import { relativeTime } from "./format";

const now = new Date("2026-06-16T12:00:00Z");

describe("relativeTime", () => {
  it("returns empty string for null", () => {
    expect(relativeTime(null, now)).toBe("");
  });
  it("returns 'just now' under a minute", () => {
    expect(relativeTime("2026-06-16T11:59:30Z", now)).toBe("just now");
  });
  it("returns minutes, hours, days", () => {
    expect(relativeTime("2026-06-16T11:30:00Z", now)).toBe("30m ago");
    expect(relativeTime("2026-06-16T09:00:00Z", now)).toBe("3h ago");
    expect(relativeTime("2026-06-14T12:00:00Z", now)).toBe("2d ago");
  });
});

import { describe, it, expect } from "vitest";
import { deriveVerificationStatus, isVerified } from "./verification";

describe("deriveVerificationStatus", () => {
  it("is verified only when all three steps are done", () => {
    expect(deriveVerificationStatus({ email: true, phone: true, id: true })).toBe("verified");
  });
  it("is pending when some but not all steps are done", () => {
    expect(deriveVerificationStatus({ email: true, phone: false, id: false })).toBe("pending");
    expect(deriveVerificationStatus({ email: true, phone: true, id: false })).toBe("pending");
  });
  it("is unverified when no steps are done", () => {
    expect(deriveVerificationStatus({ email: false, phone: false, id: false })).toBe("unverified");
  });
});

describe("isVerified", () => {
  it("true only for verified status", () => {
    expect(isVerified({ verification_status: "verified" })).toBe(true);
    expect(isVerified({ verification_status: "pending" })).toBe(false);
    expect(isVerified({ verification_status: null })).toBe(false);
    expect(isVerified({})).toBe(false);
  });
});

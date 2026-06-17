export type VerificationStatus = "unverified" | "pending" | "verified";

export function deriveVerificationStatus(steps: {
  email: boolean;
  phone: boolean;
  id: boolean;
}): VerificationStatus {
  if (steps.email && steps.phone && steps.id) return "verified";
  if (steps.email || steps.phone || steps.id) return "pending";
  return "unverified";
}

export function isVerified(p: {
  verification_status?: VerificationStatus | null;
}): boolean {
  return p.verification_status === "verified";
}

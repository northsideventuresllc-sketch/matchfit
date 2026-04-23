import { describe, expect, it } from "vitest";
import { verifyTrainerOnboardingDevPassword } from "@/lib/trainer-dev-bypass";
import { coerceTrainerBackgroundVendorStatus, coerceTrainerCptStatus } from "@/lib/trainer-onboarding-status";

describe("verifyTrainerOnboardingDevPassword", () => {
  it("accepts the exact case-sensitive password", () => {
    expect(verifyTrainerOnboardingDevPassword("Crumpet99!")).toBe(true);
  });
  it("rejects wrong casing and missing punctuation", () => {
    expect(verifyTrainerOnboardingDevPassword("crumpet99!")).toBe(false);
    expect(verifyTrainerOnboardingDevPassword("Crumpet99")).toBe(false);
    expect(verifyTrainerOnboardingDevPassword("")).toBe(false);
  });
});

describe("coerceTrainerBackgroundVendorStatus", () => {
  it("normalizes known uppercase values", () => {
    expect(coerceTrainerBackgroundVendorStatus("PENDING")).toBe("PENDING");
    expect(coerceTrainerBackgroundVendorStatus("NEEDS_FURTHER_REVIEW")).toBe("NEEDS_FURTHER_REVIEW");
  });
  it("maps legacy values", () => {
    expect(coerceTrainerBackgroundVendorStatus("pending")).toBe("NOT_STARTED");
    expect(coerceTrainerBackgroundVendorStatus("approved")).toBe("APPROVED");
  });
});

describe("coerceTrainerCptStatus", () => {
  it("maps legacy review states", () => {
    expect(coerceTrainerCptStatus("none")).toBe("NOT_STARTED");
    expect(coerceTrainerCptStatus("pending_human_review")).toBe("PENDING");
    expect(coerceTrainerCptStatus("approved")).toBe("APPROVED");
  });
});

import { describe, expect, it } from "vitest";
import { resolveTrainerSignupNextPath } from "@/lib/trainer-signup-next-path";

describe("resolveTrainerSignupNextPath", () => {
  it("routes to terms when TOS not signed", () => {
    expect(resolveTrainerSignupNextPath({ hasSignedTOS: false })).toBe("/trainer/signup/terms");
  });

  it("routes to dashboard when TOS signed and limited dashboard unlocked", () => {
    expect(
      resolveTrainerSignupNextPath({
        hasSignedTOS: true,
        registrationFeeHoldStatus: "NOT_STARTED",
        limitedDashboardUnlockedAt: new Date().toISOString(),
        onboardingFeePaymentDeadlineAt: new Date(Date.now() + 86400000).toISOString(),
      }),
    ).toBe("/trainer/dashboard");
  });

  it("routes to payment when onboarding fee deadline expired", () => {
    expect(
      resolveTrainerSignupNextPath({
        hasSignedTOS: true,
        registrationFeeHoldStatus: "NOT_STARTED",
        limitedDashboardUnlockedAt: new Date().toISOString(),
        onboardingFeePaymentDeadlineAt: new Date(Date.now() - 86400000).toISOString(),
      }),
    ).toBe("/trainer/signup/payment");
  });

  it("routes to dashboard when signup fee is held", () => {
    expect(
      resolveTrainerSignupNextPath({
        hasSignedTOS: true,
        registrationFeeHoldStatus: "HELD",
        limitedDashboardUnlockedAt: new Date().toISOString(),
      }),
    ).toBe("/trainer/dashboard");
  });
});

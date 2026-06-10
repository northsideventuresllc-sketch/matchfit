import { describe, expect, it } from "vitest";
import { resolveTrainerSignupNextPath } from "@/lib/trainer-signup-next-path";

describe("resolveTrainerSignupNextPath", () => {
  it("routes to terms when TOS not signed", () => {
    expect(resolveTrainerSignupNextPath({ hasSignedTOS: false })).toBe("/trainer/signup/terms");
  });

  it("routes to payment when fee not held", () => {
    expect(
      resolveTrainerSignupNextPath({
        hasSignedTOS: true,
        registrationFeeHoldStatus: "NOT_STARTED",
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

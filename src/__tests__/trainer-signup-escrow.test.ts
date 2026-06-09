import { describe, expect, it } from "vitest";
import {
  allocateTrainerSignupProcessingFees,
  computeTrainerSignupBackgroundEscrowHoldCents,
  computeTrainerSignupCaptureOnSuccessCents,
  computeTrainerSignupCombinedHoldCents,
  computeTrainerSignupEscrowSplit,
  computeTrainerSignupPlatformHoldCents,
} from "@/lib/trainer-signup-escrow";

describe("trainer-signup-escrow", () => {
  it("splits founding signup into background + platform slices", () => {
    const split = computeTrainerSignupEscrowSplit("FOUNDING_BG_SURCHARGE_20PCT");
    expect(split.backgroundCheckEscrowCents).toBe(4900);
    expect(split.platformEscrowCents).toBe(980);
    expect(split.baseCents).toBe(5880);
  });

  it("allocates separate hold amounts for background and platform slices", () => {
    const mode = "FOUNDING_BG_SURCHARGE_20PCT" as const;
    const bgHold = computeTrainerSignupBackgroundEscrowHoldCents(mode);
    const platformHold = computeTrainerSignupPlatformHoldCents(mode);
    expect(bgHold).toBeGreaterThan(4900);
    expect(platformHold).toBeGreaterThan(980);
    expect(computeTrainerSignupCombinedHoldCents(mode)).toBe(bgHold + platformHold);
    expect(computeTrainerSignupCombinedHoldCents(mode)).toBeLessThanOrEqual(
      computeTrainerSignupCaptureOnSuccessCents(mode),
    );
  });

  it("standard mode uses $100 base with bg escrow slice", () => {
    const split = computeTrainerSignupEscrowSplit("STANDARD_100_MINUS_BG");
    expect(split.baseCents).toBe(10_000);
    expect(split.backgroundCheckEscrowCents).toBe(4900);
    expect(split.platformEscrowCents).toBe(5100);
  });

  it("splits processing fees across both hold slices", () => {
    const processing = allocateTrainerSignupProcessingFees("FOUNDING_BG_SURCHARGE_20PCT");
    expect(processing.totalProcessingCents).toBeGreaterThan(0);
    expect(processing.backgroundCheckProcessingCents + processing.platformProcessingCents).toBe(
      processing.totalProcessingCents,
    );
  });
});

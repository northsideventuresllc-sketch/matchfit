import { describe, expect, it } from "vitest";
import {
  computeTrainerSignupCaptureOnBgFailureCents,
  computeTrainerSignupCaptureOnSuccessCents,
  computeTrainerSignupEscrowSplit,
} from "@/lib/trainer-signup-escrow";

describe("trainer-signup-escrow", () => {
  it("splits founding signup into background + platform slices", () => {
    const split = computeTrainerSignupEscrowSplit("FOUNDING_BG_SURCHARGE_20PCT");
    expect(split.backgroundCheckEscrowCents).toBe(4900);
    expect(split.platformEscrowCents).toBe(980);
    expect(split.baseCents).toBe(5880);
  });

  it("captures less on background-check failure than on success", () => {
    const mode = "FOUNDING_BG_SURCHARGE_20PCT" as const;
    expect(computeTrainerSignupCaptureOnBgFailureCents(mode)).toBeLessThan(
      computeTrainerSignupCaptureOnSuccessCents(mode),
    );
  });

  it("standard mode uses $100 base with bg escrow slice", () => {
    const split = computeTrainerSignupEscrowSplit("STANDARD_100_MINUS_BG");
    expect(split.baseCents).toBe(10_000);
    expect(split.backgroundCheckEscrowCents).toBe(4900);
    expect(split.platformEscrowCents).toBe(5100);
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/beta-launch-config", () => ({
  isBetaLaunchGatesEnabled: vi.fn(() => true),
  betaMaxTrainers: vi.fn(() => 30),
}));

import {
  resolveTrainerSignupPoolAssignment,
  trainerDeliveryBlockedByVirtualOnlyBetaSlot,
} from "@/lib/beta-trainer-pool";

/**
 * MF-ATLANTA-GATES-AFTER-WORLDWIDE (2026-08-04): the atlanta/virtual pool split
 * is gone. These tests exist to keep it gone — beta capacity must not read a
 * postal code, and no location may change the assignment a coach receives.
 */
describe("beta-trainer-pool", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("assigns a slot on capacity alone, with no location input", () => {
    expect(resolveTrainerSignupPoolAssignment({ slotsUsed: 0 })).toEqual({
      virtualOnlyBetaSlot: false,
    });
    expect(resolveTrainerSignupPoolAssignment({ slotsUsed: 29 })).toEqual({
      virtualOnlyBetaSlot: false,
    });
  });

  it("returns null only when the single worldwide cap is reached", () => {
    expect(resolveTrainerSignupPoolAssignment({ slotsUsed: 30 })).toBeNull();
    expect(resolveTrainerSignupPoolAssignment({ slotsUsed: 31 })).toBeNull();
  });

  it("takes no ZIP argument at all — signature is geography-free", () => {
    expect(resolveTrainerSignupPoolAssignment.length).toBe(1);
  });

  it("blocks in-person publish when virtualOnlyBetaSlot is set", () => {
    expect(
      trainerDeliveryBlockedByVirtualOnlyBetaSlot({ virtualOnlyBetaSlot: true, delivery: "in_person" }),
    ).toBe(true);
    expect(
      trainerDeliveryBlockedByVirtualOnlyBetaSlot({ virtualOnlyBetaSlot: true, delivery: "both" }),
    ).toBe(true);
    expect(
      trainerDeliveryBlockedByVirtualOnlyBetaSlot({ virtualOnlyBetaSlot: true, delivery: "virtual" }),
    ).toBe(false);
    expect(
      trainerDeliveryBlockedByVirtualOnlyBetaSlot({ virtualOnlyBetaSlot: false, delivery: "in_person" }),
    ).toBe(false);
  });
});

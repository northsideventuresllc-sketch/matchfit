import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/beta-launch-config", () => ({
  isBetaLaunchGatesEnabled: vi.fn(() => true),
  betaMaxTrainersAtlanta: vi.fn(() => 10),
  betaMaxTrainersVirtual: vi.fn(() => 20),
}));

import {
  evaluateClientInPersonBetaCheckoutGate,
  serviceDeliveryRequiresInPersonBetaGate,
} from "@/lib/beta-client-in-person-checkout-gate";
import {
  resolveTrainerSignupPoolAssignment,
  trainerDeliveryBlockedByVirtualOnlyBetaSlot,
  trainerOccupiesAtlantaBetaPool,
  trainerOccupiesVirtualBetaPool,
  trainerPrimaryPoolForZip,
} from "@/lib/beta-trainer-pool";

describe("beta-trainer-pool", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("assigns primary pool by service ZIP", () => {
    expect(trainerPrimaryPoolForZip("30301")).toBe("atlanta");
    expect(trainerPrimaryPoolForZip("10001")).toBe("virtual");
  });

  it("resolves Atlanta signup to atlanta pool when capacity remains", () => {
    expect(
      resolveTrainerSignupPoolAssignment("30301", { atlantaUsed: 4, virtualUsed: 0 }),
    ).toEqual({ pool: "atlanta", virtualOnlyBetaSlot: false });
  });

  it("overflows Atlanta ZIP to virtual pool with virtualOnlyBetaSlot when atlanta is full", () => {
    expect(
      resolveTrainerSignupPoolAssignment("30301", { atlantaUsed: 10, virtualUsed: 5 }),
    ).toEqual({ pool: "virtual", virtualOnlyBetaSlot: true });
  });

  it("assigns non-Atlanta ZIP to virtual pool only", () => {
    expect(
      resolveTrainerSignupPoolAssignment("90210", { atlantaUsed: 0, virtualUsed: 3 }),
    ).toEqual({ pool: "virtual", virtualOnlyBetaSlot: false });
  });

  it("returns null when both pools are full", () => {
    expect(
      resolveTrainerSignupPoolAssignment("30301", { atlantaUsed: 10, virtualUsed: 20 }),
    ).toBeNull();
    expect(
      resolveTrainerSignupPoolAssignment("90210", { atlantaUsed: 10, virtualUsed: 20 }),
    ).toBeNull();
  });

  it("counts atlanta vs virtual occupancy including virtualOnlyBetaSlot", () => {
    expect(
      trainerOccupiesAtlantaBetaPool({ serviceZipCode: "30301", virtualOnlyBetaSlot: false }),
    ).toBe(true);
    expect(
      trainerOccupiesAtlantaBetaPool({ serviceZipCode: "30301", virtualOnlyBetaSlot: true }),
    ).toBe(false);
    expect(
      trainerOccupiesVirtualBetaPool({ serviceZipCode: "30301", virtualOnlyBetaSlot: true }),
    ).toBe(true);
    expect(
      trainerOccupiesVirtualBetaPool({ serviceZipCode: "10001", virtualOnlyBetaSlot: false }),
    ).toBe(true);
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
  });
});

describe("beta-client-in-person-checkout-gate", () => {
  it("requires in-person gate for in-person and hybrid delivery", () => {
    expect(serviceDeliveryRequiresInPersonBetaGate("in_person")).toBe(true);
    expect(serviceDeliveryRequiresInPersonBetaGate("both")).toBe(true);
    expect(serviceDeliveryRequiresInPersonBetaGate("virtual")).toBe(false);
  });

  it("allows virtual checkout for any client ZIP", () => {
    expect(
      evaluateClientInPersonBetaCheckoutGate({ clientZipCode: "10001", delivery: "virtual" }),
    ).toEqual({ allowed: true });
  });

  it("allows in-person checkout for Atlanta metro client ZIP", () => {
    expect(
      evaluateClientInPersonBetaCheckoutGate({ clientZipCode: "30301", delivery: "in_person" }),
    ).toEqual({ allowed: true });
  });

  it("rejects in-person checkout for non-Atlanta client ZIP during beta", () => {
    const result = evaluateClientInPersonBetaCheckoutGate({
      clientZipCode: "94105",
      delivery: "both",
    });
    expect(result).toMatchObject({
      allowed: false,
      code: "BETA_IN_PERSON_GEO",
    });
  });
});

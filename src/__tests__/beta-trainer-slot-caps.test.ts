import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/beta-launch-config", () => ({
  betaMaxTotalTrainers: () => 30,
  betaMaxVirtualTrainersBase: () => 20,
  betaMaxInPersonTrainers: () => 10,
}));

import {
  buildTrainerBetaSlotSnapshot,
  canReserveTrainerBetaSlots,
  computeEffectiveVirtualMax,
  trainerOfferingPrefsFromSignup,
} from "@/lib/beta-trainer-slot-caps";

describe("beta-trainer-slot-caps", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  it("expands virtual cap one seat at a time when in-person seats are unused", () => {
    expect(computeEffectiveVirtualMax(15, 0)).toBe(20);
    expect(computeEffectiveVirtualMax(20, 0)).toBe(21);
    expect(computeEffectiveVirtualMax(25, 0)).toBe(26);
    expect(computeEffectiveVirtualMax(29, 0)).toBe(30);
    expect(computeEffectiveVirtualMax(20, 10)).toBe(20);
    expect(computeEffectiveVirtualMax(22, 5)).toBe(23);
  });

  it("tracks separate virtual and in-person buckets with a 30-trainer total", () => {
    const snapshot = buildTrainerBetaSlotSnapshot({
      totalUsed: 20,
      virtualUsed: 20,
      inPersonUsed: 0,
    });
    expect(snapshot.effectiveVirtualMax).toBe(21);
    expect(snapshot.totalRemaining).toBe(10);
    expect(canReserveTrainerBetaSlots(snapshot, { wantsVirtual: true, wantsInPerson: false }).ok).toBe(true);
    expect(canReserveTrainerBetaSlots(snapshot, { wantsVirtual: true, wantsInPerson: true }).ok).toBe(true);
  });

  it("requires both buckets when a coach selects in-person and virtual", () => {
    const snapshot = buildTrainerBetaSlotSnapshot({
      totalUsed: 29,
      virtualUsed: 20,
      inPersonUsed: 10,
    });
    expect(canReserveTrainerBetaSlots(snapshot, { wantsVirtual: true, wantsInPerson: true }).ok).toBe(false);
    expect(canReserveTrainerBetaSlots(snapshot, { wantsVirtual: true, wantsInPerson: false }).ok).toBe(false);
  });

  it("defaults signup prefs to virtual-only unless in-person is selected", () => {
    expect(trainerOfferingPrefsFromSignup({ wantsInPerson: false })).toEqual({
      wantsVirtual: true,
      wantsInPerson: false,
    });
    expect(trainerOfferingPrefsFromSignup({ wantsInPerson: true })).toEqual({
      wantsVirtual: true,
      wantsInPerson: true,
    });
  });
});

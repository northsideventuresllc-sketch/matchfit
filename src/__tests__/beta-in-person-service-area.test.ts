import { beforeEach, describe, expect, it, vi } from "vitest";

const { isBetaLaunchGatesEnabledMock } = vi.hoisted(() => ({
  isBetaLaunchGatesEnabledMock: vi.fn(),
}));

vi.mock("@/lib/beta-launch-config", () => ({
  isBetaLaunchGatesEnabled: isBetaLaunchGatesEnabledMock,
}));

import {
  validateBetaInPersonParticipantZips,
  validateBetaInPersonServiceZip,
  zipEligibleForBetaInPersonServices,
} from "@/lib/beta-in-person-service-area";
import { listBetaAtlantaMetroZipCodes } from "@/lib/beta-atlanta-metro-zips";

describe("beta-in-person-service-area", () => {
  beforeEach(() => {
    isBetaLaunchGatesEnabledMock.mockReturnValue(true);
  });

  it("allows any ZIP when beta gates are off", () => {
    isBetaLaunchGatesEnabledMock.mockReturnValue(false);
    expect(zipEligibleForBetaInPersonServices("90210")).toBe(true);
    expect(validateBetaInPersonServiceZip("90210")).toEqual({ ok: true });
  });

  it("accepts Atlanta metro ZIPs when gates are on", () => {
    expect(zipEligibleForBetaInPersonServices("30308")).toBe(true);
    expect(validateBetaInPersonServiceZip("30030")).toEqual({ ok: true });
  });

  it("rejects ZIPs outside the Atlanta metro area when gates are on", () => {
    expect(zipEligibleForBetaInPersonServices("10001")).toBe(false);
    expect(validateBetaInPersonServiceZip("60601")).toEqual({
      ok: false,
      error: expect.stringContaining("Atlanta metro"),
    });
  });

  it("requires both client and trainer ZIPs in-area for in-person sessions", () => {
    expect(
      validateBetaInPersonParticipantZips({
        clientZip: "30301",
        trainerServiceZip: "30002",
      }),
    ).toEqual({ ok: true });

    expect(
      validateBetaInPersonParticipantZips({
        clientZip: "94105",
        trainerServiceZip: "30301",
      }),
    ).toEqual({
      ok: false,
      error: expect.stringContaining("client home ZIP"),
    });
  });

  it("lists sorted Atlanta metro ZIP codes", () => {
    const zips = listBetaAtlantaMetroZipCodes();
    expect(zips.length).toBeGreaterThan(100);
    expect(zips).toContain("30301");
    expect(zips).toContain("30030");
    expect([...zips].sort((a, b) => Number(a) - Number(b))).toEqual(zips);
  });
});

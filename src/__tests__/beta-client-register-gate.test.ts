import { beforeEach, describe, expect, it, vi } from "vitest";

const { isBetaLaunchGatesEnabledMock, isClientBetaCapReachedMock, getValidBetaInviteMock } = vi.hoisted(() => ({
  isBetaLaunchGatesEnabledMock: vi.fn(),
  isClientBetaCapReachedMock: vi.fn(),
  getValidBetaInviteMock: vi.fn(),
}));

vi.mock("@/lib/beta-launch-config", () => ({
  isBetaLaunchGatesEnabled: isBetaLaunchGatesEnabledMock,
}));

vi.mock("@/lib/beta-waitlist-service", () => ({
  isClientBetaCapReached: isClientBetaCapReachedMock,
  getValidBetaInvite: getValidBetaInviteMock,
}));

import { evaluateBetaClientRegistrationGate } from "@/lib/beta-client-register-gate";

describe("evaluateBetaClientRegistrationGate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("allows any valid U.S. ZIP when gates are off", async () => {
    isBetaLaunchGatesEnabledMock.mockReturnValue(false);

    const result = await evaluateBetaClientRegistrationGate({
      zipCode: "90210",
      email: "la@example.com",
      username: "la_client",
    });

    expect(result).toEqual({ ok: true, betaClientWaitlistEntryId: null });
  });

  it("does not reject non-Atlanta ZIPs when capacity is available", async () => {
    isBetaLaunchGatesEnabledMock.mockReturnValue(true);
    isClientBetaCapReachedMock.mockResolvedValue(false);

    const result = await evaluateBetaClientRegistrationGate({
      zipCode: "10001",
      email: "ny@example.com",
      username: "ny_client",
    });

    expect(result).toEqual({ ok: true, betaClientWaitlistEntryId: null });
  });

  it("requires a waitlist invite when the client cap is full", async () => {
    isBetaLaunchGatesEnabledMock.mockReturnValue(true);
    isClientBetaCapReachedMock.mockResolvedValue(true);
    getValidBetaInviteMock.mockResolvedValue(null);

    const result = await evaluateBetaClientRegistrationGate({
      zipCode: "60601",
      email: "chi@example.com",
      username: "chi_client",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("BETA_CLIENT_CAP");
    }
  });
});

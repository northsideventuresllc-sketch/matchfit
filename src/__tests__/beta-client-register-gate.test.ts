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
    isBetaLaunchGatesEnabledMock.mockReturnValue(true);
    isClientBetaCapReachedMock.mockResolvedValue(true);
    getValidBetaInviteMock.mockResolvedValue(null);
  });

  it("allows signup when beta launch gates are disabled", async () => {
    isBetaLaunchGatesEnabledMock.mockReturnValue(false);

    const result = await evaluateBetaClientRegistrationGate({
      zipCode: "99501",
      email: "client@example.com",
      username: "client-user",
    });

    expect(result).toEqual({ ok: true, betaClientWaitlistEntryId: null });
    expect(isClientBetaCapReachedMock).not.toHaveBeenCalled();
    expect(getValidBetaInviteMock).not.toHaveBeenCalled();
  });

  it("allows signup without invite when cap is not reached", async () => {
    isClientBetaCapReachedMock.mockResolvedValue(false);

    const result = await evaluateBetaClientRegistrationGate({
      zipCode: "90210",
      email: "client@example.com",
      username: "client-user",
      betaInviteToken: "unused-token",
    });

    expect(result).toEqual({ ok: true, betaClientWaitlistEntryId: null });
    expect(getValidBetaInviteMock).not.toHaveBeenCalled();
  });

  it("rejects signup when cap is full and invite is missing", async () => {
    const result = await evaluateBetaClientRegistrationGate({
      zipCode: "10001",
      email: "full@example.com",
      username: "full-client",
    });

    expect(getValidBetaInviteMock).toHaveBeenCalledWith(undefined);
    expect(result).toEqual({
      ok: false,
      status: 403,
      code: "BETA_CLIENT_CAP",
      error: "Client memberships are full for this beta. Join the waitlist and we will email you when a slot opens.",
    });
  });

  it("rejects signup when invite role does not match client", async () => {
    getValidBetaInviteMock.mockResolvedValueOnce({
      role: "trainer",
      entryId: "trainer-entry",
      email: "client@example.com",
      desiredUsername: "client-user",
      firstName: "Trainer",
    });

    const result = await evaluateBetaClientRegistrationGate({
      zipCode: "30301",
      email: "client@example.com",
      username: "client-user",
      betaInviteToken: "invite-token",
    });

    expect(getValidBetaInviteMock).toHaveBeenCalledWith("invite-token");
    expect(result).toMatchObject({
      ok: false,
      status: 403,
      code: "BETA_CLIENT_CAP",
    });
  });

  it("accepts client invite after normalizing email case and trimmed username", async () => {
    getValidBetaInviteMock.mockResolvedValueOnce({
      role: "client",
      entryId: "client-entry-1",
      email: "client@example.com",
      desiredUsername: "client-user",
      firstName: "Client",
    });

    const result = await evaluateBetaClientRegistrationGate({
      zipCode: "94105",
      email: "  CLIENT@EXAMPLE.COM ",
      username: "client-user  ",
      betaInviteToken: "client-invite-token",
    });

    expect(getValidBetaInviteMock).toHaveBeenCalledWith("client-invite-token");
    expect(result).toEqual({ ok: true, betaClientWaitlistEntryId: "client-entry-1" });
  });
});

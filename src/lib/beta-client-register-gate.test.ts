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

describe("beta-client-register-gate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isBetaLaunchGatesEnabledMock.mockReturnValue(true);
    isClientBetaCapReachedMock.mockResolvedValue(true);
    getValidBetaInviteMock.mockResolvedValue(null);
  });

  it("allows signup immediately when beta launch gates are disabled", async () => {
    isBetaLaunchGatesEnabledMock.mockReturnValue(false);

    await expect(
      evaluateBetaClientRegistrationGate({
        zipCode: "99999",
        email: "someone@example.com",
        username: "someone",
      }),
    ).resolves.toEqual({
      ok: true,
      betaClientWaitlistEntryId: null,
    });

    expect(isClientBetaCapReachedMock).not.toHaveBeenCalled();
    expect(getValidBetaInviteMock).not.toHaveBeenCalled();
  });

  it("allows signup when client beta cap is not reached", async () => {
    isClientBetaCapReachedMock.mockResolvedValue(false);

    await expect(
      evaluateBetaClientRegistrationGate({
        zipCode: "30301",
        email: "member@example.com",
        username: "member_01",
      }),
    ).resolves.toEqual({
      ok: true,
      betaClientWaitlistEntryId: null,
    });

    expect(getValidBetaInviteMock).not.toHaveBeenCalled();
  });

  it("returns reserved waitlist entry id for a valid matching invite when cap is full", async () => {
    getValidBetaInviteMock.mockResolvedValue({
      role: "client",
      email: "member@example.com",
      desiredUsername: "member_01",
      entryId: "waitlist_entry_1",
    });

    await expect(
      evaluateBetaClientRegistrationGate({
        zipCode: "10001",
        email: "  MEMBER@example.com ",
        username: "  member_01  ",
        betaInviteToken: "token-1",
      }),
    ).resolves.toEqual({
      ok: true,
      betaClientWaitlistEntryId: "waitlist_entry_1",
    });

    expect(getValidBetaInviteMock).toHaveBeenCalledWith("token-1");
  });

  it("rejects signup when cap is full and invite does not match normalized email or username", async () => {
    getValidBetaInviteMock.mockResolvedValue({
      role: "client",
      email: "member@example.com",
      desiredUsername: "different_username",
      entryId: "waitlist_entry_2",
    });

    await expect(
      evaluateBetaClientRegistrationGate({
        zipCode: "60601",
        email: "member@example.com",
        username: "member_01",
      }),
    ).resolves.toEqual({
      ok: false,
      status: 403,
      code: "BETA_CLIENT_CAP",
      error: "Client memberships are full for this beta. Join the waitlist and we will email you when a slot opens.",
    });
  });

  it("rejects signup when cap is full and invite is missing", async () => {
    getValidBetaInviteMock.mockResolvedValue(null);

    await expect(
      evaluateBetaClientRegistrationGate({
        zipCode: "94105",
        email: "member@example.com",
        username: "member_01",
        betaInviteToken: null,
      }),
    ).resolves.toMatchObject({
      ok: false,
      status: 403,
      code: "BETA_CLIENT_CAP",
    });

    expect(getValidBetaInviteMock).toHaveBeenCalledWith(undefined);
  });
});

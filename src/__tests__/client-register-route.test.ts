import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  ensureClientPlatformTrialSchemaMock,
  purgeExpiredRegistrationHoldsMock,
  evaluateBetaClientRegistrationGateMock,
  resolveClientRegistrationUsernameMock,
  isEmailTakenMock,
  findDeactivatedClientForReactivationMock,
  finalizeClientRegistrationFromSignupMock,
  applyClientSessionToNextResponseMock,
  verifyTurnstileTokenMock,
} = vi.hoisted(() => ({
  ensureClientPlatformTrialSchemaMock: vi.fn(),
  purgeExpiredRegistrationHoldsMock: vi.fn(),
  evaluateBetaClientRegistrationGateMock: vi.fn(),
  resolveClientRegistrationUsernameMock: vi.fn(),
  isEmailTakenMock: vi.fn(),
  findDeactivatedClientForReactivationMock: vi.fn(),
  finalizeClientRegistrationFromSignupMock: vi.fn(),
  applyClientSessionToNextResponseMock: vi.fn(),
  verifyTurnstileTokenMock: vi.fn(),
}));

vi.mock("@/lib/ensure-client-platform-trial-schema", () => ({
  ensureClientPlatformTrialSchema: ensureClientPlatformTrialSchemaMock,
}));

vi.mock("@/lib/purge-registration-holds", () => ({
  purgeExpiredRegistrationHolds: purgeExpiredRegistrationHoldsMock,
}));

vi.mock("@/lib/beta-client-register-gate", () => ({
  evaluateBetaClientRegistrationGate: evaluateBetaClientRegistrationGateMock,
}));

vi.mock("@/lib/client-queries", () => ({
  resolveClientRegistrationUsername: resolveClientRegistrationUsernameMock,
  isEmailTaken: isEmailTakenMock,
  findDeactivatedClientForReactivation: findDeactivatedClientForReactivationMock,
}));

vi.mock("@/lib/client-register-finalize", () => ({
  finalizeClientRegistrationFromSignup: finalizeClientRegistrationFromSignupMock,
}));

vi.mock("@/lib/session", () => ({
  applyClientSessionToNextResponse: applyClientSessionToNextResponseMock,
}));

vi.mock("@/lib/turnstile-verify", () => ({
  verifyTurnstileToken: verifyTurnstileTokenMock,
}));

import { POST } from "@/app/api/client/register/route";

const validBody = {
  firstName: "Test",
  lastName: "User",
  phone: "4045550100",
  email: "newclient@example.com",
  password: "TestPass1!",
  zipCode: "30301",
  dateOfBirth: "1990-01-01",
  agreedToTerms: true,
  skipTwoFactor: true,
  stayLoggedIn: true,
  turnstileToken: "token",
};

describe("POST /api/client/register", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    ensureClientPlatformTrialSchemaMock.mockResolvedValue(undefined);
    purgeExpiredRegistrationHoldsMock.mockResolvedValue(undefined);
    verifyTurnstileTokenMock.mockResolvedValue({ ok: true });
    findDeactivatedClientForReactivationMock.mockResolvedValue(null);
    evaluateBetaClientRegistrationGateMock.mockResolvedValue({ ok: true, betaClientWaitlistEntryId: null });
    resolveClientRegistrationUsernameMock.mockResolvedValue({ username: "test1234" });
    isEmailTakenMock.mockResolvedValue(false);
    finalizeClientRegistrationFromSignupMock.mockResolvedValue({ ok: true, clientId: "client_123" });
    applyClientSessionToNextResponseMock.mockResolvedValue(undefined);
  });

  it("creates the client with a server-generated username", async () => {
    const res = await POST(
      new Request("https://match-fit.net/api/client/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validBody),
      }),
    );

    expect(res.status).toBe(200);
    expect(resolveClientRegistrationUsernameMock).toHaveBeenCalledWith({
      firstName: "Test",
      email: "newclient@example.com",
      betaInviteToken: undefined,
    });
    expect(finalizeClientRegistrationFromSignupMock).toHaveBeenCalledWith(
      expect.objectContaining({
        preferredName: null,
        username: "test1234",
      }),
      expect.any(Object),
    );
  });
});

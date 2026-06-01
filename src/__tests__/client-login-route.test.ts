import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  clientLoginDeletionRedirectMock,
  send2FACodeMock,
  findClientByIdentifierMock,
  getLoginOtpDeliveryMock,
  prismaClientUpdateMock,
  verifyPasswordMock,
  applyClientSessionToNextResponseMock,
  applyLoginChallengeToNextResponseMock,
  signLoginChallengeTokenMock,
  publicApiErrorFromUnknownMock,
  verifyTurnstileTokenMock,
} = vi.hoisted(() => ({
  clientLoginDeletionRedirectMock: vi.fn(),
  send2FACodeMock: vi.fn(),
  findClientByIdentifierMock: vi.fn(),
  getLoginOtpDeliveryMock: vi.fn(),
  prismaClientUpdateMock: vi.fn(),
  verifyPasswordMock: vi.fn(),
  applyClientSessionToNextResponseMock: vi.fn(),
  applyLoginChallengeToNextResponseMock: vi.fn(),
  signLoginChallengeTokenMock: vi.fn(),
  publicApiErrorFromUnknownMock: vi.fn(),
  verifyTurnstileTokenMock: vi.fn(),
}));

vi.mock("@/lib/account-deletion-login-redirect", () => ({
  clientLoginDeletionRedirect: clientLoginDeletionRedirectMock,
}));

vi.mock("@/lib/auth-2fa-email", () => ({
  send2FACode: send2FACodeMock,
}));

vi.mock("@/lib/client-queries", () => ({
  findClientByIdentifier: findClientByIdentifierMock,
}));

vi.mock("@/lib/login-two-factor-target", () => ({
  getLoginOtpDelivery: getLoginOtpDeliveryMock,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    client: {
      update: prismaClientUpdateMock,
    },
  },
}));

vi.mock("@/lib/password", () => ({
  verifyPassword: verifyPasswordMock,
}));

vi.mock("@/lib/session", () => ({
  applyClientSessionToNextResponse: applyClientSessionToNextResponseMock,
  applyLoginChallengeToNextResponse: applyLoginChallengeToNextResponseMock,
  signLoginChallengeToken: signLoginChallengeTokenMock,
}));

vi.mock("@/lib/public-api-error", () => ({
  publicApiErrorFromUnknown: publicApiErrorFromUnknownMock,
}));

vi.mock("@/lib/turnstile-verify", () => ({
  verifyTurnstileToken: verifyTurnstileTokenMock,
}));

import { POST } from "@/app/api/client/login/route";

function makeRequest(payload: Record<string, unknown>): Request {
  return new Request("https://example.test/api/client/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
}

describe("POST /api/client/login", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    verifyTurnstileTokenMock.mockResolvedValue({ ok: true });
    findClientByIdentifierMock.mockResolvedValue({
      id: "client_1",
      passwordHash: "hash",
      safetySuspended: false,
      twoFactorEnabled: false,
    });
    verifyPasswordMock.mockResolvedValue(true);
    getLoginOtpDeliveryMock.mockResolvedValue(null);
    prismaClientUpdateMock.mockResolvedValue(undefined);
    clientLoginDeletionRedirectMock.mockResolvedValue(null);
    applyClientSessionToNextResponseMock.mockResolvedValue(undefined);
    applyLoginChallengeToNextResponseMock.mockImplementation(() => undefined);
    signLoginChallengeTokenMock.mockResolvedValue("challenge-token");
    send2FACodeMock.mockResolvedValue(undefined);
    publicApiErrorFromUnknownMock.mockReturnValue({
      message: "Sign-in failed. Please try again.",
      status: 500,
    });
  });

  it("returns 400 when payload is invalid", async () => {
    const response = await POST(makeRequest({ identifier: "", password: "" }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Invalid login request." });
    expect(verifyTurnstileTokenMock).not.toHaveBeenCalled();
  });

  it("returns turnstile verification errors as-is", async () => {
    verifyTurnstileTokenMock.mockResolvedValueOnce({
      ok: false,
      error: "Complete the security check before continuing.",
      status: 400,
    });

    const response = await POST(
      makeRequest({ identifier: "member@example.com", password: "Password1!", turnstileToken: "bad-token" }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Complete the security check before continuing.",
    });
    expect(findClientByIdentifierMock).not.toHaveBeenCalled();
  });

  it("returns 401 when no matching client account exists", async () => {
    findClientByIdentifierMock.mockResolvedValueOnce(null);

    const response = await POST(makeRequest({ identifier: "missing@example.com", password: "Password1!" }));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "Invalid credentials." });
    expect(verifyPasswordMock).not.toHaveBeenCalled();
  });

  it("returns 401 when password verification fails", async () => {
    verifyPasswordMock.mockResolvedValueOnce(false);

    const response = await POST(makeRequest({ identifier: "member@example.com", password: "wrong-password" }));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "Invalid credentials." });
    expect(getLoginOtpDeliveryMock).not.toHaveBeenCalled();
  });

  it("returns 403 with ACCOUNT_SUSPENDED when safety-suspended", async () => {
    findClientByIdentifierMock.mockResolvedValueOnce({
      id: "client_1",
      passwordHash: "hash",
      safetySuspended: true,
      twoFactorEnabled: false,
    });

    const response = await POST(makeRequest({ identifier: "member@example.com", password: "Password1!" }));

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      error:
        "Your client account is suspended pending a Match Fit safety review. You will regain access once the review is complete.",
      code: "ACCOUNT_SUSPENDED",
    });
    expect(getLoginOtpDeliveryMock).not.toHaveBeenCalled();
  });

  it("issues a 2FA challenge when 2FA is enabled and an email delivery target exists", async () => {
    findClientByIdentifierMock.mockResolvedValueOnce({
      id: "client_1",
      passwordHash: "hash",
      safetySuspended: false,
      twoFactorEnabled: true,
    });
    getLoginOtpDeliveryMock.mockResolvedValueOnce({ email: "member@example.com" });

    const response = await POST(makeRequest({ identifier: "member@example.com", password: "Password1!" }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ needsTwoFactor: true, next: "/verify-2fa" });
    expect(send2FACodeMock).toHaveBeenCalledWith("member@example.com", "client_1", "CLIENT");
    expect(prismaClientUpdateMock).toHaveBeenCalledWith({
      where: { id: "client_1" },
      data: {
        stayLoggedIn: true,
        twoFactorLoginAttempts: 0,
        twoFactorMethod: "EMAIL",
        twoFactorOtpHash: null,
        twoFactorOtpExpires: null,
      },
    });
    expect(signLoginChallengeTokenMock).toHaveBeenCalledWith("client_1", { stayLoggedIn: true });
    expect(applyLoginChallengeToNextResponseMock).toHaveBeenCalledWith(response, "challenge-token");
    expect(applyClientSessionToNextResponseMock).not.toHaveBeenCalled();
    expect(clientLoginDeletionRedirectMock).not.toHaveBeenCalled();
  });

  it("issues a session and includes deletion redirect metadata on non-2FA flow", async () => {
    clientLoginDeletionRedirectMock.mockResolvedValueOnce({
      next: "/client/settings/account?deletionScheduled=1",
      finalizeAt: "2026-06-01T00:00:00.000Z",
    });

    const response = await POST(
      makeRequest({
        identifier: "member@example.com",
        password: "Password1!",
        stayLoggedIn: false,
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      next: "/client/settings/account?deletionScheduled=1",
      finalizeAt: "2026-06-01T00:00:00.000Z",
    });
    expect(prismaClientUpdateMock).toHaveBeenCalledWith({
      where: { id: "client_1" },
      data: { stayLoggedIn: false },
    });
    expect(clientLoginDeletionRedirectMock).toHaveBeenCalledWith("client_1");
    expect(applyClientSessionToNextResponseMock).toHaveBeenCalledWith(response, "client_1", false);
    expect(applyLoginChallengeToNextResponseMock).not.toHaveBeenCalled();
  });

  it("normalizes unexpected errors through publicApiErrorFromUnknown", async () => {
    const boom = new Error("db down");
    findClientByIdentifierMock.mockRejectedValueOnce(boom);
    publicApiErrorFromUnknownMock.mockReturnValueOnce({
      message: "Temporary login outage.",
      status: 503,
    });

    const response = await POST(makeRequest({ identifier: "member@example.com", password: "Password1!" }));

    expect(publicApiErrorFromUnknownMock).toHaveBeenCalledWith(
      boom,
      "Sign-in failed. Please try again.",
      { logLabel: "[Match Fit login]" },
    );
    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({ error: "Temporary login outage." });
  });
});

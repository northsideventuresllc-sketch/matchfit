import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockEncryptUtf8,
  mockUpsertTrainerVideoConferenceConnection,
  mockVerifyVideoOAuthState,
  mockGoogleExchangeCode,
  mockStringifyOAuthTokenBundle,
} = vi.hoisted(() => ({
  mockEncryptUtf8: vi.fn(),
  mockUpsertTrainerVideoConferenceConnection: vi.fn(),
  mockVerifyVideoOAuthState: vi.fn(),
  mockGoogleExchangeCode: vi.fn(),
  mockStringifyOAuthTokenBundle: vi.fn(),
}));

vi.mock("@/lib/field-encryption", () => ({
  encryptUtf8: mockEncryptUtf8,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    trainerVideoConferenceConnection: {
      upsert: mockUpsertTrainerVideoConferenceConnection,
    },
  },
}));

vi.mock("@/lib/trainer-video-oauth-state", () => ({
  verifyVideoOAuthState: mockVerifyVideoOAuthState,
}));

vi.mock("@/lib/trainer-video-oauth-tokens", () => ({
  googleExchangeCode: mockGoogleExchangeCode,
  stringifyOAuthTokenBundle: mockStringifyOAuthTokenBundle,
}));

import { GET } from "@/app/api/trainer/oauth/google/callback/route";

describe("GET /api/trainer/oauth/google/callback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
    process.env.NEXT_PUBLIC_APP_URL = "https://matchfit.test";

    mockEncryptUtf8.mockImplementation((value: string) => `enc:${value}`);
    mockStringifyOAuthTokenBundle.mockImplementation((bundle: unknown) => JSON.stringify(bundle));
    mockVerifyVideoOAuthState.mockResolvedValue({
      trainerId: "trainer_google",
      provider: "GOOGLE",
    });
    mockGoogleExchangeCode.mockResolvedValue({
      refreshToken: "refresh_google",
      accessToken: "access_google",
      expiresAtMs: 2_000_000_010_000,
    });
    mockUpsertTrainerVideoConferenceConnection.mockResolvedValue({});
  });

  it("returns missing_code when code/state query params are missing", async () => {
    const res = await GET(new Request("https://matchfit.test/api/trainer/oauth/google/callback"));

    expect(res.headers.get("location")).toBe(
      "https://matchfit.test/trainer/dashboard/video-meetings?oauthError=missing_code",
    );
    expect(mockVerifyVideoOAuthState).not.toHaveBeenCalled();
  });

  it("returns invalid_state when provider state is invalid", async () => {
    mockVerifyVideoOAuthState.mockResolvedValueOnce({ trainerId: "trainer_google", provider: "ZOOM" });

    const res = await GET(
      new Request("https://matchfit.test/api/trainer/oauth/google/callback?code=abc123&state=wrong-provider"),
    );

    expect(res.headers.get("location")).toBe(
      "https://matchfit.test/trainer/dashboard/video-meetings?oauthError=invalid_state",
    );
    expect(mockGoogleExchangeCode).not.toHaveBeenCalled();
  });

  it("persists connection and account hint when token exchange succeeds", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ email: "trainer.google@example.test" }), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const res = await GET(
      new Request("https://matchfit.test/api/trainer/oauth/google/callback?code=abc123&state=google-state"),
    );

    expect(mockGoogleExchangeCode).toHaveBeenCalledWith("abc123");
    expect(res.headers.get("location")).toBe(
      "https://matchfit.test/trainer/dashboard/video-meetings?connected=google",
    );
    const upsertArg = mockUpsertTrainerVideoConferenceConnection.mock.calls[0]?.[0] as {
      create: { trainerId: string; externalAccountHint: string | null };
    };
    expect(upsertArg.create.trainerId).toBe("trainer_google");
    expect(upsertArg.create.externalAccountHint).toBe("tr…@example.test");
  });

  it("surfaces token exchange errors through oauthError redirect", async () => {
    mockGoogleExchangeCode.mockResolvedValueOnce({
      error: "Google OAuth exchange failed in test",
    });

    const res = await GET(
      new Request("https://matchfit.test/api/trainer/oauth/google/callback?code=abc123&state=google-state"),
    );

    expect(res.headers.get("location")).toBe(
      "https://matchfit.test/trainer/dashboard/video-meetings?oauthError=Google%20OAuth%20exchange%20failed%20in%20test",
    );
    expect(mockUpsertTrainerVideoConferenceConnection).not.toHaveBeenCalled();
  });
});

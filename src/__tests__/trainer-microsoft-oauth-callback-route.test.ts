import { beforeEach, describe, expect, it, vi } from "vitest";
import { clearTestCookieJar, testCookieJar } from "@/test/next-cookie-jar";

const {
  mockEncryptUtf8,
  mockUpsertTrainerVideoConferenceConnection,
  mockCreateSupabaseServerClientForTrainerMicrosoftOAuth,
  mockVerifyTrainerMicrosoftSupabaseLinkState,
  mockVerifyVideoOAuthState,
  mockStringifyOAuthTokenBundle,
  mockMicrosoftAccessTokenExpiresAtMs,
  mockMicrosoftExchangeCode,
} = vi.hoisted(() => ({
  mockEncryptUtf8: vi.fn(),
  mockUpsertTrainerVideoConferenceConnection: vi.fn(),
  mockCreateSupabaseServerClientForTrainerMicrosoftOAuth: vi.fn(),
  mockVerifyTrainerMicrosoftSupabaseLinkState: vi.fn(),
  mockVerifyVideoOAuthState: vi.fn(),
  mockStringifyOAuthTokenBundle: vi.fn(),
  mockMicrosoftAccessTokenExpiresAtMs: vi.fn(),
  mockMicrosoftExchangeCode: vi.fn(),
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

vi.mock("@/lib/supabase/trainer-microsoft-oauth", () => ({
  TRAINER_MICROSOFT_SUPABASE_LINK_COOKIE: "mf_trainer_ms_supabase_oauth_link",
  createSupabaseServerClientForTrainerMicrosoftOAuth: mockCreateSupabaseServerClientForTrainerMicrosoftOAuth,
}));

vi.mock("@/lib/trainer-video-oauth-state", () => ({
  verifyTrainerMicrosoftSupabaseLinkState: mockVerifyTrainerMicrosoftSupabaseLinkState,
  verifyVideoOAuthState: mockVerifyVideoOAuthState,
}));

vi.mock("@/lib/trainer-video-oauth-tokens", () => ({
  stringifyOAuthTokenBundle: mockStringifyOAuthTokenBundle,
  microsoftAccessTokenExpiresAtMs: mockMicrosoftAccessTokenExpiresAtMs,
  microsoftExchangeCode: mockMicrosoftExchangeCode,
}));

import { GET } from "@/app/api/trainer/oauth/microsoft/callback/route";

describe("GET /api/trainer/oauth/microsoft/callback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearTestCookieJar();
    vi.unstubAllGlobals();
    process.env.NEXT_PUBLIC_APP_URL = "https://matchfit.test";

    mockEncryptUtf8.mockImplementation((value: string) => `enc:${value}`);
    mockStringifyOAuthTokenBundle.mockImplementation((bundle: unknown) => JSON.stringify(bundle));
    mockMicrosoftAccessTokenExpiresAtMs.mockReturnValue(2_000_000_000_000);
    mockCreateSupabaseServerClientForTrainerMicrosoftOAuth.mockReturnValue({
      supabase: null,
      error: "Supabase is not configured.",
    });
    mockVerifyTrainerMicrosoftSupabaseLinkState.mockResolvedValue(null);
    mockVerifyVideoOAuthState.mockResolvedValue({
      trainerId: "trainer_direct_ms",
      provider: "MICROSOFT",
    });
    mockMicrosoftExchangeCode.mockResolvedValue({
      refreshToken: "refresh_direct_ms",
      accessToken: "access_direct_ms",
      expiresAtMs: 2_000_000_010_000,
    });
    mockUpsertTrainerVideoConferenceConnection.mockResolvedValue({});
  });

  it("handles Supabase-linked callback and persists oauthGrantSource=supabase_azure", async () => {
    testCookieJar.set("mf_trainer_ms_supabase_oauth_link", "link-cookie-jwt");
    mockVerifyTrainerMicrosoftSupabaseLinkState.mockResolvedValueOnce({ trainerId: "trainer_from_ms_link" });
    const exchangeCodeForSession = vi.fn().mockResolvedValue({ error: null });
    const getSession = vi.fn().mockResolvedValue({
      data: {
        session: {
          provider_token: "supabase_ms_access",
          provider_refresh_token: "supabase_ms_refresh",
        },
      },
    });
    const signOut = vi.fn().mockResolvedValue({ error: null });
    mockCreateSupabaseServerClientForTrainerMicrosoftOAuth.mockReturnValueOnce({
      supabase: { auth: { exchangeCodeForSession, getSession, signOut } },
      error: null,
    });

    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ userPrincipalName: "coach@microsoft.test" }), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const res = await GET(new Request("https://matchfit.test/api/trainer/oauth/microsoft/callback?code=abc123"));

    expect(exchangeCodeForSession).toHaveBeenCalledWith("abc123");
    expect(signOut).toHaveBeenCalledTimes(1);
    expect(mockMicrosoftExchangeCode).not.toHaveBeenCalled();
    expect(res.headers.get("location")).toBe(
      "https://matchfit.test/trainer/dashboard/video-meetings?connected=microsoft",
    );

    const upsertArg = mockUpsertTrainerVideoConferenceConnection.mock.calls[0]?.[0] as {
      create: { trainerId: string; oauthGrantSource: string; externalAccountHint: string | null };
      update: { oauthGrantSource: string };
    };
    expect(upsertArg.create.trainerId).toBe("trainer_from_ms_link");
    expect(upsertArg.create.oauthGrantSource).toBe("supabase_azure");
    expect(upsertArg.create.externalAccountHint).toBe("co…@microsoft.test");
    expect(upsertArg.update.oauthGrantSource).toBe("supabase_azure");
  });

  it("returns supabase_not_configured when link state is present but Supabase client cannot initialize", async () => {
    testCookieJar.set("mf_trainer_ms_supabase_oauth_link", "link-cookie-jwt");
    mockVerifyTrainerMicrosoftSupabaseLinkState.mockResolvedValueOnce({ trainerId: "trainer_from_ms_link" });
    mockCreateSupabaseServerClientForTrainerMicrosoftOAuth.mockReturnValueOnce({
      supabase: null,
      error: "missing env",
    });

    const res = await GET(new Request("https://matchfit.test/api/trainer/oauth/microsoft/callback?code=abc123"));

    expect(res.headers.get("location")).toBe(
      "https://matchfit.test/trainer/dashboard/video-meetings?oauthError=supabase_not_configured",
    );
    expect(mockUpsertTrainerVideoConferenceConnection).not.toHaveBeenCalled();
  });

  it("handles direct OAuth callback and persists oauthGrantSource=direct", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ mail: "trainer.direct@microsoft.test" }), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const res = await GET(
      new Request(
        "https://matchfit.test/api/trainer/oauth/microsoft/callback?code=direct-code&state=direct-state-token",
      ),
    );

    expect(mockVerifyVideoOAuthState).toHaveBeenCalledWith("direct-state-token");
    expect(mockMicrosoftExchangeCode).toHaveBeenCalledWith("direct-code");
    expect(res.headers.get("location")).toBe(
      "https://matchfit.test/trainer/dashboard/video-meetings?connected=microsoft",
    );

    const upsertArg = mockUpsertTrainerVideoConferenceConnection.mock.calls[0]?.[0] as {
      create: { trainerId: string; oauthGrantSource: string; externalAccountHint: string | null };
      update: { oauthGrantSource: string };
    };
    expect(upsertArg.create.trainerId).toBe("trainer_direct_ms");
    expect(upsertArg.create.oauthGrantSource).toBe("direct");
    expect(upsertArg.create.externalAccountHint).toBe("tr…@microsoft.test");
    expect(upsertArg.update.oauthGrantSource).toBe("direct");
  });

  it("returns invalid_state when direct callback is missing state", async () => {
    const res = await GET(new Request("https://matchfit.test/api/trainer/oauth/microsoft/callback?code=abc123"));

    expect(res.headers.get("location")).toBe(
      "https://matchfit.test/trainer/dashboard/video-meetings?oauthError=invalid_state",
    );
    expect(mockMicrosoftExchangeCode).not.toHaveBeenCalled();
    expect(mockUpsertTrainerVideoConferenceConnection).not.toHaveBeenCalled();
  });
});

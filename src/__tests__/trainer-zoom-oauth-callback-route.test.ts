import { beforeEach, describe, expect, it, vi } from "vitest";
import { clearTestCookieJar, testCookieJar } from "@/test/next-cookie-jar";

const {
  mockEncryptUtf8,
  mockUpsertTrainerVideoConferenceConnection,
  mockCreateSupabaseServerClientForTrainerZoomOAuth,
  mockVerifyTrainerZoomSupabaseLinkState,
  mockVerifyVideoOAuthState,
  mockStringifyOAuthTokenBundle,
  mockZoomAccessTokenExpiresAtMs,
  mockZoomExchangeCode,
} = vi.hoisted(() => ({
  mockEncryptUtf8: vi.fn(),
  mockUpsertTrainerVideoConferenceConnection: vi.fn(),
  mockCreateSupabaseServerClientForTrainerZoomOAuth: vi.fn(),
  mockVerifyTrainerZoomSupabaseLinkState: vi.fn(),
  mockVerifyVideoOAuthState: vi.fn(),
  mockStringifyOAuthTokenBundle: vi.fn(),
  mockZoomAccessTokenExpiresAtMs: vi.fn(),
  mockZoomExchangeCode: vi.fn(),
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

vi.mock("@/lib/supabase/trainer-zoom-oauth", () => ({
  TRAINER_ZOOM_SUPABASE_LINK_COOKIE: "mf_trainer_zoom_supabase_oauth_link",
  createSupabaseServerClientForTrainerZoomOAuth: mockCreateSupabaseServerClientForTrainerZoomOAuth,
}));

vi.mock("@/lib/trainer-video-oauth-state", () => ({
  verifyTrainerZoomSupabaseLinkState: mockVerifyTrainerZoomSupabaseLinkState,
  verifyVideoOAuthState: mockVerifyVideoOAuthState,
}));

vi.mock("@/lib/trainer-video-oauth-tokens", () => ({
  stringifyOAuthTokenBundle: mockStringifyOAuthTokenBundle,
  zoomAccessTokenExpiresAtMs: mockZoomAccessTokenExpiresAtMs,
  zoomExchangeCode: mockZoomExchangeCode,
}));

import { GET } from "@/app/api/trainer/oauth/zoom/callback/route";

describe("GET /api/trainer/oauth/zoom/callback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearTestCookieJar();
    process.env.NEXT_PUBLIC_APP_URL = "https://matchfit.test";

    mockEncryptUtf8.mockImplementation((value: string) => `enc:${value}`);
    mockStringifyOAuthTokenBundle.mockImplementation((bundle: unknown) => JSON.stringify(bundle));
    mockZoomAccessTokenExpiresAtMs.mockReturnValue(2_000_000_000_000);
    mockCreateSupabaseServerClientForTrainerZoomOAuth.mockReturnValue({
      supabase: null,
      error: "Supabase is not configured.",
    });
    mockVerifyTrainerZoomSupabaseLinkState.mockResolvedValue(null);
    mockVerifyVideoOAuthState.mockResolvedValue({
      trainerId: "trainer_direct",
      provider: "ZOOM",
    });
    mockZoomExchangeCode.mockResolvedValue({
      refreshToken: "refresh_direct",
      accessToken: "access_direct",
      expiresAtMs: 2_000_000_010_000,
    });
    mockUpsertTrainerVideoConferenceConnection.mockResolvedValue({});
  });

  it("handles Supabase-linked callback and persists oauthGrantSource=supabase_zoom", async () => {
    testCookieJar.set("mf_trainer_zoom_supabase_oauth_link", "link-cookie-jwt");
    mockVerifyTrainerZoomSupabaseLinkState.mockResolvedValueOnce({ trainerId: "trainer_from_link_cookie" });
    const exchangeCodeForSession = vi.fn().mockResolvedValue({ error: null });
    const getSession = vi.fn().mockResolvedValue({
      data: {
        session: {
          provider_token: "supabase_provider_access",
          provider_refresh_token: "supabase_provider_refresh",
        },
      },
    });
    const signOut = vi.fn().mockResolvedValue({ error: null });
    mockCreateSupabaseServerClientForTrainerZoomOAuth.mockReturnValueOnce({
      supabase: { auth: { exchangeCodeForSession, getSession, signOut } },
      error: null,
    });

    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ email: "coach@zoom.test" }), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const res = await GET(new Request("https://matchfit.test/api/trainer/oauth/zoom/callback?code=abc123"));

    expect(exchangeCodeForSession).toHaveBeenCalledWith("abc123");
    expect(signOut).toHaveBeenCalledTimes(1);
    expect(mockZoomExchangeCode).not.toHaveBeenCalled();
    expect(res.headers.get("location")).toBe(
      "https://matchfit.test/trainer/dashboard/video-meetings?connected=zoom",
    );

    expect(mockUpsertTrainerVideoConferenceConnection).toHaveBeenCalledTimes(1);
    const upsertArg = mockUpsertTrainerVideoConferenceConnection.mock.calls[0]?.[0] as {
      create: { trainerId: string; oauthGrantSource: string; externalAccountHint: string | null };
      update: { oauthGrantSource: string };
    };
    expect(upsertArg.create.trainerId).toBe("trainer_from_link_cookie");
    expect(upsertArg.create.oauthGrantSource).toBe("supabase_zoom");
    expect(upsertArg.create.externalAccountHint).toBe("co…@zoom.test");
    expect(upsertArg.update.oauthGrantSource).toBe("supabase_zoom");
  });

  it("returns supabase_not_configured when link state is present but Supabase client cannot initialize", async () => {
    testCookieJar.set("mf_trainer_zoom_supabase_oauth_link", "link-cookie-jwt");
    mockVerifyTrainerZoomSupabaseLinkState.mockResolvedValueOnce({ trainerId: "trainer_from_link_cookie" });
    mockCreateSupabaseServerClientForTrainerZoomOAuth.mockReturnValueOnce({
      supabase: null,
      error: "missing env",
    });

    const res = await GET(new Request("https://matchfit.test/api/trainer/oauth/zoom/callback?code=abc123"));

    expect(res.headers.get("location")).toBe(
      "https://matchfit.test/trainer/dashboard/video-meetings?oauthError=supabase_not_configured",
    );
    expect(mockUpsertTrainerVideoConferenceConnection).not.toHaveBeenCalled();
  });

  it("handles direct OAuth callback and persists oauthGrantSource=direct", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: "zoom-user-12345678" }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const res = await GET(
      new Request(
        "https://matchfit.test/api/trainer/oauth/zoom/callback?code=direct-code&state=direct-state-token",
      ),
    );

    expect(mockVerifyVideoOAuthState).toHaveBeenCalledWith("direct-state-token");
    expect(mockZoomExchangeCode).toHaveBeenCalledWith("direct-code");
    expect(res.headers.get("location")).toBe(
      "https://matchfit.test/trainer/dashboard/video-meetings?connected=zoom",
    );

    const upsertArg = mockUpsertTrainerVideoConferenceConnection.mock.calls[0]?.[0] as {
      create: { trainerId: string; oauthGrantSource: string; externalAccountHint: string | null };
      update: { oauthGrantSource: string };
    };
    expect(upsertArg.create.trainerId).toBe("trainer_direct");
    expect(upsertArg.create.oauthGrantSource).toBe("direct");
    expect(upsertArg.create.externalAccountHint).toBe("zoom:zoom-use…");
    expect(upsertArg.update.oauthGrantSource).toBe("direct");
  });

  it("returns invalid_state when direct callback is missing state", async () => {
    const res = await GET(new Request("https://matchfit.test/api/trainer/oauth/zoom/callback?code=abc123"));

    expect(res.headers.get("location")).toBe(
      "https://matchfit.test/trainer/dashboard/video-meetings?oauthError=invalid_state",
    );
    expect(mockZoomExchangeCode).not.toHaveBeenCalled();
    expect(mockUpsertTrainerVideoConferenceConnection).not.toHaveBeenCalled();
  });
});

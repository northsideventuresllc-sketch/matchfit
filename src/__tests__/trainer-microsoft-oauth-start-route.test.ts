import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockGetSessionTrainerId,
  mockCreateSupabaseServerClientForTrainerMicrosoftOAuth,
  mockTrainerMicrosoftOAuthCallbackUrl,
  mockSignTrainerMicrosoftSupabaseLinkState,
  mockSignVideoOAuthState,
  mockMicrosoftAuthorizeUrl,
} = vi.hoisted(() => ({
  mockGetSessionTrainerId: vi.fn(),
  mockCreateSupabaseServerClientForTrainerMicrosoftOAuth: vi.fn(),
  mockTrainerMicrosoftOAuthCallbackUrl: vi.fn(),
  mockSignTrainerMicrosoftSupabaseLinkState: vi.fn(),
  mockSignVideoOAuthState: vi.fn(),
  mockMicrosoftAuthorizeUrl: vi.fn(),
}));

vi.mock("@/lib/session", () => ({
  getSessionTrainerId: mockGetSessionTrainerId,
}));

vi.mock("@/lib/supabase/trainer-microsoft-oauth", () => ({
  TRAINER_MICROSOFT_SUPABASE_LINK_COOKIE: "mf_trainer_ms_supabase_oauth_link",
  TRAINER_MICROSOFT_SUPABASE_OAUTH_SCOPES: "openid email profile offline_access Calendars.ReadWrite",
  trainerMicrosoftLinkCookieOptions: vi.fn(() => ({
    httpOnly: true,
    sameSite: "lax",
    secure: false,
    path: "/",
    maxAge: 900,
  })),
  trainerMicrosoftOAuthCallbackUrl: mockTrainerMicrosoftOAuthCallbackUrl,
  createSupabaseServerClientForTrainerMicrosoftOAuth: mockCreateSupabaseServerClientForTrainerMicrosoftOAuth,
}));

vi.mock("@/lib/trainer-video-oauth-state", () => ({
  signTrainerMicrosoftSupabaseLinkState: mockSignTrainerMicrosoftSupabaseLinkState,
  signVideoOAuthState: mockSignVideoOAuthState,
}));

vi.mock("@/lib/trainer-video-oauth-tokens", () => ({
  microsoftAuthorizeUrl: mockMicrosoftAuthorizeUrl,
}));

import { GET } from "@/app/api/trainer/oauth/microsoft/start/route";

describe("GET /api/trainer/oauth/microsoft/start", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_APP_URL = "https://matchfit.test";

    mockGetSessionTrainerId.mockResolvedValue("trainer_789");
    mockTrainerMicrosoftOAuthCallbackUrl.mockReturnValue(
      "https://matchfit.test/api/trainer/oauth/microsoft/callback",
    );
    mockSignTrainerMicrosoftSupabaseLinkState.mockResolvedValue("ms-link-state-jwt");
    mockSignVideoOAuthState.mockResolvedValue("video-state-jwt");
    mockMicrosoftAuthorizeUrl.mockReturnValue(
      "https://login.microsoftonline.com/common/oauth2/v2.0/authorize?state=video-state-jwt",
    );
    mockCreateSupabaseServerClientForTrainerMicrosoftOAuth.mockReturnValue({
      supabase: null,
      error: "Supabase is not configured.",
    });
  });

  it("returns 401 when trainer is not authenticated", async () => {
    mockGetSessionTrainerId.mockResolvedValueOnce(null);

    const res = await GET(new Request("https://matchfit.test/api/trainer/oauth/microsoft/start"));

    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toEqual({ error: "Unauthorized." });
  });

  it("returns 503 when callback redirect URL is unavailable", async () => {
    mockTrainerMicrosoftOAuthCallbackUrl.mockReturnValueOnce(null);

    const res = await GET(new Request("https://matchfit.test/api/trainer/oauth/microsoft/start"));

    expect(res.status).toBe(503);
    await expect(res.json()).resolves.toEqual({
      error: "NEXT_PUBLIC_APP_URL is required for Microsoft OAuth redirect.",
    });
  });

  it("prefers Supabase Azure OAuth when provider is configured", async () => {
    const signInWithOAuth = vi.fn().mockResolvedValue({
      data: { url: "https://supabase.test/auth/v1/authorize?provider=azure" },
      error: null,
    });
    mockCreateSupabaseServerClientForTrainerMicrosoftOAuth.mockReturnValueOnce({
      supabase: {
        auth: {
          signInWithOAuth,
        },
      },
      error: null,
    });

    const res = await GET(new Request("https://matchfit.test/api/trainer/oauth/microsoft/start"));

    expect(signInWithOAuth).toHaveBeenCalledWith({
      provider: "azure",
      options: {
        redirectTo: "https://matchfit.test/api/trainer/oauth/microsoft/callback",
        scopes: "openid email profile offline_access Calendars.ReadWrite",
        queryParams: { prompt: "consent" },
      },
    });
    expect(mockSignTrainerMicrosoftSupabaseLinkState).toHaveBeenCalledWith("trainer_789");
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("https://supabase.test/auth/v1/authorize?provider=azure");
    expect(res.headers.get("set-cookie")).toContain("mf_trainer_ms_supabase_oauth_link=ms-link-state-jwt");
    expect(mockSignVideoOAuthState).not.toHaveBeenCalled();
  });

  it("falls back to direct Microsoft OAuth when Supabase auth initiation fails", async () => {
    const signInWithOAuth = vi.fn().mockResolvedValue({
      data: { url: null },
      error: { message: "provider disabled" },
    });
    mockCreateSupabaseServerClientForTrainerMicrosoftOAuth.mockReturnValueOnce({
      supabase: {
        auth: {
          signInWithOAuth,
        },
      },
      error: null,
    });

    const res = await GET(new Request("https://matchfit.test/api/trainer/oauth/microsoft/start"));

    expect(mockSignVideoOAuthState).toHaveBeenCalledWith({ trainerId: "trainer_789", provider: "MICROSOFT" });
    expect(mockMicrosoftAuthorizeUrl).toHaveBeenCalledWith("video-state-jwt");
    expect(res.headers.get("location")).toBe(
      "https://login.microsoftonline.com/common/oauth2/v2.0/authorize?state=video-state-jwt",
    );
  });

  it("returns 503 when neither Supabase nor direct OAuth can be used", async () => {
    mockMicrosoftAuthorizeUrl.mockReturnValueOnce(null);

    const res = await GET(new Request("https://matchfit.test/api/trainer/oauth/microsoft/start"));

    expect(res.status).toBe(503);
    await expect(res.json()).resolves.toEqual({
      error:
        "Microsoft OAuth could not start. Enable the Azure provider in Supabase (NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY), or set MICROSOFT_OAUTH_CLIENT_ID / MICROSOFT_OAUTH_CLIENT_SECRET for direct OAuth.",
    });
  });
});

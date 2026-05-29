import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockGetSessionTrainerId,
  mockCreateSupabaseServerClientForTrainerZoomOAuth,
  mockTrainerZoomOAuthCallbackUrl,
  mockSignTrainerZoomSupabaseLinkState,
  mockSignVideoOAuthState,
  mockZoomAuthorizeUrl,
} = vi.hoisted(() => ({
  mockGetSessionTrainerId: vi.fn(),
  mockCreateSupabaseServerClientForTrainerZoomOAuth: vi.fn(),
  mockTrainerZoomOAuthCallbackUrl: vi.fn(),
  mockSignTrainerZoomSupabaseLinkState: vi.fn(),
  mockSignVideoOAuthState: vi.fn(),
  mockZoomAuthorizeUrl: vi.fn(),
}));

vi.mock("@/lib/session", () => ({
  getSessionTrainerId: mockGetSessionTrainerId,
}));

vi.mock("@/lib/supabase/trainer-zoom-oauth", () => ({
  TRAINER_ZOOM_SUPABASE_LINK_COOKIE: "mf_trainer_zoom_supabase_oauth_link",
  TRAINER_ZOOM_SUPABASE_OAUTH_SCOPES: "user:read:user meeting:read meeting:write",
  trainerZoomLinkCookieOptions: vi.fn(() => ({
    httpOnly: true,
    sameSite: "lax",
    secure: false,
    path: "/",
    maxAge: 900,
  })),
  trainerZoomOAuthCallbackUrl: mockTrainerZoomOAuthCallbackUrl,
  createSupabaseServerClientForTrainerZoomOAuth: mockCreateSupabaseServerClientForTrainerZoomOAuth,
}));

vi.mock("@/lib/trainer-video-oauth-state", () => ({
  signTrainerZoomSupabaseLinkState: mockSignTrainerZoomSupabaseLinkState,
  signVideoOAuthState: mockSignVideoOAuthState,
}));

vi.mock("@/lib/trainer-video-oauth-tokens", () => ({
  zoomAuthorizeUrl: mockZoomAuthorizeUrl,
}));

import { GET } from "@/app/api/trainer/oauth/zoom/start/route";

describe("GET /api/trainer/oauth/zoom/start", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_APP_URL = "https://matchfit.test";

    mockGetSessionTrainerId.mockResolvedValue("trainer_123");
    mockTrainerZoomOAuthCallbackUrl.mockReturnValue("https://matchfit.test/api/trainer/oauth/zoom/callback");
    mockSignTrainerZoomSupabaseLinkState.mockResolvedValue("zoom-link-state-jwt");
    mockSignVideoOAuthState.mockResolvedValue("video-state-jwt");
    mockZoomAuthorizeUrl.mockReturnValue("https://zoom.us/oauth/authorize?state=video-state-jwt");
    mockCreateSupabaseServerClientForTrainerZoomOAuth.mockReturnValue({
      supabase: null,
      error: "Supabase is not configured.",
    });
  });

  it("returns 401 when trainer is not authenticated", async () => {
    mockGetSessionTrainerId.mockResolvedValueOnce(null);

    const res = await GET(new Request("https://matchfit.test/api/trainer/oauth/zoom/start"));

    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toEqual({ error: "Unauthorized." });
  });

  it("returns 503 when callback redirect URL is unavailable", async () => {
    mockTrainerZoomOAuthCallbackUrl.mockReturnValueOnce(null);

    const res = await GET(new Request("https://matchfit.test/api/trainer/oauth/zoom/start"));

    expect(res.status).toBe(503);
    await expect(res.json()).resolves.toEqual({
      error: "NEXT_PUBLIC_APP_URL is required for Zoom OAuth redirect.",
    });
  });

  it("prefers Supabase OAuth when provider is configured", async () => {
    const signInWithOAuth = vi.fn().mockResolvedValue({
      data: { url: "https://supabase.test/auth/v1/authorize?provider=zoom" },
      error: null,
    });
    mockCreateSupabaseServerClientForTrainerZoomOAuth.mockReturnValueOnce({
      supabase: {
        auth: {
          signInWithOAuth,
        },
      },
      error: null,
    });

    const res = await GET(new Request("https://matchfit.test/api/trainer/oauth/zoom/start"));

    expect(signInWithOAuth).toHaveBeenCalledWith({
      provider: "zoom",
      options: {
        redirectTo: "https://matchfit.test/api/trainer/oauth/zoom/callback",
        scopes: "user:read:user meeting:read meeting:write",
        queryParams: { prompt: "consent" },
      },
    });
    expect(mockSignTrainerZoomSupabaseLinkState).toHaveBeenCalledWith("trainer_123");
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("https://supabase.test/auth/v1/authorize?provider=zoom");
    expect(res.headers.get("set-cookie")).toContain("mf_trainer_zoom_supabase_oauth_link=zoom-link-state-jwt");
    expect(mockSignVideoOAuthState).not.toHaveBeenCalled();
  });

  it("falls back to direct Zoom OAuth when Supabase auth initiation fails", async () => {
    const signInWithOAuth = vi.fn().mockResolvedValue({
      data: { url: null },
      error: { message: "provider disabled" },
    });
    mockCreateSupabaseServerClientForTrainerZoomOAuth.mockReturnValueOnce({
      supabase: {
        auth: {
          signInWithOAuth,
        },
      },
      error: null,
    });

    const res = await GET(new Request("https://matchfit.test/api/trainer/oauth/zoom/start"));

    expect(mockSignVideoOAuthState).toHaveBeenCalledWith({ trainerId: "trainer_123", provider: "ZOOM" });
    expect(mockZoomAuthorizeUrl).toHaveBeenCalledWith("video-state-jwt");
    expect(res.headers.get("location")).toBe("https://zoom.us/oauth/authorize?state=video-state-jwt");
  });

  it("returns 503 when neither Supabase nor direct OAuth can be used", async () => {
    mockZoomAuthorizeUrl.mockReturnValueOnce(null);

    const res = await GET(new Request("https://matchfit.test/api/trainer/oauth/zoom/start"));

    expect(res.status).toBe(503);
    await expect(res.json()).resolves.toEqual({
      error:
        "Zoom OAuth could not start. Enable the Zoom provider in Supabase (NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY), or set ZOOM_OAUTH_CLIENT_ID / ZOOM_OAUTH_CLIENT_SECRET for legacy direct OAuth.",
    });
  });
});

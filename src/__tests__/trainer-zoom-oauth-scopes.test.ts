import { describe, expect, it, beforeEach, afterEach } from "vitest";
import {
  signTrainerZoomSupabaseLinkState,
  verifyTrainerZoomSupabaseLinkState,
} from "@/lib/trainer-video-oauth-state";
import {
  TRAINER_ZOOM_SUPABASE_OAUTH_SCOPES,
  zoomAuthorizeUrl,
  zoomOAuthRedirectUri,
} from "@/lib/trainer-video-oauth-tokens";

describe("Zoom trainer video OAuth scopes", () => {
  it("includes meeting read/write and user profile for Supabase + direct flows", () => {
    expect(TRAINER_ZOOM_SUPABASE_OAUTH_SCOPES).toContain("meeting:read");
    expect(TRAINER_ZOOM_SUPABASE_OAUTH_SCOPES).toContain("meeting:write");
    expect(TRAINER_ZOOM_SUPABASE_OAUTH_SCOPES).toContain("user:read:user");
    expect(TRAINER_ZOOM_SUPABASE_OAUTH_SCOPES).not.toContain(",");
  });
});

describe("zoomAuthorizeUrl", () => {
  const prevId = process.env.ZOOM_OAUTH_CLIENT_ID;
  const prevApp = process.env.NEXT_PUBLIC_APP_URL;

  beforeEach(() => {
    process.env.ZOOM_OAUTH_CLIENT_ID = "zoom-client-id";
    process.env.NEXT_PUBLIC_APP_URL = "https://example.test";
  });

  afterEach(() => {
    process.env.ZOOM_OAUTH_CLIENT_ID = prevId;
    process.env.NEXT_PUBLIC_APP_URL = prevApp;
  });

  it("builds authorize URL with meeting scopes and redirect URI", () => {
    const url = zoomAuthorizeUrl("state-token");
    expect(url).toBeTruthy();
    const u = new URL(url!);
    expect(u.hostname).toBe("zoom.us");
    expect(u.searchParams.get("response_type")).toBe("code");
    expect(decodeURIComponent(u.searchParams.get("scope") ?? "")).toContain("meeting:write");
    expect(u.searchParams.get("redirect_uri")).toBe(zoomOAuthRedirectUri());
    expect(u.searchParams.get("state")).toBe("state-token");
  });
});

describe("trainer Zoom ↔ Supabase link state JWT", () => {
  it("round-trips trainer id", async () => {
    const token = await signTrainerZoomSupabaseLinkState("trainer_zoom_123");
    const parsed = await verifyTrainerZoomSupabaseLinkState(token);
    expect(parsed?.trainerId).toBe("trainer_zoom_123");
  });
});

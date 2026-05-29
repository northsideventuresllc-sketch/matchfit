import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { GOOGLE_TRAINER_VIDEO_OAUTH_SCOPES, googleAuthorizeUrl } from "@/lib/trainer-video-oauth-tokens";

describe("Google trainer video OAuth", () => {
  it("requests Calendar events + Meet space scopes (space-separated, no commas)", () => {
    expect(GOOGLE_TRAINER_VIDEO_OAUTH_SCOPES).toContain("https://www.googleapis.com/auth/calendar.events");
    expect(GOOGLE_TRAINER_VIDEO_OAUTH_SCOPES).toContain("https://www.googleapis.com/auth/meetings.space.created");
    expect(GOOGLE_TRAINER_VIDEO_OAUTH_SCOPES).not.toContain(",");
  });

  describe("googleAuthorizeUrl", () => {
    const prevId = process.env.GOOGLE_OAUTH_CLIENT_ID;
    const prevApp = process.env.NEXT_PUBLIC_APP_URL;

    beforeEach(() => {
      process.env.GOOGLE_OAUTH_CLIENT_ID = "test-client-id.apps.googleusercontent.com";
      process.env.NEXT_PUBLIC_APP_URL = "https://example.test";
    });

    afterEach(() => {
      process.env.GOOGLE_OAUTH_CLIENT_ID = prevId;
      process.env.NEXT_PUBLIC_APP_URL = prevApp;
    });

    it("uses offline access and consent so Google returns a refresh token on connect", () => {
      const url = googleAuthorizeUrl("signed-state-token");
      expect(url).toBeTruthy();
      const u = new URL(url!);
      expect(u.searchParams.get("access_type")).toBe("offline");
      expect(u.searchParams.get("prompt")).toBe("consent");
      expect(u.searchParams.get("response_type")).toBe("code");
      const scope = u.searchParams.get("scope") ?? "";
      expect(scope).toContain("https://www.googleapis.com/auth/calendar.events");
      expect(scope).toContain("https://www.googleapis.com/auth/meetings.space.created");
    });
  });
});

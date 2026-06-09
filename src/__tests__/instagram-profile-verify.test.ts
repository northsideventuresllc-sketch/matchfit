import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  normalizeInstagramLeadIdentity,
  verifyInstagramProfile,
} from "@/lib/instagram-profile-verify";

describe("normalizeInstagramLeadIdentity", () => {
  it("normalizes @handle to canonical profile URL", () => {
    expect(normalizeInstagramLeadIdentity({ handle: "@CoachJonny" })).toEqual({
      username: "coachjonny",
      handle: "@coachjonny",
      profileUrl: "https://www.instagram.com/coachjonny/",
    });
  });

  it("extracts username from profile URL", () => {
    expect(
      normalizeInstagramLeadIdentity({ profileUrl: "https://instagram.com/theofficialmatchfit/" }),
    ).toEqual({
      username: "theofficialmatchfit",
      handle: "@theofficialmatchfit",
      profileUrl: "https://www.instagram.com/theofficialmatchfit/",
    });
  });

  it("rejects post URLs and empty input", () => {
    expect(normalizeInstagramLeadIdentity({ profileUrl: "https://www.instagram.com/p/ABC123/" })).toBeNull();
    expect(normalizeInstagramLeadIdentity({ handle: "" })).toBeNull();
  });
});

describe("verifyInstagramProfile", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns ok for live profile JSON", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: () => "application/json" },
      json: async () => ({
        data: {
          user: {
            username: "theofficialmatchfit",
            full_name: "Match Fit",
            biography: "Swipe. Match. Train.",
            is_private: false,
          },
        },
      }),
    });

    await expect(verifyInstagramProfile("theofficialmatchfit")).resolves.toEqual({
      ok: true,
      username: "theofficialmatchfit",
      profileUrl: "https://www.instagram.com/theofficialmatchfit/",
      fullName: "Match Fit",
      biography: "Swipe. Match. Train.",
      isPrivate: false,
      verifiedVia: "api",
    });
  });

  it("returns not found for HTTP 404", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 404,
      headers: { get: () => "text/html" },
    });

    await expect(verifyInstagramProfile("missing_user_xyz")).resolves.toEqual({
      ok: false,
      username: "missing_user_xyz",
      reason: "Instagram profile not found.",
    });
  });

  it("falls back to HTML profile page when JSON API is blocked", async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: false,
        status: 429,
        headers: { get: () => "text/html" },
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () =>
          '<html><script>"username":"coachjonny","full_name":"Coach Jonny","biography":"Atlanta trainer","is_private":false</script></html>',
      });

    await expect(verifyInstagramProfile("coachjonny")).resolves.toEqual({
      ok: true,
      username: "coachjonny",
      profileUrl: "https://www.instagram.com/coachjonny/",
      fullName: "Coach Jonny",
      biography: "Atlanta trainer",
      isPrivate: false,
      verifiedVia: "html",
    });
  });
});

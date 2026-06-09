import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { normalizeFacebookPageUrl, verifyFacebookPageUrl } from "@/lib/outreach-facebook-verify";

describe("normalizeFacebookPageUrl", () => {
  it("normalizes bare facebook URLs to canonical https format", () => {
    expect(normalizeFacebookPageUrl("facebook.com/groups/AtLTrainerNetwork")).toBe(
      "https://www.facebook.com/groups/AtLTrainerNetwork/",
    );
    expect(normalizeFacebookPageUrl("https://fb.com/matchfitcollective")).toBe(
      "https://www.facebook.com/matchfitcollective/",
    );
  });

  it("rejects blocked paths and non-facebook hosts", () => {
    expect(normalizeFacebookPageUrl("https://facebook.com/login/device-based")).toBeNull();
    expect(normalizeFacebookPageUrl("https://example.com/groups/trainers")).toBeNull();
    expect(normalizeFacebookPageUrl("")).toBeNull();
  });
});

describe("verifyFacebookPageUrl", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns a validation error for invalid facebook URLs", async () => {
    await expect(verifyFacebookPageUrl("https://example.com/foo")).resolves.toEqual({
      ok: false,
      reason: "Invalid Facebook page or group URL.",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns not found when facebook responds 404", async () => {
    fetchMock.mockResolvedValueOnce({
      status: 404,
      text: async () => "",
      ok: false,
    });

    await expect(verifyFacebookPageUrl("https://facebook.com/groups/atlantacoaches")).resolves.toEqual({
      ok: false,
      reason: "Facebook page or group not found.",
    });
  });

  it("returns unavailable when html indicates missing content", async () => {
    fetchMock.mockResolvedValueOnce({
      status: 200,
      ok: true,
      text: async () => "<html>This content isn't available</html>",
    });

    await expect(verifyFacebookPageUrl("https://facebook.com/missing.page")).resolves.toEqual({
      ok: false,
      reason: "Facebook page or group not available.",
    });
  });

  it("accepts normalized urls with soft-failed live verification", async () => {
    fetchMock.mockResolvedValueOnce({
      status: 500,
      ok: false,
      text: async () => "<html>temporary issue</html>",
    });

    await expect(verifyFacebookPageUrl("https://facebook.com/groups/trainers")).resolves.toEqual({
      ok: true,
      pageUrl: "https://www.facebook.com/groups/trainers/",
      verifiedLive: false,
    });
  });

  it("returns verifiedLive true on successful fetch", async () => {
    fetchMock.mockResolvedValueOnce({
      status: 200,
      ok: true,
      text: async () => "<html>trainer community</html>",
    });

    await expect(verifyFacebookPageUrl("https://www.facebook.com/groups/trainers")).resolves.toEqual({
      ok: true,
      pageUrl: "https://www.facebook.com/groups/trainers/",
      verifiedLive: true,
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://www.facebook.com/groups/trainers/",
      expect.objectContaining({
        method: "GET",
        cache: "no-store",
        redirect: "follow",
      }),
    );
  });

  it("falls back to format-only success when fetch throws", async () => {
    fetchMock.mockRejectedValueOnce(new Error("network down"));

    await expect(verifyFacebookPageUrl("facebook.com/groups/trainers")).resolves.toEqual({
      ok: true,
      pageUrl: "https://www.facebook.com/groups/trainers/",
      verifiedLive: false,
    });
  });
});

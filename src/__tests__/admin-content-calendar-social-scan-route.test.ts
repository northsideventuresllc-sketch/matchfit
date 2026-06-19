import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockRequireAdminSession,
  mockHydratePlatformEnvFromDatabase,
  mockScanAndRecordWebsiteContext,
  mockScanAndRecordSocialProfiles,
  mockAnalyzeSocialPerformance,
  mockResetContentContextCache,
} = vi.hoisted(() => ({
  mockRequireAdminSession: vi.fn(),
  mockHydratePlatformEnvFromDatabase: vi.fn(),
  mockScanAndRecordWebsiteContext: vi.fn(),
  mockScanAndRecordSocialProfiles: vi.fn(),
  mockAnalyzeSocialPerformance: vi.fn(),
  mockResetContentContextCache: vi.fn(),
}));

vi.mock("@/lib/require-admin", () => ({
  requireAdminSession: mockRequireAdminSession,
}));

vi.mock("@/lib/hydrate-platform-env", () => ({
  hydratePlatformEnvFromDatabase: mockHydratePlatformEnvFromDatabase,
}));

vi.mock("@/lib/content-calendar/website-scan", () => ({
  scanAndRecordWebsiteContext: mockScanAndRecordWebsiteContext,
}));

vi.mock("@/lib/content-calendar/social-profile-scan", () => ({
  scanAndRecordSocialProfiles: mockScanAndRecordSocialProfiles,
}));

vi.mock("@/lib/content-calendar/content-calendar-ai", () => ({
  analyzeSocialPerformance: mockAnalyzeSocialPerformance,
}));

vi.mock("@/lib/content-calendar/content-context", () => ({
  resetContentContextCache: mockResetContentContextCache,
}));

import { POST } from "@/app/api/admin/content-calendar/social-scan/route";

describe("POST /api/admin/content-calendar/social-scan", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAdminSession.mockResolvedValue({
      adminId: "admin_1",
      testMode: false,
      rememberMe: true,
    });
    mockHydratePlatformEnvFromDatabase.mockResolvedValue(undefined);
    mockResetContentContextCache.mockImplementation(() => undefined);
    mockScanAndRecordWebsiteContext.mockResolvedValue({
      scannedAt: "2026-06-18T12:00:00.000Z",
      summary: "Home and promos scanned.",
    });
    mockScanAndRecordSocialProfiles.mockResolvedValue({
      scannedAt: "2026-06-18T12:00:00.000Z",
      summary: "Profiles fetched.",
    });
    mockAnalyzeSocialPerformance.mockResolvedValue("Top hooks are shorter CTAs and local proof.");
  });

  it("returns 401 when admin session is missing", async () => {
    mockRequireAdminSession.mockResolvedValueOnce(null);

    const res = await POST(new Request("https://matchfit.test/api/admin/content-calendar/social-scan", { method: "POST" }));

    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toEqual({ error: "Unauthorized." });
    expect(mockHydratePlatformEnvFromDatabase).not.toHaveBeenCalled();
  });

  it("hydrates platform env and returns website, social, and analysis summaries", async () => {
    const res = await POST(
      new Request("https://matchfit.test/api/admin/content-calendar/social-scan", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ includeAnalysis: true }),
      }),
    );

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      website: { scannedAt: "2026-06-18T12:00:00.000Z", summary: "Home and promos scanned." },
      social: { scannedAt: "2026-06-18T12:00:00.000Z", summary: "Profiles fetched." },
      summary: "Top hooks are shorter CTAs and local proof.",
    });
    expect(mockHydratePlatformEnvFromDatabase).toHaveBeenCalledTimes(1);
    expect(mockResetContentContextCache).toHaveBeenCalledTimes(1);
    expect(mockScanAndRecordWebsiteContext).toHaveBeenCalledTimes(1);
    expect(mockScanAndRecordSocialProfiles).toHaveBeenCalledTimes(1);
    expect(mockAnalyzeSocialPerformance).toHaveBeenCalledWith(true);
  });

  it("returns 500 when hydration fails", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    mockHydratePlatformEnvFromDatabase.mockRejectedValueOnce(new Error("platform secrets unavailable"));

    const res = await POST(new Request("https://matchfit.test/api/admin/content-calendar/social-scan", { method: "POST" }));

    expect(res.status).toBe(500);
    await expect(res.json()).resolves.toEqual({ error: "Social scan failed." });
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockRequireAdminSession, mockHydratePlatformEnvFromDatabase, mockAnalyzeSocialPerformance } = vi.hoisted(
  () => ({
    mockRequireAdminSession: vi.fn(),
    mockHydratePlatformEnvFromDatabase: vi.fn(),
    mockAnalyzeSocialPerformance: vi.fn(),
  }),
);

vi.mock("@/lib/require-admin", () => ({
  requireAdminSession: mockRequireAdminSession,
}));

vi.mock("@/lib/hydrate-platform-env", () => ({
  hydratePlatformEnvFromDatabase: mockHydratePlatformEnvFromDatabase,
}));

vi.mock("@/lib/content-calendar/content-calendar-ai", () => ({
  analyzeSocialPerformance: mockAnalyzeSocialPerformance,
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
    mockAnalyzeSocialPerformance.mockResolvedValue("Top hooks are shorter CTAs and local proof.");
  });

  it("returns 401 when admin session is missing", async () => {
    mockRequireAdminSession.mockResolvedValueOnce(null);

    const res = await POST();

    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toEqual({ error: "Unauthorized." });
    expect(mockHydratePlatformEnvFromDatabase).not.toHaveBeenCalled();
    expect(mockAnalyzeSocialPerformance).not.toHaveBeenCalled();
  });

  it("hydrates platform env and returns summary when scan succeeds", async () => {
    const res = await POST();

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      summary: "Top hooks are shorter CTAs and local proof.",
    });
    expect(mockHydratePlatformEnvFromDatabase).toHaveBeenCalledTimes(1);
    expect(mockAnalyzeSocialPerformance).toHaveBeenCalledTimes(1);
  });

  it("returns 500 when hydration fails", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    mockHydratePlatformEnvFromDatabase.mockRejectedValueOnce(new Error("platform secrets unavailable"));

    const res = await POST();

    expect(res.status).toBe(500);
    await expect(res.json()).resolves.toEqual({ error: "Social scan failed." });
    expect(mockAnalyzeSocialPerformance).not.toHaveBeenCalled();
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it("returns 500 when analysis fails", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    mockAnalyzeSocialPerformance.mockRejectedValueOnce(new Error("openai timeout"));

    const res = await POST();

    expect(res.status).toBe(500);
    await expect(res.json()).resolves.toEqual({ error: "Social scan failed." });
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockRequireAdminSession, mockHydratePlatformEnvFromDatabase, mockGenerateOutreachLeads } =
  vi.hoisted(() => ({
    mockRequireAdminSession: vi.fn(),
    mockHydratePlatformEnvFromDatabase: vi.fn(),
    mockGenerateOutreachLeads: vi.fn(),
  }));

vi.mock("@/lib/require-admin", () => ({
  requireAdminSession: mockRequireAdminSession,
}));

vi.mock("@/lib/hydrate-platform-env", () => ({
  hydratePlatformEnvFromDatabase: mockHydratePlatformEnvFromDatabase,
}));

vi.mock("@/lib/outreach-ai", () => ({
  generateOutreachLeads: mockGenerateOutreachLeads,
}));

import { POST } from "@/app/api/admin/outreach/generate/route";

function postJson(body: unknown): Request {
  return new Request("https://matchfit.test/api/admin/outreach/generate", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/admin/outreach/generate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAdminSession.mockResolvedValue({
      adminId: "admin_42",
      testMode: false,
      rememberMe: true,
    });
    mockHydratePlatformEnvFromDatabase.mockResolvedValue(undefined);
    mockGenerateOutreachLeads.mockResolvedValue({
      batchId: "batch_123",
      leads: [{ id: "lead_1" }],
      aiUsed: true,
    });
  });

  it("returns 401 when the requester is not an authenticated admin", async () => {
    mockRequireAdminSession.mockResolvedValueOnce(null);

    const response = await POST(postJson({ platform: "instagram", atlCount: 1, virtualCount: 1 }));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "Unauthorized." });
    expect(mockHydratePlatformEnvFromDatabase).not.toHaveBeenCalled();
    expect(mockGenerateOutreachLeads).not.toHaveBeenCalled();
  });

  it("returns 400 when payload validation fails", async () => {
    const response = await POST(postJson({ platform: "youtube", atlCount: 2, virtualCount: 2 }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Invalid request." });
    expect(mockHydratePlatformEnvFromDatabase).not.toHaveBeenCalled();
    expect(mockGenerateOutreachLeads).not.toHaveBeenCalled();
  });

  it("returns 400 when both lead counts are zero", async () => {
    const response = await POST(postJson({ platform: "facebook", atlCount: 0, virtualCount: 0 }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Set at least one lead count." });
    expect(mockHydratePlatformEnvFromDatabase).not.toHaveBeenCalled();
    expect(mockGenerateOutreachLeads).not.toHaveBeenCalled();
  });

  it("hydrates platform env and returns generated leads for valid requests", async () => {
    const response = await POST(postJson({ platform: "email", atlCount: 3, virtualCount: 2 }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      batchId: "batch_123",
      leads: [{ id: "lead_1" }],
      aiUsed: true,
    });
    expect(mockHydratePlatformEnvFromDatabase).toHaveBeenCalledTimes(1);
    expect(mockGenerateOutreachLeads).toHaveBeenCalledWith({
      platform: "email",
      atlCount: 3,
      virtualCount: 2,
      adminId: "admin_42",
    });
  });

  it("returns 500 when lead generation throws", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    mockGenerateOutreachLeads.mockRejectedValueOnce(new Error("provider unavailable"));

    const response = await POST(postJson({ platform: "instagram", atlCount: 2, virtualCount: 1 }));

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({ error: "Lead generation failed." });
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });
});

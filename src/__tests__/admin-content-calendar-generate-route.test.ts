import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockRequireAdminSession, mockHydratePlatformEnvFromDatabase, mockGenerateSinglePost } = vi.hoisted(() => ({
  mockRequireAdminSession: vi.fn(),
  mockHydratePlatformEnvFromDatabase: vi.fn(),
  mockGenerateSinglePost: vi.fn(),
}));

vi.mock("@/lib/require-admin", () => ({
  requireAdminSession: mockRequireAdminSession,
}));

vi.mock("@/lib/hydrate-platform-env", () => ({
  hydratePlatformEnvFromDatabase: mockHydratePlatformEnvFromDatabase,
}));

vi.mock("@/lib/content-calendar/content-calendar-ai", () => ({
  generateSinglePost: mockGenerateSinglePost,
}));

import { POST } from "@/app/api/admin/content-calendar/generate/route";

function postJson(body: unknown): Request {
  return new Request("https://matchfit.test/api/admin/content-calendar/generate", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/admin/content-calendar/generate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAdminSession.mockResolvedValue({
      adminId: "admin_1",
      testMode: false,
      rememberMe: true,
    });
    mockHydratePlatformEnvFromDatabase.mockResolvedValue(undefined);
    mockGenerateSinglePost.mockResolvedValue({
      hook: "Hook",
      body: "Body",
      cta: "CTA",
      hashtags: ["MatchFit"],
    });
  });

  it("returns 401 when admin session is missing", async () => {
    mockRequireAdminSession.mockResolvedValueOnce(null);

    const res = await POST(
      postJson({
        contentType: "coach spotlight",
        tone: "motivating",
      }),
    );

    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toEqual({ error: "Unauthorized." });
    expect(mockHydratePlatformEnvFromDatabase).not.toHaveBeenCalled();
  });

  it("returns 400 when payload validation fails", async () => {
    const res = await POST(postJson({ tone: "motivating" }));

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ error: "Invalid request." });
    expect(mockHydratePlatformEnvFromDatabase).not.toHaveBeenCalled();
    expect(mockGenerateSinglePost).not.toHaveBeenCalled();
  });

  it("returns 502 when generation returns null", async () => {
    mockGenerateSinglePost.mockResolvedValueOnce(null);

    const res = await POST(
      postJson({
        postType: "Carousel",
        contentType: "trainer testimonial",
        tone: "confident",
      }),
    );

    expect(res.status).toBe(502);
    await expect(res.json()).resolves.toEqual({ error: "Generation failed. Check AI API keys." });
  });

  it("returns generated content for valid requests", async () => {
    const generated = {
      hook: "Atlanta trainers: your calendar just got easier.",
      body: "Build your business with Match Fit.",
      cta: "Join today",
      hashtags: ["MatchFit", "AtlantaFitness"],
      dmScript: "Send us START",
    };
    mockGenerateSinglePost.mockResolvedValueOnce(generated);

    const res = await POST(
      postJson({
        postType: "Static",
        contentType: "brand awareness",
        tone: "friendly",
        customNote: "Highlight Fit Hub value",
      }),
    );

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ result: generated });
    expect(mockHydratePlatformEnvFromDatabase).toHaveBeenCalledTimes(1);
    expect(mockGenerateSinglePost).toHaveBeenCalledWith({
      postType: "Static",
      contentType: "brand awareness",
      tone: "friendly",
      customNote: "Highlight Fit Hub value",
    });
  });

  it("returns 500 when generation throws", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    mockGenerateSinglePost.mockRejectedValueOnce(new Error("upstream offline"));

    const res = await POST(
      postJson({
        contentType: "brand awareness",
        tone: "friendly",
      }),
    );

    expect(res.status).toBe(500);
    await expect(res.json()).resolves.toEqual({ error: "Generation failed." });
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });
});

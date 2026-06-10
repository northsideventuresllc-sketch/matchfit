import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { mockRequireAdminSession, mockPlatformSecretUpsert, mockClearPlatformSecretCache } = vi.hoisted(() => ({
  mockRequireAdminSession: vi.fn(),
  mockPlatformSecretUpsert: vi.fn(),
  mockClearPlatformSecretCache: vi.fn(),
}));

vi.mock("@/lib/require-admin", () => ({
  requireAdminSession: mockRequireAdminSession,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    platformSecret: {
      upsert: mockPlatformSecretUpsert,
    },
  },
}));

vi.mock("@/lib/platform-secrets", () => ({
  clearPlatformSecretCache: mockClearPlatformSecretCache,
}));

import { POST } from "@/app/api/admin/ai-config/route";

function postJson(body: unknown): Request {
  return new Request("https://example.test/api/admin/ai-config", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/admin/ai-config", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAdminSession.mockResolvedValue({ adminId: "admin_123", testMode: false, rememberMe: true });
    mockPlatformSecretUpsert.mockResolvedValue({ key: "ANTHROPIC_API_KEY" });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 401 when the requester is not an authenticated admin", async () => {
    mockRequireAdminSession.mockResolvedValueOnce(null);

    const res = await POST(postJson({ anthropicApiKey: "sk-ant-unit-test-key" }));

    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toEqual({ error: "Unauthorized." });
    expect(mockPlatformSecretUpsert).not.toHaveBeenCalled();
    expect(mockClearPlatformSecretCache).not.toHaveBeenCalled();
  });

  it("returns 400 when the payload does not contain a valid Anthropic key", async () => {
    const res = await POST(postJson({ anthropicApiKey: "invalid-key" }));

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ error: "Invalid Anthropic key payload." });
    expect(mockPlatformSecretUpsert).not.toHaveBeenCalled();
    expect(mockClearPlatformSecretCache).not.toHaveBeenCalled();
  });

  it("returns 400 when a provided anthropic model fails validation", async () => {
    const res = await POST(
      postJson({
        anthropicApiKey: "sk-ant-unit-test-key",
        anthropicModel: "x",
      }),
    );

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ error: "Invalid Anthropic key payload." });
    expect(mockPlatformSecretUpsert).not.toHaveBeenCalled();
    expect(mockClearPlatformSecretCache).not.toHaveBeenCalled();
  });

  it("stores only the Anthropic API key when anthropic model is blank", async () => {
    const res = await POST(
      postJson({
        anthropicApiKey: "sk-ant-unit-test-key",
        anthropicModel: "   ",
      }),
    );

    expect(res.status).toBe(200);
    expect(mockPlatformSecretUpsert).toHaveBeenCalledTimes(1);
    expect(mockPlatformSecretUpsert).toHaveBeenCalledWith({
      where: { key: "ANTHROPIC_API_KEY" },
      create: { key: "ANTHROPIC_API_KEY", value: "sk-ant-unit-test-key" },
      update: { value: "sk-ant-unit-test-key" },
    });
    expect(mockClearPlatformSecretCache).toHaveBeenCalledTimes(1);
  });

  it("stores the key and optional analytics model on success", async () => {
    const anthropicApiKey = "sk-ant-unit-test-key";
    const anthropicModel = "  claude-sonnet-4-6  ";

    const res = await POST(postJson({ anthropicApiKey, anthropicModel }));

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      ok: true,
      message: "Anthropic keys stored in platform_secrets. Outreach HQ can now web-search real profiles.",
    });
    expect(mockPlatformSecretUpsert).toHaveBeenNthCalledWith(1, {
      where: { key: "ANTHROPIC_API_KEY" },
      create: { key: "ANTHROPIC_API_KEY", value: anthropicApiKey },
      update: { value: anthropicApiKey },
    });
    expect(mockPlatformSecretUpsert).toHaveBeenNthCalledWith(2, {
      where: { key: "ANTHROPIC_ADMIN_ANALYTICS_MODEL" },
      create: { key: "ANTHROPIC_ADMIN_ANALYTICS_MODEL", value: "claude-sonnet-4-6" },
      update: { value: "claude-sonnet-4-6" },
    });
    expect(mockClearPlatformSecretCache).toHaveBeenCalledTimes(1);
  });
});

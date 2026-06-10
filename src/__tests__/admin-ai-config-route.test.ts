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
    delete process.env.ANTHROPIC_API_KEY;
    mockRequireAdminSession.mockResolvedValue({ adminId: "admin_123", testMode: false, rememberMe: true });
    mockPlatformSecretUpsert.mockResolvedValue({ key: "ANTHROPIC_API_KEY" });
  });

  afterEach(() => {
    delete process.env.ANTHROPIC_API_KEY;
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

  it("stores the key, clears cache, and hydrates process env on success", async () => {
    const anthropicApiKey = "sk-ant-unit-test-key";

    const res = await POST(postJson({ anthropicApiKey }));

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      ok: true,
      message: "Anthropic API key stored for admin AI features.",
    });
    expect(mockPlatformSecretUpsert).toHaveBeenCalledWith({
      where: { key: "ANTHROPIC_API_KEY" },
      create: { key: "ANTHROPIC_API_KEY", value: anthropicApiKey },
      update: { value: anthropicApiKey },
    });
    expect(mockClearPlatformSecretCache).toHaveBeenCalledTimes(1);
    expect(process.env.ANTHROPIC_API_KEY).toBe(anthropicApiKey);
  });
});

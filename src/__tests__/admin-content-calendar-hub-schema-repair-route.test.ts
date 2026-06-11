import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockRequireAdminSession, mockIsNiBrainConfiguredAsync, mockEnsureContentHubSchema } = vi.hoisted(() => ({
  mockRequireAdminSession: vi.fn(),
  mockIsNiBrainConfiguredAsync: vi.fn(),
  mockEnsureContentHubSchema: vi.fn(),
}));

vi.mock("@/lib/require-admin", () => ({
  requireAdminSession: mockRequireAdminSession,
}));

vi.mock("@/lib/ni-brain-client", () => ({
  isNiBrainConfiguredAsync: mockIsNiBrainConfiguredAsync,
}));

vi.mock("@/lib/ensure-content-hub-schema", () => ({
  ensureContentHubSchema: mockEnsureContentHubSchema,
  isMissingContentHubSchemaError: (e: unknown) =>
    e instanceof Error && /Content Hub columns are missing|NI_BRAIN_DATABASE/i.test(e.message),
}));

import { POST } from "@/app/api/admin/content-calendar/hub/schema-repair/route";

describe("POST /api/admin/content-calendar/hub/schema-repair", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAdminSession.mockResolvedValue({ adminId: "admin_1", testMode: false, rememberMe: true });
    mockIsNiBrainConfiguredAsync.mockResolvedValue(true);
    mockEnsureContentHubSchema.mockResolvedValue(undefined);
  });

  it("returns success when schema repair completes", async () => {
    const response = await POST();
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      message: "Content Hub schema is ready on NI Brain.",
    });
  });
});

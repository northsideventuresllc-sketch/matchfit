import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockRequireAdminSession, mockBuildCoworkMorningBrief, mockEnsureOutreachHubSchema } = vi.hoisted(
  () => ({
    mockRequireAdminSession: vi.fn(),
    mockBuildCoworkMorningBrief: vi.fn(),
    mockEnsureOutreachHubSchema: vi.fn(),
  }),
);

vi.mock("@/lib/require-admin", () => ({
  requireAdminSession: mockRequireAdminSession,
}));

vi.mock("@/lib/outreach-ai", () => ({
  buildCoworkMorningBrief: mockBuildCoworkMorningBrief,
}));

vi.mock("@/lib/ensure-outreach-hub-schema", () => ({
  ensureOutreachHubSchema: mockEnsureOutreachHubSchema,
}));

import { GET } from "@/app/api/admin/outreach/cowork-brief/route";

describe("GET /api/admin/outreach/cowork-brief", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEnsureOutreachHubSchema.mockResolvedValue(undefined);
  });

  it("returns 401 when unauthenticated", async () => {
    mockRequireAdminSession.mockResolvedValue(null);
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("returns the morning brief for admins", async () => {
    mockRequireAdminSession.mockResolvedValue({ adminId: "admin_1" });
    mockBuildCoworkMorningBrief.mockResolvedValue({
      generatedAt: "2026-07-14T12:00:00.000Z",
      instructions: "doit",
      runnerPrompt: "prompt",
      caps: { instagram: 5, email: 3, facebook: 5 },
      emailFrom: "jb@match-fit.net",
      emailBcc: ["support@match-fit.net"],
      missingIntentCount: 1,
      instagram: [{ id: "ig1" }],
      facebook: [],
      email: [],
    });

    const res = await GET();
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({
      runnerPrompt: "prompt",
      missingIntentCount: 1,
      instagram: [{ id: "ig1" }],
    });
    expect(mockEnsureOutreachHubSchema).toHaveBeenCalled();
  });
});

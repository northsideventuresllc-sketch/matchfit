import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockEnsureOutreachHubSchema,
  mockInstagramFindUnique,
  mockInstagramUpdate,
} = vi.hoisted(() => ({
  mockEnsureOutreachHubSchema: vi.fn(),
  mockInstagramFindUnique: vi.fn(),
  mockInstagramUpdate: vi.fn(),
}));

vi.mock("@/lib/ensure-outreach-hub-schema", () => ({
  ensureOutreachHubSchema: mockEnsureOutreachHubSchema,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    outreachInstagramLead: {
      findUnique: mockInstagramFindUnique,
      update: mockInstagramUpdate,
      updateMany: vi.fn(),
      deleteMany: vi.fn(),
    },
    outreachFacebookLead: {
      findUnique: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      deleteMany: vi.fn(),
    },
    outreachEmailLead: {
      findUnique: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      deleteMany: vi.fn(),
    },
  },
}));

import { archiveHubOutreachLeadOnAdminDelete } from "@/lib/outreach-archive";

describe("archiveHubOutreachLeadOnAdminDelete", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEnsureOutreachHubSchema.mockResolvedValue(undefined);
  });

  it("archives hub-saved instagram leads immediately", async () => {
    mockInstagramFindUnique.mockResolvedValue({
      id: "ig-1",
      savedToHubAt: new Date("2026-06-01T12:00:00.000Z"),
    });
    mockInstagramUpdate.mockResolvedValue({ id: "ig-1" });

    const ok = await archiveHubOutreachLeadOnAdminDelete("instagram", "ig-1");

    expect(ok).toBe(true);
    expect(mockInstagramUpdate).toHaveBeenCalledWith({
      where: { id: "ig-1" },
      data: expect.objectContaining({
        status: "DEAD_LEAD",
        archivedAt: expect.any(Date),
        archivePurgeAfterAt: expect.any(Date),
        autoClassification: "DEAD_LEAD",
        deletedAt: null,
      }),
    });
  });

  it("returns false when the lead was never saved to the hub", async () => {
    mockInstagramFindUnique.mockResolvedValue({ id: "ig-2", savedToHubAt: null });

    const ok = await archiveHubOutreachLeadOnAdminDelete("instagram", "ig-2");

    expect(ok).toBe(false);
    expect(mockInstagramUpdate).not.toHaveBeenCalled();
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockOutreachInstagramUpdateMany,
  mockOutreachFacebookUpdateMany,
  mockOutreachEmailUpdateMany,
  mockOutreachOtherUpdateMany,
  mockLearningFindMany,
} = vi.hoisted(() => ({
  mockOutreachInstagramUpdateMany: vi.fn(),
  mockOutreachFacebookUpdateMany: vi.fn(),
  mockOutreachEmailUpdateMany: vi.fn(),
  mockOutreachOtherUpdateMany: vi.fn(),
  mockLearningFindMany: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    outreachInstagramLead: { updateMany: mockOutreachInstagramUpdateMany },
    outreachFacebookLead: { updateMany: mockOutreachFacebookUpdateMany },
    outreachEmailLead: { updateMany: mockOutreachEmailUpdateMany },
    outreachOtherLead: { updateMany: mockOutreachOtherUpdateMany },
    outreachLearningSignal: { findMany: mockLearningFindMany },
  },
}));

import { backfillOutreachHubLeads } from "@/lib/outreach-hub-backfill";

describe("backfillOutreachHubLeads", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockOutreachInstagramUpdateMany.mockResolvedValue({ count: 1 });
    mockOutreachFacebookUpdateMany.mockResolvedValue({ count: 0 });
    mockOutreachEmailUpdateMany.mockResolvedValue({ count: 0 });
    mockOutreachOtherUpdateMany.mockResolvedValue({ count: 1 });
    mockLearningFindMany.mockResolvedValue([
      {
        leadId: "ig_missing",
        platform: "instagram",
        createdAt: new Date("2026-06-09T12:00:00.000Z"),
      },
    ]);
  });

  it("restores deleted hub leads and backfills saved timestamps from signals", async () => {
    mockOutreachInstagramUpdateMany
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 1 });

    const summary = await backfillOutreachHubLeads();

    expect(summary.restoredDeletedHubLeads).toBe(1);
    expect(summary.savedToHubAtFromSignals).toBe(1);
    expect(summary.legacyOtherLeadsTagged).toBe(1);
    expect(mockOutreachInstagramUpdateMany).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: expect.objectContaining({ savedToHubAt: { not: null }, deletedAt: { not: null } }),
        data: { deletedAt: null },
      }),
    );
    expect(mockOutreachInstagramUpdateMany).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: { id: "ig_missing", savedToHubAt: null, deletedAt: null },
      }),
    );
  });
});

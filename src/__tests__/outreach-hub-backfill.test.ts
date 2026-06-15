import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockOutreachInstagramUpdateMany,
  mockOutreachFacebookUpdateMany,
  mockOutreachEmailUpdateMany,
  mockLearningFindMany,
} = vi.hoisted(() => ({
  mockOutreachInstagramUpdateMany: vi.fn(),
  mockOutreachFacebookUpdateMany: vi.fn(),
  mockOutreachEmailUpdateMany: vi.fn(),
  mockLearningFindMany: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    outreachInstagramLead: { updateMany: mockOutreachInstagramUpdateMany },
    outreachFacebookLead: { updateMany: mockOutreachFacebookUpdateMany },
    outreachEmailLead: { updateMany: mockOutreachEmailUpdateMany },
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
    mockLearningFindMany.mockResolvedValue([
      {
        leadId: "ig_missing",
        platform: "instagram",
        createdAt: new Date("2026-06-09T12:00:00.000Z"),
      },
    ]);
  });

  it("backfills saved timestamps from signals without restoring deleted hub leads", async () => {
    const summary = await backfillOutreachHubLeads();

    expect(summary.savedToHubAtFromSignals).toBe(1);
    expect(summary.legacyOtherLeadsTagged).toBe(0);
    expect(mockOutreachInstagramUpdateMany).toHaveBeenCalledTimes(1);
    expect(mockOutreachInstagramUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "ig_missing", savedToHubAt: null, deletedAt: null },
      }),
    );
  });
});

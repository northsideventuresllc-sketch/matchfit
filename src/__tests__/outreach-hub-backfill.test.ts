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
    // The backfill batches its updateMany calls into one round trip.
    $transaction: (ops: unknown[]) => Promise.all(ops),
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
        where: { id: { in: ["ig_missing"] }, savedToHubAt: null, deletedAt: null },
      }),
    );
  });

  it("collapses repeat signals for one lead and keeps the earliest timestamp", async () => {
    const earliest = new Date("2026-06-09T12:00:00.000Z");
    mockLearningFindMany.mockResolvedValue([
      { leadId: "ig_dupe", platform: "instagram", createdAt: earliest },
      { leadId: "ig_dupe", platform: "instagram", createdAt: new Date("2026-06-10T12:00:00.000Z") },
    ]);

    await backfillOutreachHubLeads();

    // Only the earliest signal could ever have won under the old row-at-a-time
    // loop, so the repeat must not produce a second statement.
    expect(mockOutreachInstagramUpdateMany).toHaveBeenCalledTimes(1);
    expect(mockOutreachInstagramUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: { in: ["ig_dupe"] }, savedToHubAt: null, deletedAt: null },
        data: { savedToHubAt: earliest },
      }),
    );
  });

  it("groups leads saved in the same bulk action into one statement per platform", async () => {
    const sharedAt = new Date("2026-06-09T12:00:00.000Z");
    mockLearningFindMany.mockResolvedValue([
      { leadId: "ig_a", platform: "instagram", createdAt: sharedAt },
      { leadId: "ig_b", platform: "instagram", createdAt: sharedAt },
      { leadId: "em_a", platform: "email", createdAt: sharedAt },
    ]);

    await backfillOutreachHubLeads();

    expect(mockOutreachInstagramUpdateMany).toHaveBeenCalledTimes(1);
    expect(mockOutreachInstagramUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: { in: ["ig_a", "ig_b"] }, savedToHubAt: null, deletedAt: null },
      }),
    );
    expect(mockOutreachEmailUpdateMany).toHaveBeenCalledTimes(1);
    expect(mockOutreachFacebookUpdateMany).not.toHaveBeenCalled();
  });
});

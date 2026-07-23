import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockEnsureOutreachHubSchema,
  igUpdateMany,
  igCount,
  igDeleteMany,
  fbUpdateMany,
  fbCount,
  fbDeleteMany,
  emUpdateMany,
  emCount,
  emDeleteMany,
} = vi.hoisted(() => ({
  mockEnsureOutreachHubSchema: vi.fn(),
  igUpdateMany: vi.fn(),
  igCount: vi.fn(),
  igDeleteMany: vi.fn(),
  fbUpdateMany: vi.fn(),
  fbCount: vi.fn(),
  fbDeleteMany: vi.fn(),
  emUpdateMany: vi.fn(),
  emCount: vi.fn(),
  emDeleteMany: vi.fn(),
}));

vi.mock("@/lib/ensure-outreach-hub-schema", () => ({
  ensureOutreachHubSchema: mockEnsureOutreachHubSchema,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    outreachInstagramLead: { updateMany: igUpdateMany, count: igCount, deleteMany: igDeleteMany },
    outreachFacebookLead: { updateMany: fbUpdateMany, count: fbCount, deleteMany: fbDeleteMany },
    outreachEmailLead: { updateMany: emUpdateMany, count: emCount, deleteMany: emDeleteMany },
  },
}));

import { processOutreachArchiveJobs } from "@/lib/outreach-archive";

describe("processOutreachArchiveJobs (archive-fix: hide, never delete)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEnsureOutreachHubSchema.mockResolvedValue(undefined);
    for (const m of [igUpdateMany, fbUpdateMany, emUpdateMany]) m.mockResolvedValue({ count: 1 });
    for (const m of [igCount, fbCount, emCount]) m.mockResolvedValue(2);
  });

  it("never deletes archived rows", async () => {
    await processOutreachArchiveJobs(new Date("2026-07-23T12:00:00Z"));
    expect(igDeleteMany).not.toHaveBeenCalled();
    expect(fbDeleteMany).not.toHaveBeenCalled();
    expect(emDeleteMany).not.toHaveBeenCalled();
  });

  it("stamps the UI-hide window + archive lane when moving dead leads to archive", async () => {
    await processOutreachArchiveJobs(new Date("2026-07-23T12:00:00Z"));
    expect(igUpdateMany).toHaveBeenCalledWith({
      where: expect.objectContaining({ status: "DEAD_LEAD", archivedAt: null }),
      data: expect.objectContaining({
        archivedAt: expect.any(Date),
        archiveUiHiddenAfterAt: expect.any(Date),
        outreachLane: "archived",
      }),
    });
  });

  it("reports archived + ui-hidden counts (ui-hidden via count, not delete)", async () => {
    const summary = await processOutreachArchiveJobs(new Date("2026-07-23T12:00:00Z"));
    expect(summary.archivedCount).toBe(3);
    expect(summary.uiHiddenCount).toBe(6);
  });

  it("sets archiveUiHiddenAfterAt exactly 7 days after now", async () => {
    const now = new Date("2026-07-23T12:00:00Z");
    await processOutreachArchiveJobs(now);
    const data = igUpdateMany.mock.calls[0][0].data as { archiveUiHiddenAfterAt: Date };
    expect(data.archiveUiHiddenAfterAt.toISOString()).toBe("2026-07-30T12:00:00.000Z");
  });
});

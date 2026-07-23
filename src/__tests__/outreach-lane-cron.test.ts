import { beforeEach, describe, expect, it, vi } from "vitest";

const M = vi.hoisted(() => ({
  ensureSchema: vi.fn(),
  fireAxon: vi.fn(),
  igUpdateMany: vi.fn(),
  igFindMany: vi.fn(),
  fbUpdateMany: vi.fn(),
  emUpdateMany: vi.fn(),
  emFindMany: vi.fn(),
}));

vi.mock("@/lib/ensure-outreach-hub-schema", () => ({ ensureOutreachHubSchema: M.ensureSchema }));
vi.mock("@/lib/outreach-axon-notify", () => ({ fireOutreachAxonEvent: M.fireAxon }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    outreachInstagramLead: { updateMany: M.igUpdateMany, findMany: M.igFindMany },
    outreachFacebookLead: { updateMany: M.fbUpdateMany },
    outreachEmailLead: { updateMany: M.emUpdateMany, findMany: M.emFindMany },
  },
}));

import {
  processOutreachFollowUpReminders,
  processOutreachPastDueFlip,
} from "@/lib/outreach-lane-cron";

beforeEach(() => {
  vi.clearAllMocks();
  M.ensureSchema.mockResolvedValue(undefined);
});

describe("processOutreachPastDueFlip", () => {
  it("flips today-lane leads with a past queuedForDate to past_due", async () => {
    M.igUpdateMany.mockResolvedValue({ count: 2 });
    M.fbUpdateMany.mockResolvedValue({ count: 1 });
    M.emUpdateMany.mockResolvedValue({ count: 0 });

    const summary = await processOutreachPastDueFlip(new Date("2026-07-23T16:00:00Z"));

    expect(summary.total).toBe(3);
    expect(M.igUpdateMany).toHaveBeenCalledWith({
      where: expect.objectContaining({
        outreachLane: "today",
        deletedAt: null,
        queuedForDate: { lt: expect.any(Date) },
      }),
      data: { outreachLane: "past_due" },
    });
  });
});

describe("processOutreachFollowUpReminders", () => {
  it("stamps last-reminded and fires an AXON follow_up_due event for due leads", async () => {
    // follow_up_1 stage returns one IG lead; follow_up_2 stage returns none.
    M.igFindMany
      .mockResolvedValueOnce([{ id: "ig1", handle: "@coach", profileUrl: "https://ig/coach" }])
      .mockResolvedValueOnce([]);
    M.emFindMany.mockResolvedValue([]);
    M.igUpdateMany.mockResolvedValue({ count: 1 });
    M.emUpdateMany.mockResolvedValue({ count: 0 });

    const summary = await processOutreachFollowUpReminders(new Date("2026-07-23T12:00:00Z"));

    expect(summary.followUp1Reminded).toBe(1);
    expect(summary.followUp2Reminded).toBe(0);
    expect(M.igUpdateMany).toHaveBeenCalledWith({
      where: { id: { in: ["ig1"] } },
      data: { followUp1LastRemindedAt: expect.any(Date) },
    });
    expect(M.fireAxon).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "follow_up_due",
        meta: { followUpStage: "follow_up_1" },
      }),
    );
  });

  it("does nothing (no AXON event) when no leads are due", async () => {
    M.igFindMany.mockResolvedValue([]);
    M.emFindMany.mockResolvedValue([]);

    const summary = await processOutreachFollowUpReminders(new Date("2026-07-23T12:00:00Z"));

    expect(summary.total).toBe(0);
    expect(M.fireAxon).not.toHaveBeenCalled();
  });
});

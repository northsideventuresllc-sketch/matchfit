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
    // The lane filter is now wrapped in the Match Fit venture scope: this cron is a MATCH FIT
    // surface, so another venture's leads (NI Services) must not be flipped by it.
    expect(M.igUpdateMany).toHaveBeenCalledWith({
      where: expect.objectContaining({
        AND: expect.arrayContaining([
          expect.objectContaining({
            outreachLane: "today",
            deletedAt: null,
            queuedForDate: { lt: expect.any(Date) },
          }),
        ]),
      }),
      data: { outreachLane: "past_due" },
    });
  });

  it("never flips a lead belonging to another venture", async () => {
    M.igUpdateMany.mockResolvedValue({ count: 0 });
    M.fbUpdateMany.mockResolvedValue({ count: 0 });
    M.emUpdateMany.mockResolvedValue({ count: 0 });

    await processOutreachPastDueFlip(new Date("2026-07-23T16:00:00Z"));

    const where = M.igUpdateMany.mock.calls[0][0].where as {
      AND: { OR?: unknown[] }[];
    };
    const scope = where.AND.find((c) => Array.isArray(c.OR));
    expect(scope?.OR).toEqual([
      { ventureId: null },
      { venture: { is: { slug: "match_fit" } } },
    ]);
  });
});

describe("processOutreachFollowUpReminders", () => {
  // 2026-07-23 is a Thursday in America/New_York — a normal reminder day.
  const THURSDAY = new Date("2026-07-23T12:00:00Z");

  it("claims the reminder slot and fires an AXON follow_up_due event for due leads", async () => {
    // follow_up_1 stage returns one IG lead; follow_up_2 stage returns none.
    M.igFindMany
      .mockResolvedValueOnce([{ id: "ig1", handle: "@coach", profileUrl: "https://ig/coach" }])
      .mockResolvedValueOnce([]);
    M.emFindMany.mockResolvedValue([]);
    M.igUpdateMany.mockResolvedValue({ count: 1 });
    M.emUpdateMany.mockResolvedValue({ count: 0 });

    const summary = await processOutreachFollowUpReminders(THURSDAY);

    expect(summary.followUp1Reminded).toBe(1);
    expect(summary.followUp2Reminded).toBe(0);
    expect(summary.skippedReason).toBeNull();
    // The stamp IS the claim: it must be scoped to the single lead and still require the
    // reminder window to be open, so two overlapping runs cannot both nudge JB.
    expect(M.igUpdateMany).toHaveBeenCalledWith({
      where: expect.objectContaining({
        id: "ig1",
        OR: [
          { followUp1LastRemindedAt: null },
          { followUp1LastRemindedAt: { lte: expect.any(Date) } },
        ],
      }),
      data: { followUp1LastRemindedAt: expect.any(Date) },
    });
    expect(M.fireAxon).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "follow_up_due",
        meta: { followUpStage: "follow_up_1" },
      }),
    );
  });

  it("skips a lead another concurrent run already claimed", async () => {
    M.igFindMany
      .mockResolvedValueOnce([{ id: "ig1", handle: "@coach", profileUrl: "https://ig/coach" }])
      .mockResolvedValueOnce([]);
    M.emFindMany.mockResolvedValue([]);
    // count 0 => the claiming UPDATE matched nothing, i.e. someone else stamped it first.
    M.igUpdateMany.mockResolvedValue({ count: 0 });
    M.emUpdateMany.mockResolvedValue({ count: 0 });

    const summary = await processOutreachFollowUpReminders(THURSDAY);

    expect(summary.total).toBe(0);
    expect(M.fireAxon).not.toHaveBeenCalled();
  });

  it("never chases a lead that already replied or is marked dead", async () => {
    M.igFindMany.mockResolvedValue([]);
    M.emFindMany.mockResolvedValue([]);

    await processOutreachFollowUpReminders(THURSDAY);

    expect(M.igFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          AND: expect.arrayContaining([
            expect.objectContaining({ hasUnrespondedReply: false, deadLeadAt: null }),
          ]),
        }),
      }),
    );
  });

  it("never chases a lead belonging to another venture", async () => {
    M.igFindMany.mockResolvedValue([]);
    M.emFindMany.mockResolvedValue([]);

    await processOutreachFollowUpReminders(THURSDAY);

    // An NI Services lead must never be picked up here: this cron sends on the Match Fit
    // Resend account, and NI mail goes out from the NI account instead.
    // The inner where carries its own OR (the reminder window), so match on the venture clause
    // itself rather than on "the first branch that happens to have an OR".
    const where = M.igFindMany.mock.calls[0][0].where as { AND: { OR?: Record<string, unknown>[] }[] };
    const scope = where.AND.find((c) => c.OR?.some((b) => "ventureId" in b));
    expect(scope?.OR).toEqual([
      { ventureId: null },
      { venture: { is: { slug: "match_fit" } } },
    ]);
  });

  it("does nothing (no AXON event) when no leads are due", async () => {
    M.igFindMany.mockResolvedValue([]);
    M.emFindMany.mockResolvedValue([]);

    const summary = await processOutreachFollowUpReminders(THURSDAY);

    expect(summary.total).toBe(0);
    expect(M.fireAxon).not.toHaveBeenCalled();
  });

  it("skips weekends entirely without stamping anything", async () => {
    // 2026-07-25 is a Saturday in America/New_York.
    const summary = await processOutreachFollowUpReminders(new Date("2026-07-25T16:00:00Z"));

    expect(summary.total).toBe(0);
    expect(summary.skippedReason).toContain("Weekend");
    expect(M.ensureSchema).not.toHaveBeenCalled();
    expect(M.igFindMany).not.toHaveBeenCalled();
    expect(M.igUpdateMany).not.toHaveBeenCalled();
    expect(M.fireAxon).not.toHaveBeenCalled();
  });

  it("skips Sunday too", async () => {
    // 2026-07-26 is a Sunday.
    const summary = await processOutreachFollowUpReminders(new Date("2026-07-26T16:00:00Z"));
    expect(summary.skippedReason).toContain("Weekend");
    expect(M.fireAxon).not.toHaveBeenCalled();
  });
});

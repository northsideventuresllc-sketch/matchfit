import { beforeEach, describe, expect, it, vi } from "vitest";

const M = vi.hoisted(() => ({
  ensureSchema: vi.fn(),
  batchFindFirst: vi.fn(),
  batchFindUnique: vi.fn(),
  batchCreate: vi.fn(),
  batchUpdate: vi.fn(),
  igFindUnique: vi.fn(),
  igUpdate: vi.fn(),
  igFindMany: vi.fn(),
  fbFindUnique: vi.fn(),
  fbUpdate: vi.fn(),
  fbFindMany: vi.fn(),
  emFindUnique: vi.fn(),
  emUpdate: vi.fn(),
  emFindMany: vi.fn(),
}));

vi.mock("@/lib/ensure-outreach-hub-schema", () => ({
  ensureOutreachHubSchema: M.ensureSchema,
  isMissingOutreachHubSchemaError: () => false,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    outreachCoworkDispatchBatch: {
      findFirst: M.batchFindFirst,
      findUnique: M.batchFindUnique,
      create: M.batchCreate,
      update: M.batchUpdate,
    },
    outreachInstagramLead: { findUnique: M.igFindUnique, update: M.igUpdate, findMany: M.igFindMany },
    outreachFacebookLead: { findUnique: M.fbFindUnique, update: M.fbUpdate, findMany: M.fbFindMany },
    outreachEmailLead: { findUnique: M.emFindUnique, update: M.emUpdate, findMany: M.emFindMany },
  },
}));

import {
  completeOutreachDispatchBatch,
  convertAgentSendToManual,
  pullOutreachDispatch,
  queueManualSend,
  queueOutreachDispatch,
  setManualSentState,
} from "@/lib/outreach-dispatch";

const SCHEDULED = new Date("2026-07-23T17:00:00Z");

beforeEach(() => {
  vi.clearAllMocks();
  M.ensureSchema.mockResolvedValue(undefined);
  for (const fm of [M.igFindMany, M.fbFindMany, M.emFindMany]) fm.mockResolvedValue([]);
  M.batchUpdate.mockResolvedValue({});
  M.igUpdate.mockResolvedValue({});
  M.fbUpdate.mockResolvedValue({});
  M.emUpdate.mockResolvedValue({});
});

describe("queueOutreachDispatch", () => {
  it("creates the next batch and flips leads to dispatch_queued, saving previous lane", async () => {
    M.batchFindFirst.mockResolvedValue(null);
    M.batchCreate.mockResolvedValue({ id: "batch1", slot: "13:00", scheduledFor: SCHEDULED });
    M.igFindUnique.mockResolvedValue({
      outreachLane: "today",
      dispatchBatchId: null,
      dispatchPreviousLane: null,
    });

    const now = new Date("2026-07-23T15:00:00Z");
    const result = await queueOutreachDispatch({
      leads: [{ id: "ig1", platform: "instagram" }],
      adminId: "admin1",
      now,
    });

    expect(result.batchId).toBe("batch1");
    expect(result.queued).toEqual(["ig1"]);
    expect(M.igUpdate).toHaveBeenCalledWith({
      where: { id: "ig1" },
      data: {
        outreachLane: "dispatch_queued",
        dispatchBatchId: "batch1",
        dispatchPreviousLane: "today",
        sendMode: "agent",
        manualSentAt: null,
      },
    });
  });

  it("skips leads already queued", async () => {
    M.batchFindFirst.mockResolvedValue({ id: "batch1", slot: "13:00", scheduledFor: SCHEDULED });
    M.igFindUnique.mockResolvedValue({
      outreachLane: "dispatch_queued",
      dispatchBatchId: "batch1",
      dispatchPreviousLane: "today",
    });

    const result = await queueOutreachDispatch({
      leads: [{ id: "ig1", platform: "instagram" }],
      adminId: "admin1",
      now: new Date("2026-07-23T15:00:00Z"),
    });

    expect(result.skipped).toEqual(["ig1"]);
    expect(result.queued).toEqual([]);
    expect(M.igUpdate).not.toHaveBeenCalled();
  });
});

describe("pullOutreachDispatch", () => {
  it("restores dispatchPreviousLane and clears the dispatch FK", async () => {
    M.igFindUnique.mockResolvedValue({
      id: "ig1",
      outreachLane: "dispatch_queued",
      dispatchBatchId: "batch1",
      dispatchPreviousLane: "past_due",
    });
    M.fbFindUnique.mockResolvedValue(null);
    M.emFindUnique.mockResolvedValue(null);
    M.batchFindUnique.mockResolvedValue({ id: "batch1", status: "queued", scheduledFor: SCHEDULED, slot: "13:00" });

    const result = await pullOutreachDispatch({ leadIds: ["ig1"] });

    expect(result.pulled).toEqual(["ig1"]);
    expect(M.igUpdate).toHaveBeenCalledWith({
      where: { id: "ig1" },
      data: { outreachLane: "past_due", dispatchBatchId: null, dispatchPreviousLane: null },
    });
  });
});

describe("queueManualSend", () => {
  it("flips a lead to dispatch_queued with sendMode manual and no batch", async () => {
    M.igFindUnique.mockResolvedValue({
      outreachLane: "today",
      dispatchBatchId: null,
      dispatchPreviousLane: null,
    });

    const result = await queueManualSend({ leads: [{ id: "ig1", platform: "instagram" }] });

    expect(result.queued).toEqual(["ig1"]);
    expect(M.igUpdate).toHaveBeenCalledWith({
      where: { id: "ig1" },
      data: {
        outreachLane: "dispatch_queued",
        dispatchBatchId: null,
        dispatchPreviousLane: "today",
        sendMode: "manual",
        manualSentAt: null,
      },
    });
  });

  it("skips leads already queued", async () => {
    M.igFindUnique.mockResolvedValue({
      outreachLane: "dispatch_queued",
      dispatchBatchId: "batch1",
      dispatchPreviousLane: "today",
    });

    const result = await queueManualSend({ leads: [{ id: "ig1", platform: "instagram" }] });

    expect(result.skipped).toEqual(["ig1"]);
    expect(M.igUpdate).not.toHaveBeenCalled();
  });
});

describe("convertAgentSendToManual", () => {
  it("clears the batch FK and flips sendMode to manual, keeping the lane", async () => {
    M.igFindUnique.mockResolvedValue({ id: "ig1", outreachLane: "dispatch_queued" });
    M.fbFindUnique.mockResolvedValue(null);
    M.emFindUnique.mockResolvedValue(null);
    M.batchFindUnique.mockResolvedValue({ id: "batch1", status: "queued", scheduledFor: SCHEDULED, slot: "13:00" });

    const result = await convertAgentSendToManual({ leadIds: ["ig1"] });

    expect(result.converted).toEqual(["ig1"]);
    expect(M.igUpdate).toHaveBeenCalledWith({
      where: { id: "ig1" },
      data: { dispatchBatchId: null, sendMode: "manual", manualSentAt: null },
    });
  });

  it("skips a lead that isn't in the dispatch_queued lane", async () => {
    M.igFindUnique.mockResolvedValue({ id: "ig1", outreachLane: "today" });
    M.fbFindUnique.mockResolvedValue(null);
    M.emFindUnique.mockResolvedValue(null);

    const result = await convertAgentSendToManual({ leadIds: ["ig1"] });

    expect(result.skipped).toEqual(["ig1"]);
    expect(M.igUpdate).not.toHaveBeenCalled();
  });
});

describe("setManualSentState", () => {
  it("marking sent moves the lead to follow_up_1 with FU1@48h and FU2@5d", async () => {
    M.igFindUnique.mockResolvedValue({ outreachLane: "dispatch_queued", dispatchBatchId: null, dispatchPreviousLane: "today" });
    const now = new Date("2026-07-23T12:00:00Z");

    const result = await setManualSentState({ id: "ig1", platform: "instagram", sent: true, now });

    expect(result).toEqual({ ok: true });
    const data = M.igUpdate.mock.calls[0][0].data;
    expect(data.status).toBe("OUTREACH_SENT");
    expect(data.outreachLane).toBe("follow_up_1");
    expect(data.sendMode).toBeNull();
    expect(data.followUp1DueAt.toISOString()).toBe("2026-07-25T12:00:00.000Z");
    expect(data.followUp2DueAt.toISOString()).toBe("2026-07-28T12:00:00.000Z");
  });

  it("marking not-sent only clears manualSentAt", async () => {
    M.emFindUnique.mockResolvedValue({ outreachLane: "dispatch_queued", dispatchBatchId: null, dispatchPreviousLane: "today" });

    const result = await setManualSentState({ id: "em1", platform: "email", sent: false });

    expect(result).toEqual({ ok: true });
    expect(M.emUpdate).toHaveBeenCalledWith({ where: { id: "em1" }, data: { manualSentAt: null } });
  });

  it("errors when the lead is not in the Send Queue", async () => {
    M.igFindUnique.mockResolvedValue({ outreachLane: "today", dispatchBatchId: null, dispatchPreviousLane: null });

    const result = await setManualSentState({ id: "ig1", platform: "instagram", sent: true });

    expect(result).toEqual({ ok: false, error: "Lead is not in the Send Queue." });
    expect(M.igUpdate).not.toHaveBeenCalled();
  });
});

describe("completeOutreachDispatchBatch", () => {
  it("sends: moves lead to follow_up_1 with FU1@48h and FU2@5d", async () => {
    M.batchFindUnique.mockResolvedValue({ id: "batch1" });
    M.igFindMany.mockResolvedValue([{ id: "ig1", dispatchPreviousLane: "today" }]);
    const now = new Date("2026-07-23T12:00:00Z");

    const result = await completeOutreachDispatchBatch({
      batchId: "batch1",
      results: [{ leadId: "ig1", status: "sent" }],
      now,
    });

    expect(result.sent).toBe(1);
    const data = M.igUpdate.mock.calls[0][0].data;
    expect(data.outreachLane).toBe("follow_up_1");
    expect(data.status).toBe("OUTREACH_SENT");
    expect(data.followUp1DueAt.toISOString()).toBe("2026-07-25T12:00:00.000Z");
    expect(data.followUp2DueAt.toISOString()).toBe("2026-07-28T12:00:00.000Z");
    expect(M.batchUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "complete" }) }),
    );
  });

  it("failed: reverts to dispatchPreviousLane", async () => {
    M.batchFindUnique.mockResolvedValue({ id: "batch1" });
    M.emFindMany.mockResolvedValue([{ id: "em1", dispatchPreviousLane: "today" }]);

    const result = await completeOutreachDispatchBatch({
      batchId: "batch1",
      results: [{ leadId: "em1", status: "failed", detail: "bounced" }],
      now: new Date("2026-07-23T12:00:00Z"),
    });

    expect(result.failed).toBe(1);
    expect(M.emUpdate).toHaveBeenCalledWith({
      where: { id: "em1" },
      data: { outreachLane: "today", dispatchBatchId: null, dispatchPreviousLane: null },
    });
  });

  it("throws when the batch is missing", async () => {
    M.batchFindUnique.mockResolvedValue(null);
    await expect(
      completeOutreachDispatchBatch({ batchId: "nope", results: [{ leadId: "x", status: "sent" }] }),
    ).rejects.toThrow("Dispatch batch not found.");
  });
});

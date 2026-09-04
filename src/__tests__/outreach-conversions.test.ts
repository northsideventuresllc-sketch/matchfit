import { beforeEach, describe, expect, it, vi } from "vitest";

const M = vi.hoisted(() => ({
  ensureSchema: vi.fn(),
  igFindUnique: vi.fn(),
  igFindMany: vi.fn(),
  igUpdate: vi.fn(),
  fbFindMany: vi.fn(),
  emFindMany: vi.fn(),
  touchFindMany: vi.fn(),
  touchCreate: vi.fn(),
}));

vi.mock("@/lib/ensure-outreach-hub-schema", () => ({
  ensureOutreachHubSchema: M.ensureSchema,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    outreachInstagramLead: { findUnique: M.igFindUnique, findMany: M.igFindMany, update: M.igUpdate },
    outreachFacebookLead: { findMany: M.fbFindMany },
    outreachEmailLead: { findMany: M.emFindMany },
    outreachLeadTouchLog: { findMany: M.touchFindMany, create: M.touchCreate },
  },
}));

import { listOutreachConvertedLeads, setOutreachLeadConversion } from "@/lib/outreach-conversions";

beforeEach(() => {
  vi.clearAllMocks();
  M.ensureSchema.mockResolvedValue(undefined);
  M.igUpdate.mockResolvedValue({});
  M.touchCreate.mockResolvedValue({});
  M.touchFindMany.mockResolvedValue([]);
  M.fbFindMany.mockResolvedValue([]);
  M.emFindMany.mockResolvedValue([]);
});

describe("setOutreachLeadConversion", () => {
  it("first call stamps convertedAt/convertedByAdminId, sets the converted lane, and backfills history", async () => {
    M.igFindUnique.mockResolvedValue({
      id: "ig1",
      convertedAt: null,
      outreachSentAt: new Date("2026-08-01T00:00:00Z"),
      followUp1SentAt: null,
      followUp2SentAt: null,
      dmText: "Hey!",
      commentText: "Nice!",
    });

    const result = await setOutreachLeadConversion({ platform: "instagram", id: "ig1", adminId: "admin1" });

    expect(result).toEqual({ ok: true });
    expect(M.igUpdate).toHaveBeenCalledWith({
      where: { id: "ig1" },
      data: expect.objectContaining({
        convertedAt: expect.any(Date),
        convertedByAdminId: "admin1",
        outreachLane: "converted",
      }),
    });
    // Backfill: one reconstructed row for the initial send (the only timestamp present).
    expect(M.touchCreate).toHaveBeenCalledTimes(1);
    expect(M.touchCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        platform: "instagram",
        leadId: "ig1",
        stage: "initial",
        sendMode: "unknown",
        reconstructed: true,
      }),
    });
  });

  it("is idempotent: a second call never re-stamps convertedAt, only updates the account link", async () => {
    M.igFindUnique.mockResolvedValue({
      id: "ig1",
      convertedAt: new Date("2026-08-01T00:00:00Z"),
      outreachSentAt: null,
      followUp1SentAt: null,
      followUp2SentAt: null,
    });

    const result = await setOutreachLeadConversion({
      platform: "instagram",
      id: "ig1",
      adminId: "admin1",
      matchedAccountType: "trainer",
      matchedAccountId: "trainer_9",
    });

    expect(result).toEqual({ ok: true });
    expect(M.igUpdate).toHaveBeenCalledWith({
      where: { id: "ig1" },
      data: { matchedAccountType: "trainer", matchedAccountId: "trainer_9" },
    });
    // No backfill on a lead that was already converted.
    expect(M.touchCreate).not.toHaveBeenCalled();
  });

  it("does not fabricate a touch when the lead has zero send timestamps", async () => {
    M.igFindUnique.mockResolvedValue({ id: "ig1", convertedAt: null, outreachSentAt: null, followUp1SentAt: null, followUp2SentAt: null });

    await setOutreachLeadConversion({ platform: "instagram", id: "ig1", adminId: "admin1" });

    expect(M.touchCreate).not.toHaveBeenCalled();
  });

  it("errors when the lead does not exist", async () => {
    M.igFindUnique.mockResolvedValue(null);
    const result = await setOutreachLeadConversion({ platform: "instagram", id: "ghost", adminId: "admin1" });
    expect(result).toEqual({ ok: false, error: "Lead not found." });
  });
});

describe("listOutreachConvertedLeads", () => {
  it("combines platforms, sorts newest-converted-first, and attaches grouped touch history", async () => {
    M.igFindMany.mockResolvedValue([
      {
        id: "ig1",
        handle: "@older",
        convertedAt: new Date("2026-08-01T00:00:00Z"),
        convertedByAdminId: "admin1",
        matchedAccountType: null,
        matchedAccountId: null,
        createdAt: new Date("2026-07-01T00:00:00Z"),
        status: "OUTREACH_SENT",
      },
      {
        id: "ig2",
        handle: "@newer",
        convertedAt: new Date("2026-08-05T00:00:00Z"),
        convertedByAdminId: "admin1",
        matchedAccountType: "trainer",
        matchedAccountId: "trainer_1",
        createdAt: new Date("2026-07-01T00:00:00Z"),
        status: "OUTREACH_SENT",
      },
    ]);
    M.touchFindMany.mockResolvedValue([
      {
        id: "t1",
        leadId: "ig1",
        platform: "instagram",
        stage: "initial",
        sentAt: new Date("2026-07-15T00:00:00Z"),
        sendMode: "manual",
        messageFields: [{ label: "First DM", text: "hi" }],
        dispatchBatchId: null,
        performedByAdminId: "admin1",
        reconstructed: false,
      },
    ]);

    const result = await listOutreachConvertedLeads();

    expect(result).toHaveLength(2);
    expect(result[0].lead.id).toBe("ig2"); // newest convertedAt first
    expect(result[1].lead.id).toBe("ig1");
    expect(result[1].touches).toHaveLength(1);
    expect(result[1].touches[0].messageFields).toEqual([{ label: "First DM", text: "hi" }]);
    expect(result[0].touches).toHaveLength(0);
  });
});

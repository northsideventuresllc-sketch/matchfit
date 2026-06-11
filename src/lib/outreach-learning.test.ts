import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockOutreachLearningSignalCreate, mockOutreachLearningSignalFindMany } = vi.hoisted(() => ({
  mockOutreachLearningSignalCreate: vi.fn(),
  mockOutreachLearningSignalFindMany: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    outreachLearningSignal: {
      create: mockOutreachLearningSignalCreate,
      findMany: mockOutreachLearningSignalFindMany,
    },
  },
}));

vi.mock("@/lib/outreach-ni-brain-learning", () => ({
  recordOutreachNiBrainLearning: vi.fn(),
  fetchRecentOutreachNiBrainLearnings: vi.fn().mockResolvedValue([]),
}));

import {
  buildOutreachLearningContext,
  recordOutreachEditSignal,
  recordOutreachOutcomeSignal,
} from "@/lib/outreach-learning";

const ADMIN_ID = "admin_test_123";

describe("outreach-learning helpers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockOutreachLearningSignalCreate.mockResolvedValue(undefined);
    mockOutreachLearningSignalFindMany.mockResolvedValue([]);
  });

  it("does not persist edit signals when the trimmed text is unchanged", async () => {
    await recordOutreachEditSignal({
      platform: "instagram",
      leadId: "lead_1",
      adminId: ADMIN_ID,
      field: "dmText",
      originalText: "  Keep this CTA.  ",
      editedText: "Keep this CTA.",
    });

    expect(mockOutreachLearningSignalCreate).not.toHaveBeenCalled();
  });

  it("stores edit signals with bounded text length, field metadata, and admin id", async () => {
    await recordOutreachEditSignal({
      platform: "email",
      leadId: "lead_2",
      adminId: ADMIN_ID,
      field: "emailBody",
      originalText: "o".repeat(8100),
      editedText: "e".repeat(8200),
    });

    expect(mockOutreachLearningSignalCreate).toHaveBeenCalledWith({
      data: {
        platform: "email",
        signalType: "EDIT_DIFF",
        leadId: "lead_2",
        adminId: ADMIN_ID,
        originalText: "o".repeat(8000),
        editedText: "e".repeat(8000),
        metaJson: JSON.stringify({ field: "emailBody" }),
      },
    });
  });

  it("stores outcome signals with optional notes metadata", async () => {
    await recordOutreachOutcomeSignal({
      platform: "facebook",
      leadId: "lead_3",
      adminId: ADMIN_ID,
      outcome: "negative",
      notes: "Asked to be removed.",
    });

    expect(mockOutreachLearningSignalCreate).toHaveBeenCalledWith({
      data: {
        platform: "facebook",
        signalType: "OUTCOME",
        leadId: "lead_3",
        adminId: ADMIN_ID,
        outcome: "negative",
        metaJson: JSON.stringify({ notes: "Asked to be removed." }),
      },
    });
  });

  it("builds a learning summary with outcome counts and recent edits for the admin", async () => {
    mockOutreachLearningSignalFindMany
      .mockResolvedValueOnce([
        {
          originalText: "Old opener",
          editedText: "  New message tone with personalization for coaches and longer spacing.  ",
          metaJson: JSON.stringify({ field: "dmText" }),
        },
      ])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        { outcome: "positive", leadId: "lead_a" },
        { outcome: "negative", leadId: "lead_b" },
        { outcome: "no_response", leadId: "lead_c" },
      ]);

    const summary = await buildOutreachLearningContext("instagram", ADMIN_ID);

    expect(summary).toContain("Learning summary for instagram");
    expect(summary).toContain(ADMIN_ID.slice(0, 6));
    expect(summary).toContain("1 positive, 1 negative, 1 no response");
    expect(summary).toContain('Operator edited dmText — prefer tone closer to: "New message tone');
    expect(summary).toContain("IG DMs under 1,000 characters");
    expect(mockOutreachLearningSignalFindMany).toHaveBeenCalled();
  });

  it("returns fallback guidance when learning context query fails", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    mockOutreachLearningSignalFindMany.mockRejectedValueOnce(new Error("db down"));

    const summary = await buildOutreachLearningContext("facebook", ADMIN_ID);

    expect(summary).toContain("Learning summary for facebook:");
    expect(summary).toContain("No recent copy edits logged yet.");
    expect(summary).toContain("Personalize the opening hook every time");
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });
});

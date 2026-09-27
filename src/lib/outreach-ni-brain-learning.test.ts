import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockInsert, mockFrom, mockIsNiBrainConfigured } = vi.hoisted(() => ({
  mockInsert: vi.fn(),
  mockFrom: vi.fn(),
  mockIsNiBrainConfigured: vi.fn(),
}));

vi.mock("@/lib/ni-brain-client", () => ({
  isNiBrainConfigured: mockIsNiBrainConfigured,
  createNiBrainClient: () => ({ from: mockFrom }),
}));

import { recordOutreachNiBrainLearning } from "@/lib/outreach-ni-brain-learning";

/** Builds a `.from()` stub whose `.select().eq()...` chain resolves to `signalRows`. */
function tableStub(signalRows: { meta_json: { field?: string } | null; created_at: string }[]) {
  const chain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue({ data: signalRows }),
  };
  return chain;
}

describe("recordOutreachNiBrainLearning EDIT_DIFF dedup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsNiBrainConfigured.mockReturnValue(true);
    mockInsert.mockResolvedValue({ data: null, error: null });
  });

  it("promotes a durable Learning on the first edit for a lead+field", async () => {
    const signalChain = tableStub([
      // Only the row this call itself just inserted into match_fit_outreach_learning_signals.
      { meta_json: { field: "emailBody" }, created_at: new Date().toISOString() },
    ]);
    mockFrom.mockImplementation((table: string) => {
      if (table === "match_fit_outreach_learning_signals") {
        return { insert: mockInsert, ...signalChain };
      }
      return { insert: mockInsert };
    });

    await recordOutreachNiBrainLearning({
      signalType: "EDIT_DIFF",
      platform: "email",
      leadId: "lead_1",
      adminId: "admin_1",
      originalText: "Hi there.",
      editedText: "Hey Cory, we found your page.",
      meta: { field: "emailBody" },
    });

    const learningsInsert = mockInsert.mock.calls.find(([payload]) =>
      String(payload?.learning ?? "").startsWith("Match Fit outreach edit"),
    );
    expect(learningsInsert).toBeDefined();
  });

  it("does not promote a second Learning for the same lead+field inside the dedup window", async () => {
    const now = new Date();
    const signalChain = tableStub([
      { meta_json: { field: "emailBody" }, created_at: now.toISOString() },
      { meta_json: { field: "emailBody" }, created_at: new Date(now.getTime() - 60_000).toISOString() },
    ]);
    mockFrom.mockImplementation((table: string) => {
      if (table === "match_fit_outreach_learning_signals") {
        return { insert: mockInsert, ...signalChain };
      }
      return { insert: mockInsert };
    });

    await recordOutreachNiBrainLearning({
      signalType: "EDIT_DIFF",
      platform: "email",
      leadId: "lead_1",
      adminId: "admin_1",
      originalText: "Hey Cory, we found your pag",
      editedText: "Hey Cory, we found your page.",
      meta: { field: "emailBody" },
    });

    const learningsInsert = mockInsert.mock.calls.find(([payload]) =>
      String(payload?.learning ?? "").startsWith("Match Fit outreach edit"),
    );
    expect(learningsInsert).toBeUndefined();
    // The raw per-edit audit signal still records every time, unthrottled.
    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({ signal_type: "EDIT_DIFF", lead_id: "lead_1" }),
    );
  });

  it("still promotes a Learning for a different field on the same lead", async () => {
    const signalChain = tableStub([
      { meta_json: { field: "dmText" }, created_at: new Date().toISOString() },
    ]);
    mockFrom.mockImplementation((table: string) => {
      if (table === "match_fit_outreach_learning_signals") {
        return { insert: mockInsert, ...signalChain };
      }
      return { insert: mockInsert };
    });

    await recordOutreachNiBrainLearning({
      signalType: "EDIT_DIFF",
      platform: "instagram",
      leadId: "lead_1",
      adminId: "admin_1",
      originalText: "Old dm",
      editedText: "New dm",
      meta: { field: "dmText" },
    });

    const learningsInsert = mockInsert.mock.calls.find(([payload]) =>
      String(payload?.learning ?? "").startsWith("Match Fit outreach edit"),
    );
    expect(learningsInsert).toBeDefined();
  });
});

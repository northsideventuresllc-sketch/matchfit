import { beforeEach, describe, expect, it, vi } from "vitest";

const M = vi.hoisted(() => ({
  touchCreate: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    outreachLeadTouchLog: { create: M.touchCreate },
  },
}));

import {
  recordOutreachTouch,
  snapshotMessageFieldsForTouch,
  stageForPreviousLane,
} from "@/lib/outreach-touch-log";

beforeEach(() => {
  vi.clearAllMocks();
  M.touchCreate.mockResolvedValue({});
});

describe("stageForPreviousLane", () => {
  it("maps a reply completion (queued from Pending Responses) to reply", () => {
    expect(stageForPreviousLane("pending_response")).toBe("reply");
  });
  it("maps follow_up_1/follow_up_2 lanes to their own stage", () => {
    expect(stageForPreviousLane("follow_up_1")).toBe("follow_up_1");
    expect(stageForPreviousLane("follow_up_2")).toBe("follow_up_2");
  });
  it("maps everything else (today/past_due/pending/null) to the initial send", () => {
    expect(stageForPreviousLane("today")).toBe("initial");
    expect(stageForPreviousLane("past_due")).toBe("initial");
    expect(stageForPreviousLane("pending")).toBe("initial");
    expect(stageForPreviousLane(null)).toBe("initial");
  });
});

describe("snapshotMessageFieldsForTouch", () => {
  it("Instagram initial send: DM + comment", () => {
    const fields = snapshotMessageFieldsForTouch("instagram", "initial", {
      dmText: "Hey there",
      commentText: "Nice post!",
    });
    expect(fields).toEqual([
      { label: "First DM", text: "Hey there" },
      { label: "Comment", text: "Nice post!" },
    ]);
  });

  it("Instagram follow-up 1 uses the follow-up DM text only", () => {
    const fields = snapshotMessageFieldsForTouch("instagram", "follow_up_1", {
      dmText: "primary dm",
      followUp1DmText: "checking in",
    });
    expect(fields).toEqual([{ label: "First follow-up DM", text: "checking in" }]);
  });

  it("a reply stage uses the pendingResponseDraft, ignoring outbound copy fields", () => {
    const fields = snapshotMessageFieldsForTouch("email", "reply", {
      emailSubject: "Subject",
      emailBody: "Body",
      pendingResponseDraft: "Thanks for reaching out!",
    });
    expect(fields).toEqual([{ label: "Reply", text: "Thanks for reaching out!" }]);
  });

  it("a reply stage with no draft returns an empty list (nothing fabricated)", () => {
    expect(snapshotMessageFieldsForTouch("email", "reply", { pendingResponseDraft: null })).toEqual([]);
  });

  it("Facebook always uses the page post text regardless of stage", () => {
    const fields = snapshotMessageFieldsForTouch("facebook", "initial", { pagePostText: "Join our group!" });
    expect(fields).toEqual([{ label: "Page post", text: "Join our group!" }]);
  });

  it("Email follow-up 2 uses the second follow-up subject + body", () => {
    const fields = snapshotMessageFieldsForTouch("email", "follow_up_2", {
      followUp2EmailSubject: "Still interested?",
      followUp2EmailBody: "Last check-in.",
    });
    expect(fields).toEqual([
      { label: "Second follow-up subject", text: "Still interested?" },
      { label: "Second follow-up email", text: "Last check-in." },
    ]);
  });

  it("skips fields that are missing or empty rather than emitting blank text", () => {
    expect(snapshotMessageFieldsForTouch("instagram", "initial", { dmText: "", commentText: null })).toEqual([]);
  });
});

describe("recordOutreachTouch", () => {
  it("writes a row with the literal sendMode passed in, never reading it off the lead row", async () => {
    const sentAt = new Date("2026-09-04T12:00:00Z");
    await recordOutreachTouch({
      platform: "instagram",
      leadId: "ig1",
      stage: "initial",
      sentAt,
      sendMode: "agent",
      messageFields: [{ label: "First DM", text: "hi" }],
      dispatchBatchId: "batch1",
    });

    expect(M.touchCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        platform: "instagram",
        leadId: "ig1",
        stage: "initial",
        sentAt,
        sendMode: "agent",
        dispatchBatchId: "batch1",
        performedByAdminId: null,
        reconstructed: false,
      }),
    });
  });

  it("does nothing when there is no message text to log", async () => {
    await recordOutreachTouch({
      platform: "email",
      leadId: "em1",
      stage: "reply",
      sentAt: new Date(),
      sendMode: "manual",
      messageFields: [],
    });
    expect(M.touchCreate).not.toHaveBeenCalled();
  });

  it("swallows a write failure instead of throwing (a logging failure must never break a completed send)", async () => {
    M.touchCreate.mockRejectedValue(new Error("db down"));
    await expect(
      recordOutreachTouch({
        platform: "instagram",
        leadId: "ig1",
        stage: "initial",
        sentAt: new Date(),
        sendMode: "manual",
        messageFields: [{ label: "First DM", text: "hi" }],
      }),
    ).resolves.toBeUndefined();
  });
});

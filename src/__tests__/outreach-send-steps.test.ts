import { beforeEach, describe, expect, it, vi } from "vitest";

const M = vi.hoisted(() => ({
  queueMiniChromeAgentJob: vi.fn(),
  setManualSentState: vi.fn(),
}));

vi.mock("@/lib/content-calendar/cowork-jobs", () => ({
  queueMiniChromeAgentJob: M.queueMiniChromeAgentJob,
}));

vi.mock("@/lib/outreach-dispatch", () => ({
  setManualSentState: M.setManualSentState,
}));

import {
  assertSendAllowed,
  planSendStep,
  queueInstagramSendStep,
  recordManualSend,
  resendAccountEnvKey,
  resendAccountFromAddress,
} from "@/lib/outreach-send-steps";

beforeEach(() => {
  vi.clearAllMocks();
  delete process.env.OUTREACH_TEST_RECIPIENTS;
});

describe("assertSendAllowed — approve-only gate", () => {
  const WEEKDAY = new Date("2026-09-09T15:00:00Z"); // Wednesday ET
  const SATURDAY = new Date("2026-09-12T15:00:00Z"); // Saturday ET

  it("blocks a lead that has not been approved (not in dispatch_queued)", () => {
    const result = assertSendAllowed({ outreachLane: "today" }, WEEKDAY);
    expect(result).toEqual({
      allowed: false,
      reason: "Lead is not approved for send (not in the send queue).",
    });
  });

  it("blocks a send on a weekend even when approved", () => {
    const result = assertSendAllowed({ outreachLane: "dispatch_queued" }, SATURDAY);
    expect(result).toEqual({
      allowed: false,
      reason: "Outreach only sends on weekdays (America/New_York).",
    });
  });

  it("allows an approved weekday send with no recipient asserted", () => {
    expect(assertSendAllowed({ outreachLane: "dispatch_queued" }, WEEKDAY)).toEqual({ allowed: true });
  });

  it("blocks a fabricated recipient not on OUTREACH_TEST_RECIPIENTS when a recipient is asserted", () => {
    process.env.OUTREACH_TEST_RECIPIENTS = "jb@match-fit.net, jb@northsideintelligence.com";
    const result = assertSendAllowed(
      { outreachLane: "dispatch_queued", recipient: "made-up-lead@example.com" },
      WEEKDAY,
    );
    expect(result.allowed).toBe(false);
  });

  it("allows a recipient listed in OUTREACH_TEST_RECIPIENTS (JB's own account)", () => {
    process.env.OUTREACH_TEST_RECIPIENTS = "jb@match-fit.net";
    const result = assertSendAllowed(
      { outreachLane: "dispatch_queued", recipient: "JB@Match-Fit.net" },
      WEEKDAY,
    );
    expect(result).toEqual({ allowed: true });
  });
});

describe("planSendStep — venture -> account / executor mapping", () => {
  it("routes email through Resend on the Match Fit account by default (unassigned reads as Match Fit)", () => {
    expect(planSendStep({ platform: "email" })).toEqual({
      channel: "email",
      executor: "resend",
      account: "match_fit",
    });
  });

  it("routes email through Resend on the NI account for ni_services leads", () => {
    expect(planSendStep({ platform: "email" }, "ni_services")).toEqual({
      channel: "email",
      executor: "resend",
      account: "ni",
    });
  });

  it("routes Instagram to the mini (Chrome/desktop control), never Resend, regardless of venture", () => {
    expect(planSendStep({ platform: "instagram" }, "ni_services")).toEqual({
      channel: "instagram",
      executor: "mini_chrome",
      account: "ni",
    });
  });

  it("maps accounts to the correct Resend API key env var", () => {
    expect(resendAccountEnvKey("match_fit")).toBe("RESEND_API_KEY");
    expect(resendAccountEnvKey("ni")).toBe("RESEND_API_KEY_NI");
  });

  it("maps accounts to the correct from address", () => {
    expect(resendAccountFromAddress("match_fit")).toBe("jb@match-fit.net");
    expect(resendAccountFromAddress("ni")).toBe("jb@northsideintelligence.com");
  });
});

describe("queueInstagramSendStep — Instagram queues a mini job, never sends", () => {
  it("queues a mini Chrome job for the lead instead of calling any send API", async () => {
    M.queueMiniChromeAgentJob.mockResolvedValue(undefined);

    await queueInstagramSendStep({ id: "ig1", handle: "@coach_jane" });

    expect(M.queueMiniChromeAgentJob).toHaveBeenCalledTimes(1);
    expect(M.queueMiniChromeAgentJob).toHaveBeenCalledWith({
      ids: ["ig1"],
      title: "Outreach Instagram DM — @coach_jane",
    });
  });
});

describe("recordManualSend — JB's manual sends reported back", () => {
  it("records the send via the same lane-advance + touch-log path as an automated send, with the note attached", async () => {
    M.setManualSentState.mockResolvedValue({ ok: true });
    const sentAt = new Date("2026-09-09T18:00:00Z");

    const result = await recordManualSend("em1", "email", sentAt, "Sent from my phone at lunch.");

    expect(result).toEqual({ ok: true });
    expect(M.setManualSentState).toHaveBeenCalledWith({
      id: "em1",
      platform: "email",
      sent: true,
      now: sentAt,
      note: "Sent from my phone at lunch.",
    });
  });

  it("propagates a failure from the underlying lane-advance (e.g. lead not in the send queue)", async () => {
    M.setManualSentState.mockResolvedValue({ ok: false, error: "Lead is not in the Send Queue." });

    const result = await recordManualSend("em2", "email", new Date());

    expect(result).toEqual({ ok: false, error: "Lead is not in the Send Queue." });
  });
});

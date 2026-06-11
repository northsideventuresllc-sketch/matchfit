import { describe, expect, it } from "vitest";
import { classifyBackgroundCheckQueueEntry } from "@/lib/admin-background-checks-panel";

describe("classifyBackgroundCheckQueueEntry", () => {
  const base = {
    backgroundCheckStatus: "PENDING",
    inviteRequestedAt: null as string | null,
    inviteSentAt: null as string | null,
    checkrCandidateId: null as string | null,
    planBActive: true,
    hasPaidBackgroundFee: true,
  };

  it("flags Plan B manual queue when invite requested but not sent", () => {
    expect(
      classifyBackgroundCheckQueueEntry({
        ...base,
        inviteRequestedAt: "2026-06-10T12:00:00.000Z",
        inviteSentAt: null,
      }),
    ).toBe("awaiting_manual_invite");
  });

  it("classifies automated invite when API sent at request time", () => {
    const at = "2026-06-10T12:00:00.000Z";
    expect(
      classifyBackgroundCheckQueueEntry({
        ...base,
        inviteRequestedAt: at,
        inviteSentAt: at,
        checkrCandidateId: "cand_123",
      }),
    ).toBe("automated_invite_sent");
  });

  it("classifies manual invite when staff confirmed later", () => {
    expect(
      classifyBackgroundCheckQueueEntry({
        ...base,
        inviteRequestedAt: "2026-06-10T12:00:00.000Z",
        inviteSentAt: "2026-06-11T09:00:00.000Z",
        checkrCandidateId: null,
      }),
    ).toBe("manual_invite_sent");
  });

  it("classifies Plan A pending when paid without invite timestamps", () => {
    expect(
      classifyBackgroundCheckQueueEntry({
        ...base,
        planBActive: false,
        hasPaidBackgroundFee: true,
        backgroundCheckStatus: "PENDING",
      }),
    ).toBe("plan_a_pending");
  });

  it("returns approved for cleared trainers", () => {
    expect(
      classifyBackgroundCheckQueueEntry({
        ...base,
        backgroundCheckStatus: "APPROVED",
      }),
    ).toBe("approved");
  });
});
